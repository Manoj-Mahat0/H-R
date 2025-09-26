# app/routers/vendor_limits.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlmodel import Session, select
from ..database import get_session
from ..models import VendorLimit, User, AuditLog, Role
from ..schemas import VendorLimitCreate, VendorLimitRead
from ..deps import get_current_user, require_roles
from typing import List, Optional
from datetime import datetime
from sqlalchemy import desc

import json

router = APIRouter(prefix="/api/vendor-limits", tags=["vendor-limits"])


@router.post("/", response_model=VendorLimitRead, dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def assign_vendor_limit(payload: VendorLimitCreate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    v = session.get(User, payload.vendor_id)
    if not v or v.role != Role.VENDOR:
        raise HTTPException(status_code=400, detail="Vendor not found or not a vendor")

    stmt = select(VendorLimit).where(VendorLimit.vendor_id == payload.vendor_id)
    if payload.month:
        stmt = stmt.where(VendorLimit.month == payload.month)
    else:
        stmt = stmt.where(VendorLimit.month.is_(None))

    existing = session.exec(stmt).one_or_none()
    if existing:
        existing.limit_amount = payload.limit_amount
        existing.limit_boxes = payload.limit_boxes
        existing.note = payload.note
        existing.created_by = user.id
        existing.created_at = datetime.utcnow()
        session.add(existing)
        action_obj = existing
    else:
        new = VendorLimit(
            vendor_id=payload.vendor_id,
            limit_amount=payload.limit_amount,
            limit_boxes=payload.limit_boxes,
            month=payload.month,
            note=payload.note,
            created_by=user.id,
        )
        session.add(new)
        action_obj = new

    session.commit()
    session.refresh(action_obj)
    return action_obj



@router.get("/{vendor_id}", response_model=List[VendorLimitRead])
def get_vendor_limits_for_month(vendor_id: int, month: Optional[str] = Query(None, description="YYYY-MM or omit to get all"), session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    # vendor can view only their own; admin/master can view any
    if user.role == Role.VENDOR and user.id != vendor_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    stmt = select(VendorLimit).where(VendorLimit.vendor_id == vendor_id)
    if month:
        stmt = stmt.where(VendorLimit.month == month)
    stmt = stmt.order_by(VendorLimit.created_at.desc())
    rows = session.exec(stmt).all()
    return rows



@router.get("/", response_model=List[VendorLimitRead], dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def list_all_limits(
    vendor_id: Optional[int] = Query(None),
    month: Optional[str] = Query(None),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = select(VendorLimit)
    if vendor_id is not None:
        stmt = stmt.where(VendorLimit.vendor_id == vendor_id)
    if month is not None:
        stmt = stmt.where(VendorLimit.month == month)

    # Put NULL months first, then order months descending
    stmt = stmt.order_by(
        VendorLimit.vendor_id,
        desc(VendorLimit.month.is_(None)),  # NULL months first
        desc(VendorLimit.month)             # newest month first
    )
    rows = session.exec(stmt).all()
    return rows


@router.delete("/{limit_id}", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def delete_vendor_limit(limit_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    lim = session.get(VendorLimit, limit_id)
    if not lim:
        raise HTTPException(status_code=404, detail="Limit not found")
    session.delete(lim)
    # audit
    try:
        session.add(AuditLog(user_id=user.id, action="delete_vendor_limit", meta=json.dumps({"limit_id": limit_id, "vendor_id": lim.vendor_id})))
    except Exception:
        pass
    session.commit()
    return {"status": "deleted", "limit_id": limit_id}
