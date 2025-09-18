# app/routers/categories.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from ..database import get_session
from ..models import Category, ProductCategory
from ..schemas import CategoryCreate, CategoryRead
from ..deps import require_roles, get_current_user
from ..models import Role
from sqlmodel import Session
from typing import Optional

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.post("/", response_model=CategoryRead, dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def create_category(payload: CategoryCreate, session: Session = Depends(get_session)):
    # prevent duplicate names (case-insensitive)
    stmt = select(Category).where(Category.name == payload.name)
    if session.exec(stmt).one_or_none():
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    cat = Category(name=payload.name, description=payload.description)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.get("/", response_model=list[CategoryRead])
def list_categories(session: Session = Depends(get_session)):
    stmt = select(Category).order_by(Category.name)
    return session.exec(stmt).all()


@router.get("/{category_id}", response_model=CategoryRead)
def get_category(category_id: int, session: Session = Depends(get_session)):
    cat = session.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat


@router.put("/{category_id}", response_model=CategoryRead, dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def update_category(category_id: int, payload: CategoryCreate, session: Session = Depends(get_session)):
    """
    Update category (replace name/description).
    Prevents duplicate names.
    """
    cat = session.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # check duplicate name (exclude current)
    stmt = select(Category).where(Category.name == payload.name)
    existing = session.exec(stmt).one_or_none()
    if existing and existing.id != cat.id:
        raise HTTPException(status_code=400, detail="Another category with this name already exists")

    cat.name = payload.name
    cat.description = payload.description
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.delete("/{category_id}", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def delete_category(category_id: int, hard: Optional[bool] = Query(False, description="If true, delete associations and category (hard delete). Otherwise reject if category is used."), session: Session = Depends(get_session)):
    """
    Delete a category.
    - If hard=false (default) and category is associated with any product -> reject and ask to remove associations first.
    - If hard=true -> delete associated ProductCategory rows first, then delete the category (irreversible).
    """
    cat = session.get(Category, category_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # check associations
    stmt = select(ProductCategory).where(ProductCategory.category_id == category_id)
    associations = session.exec(stmt).all()

    if associations:
        if not hard:
            raise HTTPException(status_code=400, detail="Category is associated with products. Remove associations or call delete with ?hard=true to force delete.")
        # hard delete: remove associations first
        for assoc in associations:
            try:
                session.delete(assoc)
            except Exception:
                # continue trying to delete others; we'll rollback on commit failure
                pass
        session.commit()

    # now delete category
    try:
        session.delete(cat)
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete category: {e}")

    return {"status": "deleted", "category_id": category_id, "hard": bool(hard)}
