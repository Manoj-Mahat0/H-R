# app/routers/orders.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Dict, Any, Optional
from datetime import datetime
from ..database import get_session
from ..models import Order, OrderItem, OrderItemHistory, Product, StockBatch, StockMovement, OrderStatus, User
from ..schemas import OrderCreate, OrderRead, OrderItemRead, OrderUpdateItemsIn
from ..deps import require_roles, get_current_user
from ..models import Role
from sqlmodel import func

router = APIRouter(prefix="/api/orders", tags=["New Orders"])

# Helper: calculate order totals
def _calc_totals(items: List[OrderItem]) -> float:
    return sum(i.subtotal for i in items)

# Create order (customer or vendor)
@router.post("/", response_model=OrderRead)
def create_order(payload: OrderCreate, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    # user can be customer or vendor or other roles who create orders
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items in the order")

    # Validate products and prepare Order + OrderItems
    order = Order(customer_id=user.id, status=OrderStatus.PLACED, shipping_address=payload.shipping_address, notes=payload.notes)
    session.add(order)
    session.commit()
    session.refresh(order)

    items_objs = []
    for it in payload.items:
        product = session.get(Product, it.product_id)
        if not product:
            session.rollback()
            raise HTTPException(status_code=400, detail=f"Product {it.product_id} not found")
        if it.qty <= 0:
            session.rollback()
            raise HTTPException(status_code=400, detail="qty must be > 0")
        unit_price = it.unit_price if it.unit_price and it.unit_price > 0 else product.price
        subtotal = unit_price * it.qty
        oi = OrderItem(order_id=order.id, product_id=it.product_id, original_qty=it.qty, final_qty=it.qty, unit_price=unit_price, subtotal=subtotal)
        session.add(oi)
        items_objs.append(oi)
    session.commit()

    # compute total
    session.refresh(order)
    stmt = select(OrderItem).where(OrderItem.order_id == order.id)
    order_items = session.exec(stmt).all()
    order.total_amount = _calc_totals(order_items)
    session.add(order)
    session.commit()
    session.refresh(order)

    # build response
    out_items = []
    for i in order_items:
        out_items.append(OrderItemRead.from_orm(i))
    resp = OrderRead(
        id=order.id,
        customer_id=order.customer_id,
        created_at=order.created_at,
        status=order.status,
        total_amount=order.total_amount,
        items=out_items,
        shipping_address=order.shipping_address,
        notes=order.notes,
    )
    return resp

# -------------------------
# IMPORTANT: define this BEFORE the "/{order_id}" route to avoid path conflicts
# -------------------------
@router.get("/me", response_model=List[OrderRead])
def my_orders(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Returns orders placed by the current user (customer/vendor).
    Optional: filter by status, and use limit/offset for pagination.
    """
    stmt = select(Order).where(Order.customer_id == user.id)
    if status:
        stmt = stmt.where(Order.status == status)
    stmt = stmt.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    orders = session.exec(stmt).all()

    results: List[OrderRead] = []
    for o in orders:
        items = session.exec(select(OrderItem).where(OrderItem.order_id == o.id)).all()
        out_items = [OrderItemRead.from_orm(i) for i in items]
        results.append(
            OrderRead(
                id=o.id,
                customer_id=o.customer_id,
                created_at=o.created_at,
                status=o.status,
                total_amount=o.total_amount,
                items=out_items,
                shipping_address=o.shipping_address,
                notes=o.notes,
            )
        )

    return results

# Admin: view ALL orders (customers/vendors)
@router.get("/all", response_model=List[OrderRead])
def admin_get_all_orders(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    session: Session = Depends(get_session),
    admin: User = Depends(require_roles(Role.MASTER, Role.ADMIN)),
):
    """
    Admin: list all orders (optionally filter by status). Pagination with limit & offset.
    """
    stmt = select(Order)
    if status:
        stmt = stmt.where(Order.status == status)
    stmt = stmt.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    orders = session.exec(stmt).all()

    results: List[OrderRead] = []
    for o in orders:
        items = session.exec(select(OrderItem).where(OrderItem.order_id == o.id)).all()
        out_items = [OrderItemRead.from_orm(i) for i in items]
        results.append(
            OrderRead(
                id=o.id,
                customer_id=o.customer_id,
                created_at=o.created_at,
                status=o.status,
                total_amount=o.total_amount,
                items=out_items,
                shipping_address=o.shipping_address,
                notes=o.notes,
            )
        )
    return results


# Vendor / user: get previous orders by vendor_id
@router.get("/vendor/{vendor_id}", response_model=List[OrderRead])
def get_orders_by_vendor(
    vendor_id: int,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    session: Session = Depends(get_session),
    caller: User = Depends(get_current_user),
):
    """
    Return orders placed by the given vendor_id.
    Admin/master can request any vendor_id.
    A vendor user can request only their own vendor_id.
    """
    # permission check
    if caller.role not in (Role.MASTER, Role.ADMIN):
        # only allow a vendor to view their own orders
        if caller.id != vendor_id:
            raise HTTPException(status_code=403, detail="Not allowed to view other vendor's orders")

    stmt = select(Order).where(Order.customer_id == vendor_id)  # orders placed by that vendor user
    if status:
        stmt = stmt.where(Order.status == status)
    stmt = stmt.order_by(Order.created_at.desc()).limit(limit).offset(offset)
    orders = session.exec(stmt).all()

    results: List[OrderRead] = []
    for o in orders:
        items = session.exec(select(OrderItem).where(OrderItem.order_id == o.id)).all()
        out_items = [OrderItemRead.from_orm(i) for i in items]
        results.append(
            OrderRead(
                id=o.id,
                customer_id=o.customer_id,
                created_at=o.created_at,
                status=o.status,
                total_amount=o.total_amount,
                items=out_items,
                shipping_address=o.shipping_address,
                notes=o.notes,
            )
        )
    return results


# Get single order
@router.get("/{order_id}", response_model=OrderRead)
def get_order(order_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # optional: restrict visibility (customer can see own orders)
    if user.role not in (Role.MASTER, Role.ADMIN) and order.customer_id != user.id:
        # allow customer to see own orders, others need roles
        raise HTTPException(status_code=403, detail="Not allowed to view this order")

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()
    out_items = [OrderItemRead.from_orm(i) for i in items]
    return OrderRead(
        id=order.id,
        customer_id=order.customer_id,
        created_at=order.created_at,
        status=order.status,
        total_amount=order.total_amount,
        items=out_items,
        shipping_address=order.shipping_address,
        notes=order.notes,
    )

# Admin: update items (add/remove/change qty) BEFORE confirmation

@router.patch("/{order_id}/items")
def admin_update_items(order_id: int, payload: OrderUpdateItemsIn, session: Session = Depends(get_session), admin: User = Depends(require_roles(Role.MASTER, Role.ADMIN))):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.PLACED:
        # allow updates until confirmed
        raise HTTPException(status_code=400, detail="Can only update items while order is in 'placed' state")

    try:
        # Build map of existing items by product_id
        existing = {oi.product_id: oi for oi in session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()}

        # New list submitted by admin — we'll reconcile: add new, update existing, remove missing
        submitted_product_ids = set()
        for it in payload.items:
            submitted_product_ids.add(it.product_id)
            if it.product_id in existing:
                oi = existing[it.product_id]
                old = oi.final_qty
                # preserve original_qty
                oi.final_qty = it.qty
                oi.unit_price = it.unit_price if it.unit_price and it.unit_price > 0 else oi.unit_price
                oi.subtotal = oi.final_qty * oi.unit_price
                session.add(oi)
                # add history
                h = OrderItemHistory(order_item_id=oi.id, changed_by=admin.id, old_final_qty=old, new_final_qty=oi.final_qty, reason=payload.reason)
                session.add(h)
            else:
                # add new item
                product = session.get(Product, it.product_id)
                if not product:
                    session.rollback()
                    raise HTTPException(status_code=400, detail=f"Product {it.product_id} not found")
                unit_price = it.unit_price if it.unit_price and it.unit_price > 0 else product.price
                oi = OrderItem(order_id=order.id, product_id=it.product_id, original_qty=it.qty, final_qty=it.qty, unit_price=unit_price, subtotal=unit_price*it.qty)
                session.add(oi)
                session.flush()  # ensure oi.id available
                h = OrderItemHistory(order_item_id=oi.id, changed_by=admin.id, old_final_qty=0, new_final_qty=oi.final_qty, reason="added via admin: " + (payload.reason or ""))
                session.add(h)

        # Remove items not in submitted list
        for pid, oi in list(existing.items()):
            if pid not in submitted_product_ids:
                # FIRST: delete related OrderItemHistory rows to avoid FK constraint
                try:
                    histories = session.exec(select(OrderItemHistory).where(OrderItemHistory.order_item_id == oi.id)).all()
                    for hh in histories:
                        session.delete(hh)
                except Exception:
                    # if model/table not present or other error, continue and let DB raise if needed
                    pass

                # create history record for removal (optional — here we record removal as a history row BEFORE deleting)
                # Note: since we're deleting histories above, we create a separate removal-audit table if you want persistent audit.
                # For now we'll insert a removal history (and keep it) OR skip if you prefer removal to be final.
                # h_rem = OrderItemHistory(order_item_id=oi.id, changed_by=admin.id, old_final_qty=oi.final_qty, new_final_qty=0, reason="removed via admin: " + (payload.reason or ""))
                # session.add(h_rem)

                # delete the order item
                session.delete(oi)

        # Recalculate totals
        session.commit()  # commit the deletions/additions/updates before recalculation to ensure DB state consistent

        # recalc total
        items = session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()
        order.total_amount = _calc_totals(items)
        session.add(order)
        session.commit()
        return {"status": "updated", "order_id": order.id, "total": order.total_amount}

    except IntegrityError as ie:
        session.rollback()
        # if still integrity error, surface helpful info
        raise HTTPException(status_code=400, detail=f"DB integrity error while updating order items: {ie.orig}")
    except HTTPException:
        # re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update order items: {str(e)}")


# Admin: confirm order (after possible edits) -> moves order to CONFIRMED
from pydantic import BaseModel

class ConfirmOrderIn(BaseModel):
    vehicle_id: int | None = None
    notes: str | None = None

@router.post("/{order_id}/confirm")
def confirm_order(order_id: int, payload: ConfirmOrderIn, session: Session = Depends(get_session), admin: User = Depends(require_roles(Role.MASTER, Role.ADMIN))):
    """
    Confirm an order and optionally assign a vehicle by id.
    Body JSON:
      { "vehicle_id": 12, "notes": "optional note" }
    """
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != OrderStatus.PLACED:
        raise HTTPException(status_code=400, detail="Order not in placed state")

    # optional: validate and assign vehicle if provided
    if payload.vehicle_id is not None:
        try:
            # import Vehicle model (should exist in your models.py)
            from ..models import Vehicle
        except Exception:
            raise HTTPException(status_code=500, detail="Vehicle model not found in server code. Add Vehicle model to models.py")

        vehicle = session.get(Vehicle, payload.vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=400, detail=f"Vehicle with id {payload.vehicle_id} not found")

        # assign if the Order model has vehicle_id field
        if hasattr(order, "vehicle_id"):
            setattr(order, "vehicle_id", payload.vehicle_id)
        else:
            # helpful error explaining how to add field
            raise HTTPException(
                status_code=500,
                detail="Order model has no vehicle_id attribute. Add 'vehicle_id' column to Order model (see instructions)."
            )

    # optional notes field: if your Order model has notes, append or overwrite
    if payload.notes is not None:
        # append note safely
        existing_notes = getattr(order, "notes", None)
        new_notes = (existing_notes or "") + ("\n" if existing_notes else "") + payload.notes
        try:
            setattr(order, "notes", new_notes)
        except Exception:
            pass

    order.status = OrderStatus.CONFIRMED
    order.confirmed_by = admin.id
    session.add(order)
    session.commit()
    session.refresh(order)

    return {"status": "confirmed", "order_id": order.id, "vehicle_id": getattr(order, "vehicle_id", None)}

# Accountant: payment check
@router.post("/{order_id}/payment-check")
def payment_check(order_id: int, session: Session = Depends(get_session), accountant: User = Depends(require_roles(Role.ACCOUNTANT))):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Order must be confirmed before payment check")
    order.status = OrderStatus.PAYMENT_CHECKED
    order.payment_checked_by = accountant.id
    session.add(order)
    session.commit()
    return {"status": "payment_checked", "order_id": order.id}

# Staff: processing -> allocate/reserve stock (reduces StockBatch quantity using FIFO expiry)
@router.post("/{order_id}/process")
def process_order(order_id: int, session: Session = Depends(get_session), staff: User = Depends(require_roles(Role.STAFF, Role.MASTER, Role.ADMIN))):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in (OrderStatus.PAYMENT_CHECKED, OrderStatus.CONFIRMED):
        raise HTTPException(status_code=400, detail="Order must be payment_checked or confirmed before processing")

    items = session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()
    if not items:
        raise HTTPException(status_code=400, detail="Order has no items")

    allocation_log = []
    # For each order item, allocate from StockBatch (FIFO by expire_date then added_at)
    for oi in items:
        need = oi.final_qty
        if need <= 0:
            continue
        # query available batches
        stmt = select(StockBatch).where(StockBatch.product_id == oi.product_id).where(StockBatch.active == True).where(StockBatch.quantity > 0).order_by(StockBatch.expire_date.nullsfirst(), StockBatch.added_at)
        batches = session.exec(stmt).all()
        allocated_total = 0
        for b in batches:
            if need <= 0:
                break
            take = min(b.quantity, need)
            if take <= 0:
                continue
            # reduce batch quantity
            old_q = b.quantity
            b.quantity = b.quantity - take
            session.add(b)
            # record StockMovement
            sm = StockMovement(product_id=oi.product_id, qty=take, type="OUT", ref=f"order:{order.id}", performed_by=staff.id, notes=f"Alloc->order_item:{oi.id}")
            session.add(sm)
            need -= take
            allocated_total += take
            allocation_log.append({"order_item_id": oi.id, "batch_id": b.id, "qty": take, "batch_old_q": old_q})
        if need > 0:
            # Not enough stock to fully allocate: rollback and inform
            session.rollback()
            raise HTTPException(status_code=400, detail=f"Not enough stock to process order; product {oi.product_id} missing {need} pieces")
    # if we reach here, all allocations succeeded
    order.status = OrderStatus.PROCESSING
    order.processed_by = staff.id
    session.add(order)
    session.commit()
    return {"status": "processing", "order_id": order.id, "allocations": allocation_log}

# Ship order
@router.post("/{order_id}/ship")
def ship_order(order_id: int, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.STAFF, Role.MASTER, Role.ADMIN, Role.DRIVER))):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="Order must be in processing state to ship")
    order.status = OrderStatus.SHIPPED
    order.shipped_by = user.id
    session.add(order)
    session.commit()
    return {"status": "shipped", "order_id": order.id, "shipped_by": user.id}

# Receive order (customer confirms receipt)
@router.post("/{order_id}/receive")
def receive_order(order_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # only customer who placed (or admin) can mark received
    if user.role not in (Role.MASTER, Role.ADMIN) and order.customer_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to mark received")
    if order.status != OrderStatus.SHIPPED:
        raise HTTPException(status_code=400, detail="Order must be shipped before receiving")
    order.status = OrderStatus.RECEIVED
    order.received_by = user.id
    session.add(order)
    session.commit()
    return {"status": "received", "order_id": order.id}

# Customer: report shortage or request return
@router.post("/{order_id}/return")
def return_order(order_id: int, reason: str, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.customer_id != user.id and user.role not in (Role.MASTER, Role.ADMIN):
        raise HTTPException(status_code=403, detail="Not allowed to return this order")
    # Allowed if order received/shipped recently — real logic can be stricter
    if order.status not in (OrderStatus.SHIPPED, OrderStatus.RECEIVED):
        raise HTTPException(status_code=400, detail="Order not in shippable/received state for returns")

    # Mark returned (business logic: decide whether to restock or quarantine)
    order.status = OrderStatus.RETURNED
    session.add(order)
    # create StockMovement IN for returned items (simplified: assume full return of all final_qty)
    items = session.exec(select(OrderItem).where(OrderItem.order_id == order_id)).all()
    return_log = []
    for oi in items:
        if oi.final_qty <= 0:
            continue
        # For returned items, we can add to a "quarantine" batch or re-add to stock as new batch.
        # Simple approach: create a StockBatch with returned qty and no expiry (or mark notes).
        rb = StockBatch(product_id=oi.product_id, batch_no=f"return-order-{order.id}", quantity=oi.final_qty, unit="pcs", expire_date=None, notes=f"Returned: {reason}")
        session.add(rb)
        session.flush()
        sm = StockMovement(product_id=oi.product_id, qty=oi.final_qty, type="IN", ref=f"return:order:{order.id}", performed_by=user.id, notes=reason)
        session.add(sm)
        return_log.append({"product_id": oi.product_id, "qty": oi.final_qty, "new_batch_id": rb.id})
    session.commit()
    return {"status": "returned", "order_id": order.id, "returns": return_log}

# Optional: report short delivery (customer claims fewer pieces)
@router.post("/{order_id}/report-shortage")
def report_shortage(order_id: int, product_id: int, claimed_short_by: int, note: str | None = None, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.customer_id != user.id and user.role not in (Role.MASTER, Role.ADMIN):
        raise HTTPException(status_code=403, detail="Not allowed")
    # store as audit / create a simple record via StockMovement notes or in a dedicated complaints table (not implemented)
    # Here: create an AuditLog entry via existing AuditLog model if exists, else just respond
    # For now we'll just return the report and leave action to admin/accounts.
    return {"status": "reported", "order_id": order_id, "product_id": product_id, "short_by": claimed_short_by, "note": note}
