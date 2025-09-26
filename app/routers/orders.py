# app/routers/vendor.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional

from pydantic import BaseModel, conint
from sqlmodel import select
from ..database import get_session
from ..models import PurchaseOrder, PurchaseItem, Product, AuditLog, User
from ..schemas import PurchaseOrderCreate, PurchaseOrderRead, PurchaseItemRead
from ..deps import require_roles, get_current_user
from ..models import Role
from sqlmodel import Session
from datetime import datetime
import os
import requests
import json
import time

router = APIRouter(prefix="/api/vendor", tags=["vendor"])

# --- Payment configuration (env override) ---------------------------------
PAYMENT_ENABLED = os.getenv("PAYMENT_ENABLED", "true").lower() in ("1", "true", "yes")
PHONEPE_CLIENT_ID = os.getenv("PHONEPE_CLIENT_ID", "TEST-M23AZS78T1O0V_25091")
PHONEPE_CLIENT_SECRET = os.getenv("PHONEPE_CLIENT_SECRET", "YmQyNzFiM2MtYWE0ZS00NjNkLWFlNWItMGFjMTE5OGYzMjYz")
PHONEPE_OAUTH_URL = os.getenv("PHONEPE_OAUTH_URL", "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token")
PHONEPE_PAY_URL = os.getenv("PHONEPE_PAY_URL", "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay")
PHONEPE_STATUS_BASE = os.getenv("PHONEPE_STATUS_BASE", "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order")
# Optional fixed merchantOrderId (for testing). If set, will be used instead of generated id.
PAYMENT_MERCHANT_ORDER_ID = os.getenv("PAYMENT_MERCHANT_ORDER_ID", None)
# multiplier (e.g. to convert rupee->paise)
PAYMENT_AMOUNT_MULTIPLIER = int(os.getenv("PAYMENT_AMOUNT_MULTIPLIER", "100"))
# redirect on payment complete
PAYMENT_REDIRECT_URL = os.getenv("PAYMENT_REDIRECT_URL", "https://your-frontend.example.com/payment-callback")

# simple in-memory token cache
_token_cache = {"token": None, "expires_at": 0}


# -------------------- helpers: PhonePe token / API -------------------------
def _get_phonepe_token():
    """
    Obtain OAuth token from PhonePe sandbox. Returns token string.
    Uses simple in-memory caching for expires_in.
    """
    global _token_cache
    now = int(time.time())
    if _token_cache.get("token") and _token_cache.get("expires_at", 0) > now + 5:
        return _token_cache["token"]

    data = {
        "client_id": PHONEPE_CLIENT_ID,
        "client_version": "1",
        "client_secret": PHONEPE_CLIENT_SECRET,
        "grant_type": "client_credentials",
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    try:
        resp = requests.post(PHONEPE_OAUTH_URL, data=data, headers=headers, timeout=10)
        resp.raise_for_status()
        j = resp.json()
        token = j.get("access_token")
        expires_in = int(j.get("expires_in", 3600))
        _token_cache["token"] = token
        _token_cache["expires_at"] = now + expires_in
        return token
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Payment token request failed: {e}")


def _create_phonepe_payment(merchant_order_id: str, amount: int, meta: dict, redirect_url: str):
    """
    Create a PhonePe checkout order and return the JSON response.
    amount is in smallest currency unit (paise).
    """
    token = _get_phonepe_token()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"O-Bearer {token}",
    }
    payload = {
        "merchantOrderId": merchant_order_id,
        "amount": amount,
        "expireAfter": 1200,
        "metaInfo": meta or {},
        "paymentFlow": {
            "type": "PG_CHECKOUT",
            "message": "Payment message",
            "merchantUrls": {"redirectUrl": redirect_url},
        },
    }
    try:
        resp = requests.post(PHONEPE_PAY_URL, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Payment create failed: {e}")


def _phonepe_check_status_by_merchant_order(merchant_order_id: str):
    """
    Call PhonePe status endpoint for given merchantOrderId.
    Endpoint: {PHONEPE_STATUS_BASE}/{merchantOrderId}/status
    """
    token = _get_phonepe_token()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"O-Bearer {token}",
    }
    url = f"{PHONEPE_STATUS_BASE}/{merchant_order_id}/status"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Payment status request failed: {e}")


def _get_product_and_price(session: Session, product_id: int):
    prod = session.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=400, detail=f"Product id {product_id} not found")
    price = float(getattr(prod, "price", 0.0) or 0.0)
    return prod, price


