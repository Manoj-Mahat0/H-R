# app/routers/stock.py
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from ..database import get_session
from ..models import StockLevel, StockMovement, Product, AuditLog, User
from ..deps import require_roles, get_current_user
from ..models import Role
from sqlmodel import Session
from datetime import datetime
from typing import List, Optional

router = APIRouter(prefix="/api/stock", tags=["stock"])


# ----------------- Pydantic bodies -----------------------------------------
class IssueIn(BaseModel):
    product_id: int
    qty: int
    ref: Optional[str] = None
    notes: Optional[str] = None
    # optional when issuing a specific received batch
    received_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class AdjustIn(BaseModel):
    product_id: int
    qty: int  # positive (increase) OR negative (decrease)
    reason: str
    # when adding stock via adjust, vendor may send received/expiry
    received_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class CorrectIn(BaseModel):
    product_id: int
    quantity: int  # absolute quantity to set
    reason: str
    # set received_date/expiry_date for the correction (optional)
    received_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None


class UndoIn(BaseModel):
    movement_id: int
    reason: str


# ----------------- helpers --------------------------------------------------
def _ensure_stocklevel(session: Session, product_id: int) -> StockLevel:
    stmt = select(StockLevel).where(StockLevel.product_id == product_id)
    sl = session.exec(stmt).one_or_none()
    if not sl:
        sl = StockLevel(product_id=product_id, quantity=0)
        session.add(sl)
        session.commit()
        session.refresh(sl)
    return sl


def _get_category_tag_summary(session: Session, product: Product) -> str:
    return product.name if product else f"Product #{getattr(product, 'id', '?')}"


