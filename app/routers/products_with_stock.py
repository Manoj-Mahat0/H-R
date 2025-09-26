# app/routers/products_with_stock.py

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status, Body, Query
from sqlmodel import SQLModel, Field, Session, select
from typing import Optional, List, Dict, Any
from datetime import datetime
import os, shutil, json
from uuid import uuid4

from ..database import get_session
from ..deps import require_roles, get_current_user
from ..models import (
    Product,
    StockLevel,
    Category,
    Tag,
    ProductCategory,
    ProductTag,
    User,
    StockMovement,
    Role,
)

# Try to import StockBatch from central models; if not present define a local one
try:
    from ..models import StockBatch  # type: ignore
    STOCKBATCH_EXTERNAL = True
except Exception:
    STOCKBATCH_EXTERNAL = False
    # local StockBatch (only define if not present). If you later add StockBatch to models.py, remove this local class.
    class StockBatch(SQLModel, table=True):
        id: Optional[int] = Field(default=None, primary_key=True)
        product_id: int = Field(foreign_key="product.id", index=True)
        batch_no: Optional[str] = None
        quantity: int = Field(default=0)
        unit: Optional[str] = Field(default="pcs")
        expire_date: Optional[datetime] = None
        added_at: datetime = Field(default_factory=datetime.utcnow)
        notes: Optional[str] = None
        active: bool = Field(default=True)

# Ensure uploads dir
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/api/products-with-stock", tags=["products-with-stock"])


# --------------------
# Pydantic schemas (for request/response)
# --------------------
from pydantic import BaseModel

class NewProductOut(BaseModel):
    id: int
    sku: str
    name: str
    weight: float
    price: float
    gst_rate: float
    description: Optional[str]
    image_url: Optional[str]
    category: Optional[str]
    tags: List[str]
    stock_quantity: int
    initial_batch: Optional[Dict[str, Any]] = None
    active: bool

    class Config:
        orm_mode = True

class BatchCreateIn(BaseModel):
    product_id: int
    batch_no: Optional[str] = None
    quantity: int
    unit: Optional[str] = "pcs"
    expire_date: Optional[str] = None  # ISO
    notes: Optional[str] = None

class BatchUpdateIn(BaseModel):
    quantity: Optional[int] = None
    unit: Optional[str] = None
    expire_date: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None

class BatchOut(BaseModel):
    id: int
    product_id: int
    batch_no: Optional[str]
    quantity: int
    unit: Optional[str]
    expire_date: Optional[datetime]
    added_at: datetime
    notes: Optional[str]
    active: bool

    class Config:
        orm_mode = True

# --------------------
# Helpers
# --------------------
def _get_category_names(session: Session, product_id: int) -> List[str]:
    stmt = select(Category).join(ProductCategory, Category.id == ProductCategory.category_id).where(ProductCategory.product_id == product_id)
    rows = session.exec(stmt).all()
    return [r.name for r in rows]

def _get_tag_names(session: Session, product_id: int) -> List[str]:
    stmt = select(Tag).join(ProductTag, Tag.id == ProductTag.tag_id).where(ProductTag.product_id == product_id)
    rows = session.exec(stmt).all()
    return [r.name for r in rows]

def _attach_categories_and_tags(session: Session, product_id: int, category_ids: List[int], tag_ids: List[int]):
    # remove existing associations first (idempotent)
    stmt_pc = select(ProductCategory).where(ProductCategory.product_id == product_id)
    for row in session.exec(stmt_pc).all():
        session.delete(row)
    stmt_pt = select(ProductTag).where(ProductTag.product_id == product_id)
    for row in session.exec(stmt_pt).all():
        session.delete(row)
    session.commit()

    for cid in category_ids:
        session.add(ProductCategory(product_id=product_id, category_id=cid))
    for tid in tag_ids:
        session.add(ProductTag(product_id=product_id, tag_id=tid))
    session.commit()

def _parse_iso(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str.replace("Z", ""))
    except Exception:
        raise HTTPException(status_code=400, detail="expire_date must be ISO format, e.g. 2026-01-31T00:00:00")