# -------------------- PO helpers ------------------------------------------
def _get_po_response(session: Session, po: PurchaseOrder) -> PurchaseOrderRead:
    stmt = select(PurchaseItem).where(PurchaseItem.purchase_order_id == po.id)
    items = session.exec(stmt).all()
    items_read = [PurchaseItemRead(id=i.id, product_id=i.product_id, qty=i.qty, unit_price=i.unit_price) for i in items]
    po_read = PurchaseOrderRead(
        id=po.id,
        vendor_id=po.vendor_id,
        created_by=po.created_by,
        status=po.status,
        total=po.total,
        expected_date=po.expected_date,
        created_at=po.created_at,
        items=items_read,
    )
    return po_read


# -------------------- endpoints -------------------------------------------
@router.post("/orders", status_code=201, response_model=PurchaseOrderRead)
def vendor_create_order(payload: PurchaseOrderCreate, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.VENDOR))):
    """
    Vendor places an order. Vendor identity taken from JWT (user.id).
    If PAYMENT_ENABLED is true, a PhonePe checkout order is created and its redirectUrl
    is stored in AuditLog meta (including merchantOrderId). Response includes payment info.
    """
    vendor_id = user.id

    # create skeleton PO
    po = PurchaseOrder(
        vendor_id=vendor_id,
        created_by=user.id,
        status="placed",
        total=0.0,
        expected_date=payload.expected_date,
        created_at=datetime.utcnow(),
    )
    session.add(po)
    session.commit()
    session.refresh(po)

    # insert items using master product price (ignore client-sent price)
    total = 0.0
    for it in payload.items:
        _, price = _get_product_and_price(session, it.product_id)
        pi = PurchaseItem(purchase_order_id=po.id, product_id=it.product_id, qty=it.qty, unit_price=price)
        total += float(it.qty) * price
        session.add(pi)

    po.total = total
    session.add(po)

    # audit: po created
    session.add(AuditLog(user_id=user.id, action="create_po", meta=f"po:{po.id},vendor:{vendor_id},total:{total}"))

    session.commit()
    session.refresh(po)

    # PAYMENT (optional)
    payment_info = None
    if PAYMENT_ENABLED:
        # merchant_order_id from env if set else generated
        merchant_order_id = PAYMENT_MERCHANT_ORDER_ID or f"PO{po.id}-{int(datetime.utcnow().timestamp())}"
        amount_int = int(round(po.total * PAYMENT_AMOUNT_MULTIPLIER))
        meta = {"po_id": str(po.id), "vendor_id": str(vendor_id)}
        redirect_url = PAYMENT_REDIRECT_URL

        pay_resp = _create_phonepe_payment(merchant_order_id=merchant_order_id, amount=amount_int, meta=meta, redirect_url=redirect_url)

        # Store merchantOrderId + response in audit log for later status checks
        audit_meta = {"merchantOrderId": merchant_order_id, "phonepe_response": pay_resp}
        session.add(AuditLog(user_id=user.id, action="create_payment", meta=json.dumps(audit_meta)))
        session.commit()

        payment_info = {
            "merchantOrderId": merchant_order_id,
            "amount": amount_int,
            "orderId": pay_resp.get("orderId"),
            "state": pay_resp.get("state"),
            "redirectUrl": pay_resp.get("redirectUrl"),
            "raw": pay_resp,
        }
        po.status = "pending_payment"
        session.add(po)
        session.commit()
        session.refresh(po)

    po_with_items = _get_po_response(session, po)
    resp = po_with_items.dict() if hasattr(po_with_items, "dict") else po_with_items
    if payment_info:
        resp = dict(resp)
        resp["payment"] = payment_info
    return resp


@router.get("/orders/me", response_model=List[PurchaseOrderRead])
def vendor_list_orders(session: Session = Depends(get_session), user: User = Depends(require_roles(Role.VENDOR))):
    stmt = select(PurchaseOrder).where(PurchaseOrder.vendor_id == user.id).order_by(PurchaseOrder.created_at.desc())
    pos = session.exec(stmt).all()
    return [ _get_po_response(session, p) for p in pos ]


