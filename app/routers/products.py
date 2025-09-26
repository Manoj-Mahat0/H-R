# app/routers/products.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlmodel import select
from ..database import get_session
from ..models import (
    Product,
    StockLevel,
    Category,
    Tag,
    ProductCategory,
    ProductTag,
    User,
)
from ..schemas import ProductRead
from ..deps import require_roles
from ..models import Role
from sqlmodel import Session
import os
import shutil
import json
from uuid import uuid4
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/api/products", tags=["products"])

# Ensure uploads folder
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ----- helpers --------------------------------------------------------------
def _get_category_names(session: Session, product_id: int) -> List[str]:
    stmt = select(Category).join(ProductCategory, Category.id == ProductCategory.category_id).where(ProductCategory.product_id == product_id)
    rows = session.exec(stmt).all()
    return [r.name for r in rows]


def _get_tag_names(session: Session, product_id: int) -> List[str]:
    stmt = select(Tag).join(ProductTag, Tag.id == ProductTag.tag_id).where(ProductTag.product_id == product_id)
    rows = session.exec(stmt).all()
    return [r.name for r in rows]


def _attach_categories_and_tags(session: Session, product_id: int, category_ids: List[int], tag_ids: List[int]):
    # remove existing associations first (idempotent on update)
    stmt_pc = select(ProductCategory).where(ProductCategory.product_id == product_id)
    for row in session.exec(stmt_pc).all():
        session.delete(row)
    stmt_pt = select(ProductTag).where(ProductTag.product_id == product_id)
    for row in session.exec(stmt_pt).all():
        session.delete(row)
    session.commit()

    # add new ones
    for cid in category_ids:
        session.add(ProductCategory(product_id=product_id, category_id=cid))
    for tid in tag_ids:
        session.add(ProductTag(product_id=product_id, tag_id=tid))
    session.commit()


# ----- create product (multipart/form-data; image required) -----------------
@router.post("/", response_model=ProductRead)
def create_product(
    sku: str = Form(...),
    name: str = Form(...),
    weight: float = Form(0.0),
    min_quantity: int = Form(0),
    max_quantity: int = Form(0),
    price: float = Form(0.0),
    gst_rate: float = Form(0.0),   # ✅ add here
    description: str | None = Form(None),
    category_ids: str | None = Form("[]"),  # JSON string like "[1,2]"
    tag_ids: str | None = Form("[]"),  # JSON string like "[3,4]"
    file: UploadFile = File(...),  # required image
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF)),
):
    # parse ids (must be JSON array strings)
    try:
        category_ids_list = json.loads(category_ids) if category_ids else []
        tag_ids_list = json.loads(tag_ids) if tag_ids else []
        if not isinstance(category_ids_list, list) or not isinstance(tag_ids_list, list):
            raise ValueError
    except Exception:
        raise HTTPException(status_code=400, detail="category_ids and tag_ids must be JSON arrays (e.g. [1,2])")

    # validate categories & tags exist
    for cid in category_ids_list:
        if session.get(Category, cid) is None:
            raise HTTPException(status_code=400, detail=f"Category id {cid} not found")
    for tid in tag_ids_list:
        if session.get(Tag, tid) is None:
            raise HTTPException(status_code=400, detail=f"Tag id {tid} not found")

    # unique SKU check
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
        min_quantity=min_quantity,
        max_quantity=max_quantity,
        price=price,
        gst_rate=gst_rate,   # ✅ set here
        description=description,
        image_path=image_url,
        active=True,
    )
    session.add(prod)
    session.commit()
    session.refresh(prod)

    # create stock level row
    sl = StockLevel(product_id=prod.id, quantity=0)
    session.add(sl)
    session.commit()

    # create associations
    _attach_categories_and_tags(session, prod.id, category_ids_list, tag_ids_list)

    # prepare response
    category_names = _get_category_names(session, prod.id)
    tag_names = _get_tag_names(session, prod.id)
    category_value = ", ".join(category_names) if category_names else None

    resp = {
        "id": prod.id,
        "sku": prod.sku,
        "name": prod.name,
        "weight": prod.weight,
        "min_quantity": prod.min_quantity,
        "max_quantity": prod.max_quantity,
        "price": prod.price,
        "gst_rate": prod.gst_rate,    # ✅ add
        "description": prod.description,
        "image_url": prod.image_path,
        "category": category_value,
        "tags": tag_names,
        "active": prod.active,
    }
    return resp