# --------------------
# Endpoint: create product + optional initial stock batch
# --------------------
@router.post("/create", response_model=NewProductOut, status_code=status.HTTP_201_CREATED)
def create_product_with_stock(
    sku: str = Form(...),
    name: str = Form(...),
    weight: float = Form(0.0),
    price: float = Form(0.0),
    gst_rate: float = Form(0.0),
    description: Optional[str] = Form(None),
    category_ids: Optional[str] = Form("[]"),   # JSON array string like "[1,2]"
    tag_ids: Optional[str] = Form("[]"),        # JSON array string like "[3,4]"
    file: UploadFile = File(...),               # required binary image/file
    initial_quantity: int = Form(0),
    unit: str = Form("pcs"),
    expire_date: Optional[str] = Form(None),    # ISO string
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF)),
):
    """
    Create a product AND initialize stock (StockLevel) and an initial StockBatch (optional).
    Required: sku, name, file (binary).
    category_ids and tag_ids must be JSON arrays passed as strings.
    """
    # parse category/tag ids
    try:
        category_ids_list = json.loads(category_ids) if category_ids else []
        tag_ids_list = json.loads(tag_ids) if tag_ids else []
        if not isinstance(category_ids_list, list) or not isinstance(tag_ids_list, list):
            raise ValueError
    except Exception:
        raise HTTPException(status_code=400, detail="category_ids and tag_ids must be JSON arrays (e.g. [1,2])")

    # validate categories & tags
    for cid in category_ids_list:
        if session.get(Category, cid) is None:
            raise HTTPException(status_code=400, detail=f"Category id {cid} not found")
    for tid in tag_ids_list:
        if session.get(Tag, tid) is None:
            raise HTTPException(status_code=400, detail=f"Tag id {tid} not found")

    # SKU uniqueness
    stmt = select(Product).where(Product.sku == sku)
    if session.exec(stmt).one_or_none():
        raise HTTPException(status_code=400, detail="SKU already exists")

    # save file
    try:
        ext = os.path.splitext(file.filename)[1] or ".jpg"
        fname = f"{uuid4().hex}{ext}"
        dest = os.path.join(UPLOAD_DIR, fname)
        with open(dest, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
    finally:
        try:
            file.file.close()
        except Exception:
            pass

    image_url = f"/uploads/{fname}"

    # create product
    prod = Product(
        sku=sku,
        name=name,
        weight=weight,
        price=price,
        gst_rate=gst_rate,
        description=description,
        image_path=image_url,
        active=True,
    )
    session.add(prod)
    session.commit()
    session.refresh(prod)

    # create or update StockLevel
    sl = session.exec(select(StockLevel).where(StockLevel.product_id == prod.id)).one_or_none()
    if not sl:
        sl = StockLevel(product_id=prod.id, quantity=max(0, int(initial_quantity)))
        session.add(sl)
        session.commit()
        session.refresh(sl)
    else:
        if initial_quantity and int(initial_quantity) > 0:
            sl.quantity = (sl.quantity or 0) + int(initial_quantity)
            session.add(sl)
            session.commit()
            session.refresh(sl)

    created_batch = None
    if initial_quantity and int(initial_quantity) > 0:
        exp_dt = None
        if expire_date:
            exp_dt = _parse_iso(expire_date)
        # Create StockBatch (use external model if available)
        try:
            batch = StockBatch(
                product_id=prod.id,
                batch_no=f"init-{prod.id}-{uuid4().hex[:6]}",
                quantity=int(initial_quantity),
                unit=unit,
                expire_date=exp_dt,
                added_at=datetime.utcnow(),
                notes="initial stock on product creation",
                active=True,
            )
            session.add(batch)
            session.commit()
            session.refresh(batch)
            created_batch = batch
        except Exception as e:
            # rollback only the batch creation; stocklevel exists
            session.rollback()
            # don't fail the entire product creation for batch errors, but surface in return if needed
            created_batch = None

        # create StockMovement IN audit
        try:
            sm = StockMovement(product_id=prod.id, qty=int(initial_quantity), type="IN", ref=f"init_batch:{prod.id}", performed_by=user.id if user else None, notes="initial stock added")
            session.add(sm)
            session.commit()
        except Exception:
            session.rollback()

    # attach categories & tags
    try:
        _attach_categories_and_tags(session, prod.id, category_ids_list, tag_ids_list)
    except Exception:
        session.rollback()

    # prepare response
    category_names = _get_category_names(session, prod.id)
    tag_names = _get_tag_names(session, prod.id)
    category_value = ", ".join(category_names) if category_names else None

    resp = NewProductOut(
        id=prod.id,
        sku=prod.sku,
        name=prod.name,
        weight=prod.weight or 0.0,
        price=prod.price,
        gst_rate=prod.gst_rate,
        description=prod.description,
        image_url=prod.image_path,
        category=category_value,
        tags=tag_names,
        stock_quantity=sl.quantity if sl else 0,
        initial_batch={
            "id": created_batch.id,
            "batch_no": created_batch.batch_no,
            "quantity": created_batch.quantity,
            "expire_date": created_batch.expire_date.isoformat() if created_batch and created_batch.expire_date else None,
        } if created_batch else None,
        active=prod.active,
    )

    return resp


# --------------------
# Products: list / get / update / delete
# --------------------


# GET - list all products with stock summary
@router.get("/products")
def list_all_products(session: Session = Depends(get_session)):
    """
    Returns list of products with basic fields + stock summary (stocklevel + batches_total).
    Public endpoint (no auth) — change if you want restricted access.
    """
    stmt = select(Product)
    prods = session.exec(stmt).all()
    results = []
    for p in prods:
        # stocklevel
        sl = session.exec(select(StockLevel).where(StockLevel.product_id == p.id)).one_or_none()
        stocklevel_qty = sl.quantity if sl else 0
        # batches
        batches = session.exec(select(StockBatch).where(StockBatch.product_id == p.id).where(StockBatch.active == True)).all()
        batches_total = sum((b.quantity or 0) for b in batches)
        cat_names = _get_category_names(session, p.id)
        tag_names = _get_tag_names(session, p.id)
        results.append({
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "weight": p.weight,
            "price": p.price,
            "gst_rate": p.gst_rate,
            "description": p.description,
            "image_url": p.image_path,
            "category": ", ".join(cat_names) if cat_names else None,
            "tags": tag_names,
            "stocklevel_quantity": stocklevel_qty,
            "batches_total_quantity": batches_total,
            "active": p.active,
        })
    return results

# GET - single product detail
@router.get("/products/{product_id}")
def get_product(product_id: int, session: Session = Depends(get_session)):
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    sl = session.exec(select(StockLevel).where(StockLevel.product_id == p.id)).one_or_none()
    stocklevel_qty = sl.quantity if sl else 0
    batches = session.exec(select(StockBatch).where(StockBatch.product_id == p.id)).all()
    cat_names = _get_category_names(session, p.id)
    tag_names = _get_tag_names(session, p.id)
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "weight": p.weight,
        "price": p.price,
        "gst_rate": p.gst_rate,
        "description": p.description,
        "image_url": p.image_path,
        "category": ", ".join(cat_names) if cat_names else None,
        "tags": tag_names,
        "stocklevel_quantity": stocklevel_qty,
        "batches": [ {
            "id": b.id,
            "batch_no": b.batch_no,
            "quantity": b.quantity,
            "expire_date": b.expire_date,
            "active": b.active
        } for b in batches ],
        "active": p.active,
    }