@router.get("/orders/{po_id}/payment-status")
def check_and_sync_payment_status(
    po_id: int,
    merchant_order_id: Optional[str] = Query(None, description="Optional merchantOrderId (if you have it)."),
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.VENDOR)),
):
    """
    Check PhonePe payment status for a given PO and also update PurchaseOrder.status.
    - If merchant_order_id provided, use it.
    - Otherwise find merchantOrderId from audit logs.
    - Updates PurchaseOrder.status:
        COMPLETED -> paid
        PENDING   -> pending_payment
        FAILED    -> payment_failed
        Others    -> payment_<state_lower>
    - Returns both gateway status + updated PO info.
    """
    # verify PO belongs to vendor
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.vendor_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    moid = merchant_order_id

    # search AuditLog if merchant_order_id not provided
    if not moid:
        stmt = select(AuditLog).where(
            AuditLog.user_id == user.id,
            AuditLog.action.in_(["create_payment", "create_payment_regen"])
        ).order_by(AuditLog.id.desc())
        logs = session.exec(stmt).all()
        for log in logs:
            try:
                meta = json.loads(log.meta)
            except Exception:
                continue
            if isinstance(meta, dict):
                if "merchantOrderId" in meta:
                    moid = meta["merchantOrderId"]
                    break
                if "phonepe_response" in meta and isinstance(meta["phonepe_response"], dict):
                    nested = meta["phonepe_response"]
                    moid = nested.get("merchantOrderId") or nested.get("merchantOrderID") or nested.get("merchantOrder")
                    if moid:
                        break

    if not moid:
        raise HTTPException(status_code=404, detail="merchantOrderId not found. Provide it explicitly or ensure payment was created.")

    # call PhonePe status endpoint
    status_resp = _phonepe_check_status_by_merchant_order(moid)
    state = status_resp.get("state")

    # map state to PO.status
    if state == "COMPLETED":
        po.status = "paid"
    elif state == "FAILED":
        po.status = "payment_failed"
    elif state == "PENDING":
        po.status = "pending_payment"
    else:
        po.status = f"payment_{str(state).lower()}" if state else po.status

    try:
        session.add(po)
        session.add(AuditLog(
            user_id=user.id,
            action="payment_status_sync",
            meta=json.dumps({"po_id": po.id, "merchantOrderId": moid, "gateway_state": state, "raw": status_resp})
        ))
        session.commit()
        session.refresh(po)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update PO status: {e}")

    return {
        "po_id": po.id,
        "merchantOrderId": moid,
        "gateway_state": state,
        "updated_status": po.status,
        "gateway_raw": status_resp,
    }



@router.post("/orders/{po_id}/regenerate-payment")
def regenerate_payment_for_po(
    po_id: int,
    redirect_url: Optional[str] = None,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.VENDOR))
):
    """
    Regenerate PhonePe checkout for existing PO and return redirectUrl.
    - Uses PAYMENT_MERCHANT_ORDER_ID env if set; otherwise generates unique merchantOrderId.
    - Stores payment raw response in AuditLog (create_payment_regen).
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po.vendor_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if not PAYMENT_ENABLED:
        raise HTTPException(status_code=400, detail="Payment disabled on server")

    merchant_order_id = PAYMENT_MERCHANT_ORDER_ID or f"PO{po.id}-{int(datetime.utcnow().timestamp())}"
    amount_int = int(round(po.total * PAYMENT_AMOUNT_MULTIPLIER))
    meta = {"po_id": str(po.id), "vendor_id": str(user.id)}
    redirect = redirect_url or PAYMENT_REDIRECT_URL

    pay_resp = _create_phonepe_payment(merchant_order_id=merchant_order_id, amount=amount_int, meta=meta, redirect_url=redirect)

    # persist audit log
    try:
        audit_meta = {"merchantOrderId": merchant_order_id, "phonepe_response": pay_resp}
        session.add(AuditLog(user_id=user.id, action="create_payment_regen", meta=json.dumps(audit_meta)))
        session.commit()
    except Exception:
        session.rollback()

    return {"merchantOrderId": merchant_order_id, "redirectUrl": pay_resp.get("redirectUrl"), "raw": pay_resp}


@router.post("/orders/{po_id}/sync-payment-status")
def sync_payment_status(
    po_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.VENDOR)),
):
    """
    Check PhonePe status for given PO and update PurchaseOrder.status accordingly.
    Mapping:
      - COMPLETED -> paid
      - PENDING   -> pending_payment
      - FAILED    -> payment_failed
      - others    -> payment_<state_lower>
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.vendor_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # find merchantOrderId from latest create_payment / create_payment_regen audit logs
    stmt = select(AuditLog).where(AuditLog.user_id == user.id, AuditLog.action.in_(["create_payment", "create_payment_regen"])).order_by(AuditLog.id.desc())
    logs = session.exec(stmt).all()
    merchant_order_id = None
    for log in logs:
        try:
            meta = json.loads(log.meta)
        except Exception:
            continue
        if isinstance(meta, dict):
            if "merchantOrderId" in meta:
                merchant_order_id = meta["merchantOrderId"]
                break
            if "phonepe_response" in meta and isinstance(meta["phonepe_response"], dict):
                nested = meta["phonepe_response"]
                merchant_order_id = nested.get("merchantOrderId") or nested.get("merchantOrderID") or nested.get("merchantOrder")
                if merchant_order_id:
                    break

    if not merchant_order_id:
        raise HTTPException(status_code=404, detail="No merchantOrderId found for this PO. Create payment first or provide merchantOrderId.")

    # call PhonePe status
    status_resp = _phonepe_check_status_by_merchant_order(merchant_order_id)
    state = status_resp.get("state")

    # map state to PO.status
    if state == "COMPLETED":
        po.status = "paid"
    elif state == "FAILED":
        po.status = "payment_failed"
    elif state == "PENDING":
        po.status = "pending_payment"
    else:
        po.status = f"payment_{str(state).lower()}" if state else po.status

    try:
        session.add(po)
        session.add(AuditLog(user_id=user.id, action="sync_payment_status", meta=json.dumps({"po_id": po.id, "merchantOrderId": merchant_order_id, "gateway_state": state, "raw": status_resp})))
        session.commit()
        session.refresh(po)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update PO status: {e}")

    return {"po_id": po.id, "merchantOrderId": merchant_order_id, "gateway_state": state, "updated_status": po.status}




