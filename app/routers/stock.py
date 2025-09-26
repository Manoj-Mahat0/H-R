# app/routers/stock.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session, select
from typing import List
from datetime import datetime, timedelta

from ..database import get_session
from ..models import StockBatch, Product
from ..schemas import StockBatchCreate, StockBatchRead, StockConsumeIn
from ..deps import require_roles
from ..models import Role

router = APIRouter(prefix="/api/stock", tags=["stock"])

# create/add a stock batch
@router.post("/", response_model=StockBatchRead)
def add_stock_batch(
    payload: StockBatchCreate,
    session: Session = Depends(get_session),
    user = Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF))
):
    # validate product exists
    if session.get(Product, payload.product_id) is None:
        raise HTTPException(status_code=400, detail="Product not found")
    if payload.quantity < 0:
        raise HTTPException(status_code=400, detail="quantity must be >= 0")

    batch = StockBatch(
        product_id=payload.product_id,
        batch_no=payload.batch_no,
        quantity=payload.quantity,
        unit=payload.unit,
        expire_date=payload.expire_date,
        notes=payload.notes,
        created_by=user.id,
    )
    session.add(batch)
    session.commit()
    session.refresh(batch)
    return batch

# list batches (optionally for a product)
@router.get("/", response_model=List[StockBatchRead])
def list_batches(
    product_id: int | None = Query(None),
    only_active: bool = Query(True),
    session: Session = Depends(get_session)
):
    stmt = select(StockBatch)
    if product_id is not None:
        stmt = stmt.where(StockBatch.product_id == product_id)
    if only_active:
        stmt = stmt.where(StockBatch.active == True)
    stmt = stmt.order_by(StockBatch.expire_date, StockBatch.added_at)
    rows = session.exec(stmt).all()
    return rows

# get soon-to-expire within N days
@router.get("/expiring-soon", response_model=List[StockBatchRead])
def expiring_soon(days: int = Query(30, ge=1), session: Session = Depends(get_session)):
    now = datetime.utcnow()
    to = now + timedelta(days=days)
    stmt = select(StockBatch).where(StockBatch.expire_date != None).where(StockBatch.expire_date <= to).where(StockBatch.active == True).order_by(StockBatch.expire_date)
    return session.exec(stmt).all()

# consume stock (will reduce quantity across batches using FIFO by default)
@router.post("/consume")
def consume_stock(payload: StockConsumeIn, session: Session = Depends(get_session), user = Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF))):
    if payload.qty <= 0:
        raise HTTPException(status_code=400, detail="qty must be > 0")
    if session.get(Product, payload.product_id) is None:
        raise HTTPException(status_code=400, detail="Product not found")

    remaining = payload.qty
    consumed = []  # list of (batch_id, qty_consumed)

    if payload.method == "specific_batch":
        if not payload.batch_id:
            raise HTTPException(status_code=400, detail="batch_id required for specific_batch")
        batch = session.get(StockBatch, payload.batch_id)
        if not batch or not batch.active or batch.product_id != payload.product_id:
            raise HTTPException(status_code=404, detail="Batch not found")
        take = min(batch.quantity, remaining)
        if take <= 0:
            raise HTTPException(status_code=400, detail="No stock available in the batch")
        batch.quantity -= take
        remaining -= take
        consumed.append({"batch_id": batch.id, "qty": take})
        session.add(batch)
    else:
        # fifo by default: earliest expire_date first, then added_at
        stmt = select(StockBatch).where(StockBatch.product_id == payload.product_id).where(StockBatch.active == True).where(StockBatch.quantity > 0).order_by(StockBatch.expire_date.nullsfirst(), StockBatch.added_at)
        for b in session.exec(stmt).all():
            if remaining <= 0:
                break
            take = min(b.quantity, remaining)
            if take <= 0:
                continue
            b.quantity -= take
            remaining -= take
            consumed.append({"batch_id": b.id, "qty": take})
            session.add(b)

    if remaining > 0:
        # not enough stock — you can either fail or commit partial. Here we rollback and fail.
        session.rollback()
        raise HTTPException(status_code=400, detail=f"Not enough stock to consume. Needed {payload.qty}, available {payload.qty - remaining}")

    session.commit()
    # optionally: create StockMovement / audit log entries here
    return {"status": "ok", "consumed": consumed, "requested": payload.qty}

# soft-delete / deactivate batch
@router.delete("/{batch_id}")
def delete_batch(batch_id: int, session: Session = Depends(get_session), user = Depends(require_roles(Role.MASTER, Role.ADMIN))):
    b = session.get(StockBatch, batch_id)
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")
    b.active = False
    session.add(b)
    session.commit()
    return {"status": "deactivated", "batch_id": batch_id}