# PATCH - update product (fields + optional image + categories/tags + optional stocklevel set)
@router.patch("/products/{product_id}", status_code=200)
def update_product(
    product_id: int,
    sku: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    weight: Optional[float] = Form(None),
    price: Optional[float] = Form(None),
    gst_rate: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    category_ids: Optional[str] = Form(None),  # JSON string or None
    tag_ids: Optional[str] = Form(None),       # JSON string or None
    file: Optional[UploadFile] = File(None),
    # optional: set stocklevel explicitly (absolute number)
    stocklevel_quantity: Optional[int] = Form(None),
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.MASTER, Role.ADMIN)),
):
    """
    Edit product. Only MASTER/ADMIN allowed.
    To replace image, send file binary. To change categories/tags pass JSON arrays as strings.
    If stocklevel_quantity provided, StockLevel will be set to that value (and a StockMovement recorded).
    """
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    # sku uniqueness check
    if sku is not None and sku != p.sku:
        stmt = select(Product).where(Product.sku == sku).where(Product.id != product_id)
        if session.exec(stmt).one_or_none():
            raise HTTPException(status_code=400, detail="SKU already exists")
        p.sku = sku

    if name is not None:
        p.name = name
    if weight is not None:
        p.weight = weight
    if price is not None:
        p.price = price
    if gst_rate is not None:
        p.gst_rate = gst_rate
    if description is not None:
        p.description = description

    # handle image replacement
    if file is not None:
        try:
            ext = os.path.splitext(file.filename)[1] or ".jpg"
            fname = f"{uuid4().hex}{ext}"
            dest = os.path.join(UPLOAD_DIR, fname)
            with open(dest, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            # optionally delete old file (not implemented)
            p.image_path = f"/uploads/{fname}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
        finally:
            try:
                file.file.close()
            except Exception:
                pass

    # parse categories/tags if provided
    if category_ids is not None or tag_ids is not None:
        try:
            category_ids_list = json.loads(category_ids) if category_ids else []
            tag_ids_list = json.loads(tag_ids) if tag_ids else []
            if not isinstance(category_ids_list, list) or not isinstance(tag_ids_list, list):
                raise ValueError
        except Exception:
            raise HTTPException(status_code=400, detail="category_ids and tag_ids must be JSON arrays (e.g. [1,2])")

        # validate
        for cid in category_ids_list:
            if session.get(Category, cid) is None:
                raise HTTPException(status_code=400, detail=f"Category id {cid} not found")
        for tid in tag_ids_list:
            if session.get(Tag, tid) is None:
                raise HTTPException(status_code=400, detail=f"Tag id {tid} not found")

        _attach_categories_and_tags(session, p.id, category_ids_list, tag_ids_list)

    session.add(p)

    # handle stocklevel explicit set
    if stocklevel_quantity is not None:
        if stocklevel_quantity < 0:
            raise HTTPException(status_code=400, detail="stocklevel_quantity cannot be negative")
        sl = session.exec(select(StockLevel).where(StockLevel.product_id == p.id)).one_or_none()
        old_q = sl.quantity if sl else 0
        delta = stocklevel_quantity - old_q
        if sl:
            sl.quantity = stocklevel_quantity
            session.add(sl)
        else:
            sl = StockLevel(product_id=p.id, quantity=stocklevel_quantity)
            session.add(sl)
        # record StockMovement for delta if non-zero
        try:
            if delta != 0:
                mtype = "IN" if delta > 0 else "OUT"
                sm = StockMovement(product_id=p.id, qty=abs(delta), type=mtype, ref=f"product_update:{p.id}", performed_by=user.id if user else None, notes="stocklevel set via product update")
                session.add(sm)
        except Exception:
            pass

    session.commit()
    session.refresh(p)

    # build response similar to get_product
    sl = session.exec(select(StockLevel).where(StockLevel.product_id == p.id)).one_or_none()
    stocklevel_qty = sl.quantity if sl else 0
    batches = session.exec(select(StockBatch).where(StockBatch.product_id == p.id)).all()
    cat_names = _get_category_names(session, p.id)
    tag_names = _get_tag_names(session, p.id)

    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "weight": p.weight,
        "price": p.price,
        "gst_rate": p.gst_rate,
        "description": p.description,
        "image_url": p.image_path,
        "category": ", ".join(cat_names) if cat_names else None,
        "tags": tag_names,
        "stocklevel_quantity": stocklevel_qty,
        "batches": [ {"id": b.id, "batch_no": b.batch_no, "quantity": b.quantity, "expire_date": b.expire_date, "active": b.active} for b in batches ],
        "active": p.active,
    }