# ---------------- Admin/Staff view endpoints ----------------
@router.get("/admin/orders", response_model=List[PurchaseOrderRead], dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF, Role.ACCOUNTANT))])
def admin_list_orders(
    vendor_id: Optional[int] = Query(None, description="Filter by vendor id"),
    status: Optional[str] = Query(None, description="Filter by PO status"),
    date_from: Optional[datetime] = Query(None, description="Created_at >= (ISO datetime)"),
    date_to: Optional[datetime] = Query(None, description="Created_at <= (ISO datetime)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user)  # ensures authenticated & role check above
):
    """
    Admin/staff/accountant can list all vendor purchase orders.
    Supports filtering by vendor_id, status and created_at date range, with pagination.
    """
    stmt = select(PurchaseOrder)
    if vendor_id is not None:
        stmt = stmt.where(PurchaseOrder.vendor_id == vendor_id)
    if status is not None:
        stmt = stmt.where(PurchaseOrder.status == status)
    if date_from is not None:
        stmt = stmt.where(PurchaseOrder.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(PurchaseOrder.created_at <= date_to)
    stmt = stmt.order_by(PurchaseOrder.created_at.desc())

    pos = session.exec(stmt.offset(skip).limit(limit)).all()
    return [ _get_po_response(session, p) for p in pos ]


@router.get("/admin/orders/{po_id}", response_model=PurchaseOrderRead, dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF, Role.ACCOUNTANT))])
def admin_get_order(po_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    """
    Admin/staff/accountant can fetch any PO by id (full details + items).
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return _get_po_response(session, po)

# paste into app/routers/orders.py (below admin endpoints)
from fastapi import Body

@router.patch("/admin/orders/{po_id}", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF))])
def admin_patch_order(
    po_id: int,
    payload: Optional[PurchaseOrderCreate] = None,
    status: Optional[str] = Body(None, embed=True, description="Optional status string"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Admin/Staff can patch PO: change status and/or replace items (if payload provided).
    Mirrors behaviour of purchases.update_po but exposed under admin path.
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Update status if provided (basic)
    if status:
        po.status = status

    # If payload provided (items/expected_date), reuse purchases.update_po logic:
    if payload and payload.items is not None:
        # remove existing items
        stmt = select(PurchaseItem).where(PurchaseItem.purchase_order_id == po.id)
        for row in session.exec(stmt).all():
            session.delete(row)
        session.commit()
        total = 0.0
        for it in payload.items:
            prod = session.get(Product, it.product_id)
            if not prod:
                session.rollback()
                raise HTTPException(status_code=400, detail=f"Product id {it.product_id} not found")
            pi = PurchaseItem(purchase_order_id=po.id, product_id=it.product_id, qty=it.qty, unit_price=it.unit_price)
            total += float(it.qty) * float(it.unit_price)
            session.add(pi)
        po.total = total

    if payload and payload.expected_date is not None:
        po.expected_date = payload.expected_date

    session.add(po)
    session.add(AuditLog(user_id=user.id, action="update_po", meta=json.dumps({"po_id": po.id, "status": po.status})))
    session.commit()
    session.refresh(po)
    return _get_po_response(session, po)




class ItemQtyUpdate(BaseModel):
    id: int
    qty: conint(ge=0)

class BatchQtyUpdate(BaseModel):
    items: List[ItemQtyUpdate]

@router.patch("/{vendor_id}/items/update-quantities", dependencies=[Depends(require_roles(Role.VENDOR, Role.STAFF, Role.ADMIN, Role.MASTER))])
def vendor_or_staff_update_item_quantities(
    vendor_id: int,
    payload: BatchQtyUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # If caller is vendor, enforce they match vendor_id
    if user.role == Role.VENDOR and int(user.id) != int(vendor_id):
        raise HTTPException(status_code=403, detail="Operation not permitted")

    if not payload.items:
        raise HTTPException(status_code=400, detail="No items provided")

    # fetch items and validate they belong to vendor's POs
    item_ids = [it.id for it in payload.items]
    stmt = select(PurchaseItem).where(PurchaseItem.id.in_(item_ids))
    items = session.exec(stmt).all()
    if len(items) != len(item_ids):
        found_ids = {it.id for it in items}
        missing = [iid for iid in item_ids if iid not in found_ids]
        raise HTTPException(status_code=400, detail=f"PurchaseItem ids not found: {missing}")

    affected_po_ids = set()
    updated = []
    for upd in payload.items:
        pi = next(x for x in items if x.id == upd.id)
        po = session.get(PurchaseOrder, pi.purchase_order_id)
        if not po:
            raise HTTPException(status_code=400, detail=f"PurchaseOrder {pi.purchase_order_id} not found")
        # vendor callers already enforced match; staff/admin allowed
        if user.role == Role.VENDOR and int(po.vendor_id) != int(vendor_id):
            raise HTTPException(status_code=403, detail="Operation not permitted on this PO")

        # business rule: vendors can only edit in certain statuses; staff/admin can edit more
        if user.role == Role.VENDOR:
            if po.status not in ("placed", "pending_payment"):
                raise HTTPException(status_code=400, detail=f"Cannot edit items when PO status is '{po.status}'")
        # STAFF/ADMIN allowed regardless (or add your own restriction)

        old_qty = int(pi.qty or 0)
        new_qty = int(upd.qty)
        if old_qty != new_qty:
            # 1) Update the purchase item
            pi.qty = new_qty
            session.add(pi)

            # 2) Create a history row
            try:
                history = PurchaseItemHistory(
                    purchase_item_id=pi.id,
                    purchase_order_id=pi.purchase_order_id,
                    old_qty=old_qty,
                    new_qty=new_qty,
                    changed_by=user.id,
                    reason=None  # optional: you can pass reason via payload if desired
                )
                session.add(history)
            except Exception:
                # don't block update if history insert fails, but log it into AuditLog
                session.add(AuditLog(user_id=user.id, action="history_insert_failed", meta=json.dumps({"purchase_item_id": pi.id})))

            # 3) AuditLog (existing)
            meta = {"po_id": pi.purchase_order_id, "purchase_item_id": pi.id, "old_qty": old_qty, "new_qty": new_qty, "by": user.id}
            session.add(AuditLog(user_id=user.id, action="update_item_qty", meta=json.dumps(meta)))
            updated.append({"item_id": pi.id, "old_qty": old_qty, "new_qty": new_qty})

        affected_po_ids.add(pi.purchase_order_id)

    # recalc totals for affected POs
    for po_id in affected_po_ids:
        stmt2 = select(PurchaseItem).where(PurchaseItem.purchase_order_id == po_id)
        po_items = session.exec(stmt2).all()
        total = sum((float(it.unit_price or 0.0) * float(it.qty or 0)) for it in po_items)
        po = session.get(PurchaseOrder, po_id)
        po.total = total
        session.add(po)
        session.add(AuditLog(user_id=user.id, action="recalc_total", meta=json.dumps({"po_id":po_id,"new_total":total,"by":user.id})))

    session.commit()
    return {"updated": updated, "message": "Quantities updated"}