# ----------------- read endpoints -----------------------------------------
@router.get("/", response_model=List[StockLevel])
def list_stock(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    stmt = select(StockLevel)
    return session.exec(stmt).all()


@router.get("/product/{product_id}")
def get_stock_for_product(product_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    sl_stmt = select(StockLevel).where(StockLevel.product_id == product_id)
    sl = session.exec(sl_stmt).one_or_none()
    if not sl:
        raise HTTPException(status_code=404, detail="Stock level not found")
    prod = session.get(Product, product_id)
    return {
        "product_id": product_id,
        "product_name": prod.name if prod else None,
        "quantity": sl.quantity,
    }


@router.get("/movements", response_model=List[StockMovement])
def list_movements(
    product_id: Optional[int] = Query(None),
    limit: int = Query(100, le=1000),
    skip: int = Query(0, ge=0),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    stmt = select(StockMovement).order_by(StockMovement.timestamp.desc())
    if product_id is not None:
        stmt = stmt.where(StockMovement.product_id == product_id)
    rows = session.exec(stmt.offset(skip).limit(limit)).all()
    return rows


@router.get("/movements/{movement_id}", response_model=StockMovement)
def get_movement(movement_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    mv = session.get(StockMovement, movement_id)
    if not mv:
        raise HTTPException(status_code=404, detail="Movement not found")
    return mv


# ----------------- write endpoints ----------------------------------------
@router.post("/issue", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF))])
def issue_stock(payload: IssueIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    sl = _ensure_stocklevel(session, payload.product_id)
    if sl.quantity < payload.qty:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    prev = sl.quantity
    sl.quantity -= payload.qty

    mv = StockMovement(
        product_id=payload.product_id,
        qty=-abs(payload.qty),
        type="OUT",
        ref=payload.ref,
        performed_by=user.id,
        timestamp=datetime.utcnow(),
        received_date=payload.received_date,
        expiry_date=payload.expiry_date,
        notes=payload.notes,
    )

    session.add(sl)
    session.add(mv)
    log = AuditLog(user_id=user.id, action="issue", meta=f"product:{payload.product_id},from:{prev},to:{sl.quantity},qty:{payload.qty}")
    session.add(log)
    session.commit()
    return {"status": "issued", "quantity": sl.quantity}


@router.post("/adjust", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def adjust_stock(payload: AdjustIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    sl = _ensure_stocklevel(session, payload.product_id)
    prev = sl.quantity
    sl.quantity += payload.qty

    mv = StockMovement(
        product_id=payload.product_id,
        qty=payload.qty,
        type="ADJUST",
        performed_by=user.id,
        timestamp=datetime.utcnow(),
        received_date=payload.received_date,
        expiry_date=payload.expiry_date,
        notes=payload.reason,
    )

    session.add(sl)
    session.add(mv)
    log = AuditLog(user_id=user.id, action="adjust", meta=f"product:{payload.product_id},from:{prev},to:{sl.quantity},delta:{payload.qty}")
    session.add(log)
    session.commit()
    return {"status": "adjusted", "quantity": sl.quantity}


@router.post("/correct", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def correct_stock(payload: CorrectIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    sl = _ensure_stocklevel(session, payload.product_id)
    prev = sl.quantity
    new_q = int(payload.quantity)
    delta = new_q - prev
    if delta == 0:
        raise HTTPException(status_code=400, detail="Quantity identical — no change required")
    sl.quantity = new_q

    mv = StockMovement(
        product_id=payload.product_id,
        qty=delta,
        type="ADJUST",
        performed_by=user.id,
        timestamp=datetime.utcnow(),
        received_date=payload.received_date,
        expiry_date=payload.expiry_date,
        notes=f"correction: {payload.reason}",
    )

    session.add(sl)
    session.add(mv)
    log = AuditLog(user_id=user.id, action="correct", meta=f"product:{payload.product_id},from:{prev},to:{new_q},reason:{payload.reason}")
    session.add(log)
    session.commit()
    return {"status": "corrected", "from": prev, "to": new_q, "delta": delta}


@router.post("/undo", dependencies=[Depends(require_roles(Role.MASTER))])
def undo_movement(payload: UndoIn, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    mv = session.get(StockMovement, payload.movement_id)
    if not mv:
        raise HTTPException(status_code=404, detail="Movement not found")

    existing_rev_stmt = select(StockMovement).where(StockMovement.ref == f"undo-{mv.id}")
    existing_rev = session.exec(existing_rev_stmt).one_or_none()
    if existing_rev:
        raise HTTPException(status_code=400, detail="Movement already undone")

    sl = _ensure_stocklevel(session, mv.product_id)
    prev = sl.quantity
    rev_qty = -mv.qty
    sl.quantity += rev_qty

    rev = StockMovement(
        product_id=mv.product_id,
        qty=rev_qty,
        type="REVERSE",
        performed_by=user.id,
        timestamp=datetime.utcnow(),
        ref=f"undo-{mv.id}",
        received_date=mv.received_date,
        expiry_date=mv.expiry_date,
        notes=f"Undo movement {mv.id}: {payload.reason}",
    )

    session.add(sl)
    session.add(rev)
    log = AuditLog(user_id=user.id, action="undo", meta=f"movement:{mv.id},product:{mv.product_id},from:{prev},to:{sl.quantity},reason:{payload.reason}")
    session.add(log)
    session.commit()
    return {"status": "undone", "movement_id": mv.id, "new_quantity": sl.quantity}


# ----------------- utility endpoints --------------------------------------
@router.get("/summary")
def stock_summary(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    stmt = select(StockLevel)
    rows = session.exec(stmt).all()
    total_products = len(rows)
    low_stock = []
    for r in rows:
        prod = session.get(Product, r.product_id)
        reorder = getattr(prod, "re_order_level", None) or getattr(prod, "min_quantity", None) or 0
        if reorder and r.quantity <= reorder:
            low_stock.append({"product_id": r.product_id, "product_name": getattr(prod, "name", None), "quantity": r.quantity, "reorder_level": reorder})
    return {"total_products": total_products, "low_stock": low_stock}