# DELETE - soft (default) or hard
# use inside your products router file
from sqlalchemy.exc import IntegrityError

@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    hard: bool = Query(False),
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.MASTER)),
):
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    if not hard:
        p.active = False
        session.add(p)
        session.commit()
        return {"status": "deactivated", "product_id": product_id}

    # HARD delete path: delete dependents in a safe order
    try:
        # 1) OrderItem (orders referencing product)
        try:
            from ..models import OrderItem
            stmt_oi = select(OrderItem).where(OrderItem.product_id == p.id)
            for row in session.exec(stmt_oi).all():
                session.delete(row)
        except Exception:
            # If OrderItem model not present, ignore
            pass

        # 2) PurchaseItem (if any)
        try:
            from ..models import PurchaseItem
            stmt_pi = select(PurchaseItem).where(PurchaseItem.product_id == p.id)
            for row in session.exec(stmt_pi).all():
                session.delete(row)
        except Exception:
            pass

        # 3) StockMovement
        try:
            stmt_sm = select(StockMovement).where(StockMovement.product_id == p.id)
            for row in session.exec(stmt_sm).all():
                session.delete(row)
        except Exception:
            pass

        # 4) StockBatch
        try:
            stmt_sb = select(StockBatch).where(StockBatch.product_id == p.id)
            for row in session.exec(stmt_sb).all():
                session.delete(row)
        except Exception:
            pass

        # 5) StockLevel
        try:
            stmt_sl = select(StockLevel).where(StockLevel.product_id == p.id)
            for row in session.exec(stmt_sl).all():
                session.delete(row)
        except Exception:
            pass

        # 6) ProductCategory / ProductTag (association tables)
        stmt_pc = select(ProductCategory).where(ProductCategory.product_id == p.id)
        for row in session.exec(stmt_pc).all():
            session.delete(row)
        stmt_pt = select(ProductTag).where(ProductTag.product_id == p.id)
        for row in session.exec(stmt_pt).all():
            session.delete(row)

        # commit deletions of dependents, then delete product
        session.commit()

        session.delete(p)
        session.commit()
        return {"status": "deleted", "product_id": product_id, "hard": True}
    except IntegrityError as ie:
        session.rollback()
        # return clear message so frontend can show reason
        raise HTTPException(status_code=400, detail=f"Could not delete product due to DB integrity: {ie.orig}")
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to hard delete product: {e}")

