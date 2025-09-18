from fastapi import APIRouter, Depends
from sqlmodel import select
from ..database import get_session
from ..models import StockLevel, Product
from ..deps import require_roles
from ..models import Role

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.get("/low-stock", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.ACCOUNTANT))])
def low_stock(session=Depends(get_session)):
    stmt = select(Product, StockLevel).where(Product.id == StockLevel.product_id).where(StockLevel.quantity <= Product.re_order_level)
    rows = session.exec(stmt).all()
    # return simplified list
    return [{"product_id": p.id, "sku": p.sku, "name": p.name, "qty": sl.quantity, "reorder": p.re_order_level} for p, sl in rows]

@router.get("/stock-summary", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.ACCOUNTANT))])
def stock_summary(session=Depends(get_session)):
    stmt = select(Product, StockLevel).where(Product.id == StockLevel.product_id)
    rows = session.exec(stmt).all()
    return [{"product_id": p.id, "sku": p.sku, "name": p.name, "qty": sl.quantity} for p, sl in rows]
