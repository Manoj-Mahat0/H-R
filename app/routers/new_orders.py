# app/routers/new_orders.py
from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from typing import List, Optional
from sqlmodel import Session, select
from ..database import get_session
from ..models import NewOrder, NewOrderItem, Product, User, Vehicle, Role
from ..schemas import (
    NewOrderCreate, NewOrderRead, NewOrderItemRead,
    NewOrderUpdateIn, NewOrderItemCreate
)
from ..deps import require_roles, get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/new-orders", tags=["new-orders"])

# Helper to build response object
def build_order_response(session: Session, order: NewOrder) -> NewOrderRead:
    items = session.exec(select(NewOrderItem).where(NewOrderItem.new_order_id == order.id)).all()
    item_objs = [
        NewOrderItemRead(
            id=i.id,
            product_id=i.product_id,
            qty=i.qty,
            unit_price=float(i.unit_price or 0.0),
            subtotal=float(i.subtotal or 0.0),
            notes=i.notes
        ) for i in items
    ]
    return NewOrderRead(
        id=order.id,
        vendor_id=order.vendor_id,
        created_at=order.created_at,
        status=order.status,
        total_amount=float(order.total_amount or 0.0),
        items=item_objs,
        shipping_address=order.shipping_address,
        notes=order.notes,
        vehicle_id=order.vehicle_id,
        verified=bool(order.verified),
        verified_by=order.verified_by,
        verified_at=order.verified_at
    )

# ----------------------
# Vendor: create order
# ----------------------
@router.post("/", response_model=NewOrderRead, status_code=status.HTTP_201_CREATED)
def create_new_order(payload: NewOrderCreate,
                     session: Session = Depends(get_session),
                     vendor: User = Depends(require_roles(Role.VENDOR))):
    if not payload.items or len(payload.items) == 0:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    order = NewOrder(vendor_id=vendor.id, shipping_address=payload.shipping_address, notes=payload.notes)
    session.add(order)
    session.commit()
    session.refresh(order)

    total = 0.0
    for it in payload.items:
        prod = session.get(Product, it.product_id)
        if not prod:
            session.delete(order)
            session.commit()
            raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")
        unit_price = float(it.unit_price) if (it.unit_price is not None) else float(prod.price or 0.0)
        subtotal = unit_price * int(it.qty)
        oi = NewOrderItem(new_order_id=order.id, product_id=it.product_id, qty=it.qty, unit_price=unit_price, subtotal=subtotal, notes=it.notes)
        session.add(oi)
        total += subtotal

    order.total_amount = total
    session.add(order)
    session.commit()
    session.refresh(order)

    return build_order_response(session, order)

# ----------------------
# List orders (role aware)
# ----------------------
@router.get("/", response_model=List[NewOrderRead])
def list_orders(limit: int = Query(200, ge=1, le=2000),
                session: Session = Depends(get_session),
                current: User = Depends(get_current_user)):
    # vendor sees only own orders
    stmt = select(NewOrder)
    if current.role == Role.VENDOR:
        stmt = stmt.where(NewOrder.vendor_id == current.id)
    # staff/admin/accountant/master see all
    stmt = stmt.limit(limit).order_by(NewOrder.created_at.desc())
    rows = session.exec(stmt).all()
    return [build_order_response(session, o) for o in rows]