# --------------------
# Stock batch endpoints (list / get / create / patch / deactivate)
# --------------------

@router.get("/stock", response_model=List[BatchOut])
def list_batches(
    product_id: Optional[int] = Query(None),
    only_active: bool = Query(True),
    limit: int = Query(200, ge=1, le=2000),
    session: Session = Depends(get_session),
):
    """
    List stock batches. If product_id provided, filter by product.
    """
    stmt = select(StockBatch)
    if product_id is not None:
        stmt = stmt.where(StockBatch.product_id == product_id)
    if only_active:
        stmt = stmt.where(StockBatch.active == True)
    stmt = stmt.order_by(StockBatch.expire_date, StockBatch.added_at).limit(limit)
    rows = session.exec(stmt).all()
    return rows

@router.get("/stock/batches/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: int, session: Session = Depends(get_session)):
    b = session.get(StockBatch, batch_id)
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")
    return b

@router.post("/stock/batches", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(payload: BatchCreateIn = Body(...), session: Session = Depends(get_session), user: User = Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF))):
    """
    Create a new StockBatch and add quantity to StockLevel. Creates a StockMovement IN record.
    """
    product = session.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=400, detail="Product not found")
    if payload.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be > 0")

    exp_dt = _parse_iso(payload.expire_date)

    b = StockBatch(
        product_id=payload.product_id,
        batch_no=payload.batch_no,
        quantity=payload.quantity,
        unit=payload.unit,
        expire_date=exp_dt,
        notes=payload.notes,
        added_at=datetime.utcnow(),
        active=True,
    )
    session.add(b)

    # Update or create StockLevel
    sl = session.exec(select(StockLevel).where(StockLevel.product_id == payload.product_id)).one_or_none()
    if sl:
        sl.quantity = (sl.quantity or 0) + payload.quantity
        session.add(sl)
    else:
        sl = StockLevel(product_id=payload.product_id, quantity=payload.quantity)
        session.add(sl)

    # Add StockMovement record
    try:
        sm = StockMovement(product_id=payload.product_id, qty=payload.quantity, type="IN", ref=f"batch:{b.batch_no or 'new'}", performed_by=user.id if user else None, notes=f"Added batch: {payload.batch_no or ''}")
        session.add(sm)
    except Exception:
        # ignore if StockMovement signature mismatches
        pass

    session.commit()
    session.refresh(b)
    return b