# ----- list products -------------------------------------------------------
@router.get("/", response_model=List[ProductRead])
def list_products(session: Session = Depends(get_session)):
    stmt = select(Product)
    products = session.exec(stmt).all()

    results: List[Dict[str, Any]] = []
    for p in products:
        category_names = _get_category_names(session, p.id)
        tag_names = _get_tag_names(session, p.id)
        category_value = ", ".join(category_names) if category_names else None
        results.append(
            {
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "weight": p.weight,
                "min_quantity": p.min_quantity,
                "max_quantity": p.max_quantity,
                "price": p.price,
                "gst_rate": p.gst_rate,    # ✅ add
                "description": p.description,
                "image_url": p.image_path,
                "category": category_value,
                "tags": tag_names,
            }
        )
    return results


# ----- update product (PATCH) ----------------------------------------------
@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    sku: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    weight: Optional[float] = Form(None),
    min_quantity: Optional[int] = Form(None),
    max_quantity: Optional[int] = Form(None),
    price: Optional[float] = Form(None),
    gst_rate: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    category_ids: Optional[str] = Form(None),  # JSON string or None
    tag_ids: Optional[str] = Form(None),  # JSON string or None
    file: Optional[UploadFile] = File(None),  # optional new image
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.MASTER, Role.ADMIN)),
):
    prod = session.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    # update fields if provided
    if sku is not None and sku != prod.sku:
        # check uniqueness
        stmt = select(Product).where(Product.sku == sku).where(Product.id != product_id)
        if session.exec(stmt).one_or_none():
            raise HTTPException(status_code=400, detail="SKU already exists")
        prod.sku = sku
    if name is not None:
        prod.name = name
    if weight is not None:
        prod.weight = weight
    if min_quantity is not None:
        prod.min_quantity = min_quantity
    if max_quantity is not None:
        prod.max_quantity = max_quantity
    if price is not None:
        prod.price = price
    if gst_rate is not None:
        prod.gst_rate = gst_rate
    if description is not None:
        prod.description = description

    # handle optional image replacement
    if file is not None:
        try:
            ext = os.path.splitext(file.filename)[1] or ".jpg"
            fname = f"{uuid4().hex}{ext}"
            dest = os.path.join(UPLOAD_DIR, fname)
            with open(dest, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            prod.image_path = f"/uploads/{fname}"
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
        finally:
            try:
                file.file.close()
            except Exception:
                pass

    # parse and attach new categories/tags if provided
    if category_ids is not None or tag_ids is not None:
        try:
            category_ids_list = json.loads(category_ids) if category_ids else []
            tag_ids_list = json.loads(tag_ids) if tag_ids else []
            if not isinstance(category_ids_list, list) or not isinstance(tag_ids_list, list):
                raise ValueError
        except Exception:
            raise HTTPException(status_code=400, detail="category_ids and tag_ids must be JSON arrays (e.g. [1,2])")

        # validate exist
        for cid in category_ids_list:
            if session.get(Category, cid) is None:
                raise HTTPException(status_code=400, detail=f"Category id {cid} not found")
        for tid in tag_ids_list:
            if session.get(Tag, tid) is None:
                raise HTTPException(status_code=400, detail=f"Tag id {tid} not found")

        _attach_categories_and_tags(session, prod.id, category_ids_list, tag_ids_list)

    session.add(prod)
    session.commit()
    session.refresh(prod)

    category_names = _get_category_names(session, prod.id)
    tag_names = _get_tag_names(session, prod.id)
    category_value = ", ".join(category_names) if category_names else None

    return {
        "id": prod.id,
        "sku": prod.sku,
        "name": prod.name,
        "weight": prod.weight,
        "min_quantity": prod.min_quantity,
        "max_quantity": prod.max_quantity,
        "price": prod.price,
        "gst_rate": prod.gst_rate,    # ✅ add
        "description": prod.description,
        "image_url": prod.image_path,
        "category": category_value,
        "tags": tag_names,
        "active": prod.active,
    }


# ----- delete product (soft by default; hard if ?hard=true) ----------------
from fastapi import Query

@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    hard: bool = Query(False),
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.MASTER)),
):
    prod = session.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    if hard:
        # Delete dependent rows first to satisfy FK constraints.
        # 1) ProductCategory
        stmt_pc = select(ProductCategory).where(ProductCategory.product_id == prod.id)
        for row in session.exec(stmt_pc).all():
            session.delete(row)

        # 2) ProductTag
        stmt_pt = select(ProductTag).where(ProductTag.product_id == prod.id)
        for row in session.exec(stmt_pt).all():
            session.delete(row)

        # 3) StockMovement (if you have this table referencing product)
        try:
            from ..models import StockMovement
            stmt_sm = select(StockMovement).where(StockMovement.product_id == prod.id)
            for row in session.exec(stmt_sm).all():
                session.delete(row)
        except Exception:
            # ignore if model/table not present
            pass

        # 4) PurchaseItem (if exists)
        try:
            from ..models import PurchaseItem
            stmt_pi = select(PurchaseItem).where(PurchaseItem.product_id == prod.id)
            for row in session.exec(stmt_pi).all():
                session.delete(row)
        except Exception:
            pass

        # 5) StockLevel
        try:
            stmt_sl = select(StockLevel).where(StockLevel.product_id == prod.id)
            for row in session.exec(stmt_sl).all():
                session.delete(row)
        except Exception:
            pass

        # commit deletions of dependents
        session.commit()

        # finally delete product
        session.delete(prod)
        session.commit()
        return {"status": "deleted", "product_id": product_id, "hard": True}
    else:
        # soft delete
        prod.active = False
        session.add(prod)
        session.commit()
        return {"status": "deactivated", "product_id": product_id}