# ----------------------
# Get single order (role-aware)
# ----------------------
@router.get("/{order_id}", response_model=NewOrderRead)
def get_order(order_id: int, session: Session = Depends(get_session), current: User = Depends(get_current_user)):
    order = session.get(NewOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current.role == Role.VENDOR and order.vendor_id != current.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    return build_order_response(session, order)

# ----------------------
# Update order (staff/admin/master can add/edit items & change basic fields)
# Vendor cannot patch items (only create). Staff/accountant/admin/master permitted per request.
# ----------------------
@router.patch("/{order_id}", response_model=NewOrderRead)
def update_order(order_id: int,
                 payload: NewOrderUpdateIn = Body(...),
                 session: Session = Depends(get_session),
                 user: User = Depends(require_roles(Role.STAFF, Role.ADMIN, Role.MASTER))):
    order = session.get(NewOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # replace items if provided
    if payload.items is not None:
        # delete existing
        existing = session.exec(select(NewOrderItem).where(NewOrderItem.new_order_id == order.id)).all()
        for e in existing:
            session.delete(e)
        session.commit()
        # add new
        total = 0.0
        for it in payload.items:
            prod = session.get(Product, it.product_id)
            if not prod:
                raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")
            unit_price = float(it.unit_price) if (it.unit_price is not None) else float(prod.price or 0.0)
            subtotal = unit_price * int(it.qty)
            oi = NewOrderItem(new_order_id=order.id, product_id=it.product_id, qty=it.qty, unit_price=unit_price, subtotal=subtotal, notes=it.notes)
            session.add(oi)
            total += subtotal
        order.total_amount = total

    # simple field updates
    if payload.shipping_address is not None:
        order.shipping_address = payload.shipping_address
    if payload.notes is not None:
        order.notes = payload.notes
    if payload.status is not None:
        order.status = payload.status

    order.last_modified_by = user.id
    order.last_modified_at = datetime.utcnow()

    session.add(order)
    session.commit()
    session.refresh(order)
    return build_order_response(session, order)

# ----------------------
# Assign / remove vehicle (admin/master)
# PATCH body: {"vehicle_id": <int or 0 to remove>}
# ----------------------
@router.patch("/{order_id}/vehicle", response_model=NewOrderRead)
def assign_vehicle(order_id: int, vehicle_id: int = Body(...), session: Session = Depends(get_session), admin: User = Depends(require_roles(Role.ADMIN, Role.MASTER))):
    order = session.get(NewOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if vehicle_id == 0:
        order.vehicle_id = None
    else:
        v = session.get(Vehicle, vehicle_id)
        if not v:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        order.vehicle_id = vehicle_id
    order.last_modified_by = admin.id
    order.last_modified_at = datetime.utcnow()
    session.add(order)
    session.commit()
    session.refresh(order)
    return build_order_response(session, order)

# ----------------------
# Accountant: verify order
# ----------------------
@router.post("/{order_id}/verify", response_model=NewOrderRead)
def verify_order(order_id: int, session: Session = Depends(get_session), acct: User = Depends(require_roles(Role.ACCOUNTANT))):
    order = session.get(NewOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.verified = True
    order.verified_by = acct.id
    order.verified_at = datetime.utcnow()
    session.add(order)
    session.commit()
    session.refresh(order)
    return build_order_response(session, order)

# ----------------------
# Remove single item (staff/admin/master)
# ----------------------
@router.delete("/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order_item(order_id: int, item_id: int, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.STAFF, Role.ADMIN, Role.MASTER))):
    order = session.get(NewOrder, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    item = session.get(NewOrderItem, item_id)
    if not item or item.new_order_id != order.id:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    # recalc total
    remaining = session.exec(select(NewOrderItem).where(NewOrderItem.new_order_id == order.id)).all()
    order.total_amount = sum((i.subtotal or 0.0) for i in remaining)
    order.last_modified_by = user.id
    order.last_modified_at = datetime.utcnow()
    session.add(order)
    session.commit()
    return {}

# GET vendor's orders (admin/master)
@router.get("/vendor/{vendor_id}", response_model=List[NewOrderRead])
def list_vendor_orders(
    vendor_id: int,
    date_from: Optional[str] = Query(None, description="ISO date e.g. 2025-09-01"),
    date_to: Optional[str] = Query(None, description="ISO date e.g. 2025-09-30"),
    status: Optional[str] = Query(None, description="filter by order status"),
    limit: int = Query(100, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    session: Session = Depends(get_session),
    admin: User = Depends(require_roles(Role.ADMIN, Role.MASTER)),
):
    """
    Admin / Master: list previous orders for a given vendor.
    Optional filters: date_from, date_to (ISO), status, pagination.
    """
    stmt = select(NewOrder).where(NewOrder.vendor_id == vendor_id)

    # date filters (assumes created_at is datetime)
    if date_from:
        try:
            dtf = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            stmt = stmt.where(NewOrder.created_at >= dtf)
        except Exception:
            raise HTTPException(status_code=400, detail="date_from must be ISO format")
    if date_to:
        try:
            dtt = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            stmt = stmt.where(NewOrder.created_at <= dtt)
        except Exception:
            raise HTTPException(status_code=400, detail="date_to must be ISO format")

    if status:
        stmt = stmt.where(NewOrder.status == status)

    stmt = stmt.order_by(NewOrder.created_at.desc()).offset(offset).limit(limit)
    rows = session.exec(stmt).all()
    return [build_order_response(session, o) for o in rows]

# ----------------------
# Admin create order on behalf of a vendor
# ----------------------
@router.post("/admin/{vendor_id}", response_model=NewOrderRead, status_code=status.HTTP_201_CREATED)
def admin_create_order_for_vendor(
    vendor_id: int,
    payload: NewOrderCreate,
    session: Session = Depends(get_session),
    admin: User = Depends(require_roles(Role.ADMIN, Role.MASTER))
):
    """
    Admin/Master can create an order for a specific vendor.
    Works same as vendor creating their own order.
    """
    if not payload.items or len(payload.items) == 0:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    # check vendor exists and role is vendor
    vendor = session.get(User, vendor_id)
    if not vendor or vendor.role != Role.VENDOR:
        raise HTTPException(status_code=404, detail="Vendor not found")

    order = NewOrder(vendor_id=vendor_id, shipping_address=payload.shipping_address, notes=payload.notes)
    session.add(order)
    session.commit()
    session.refresh(order)

    total = 0.0
    for it in payload.items:
        prod = session.get(Product, it.product_id)
        if not prod:
            session.delete(order)
            session.commit()
            raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")
        unit_price = float(it.unit_price) if (it.unit_price is not None) else float(prod.price or 0.0)
        subtotal = unit_price * int(it.qty)
        oi = NewOrderItem(
            new_order_id=order.id,
            product_id=it.product_id,
            qty=it.qty,
            unit_price=unit_price,
            subtotal=subtotal,
            notes=it.notes,
        )
        session.add(oi)
        total += subtotal

    order.total_amount = total
    session.add(order)
    session.commit()
    session.refresh(order)

    return build_order_response(session, order)