@router.patch("/stock/batches/{batch_id}", response_model=BatchOut)
def update_batch(batch_id: int, payload: BatchUpdateIn = Body(...), session: Session = Depends(get_session), user: User = Depends(require_roles(Role.MASTER, Role.ADMIN))):
    """
    Update a batch fields. If quantity changes, StockLevel adjusted accordingly and StockMovement created.
    """
    b = session.get(StockBatch, batch_id)
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")

    delta = 0
    if payload.quantity is not None:
        if payload.quantity < 0:
            raise HTTPException(status_code=400, detail="quantity cannot be negative")
        delta = payload.quantity - (b.quantity or 0)
        b.quantity = payload.quantity
    if payload.unit is not None:
        b.unit = payload.unit
    if payload.expire_date is not None:
        b.expire_date = _parse_iso(payload.expire_date)
    if payload.notes is not None:
        b.notes = payload.notes
    if payload.active is not None:
        b.active = payload.active

    session.add(b)

    # adjust StockLevel
    if delta != 0:
        sl = session.exec(select(StockLevel).where(StockLevel.product_id == b.product_id)).one_or_none()
        if not sl:
            if delta < 0:
                raise HTTPException(status_code=400, detail="Cannot reduce from non-existing stock level")
            sl = StockLevel(product_id=b.product_id, quantity=delta)
            session.add(sl)
        else:
            new_q = (sl.quantity or 0) + delta
            if new_q < 0:
                raise HTTPException(status_code=400, detail=f"StockLevel would become negative ({new_q})")
            sl.quantity = new_q
            session.add(sl)

        try:
            mtype = "IN" if delta > 0 else "OUT"
            sm = StockMovement(product_id=b.product_id, qty=abs(delta), type=mtype, ref=f"batch_update:{b.id}", performed_by=user.id if user else None, notes=f"Batch update delta {delta}")
            session.add(sm)
        except Exception:
            pass

    session.commit()
    session.refresh(b)
    return b

@router.delete("/stock/batches/{batch_id}")
def deactivate_batch(batch_id: int, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.MASTER, Role.ADMIN))):
    """
    Soft-deactivate a batch. Removes its qty from StockLevel and records StockMovement OUT.
    """
    b = session.get(StockBatch, batch_id)
    if not b:
        raise HTTPException(status_code=404, detail="Batch not found")
    if not b.active:
        return {"status": "already_deactivated", "batch_id": batch_id}

    qty = b.quantity or 0
    b.active = False
    session.add(b)

    sl = session.exec(select(StockLevel).where(StockLevel.product_id == b.product_id)).one_or_none()
    if sl:
        new_q = (sl.quantity or 0) - qty
        if new_q < 0:
            sl.quantity = 0
        else:
            sl.quantity = new_q
        session.add(sl)

    try:
        sm = StockMovement(product_id=b.product_id, qty=qty, type="OUT", ref=f"batch_deactivate:{b.id}", performed_by=user.id if user else None, notes="Batch deactivated")
        session.add(sm)
    except Exception:
        pass

    session.commit()
    return {"status": "deactivated", "batch_id": batch_id, "removed_qty": qty}

@router.get("/stock/product/{product_id}/summary")
def product_stock_summary(product_id: int, session: Session = Depends(get_session)):
    """
    Aggregated view: StockLevel quantity + active batches list & totals.
    """
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    batches = session.exec(select(StockBatch).where(StockBatch.product_id == product_id).where(StockBatch.active == True)).all()
    total_from_batches = sum((b.quantity or 0) for b in batches)
    sl = session.exec(select(StockLevel).where(StockLevel.product_id == product_id)).one_or_none()
    stocklevel_qty = sl.quantity if sl else 0

    return {
        "product_id": product_id,
        "sku": getattr(product, "sku", None),
        "name": getattr(product, "name", None),
        "stocklevel_quantity": stocklevel_qty,
        "batches_count": len(batches),
        "batches_total_quantity": total_from_batches,
        "batches": [BatchOut.from_orm(b) for b in batches],
    }
