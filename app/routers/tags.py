# app/routers/tags.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select
from ..database import get_session
from ..models import Tag, ProductTag
from ..schemas import TagCreate, TagRead
from ..deps import require_roles
from ..models import Role
from sqlmodel import Session
from typing import Optional

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.post("/", response_model=TagRead, dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def create_tag(payload: TagCreate, session: Session = Depends(get_session)):
    stmt = select(Tag).where(Tag.name == payload.name)
    if session.exec(stmt).one_or_none():
        raise HTTPException(status_code=400, detail="Tag with this name already exists")
    t = Tag(name=payload.name)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


@router.get("/", response_model=list[TagRead])
def list_tags(session: Session = Depends(get_session)):
    stmt = select(Tag).order_by(Tag.name)
    return session.exec(stmt).all()


@router.get("/{tag_id}", response_model=TagRead)
def get_tag(tag_id: int, session: Session = Depends(get_session)):
    t = session.get(Tag, tag_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tag not found")
    return t


@router.put("/{tag_id}", response_model=TagRead, dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def update_tag(tag_id: int, payload: TagCreate, session: Session = Depends(get_session)):
    """
    Update tag name (prevent duplicates).
    """
    t = session.get(Tag, tag_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tag not found")

    stmt = select(Tag).where(Tag.name == payload.name)
    existing = session.exec(stmt).one_or_none()
    if existing and existing.id != t.id:
        raise HTTPException(status_code=400, detail="Another tag with this name already exists")

    t.name = payload.name
    session.add(t)
    session.commit()
    session.refresh(t)
    return t


@router.delete("/{tag_id}", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def delete_tag(
    tag_id: int,
    hard: Optional[bool] = Query(False, description="If true, delete associations and the tag (hard delete)."),
    session: Session = Depends(get_session),
):
    """
    Delete a tag.
    - If hard=false and tag is associated with products, reject.
    - If hard=true, delete associations first then delete the tag.
    """
    t = session.get(Tag, tag_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tag not found")

    # check associations
    stmt = select(ProductTag).where(ProductTag.tag_id == tag_id)
    associations = session.exec(stmt).all()

    if associations:
        if not hard:
            raise HTTPException(
                status_code=400,
                detail="Tag is associated with products. Remove associations or use ?hard=true to force delete.",
            )
        for assoc in associations:
            try:
                session.delete(assoc)
            except Exception:
                pass
        session.commit()

    try:
        session.delete(t)
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete tag: {e}")

    return {"status": "deleted", "tag_id": tag_id, "hard": bool(hard)}
