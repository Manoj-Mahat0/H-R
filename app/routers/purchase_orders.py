# app/routers/purchase_orders.py
import json
from typing import Optional, List, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.deps import get_current_user, require_roles
from app.models import AuditLog, PurchaseOrder, Role, User

router = APIRouter(prefix="/purchase-orders", tags=["PurchaseOrders"])


# ---------------- workflow endpoints ----------------

@router.post("/{po_id}/verify-payment", dependencies=[Depends(require_roles(Role.ACCOUNTANT, Role.ADMIN, Role.MASTER))])
def accountant_verify_payment(
    po_id: int,
    note: Optional[str] = Body(None, description="Optional note from accountant"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Accountant / Admin / Master manually verifies payment for a PO.
    Sets PO.status -> 'payment_verified' and writes an AuditLog entry.
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")

    if po.status not in ("received", "pending_payment", "paid", "payment_failed", "payment_pending"):
        raise HTTPException(status_code=400, detail=f"Cannot verify payment from current status '{po.status}'")

    po.status = "payment_verified"
    session.add(po)

    meta = {"po_id": po.id, "action": "verified_payment", "by": user.id}
    if note:
        meta["note"] = note
    session.add(AuditLog(user_id=user.id, action="verify_payment", meta=json.dumps(meta)))

    session.commit()
    session.refresh(po)
    return {"status": "payment_verified", "po_id": po.id}


@router.post("/{po_id}/mark-packed", dependencies=[Depends(require_roles(Role.STAFF, Role.ADMIN, Role.MASTER))])
def staff_mark_packed(
    po_id: int,
    box_count: Optional[int] = Body(None, description="Optional: number of boxes/packages packed"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Staff marks the PO as packed. Requires status == 'payment_verified'.
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")

    if po.status != "payment_verified":
        raise HTTPException(status_code=400, detail=f"PO must be in 'payment_verified' to be packed (current: {po.status})")

    po.status = "packed"
    session.add(po)

    meta = {"po_id": po.id, "action": "packed", "by": user.id}
    if box_count is not None:
        meta["box_count"] = box_count
    session.add(AuditLog(user_id=user.id, action="pack_po", meta=json.dumps(meta)))

    session.commit()
    session.refresh(po)
    return {"status": "packed", "po_id": po.id}


@router.post("/{po_id}/assign-driver", dependencies=[Depends(require_roles(Role.ACCOUNTANT, Role.ADMIN, Role.MASTER))])
def accountant_assign_driver(
    po_id: int,
    driver_id: int = Body(..., description="User.id of driver to assign"),
    eta_days: Optional[int] = Body(None, description="Optional ETA in days"),
    notes: Optional[str] = Body(None, description="Optional notes/instructions"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Assign a driver to a packed PO. Stores assignment in AuditLog.
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")

    if po.status != "packed":
        raise HTTPException(status_code=400, detail=f"PO must be in 'packed' state before assigning driver (current: {po.status})")

    drv = session.get(User, driver_id)
    if not drv:
        raise HTTPException(status_code=404, detail="Driver user not found")

    po.status = "driver_assigned"
    session.add(po)

    meta = {"po_id": po.id, "action": "assign_driver", "by": user.id, "driver_id": driver_id}
    if eta_days is not None:
        meta["eta_days"] = eta_days
    if notes:
        meta["notes"] = notes

    session.add(AuditLog(user_id=user.id, action="assign_driver", meta=json.dumps(meta)))
    session.commit()
    session.refresh(po)
    return {"status": "driver_assigned", "po_id": po.id, "driver_id": driver_id}


@router.post("/{po_id}/ship", dependencies=[Depends(require_roles(Role.ACCOUNTANT, Role.ADMIN, Role.MASTER))])
def mark_shipped(
    po_id: int,
    tracking_id: Optional[str] = Body(None, description="Optional tracking id / AWB"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Mark PO as shipped. Requires status == 'driver_assigned'.
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")

    if po.status != "driver_assigned":
        raise HTTPException(status_code=400, detail=f"PO must be in 'driver_assigned' to be shipped (current: {po.status})")

    po.status = "shipped"
    session.add(po)

    meta = {"po_id": po.id, "action": "ship", "by": user.id}
    if tracking_id:
        meta["tracking_id"] = tracking_id
    session.add(AuditLog(user_id=user.id, action="ship_po", meta=json.dumps(meta)))

    session.commit()
    session.refresh(po)
    return {"status": "shipped", "po_id": po.id, "tracking_id": tracking_id}


# ---------------- dashboard helpers ----------------
# These import _get_po_with_items at runtime to avoid circular imports.

@router.get("/admin/pending/verify", dependencies=[Depends(require_roles(Role.ACCOUNTANT, Role.ADMIN, Role.MASTER))])
def list_pending_verification(session: Session = Depends(get_session), limit: int = Query(100, le=1000)):
    from app.routers.purchases import _get_po_with_items  # runtime import to avoid circular import

    stmt = select(PurchaseOrder).where(PurchaseOrder.status.in_(["received", "pending_payment", "payment_failed", "paid"]))
    rows = session.exec(stmt.limit(limit)).all()
    return {"count": len(rows), "results": [_get_po_with_items(session, p) for p in rows]}


@router.get("/admin/pending/pack", dependencies=[Depends(require_roles(Role.STAFF, Role.ADMIN, Role.MASTER))])
def list_to_pack(session: Session = Depends(get_session), limit: int = Query(100, le=1000)):
    from app.routers.purchases import _get_po_with_items

    stmt = select(PurchaseOrder).where(PurchaseOrder.status == "payment_verified")
    rows = session.exec(stmt.limit(limit)).all()
    return {"count": len(rows), "results": [_get_po_with_items(session, p) for p in rows]}


@router.get("/admin/pending/assign-driver", dependencies=[Depends(require_roles(Role.ACCOUNTANT, Role.ADMIN, Role.MASTER))])
def list_to_assign_driver(session: Session = Depends(get_session), limit: int = Query(100, le=1000)):
    from app.routers.purchases import _get_po_with_items

    stmt = select(PurchaseOrder).where(PurchaseOrder.status == "packed")
    rows = session.exec(stmt.limit(limit)).all()
    return {"count": len(rows), "results": [_get_po_with_items(session, p) for p in rows]}


@router.get("/driver/my-assignments", dependencies=[Depends(require_roles(Role.DRIVER))])
def driver_my_assignments(session: Session = Depends(get_session), user: User = Depends(get_current_user), limit: int = Query(200, le=1000)):
    """
    Return POs assigned to current driver by reading AuditLog entries (action='assign_driver').
    """
    from app.routers.purchases import _get_po_with_items

    stmt = select(AuditLog).where(AuditLog.action == "assign_driver").order_by(AuditLog.timestamp.desc())
    rows = session.exec(stmt.limit(limit)).all()

    assigned_po_ids: List[int] = []
    for r in rows:
        try:
            meta = json.loads(r.meta) if r.meta else {}
            if int(meta.get("driver_id", 0)) == int(user.id):
                assigned_po_ids.append(int(meta.get("po_id")))
        except Exception:
            continue

    # dedupe and fetch POs
    assigned_po_ids = list(dict.fromkeys(assigned_po_ids))
    results: List[Any] = []
    for pid in assigned_po_ids:
        po = session.get(PurchaseOrder, pid)
        if po:
            results.append(_get_po_with_items(session, po))
    return {"count": len(results), "results": results}


# ---------------- single simple status endpoint ----------------

@router.get("/{po_id}/status")
def get_purchase_order_status(
    po_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),   # requires authentication
):
    """
    Single compact endpoint returning current PO.status and recent audit actions for that PO.
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="PurchaseOrder not found")

    # fetch audit logs (descending by timestamp) and filter entries that reference this PO
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc())
    rows = session.exec(stmt.limit(200)).all()

    audit_entries: List[dict[str, Any]] = []
    for r in rows:
        raw_meta = r.meta or ""
        try:
            meta = json.loads(raw_meta) if raw_meta else {}
        except Exception:
            meta = {}

        po_in_meta = False
        if isinstance(meta, dict) and int(meta.get("po_id", -1)) == int(po_id):
            po_in_meta = True
        else:
            if f'"po_id": {po_id}' in raw_meta or f'"po_id":"{po_id}"' in raw_meta or f"'po_id': {po_id}" in raw_meta:
                po_in_meta = True

        if po_in_meta:
            audit_entries.append({
                "id": r.id,
                "action": r.action,
                "user_id": r.user_id,
                "timestamp": getattr(r, "timestamp", None),
                "meta": meta if meta else raw_meta,
            })

    return {
        "po_id": po.id,
        "vendor_id": getattr(po, "vendor_id", None),
        "status": getattr(po, "status", None),
        "total": getattr(po, "total", None),
        "last_updated": getattr(po, "updated_at", None) or getattr(po, "modified_at", None),
        "recent_audit": audit_entries[:10],
    }
