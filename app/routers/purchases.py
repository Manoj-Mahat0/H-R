# app/routers/purchase_orders.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import select
from ..database import get_session
from ..models import (
    PurchaseOrder,
    PurchaseItem,
    StockLevel,
    StockMovement,
    Product,
    AuditLog,
    User,
)
from ..schemas import PurchaseOrderCreate, PurchaseOrderRead, PurchaseItemRead
from ..deps import require_roles, get_current_user
from ..models import Role
from sqlmodel import Session
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase"])


def _calc_total_from_items(items):
    total = 0.0
    for it in items:
        total += float(it.qty) * float(it.unit_price)
    return total


def _get_po_with_items(session: Session, po: PurchaseOrder):
    # fetch items
    stmt = select(PurchaseItem).where(PurchaseItem.purchase_order_id == po.id)
    items = session.exec(stmt).all()
    items_read = [PurchaseItemRead(id=i.id, product_id=i.product_id, qty=i.qty, unit_price=i.unit_price) for i in items]
    return PurchaseOrderRead(
        id=po.id,
        vendor_id=po.vendor_id,
        created_by=po.created_by,
        status=po.status,
        total=po.total,
        expected_date=po.expected_date,
        created_at=po.created_at,
        items=items_read,
    )


@router.post("/", status_code=201, response_model=PurchaseOrderRead)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.VENDOR)),
):
    """
    Vendor creates a purchase order.
    👉 Vendor ka bheja hua price ignore hota hai.
    👉 Product.price master table se uthaya jata hai.
    """
    vendor_id = user.id
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

    total = 0.0
    for it in payload.items:
        prod = session.get(Product, it.product_id)
        if not prod:
            session.rollback()
            raise HTTPException(status_code=400, detail=f"Product id {it.product_id} not found")

        # ✅ vendor price ignore, master price use karo
        used_price = float(prod.price or 0.0)

        pi = PurchaseItem(
            purchase_order_id=po.id,
            product_id=it.product_id,
            qty=it.qty,
            unit_price=used_price,
        )
        total += it.qty * used_price
        session.add(pi)

    po.total = total
    session.add(po)

    # audit log
    log = AuditLog(user_id=user.id, action="create_po", meta=f"po:{po.id},vendor:{vendor_id},total:{total}")
    session.add(log)
    session.commit()
    session.refresh(po)

    return _get_po_with_items(session, po)


@router.get("/me", response_model=List[PurchaseOrderRead])
def list_my_orders(session: Session = Depends(get_session), user: User = Depends(require_roles(Role.VENDOR))):
    stmt = select(PurchaseOrder).where(PurchaseOrder.vendor_id == user.id).order_by(PurchaseOrder.created_at.desc())
    pos = session.exec(stmt).all()
    return [ _get_po_with_items(session, p) for p in pos ]


@router.get("/", response_model=List[PurchaseOrderRead])
def list_orders(status: Optional[str] = Query(None), session: Session = Depends(get_session), user: User = Depends(require_roles(Role.STAFF, Role.ADMIN, Role.MASTER, Role.ACCOUNTANT))):
    stmt = select(PurchaseOrder)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    stmt = stmt.order_by(PurchaseOrder.created_at.desc())
    pos = session.exec(stmt).all()
    return [ _get_po_with_items(session, p) for p in pos ]


@router.get("/{po_id}", response_model=PurchaseOrderRead)
def get_po(po_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    # allow vendor to see only their own; staff/admin/master can view all
    if user.role == Role.VENDOR and po.vendor_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return _get_po_with_items(session, po)


@router.patch("/{po_id}", response_model=PurchaseOrderRead)
def update_po(po_id: int, payload: Optional[PurchaseOrderCreate] = None, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    """
    Vendor can update their own PO while status is 'placed'.
    Staff/Admin/Master can update PO while status is 'accepted' (for minor corrections) — they must have appropriate role.
    Payload may include items (replace) and expected_date (optional).
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    # permission checks
    if user.role == Role.VENDOR:
        if po.vendor_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if po.status != "placed":
            raise HTTPException(status_code=400, detail="Vendor can only edit PO in 'placed' status")
    else:
        # staff/admin/master may update only if po.status in allowed list
        if po.status not in ("placed", "accepted"):
            raise HTTPException(status_code=400, detail="PO not editable in current status")

    # if items provided, replace existing items
    if payload and payload.items is not None:
        # delete existing items
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
    log = AuditLog(user_id=user.id, action="update_po", meta=f"po:{po.id}")
    session.add(log)
    session.commit()
    session.refresh(po)
    return _get_po_with_items(session, po)


@router.post("/{po_id}/accept")
def accept_po(po_id: int, payload: Optional[PurchaseOrderCreate] = None, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.STAFF, Role.ADMIN, Role.MASTER))):
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po.status not in ("placed", "pending"):
        raise HTTPException(status_code=400, detail=f"PO cannot be accepted from status '{po.status}'")

    # Staff may replace items at acceptance if payload provided
    if payload and payload.items is not None:
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

    po.status = "accepted"
    session.add(po)
    log = AuditLog(user_id=user.id, action="accept_po", meta=f"po:{po.id}")
    session.add(log)
    session.commit()
    session.refresh(po)
    return {"status": "accepted", "po_id": po.id, "total": po.total}


@router.post("/{po_id}/receive")
def receive_po(po_id: int, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.STAFF, Role.ADMIN, Role.MASTER))):
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po.status != "accepted":
        raise HTTPException(status_code=400, detail="Only accepted PO can be received")

    stmt = select(PurchaseItem).where(PurchaseItem.purchase_order_id == po_id)
    items = session.exec(stmt).all()
    try:
        for it in items:
            # ensure stocklevel
            sl_stmt = select(StockLevel).where(StockLevel.product_id == it.product_id)
            sl = session.exec(sl_stmt).one_or_none()
            if not sl:
                sl = StockLevel(product_id=it.product_id, quantity=0)
                session.add(sl)
                session.commit()
                session.refresh(sl)
            prev_qty = sl.quantity
            sl.quantity += it.qty
            session.add(sl)
            mv = StockMovement(product_id=it.product_id, qty=it.qty, type="IN", ref=f"PO#{po.id}", performed_by=user.id)
            session.add(mv)
        po.status = "received"
        session.add(po)
        log = AuditLog(user_id=user.id, action="receive_po", meta=f"po:{po.id}")
        session.add(log)
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to receive PO: {e}")
    return {"status": "received", "po_id": po.id}


@router.post("/{po_id}/dispatch")
def dispatch_po(po_id: int, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.ADMIN, Role.MASTER))):
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")
    if po.status != "received":
        raise HTTPException(status_code=400, detail="PO must be in 'received' state before dispatch")
    po.status = "dispatched"
    session.add(po)
    log = AuditLog(user_id=user.id, action="dispatch_po", meta=f"po:{po.id}")
    session.add(log)
    session.commit()
    return {"status": "dispatched", "po_id": po.id}


@router.post("/{po_id}/cancel")
def cancel_po(po_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    """
    Vendor can cancel their own PO while it's in 'placed' status.
    Staff/admin/master can cancel in other statuses if needed.
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PO not found")

    if user.role == Role.VENDOR:
        if po.vendor_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if po.status != "placed":
            raise HTTPException(status_code=400, detail="Vendor can only cancel PO in 'placed' status")
    else:
        # staff/admin/master can cancel any PO
        pass

    po.status = "cancelled"
    session.add(po)
    log = AuditLog(user_id=user.id, action="cancel_po", meta=f"po:{po.id}")
    session.add(log)
    session.commit()
    return {"status": "cancelled", "po_id": po.id}