# ----- activate / deactivate (soft) ---------------------------------------
@router.post("/{product_id}/activate")
def activate_product(product_id: int, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.MASTER, Role.ADMIN))):
    prod = session.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    prod.active = True
    session.add(prod)
    session.commit()
    return {"status": "activated", "product_id": product_id}


@router.post("/{product_id}/deactivate")
def deactivate_product(product_id: int, session: Session = Depends(get_session), user: User = Depends(require_roles(Role.MASTER, Role.ADMIN))):
    prod = session.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    prod.active = False
    session.add(prod)
    session.commit()
    return {"status": "deactivated", "product_id": product_id}


# ----- upload/replace image for an existing product ------------------------
@router.post("/{product_id}/upload-image")
def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF)),
):
    prod = session.get(Product, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

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

    prod.image_path = f"/uploads/{fname}"
    session.add(prod)
    session.commit()
    session.refresh(prod)

    category_names = _get_category_names(session, prod.id)
    tag_names = _get_tag_names(session, prod.id)
    category_value = ", ".join(category_names) if category_names else None

    return {
        "id": prod.id,
        "sku": prod.sku,
        "name": prod.name,
        "weight": prod.weight,
        "min_quantity": prod.min_quantity,
        "max_quantity": prod.max_quantity,
        "price": prod.price,
        "description": prod.description,
        "image_url": prod.image_path,
        "category": category_value,
        "tags": tag_names,
        "active": prod.active,
    }
