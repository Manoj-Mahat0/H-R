# app/routers/vendors.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from ..database import get_session
from ..models import User, Role, UserBase
from ..deps import get_current_user, require_roles

router = APIRouter(prefix="/api/vendors", tags=["vendors"])


@router.get("/me", response_model=UserBase)
def get_my_profile(
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.VENDOR))
):
    """
    Vendor can fetch their own profile (from User table).
    """
    db_user = session.get(User, user.id)
    if not db_user or db_user.role != Role.VENDOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")
    return db_user


@router.patch("/me", response_model=UserBase)
def update_my_profile(
    payload: UserBase,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles(Role.VENDOR))
):
    """
    Vendor can update their own profile fields (name, email, phone, active).
    Password change should be separate endpoint.
    """
    db_user = session.get(User, user.id)
    if not db_user or db_user.role != Role.VENDOR:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor profile not found")

    db_user.name = payload.name
    db_user.email = payload.email
    db_user.phone = payload.phone
    db_user.active = payload.active

    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user
