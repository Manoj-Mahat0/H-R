from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from ..database import get_session
from ..models import User, Role
from ..schemas import LoginIn, RegisterIn, MeOut, ChangePasswordIn, Token, TokenOut
from ..auth import get_password_hash, verify_password, create_access_token
from ..deps import get_current_user, authenticate_user
from sqlmodel import Session
from datetime import timedelta

router = APIRouter(prefix="/api/auth", tags=["auth-extra"])

@router.post("/register", response_model=Token)
def register_first_master(payload: RegisterIn, session: Session = Depends(get_session)):
    """
    Create the master_admin only if none exists.
    After a master exists this endpoint returns 403.
    """
    stmt = select(User).where(User.role == Role.MASTER)
    existing = session.exec(stmt).one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Master admin already exists. Use master to create users.")
    # ensure email unique
    stmt2 = select(User).where(User.email == payload.email)
    if session.exec(stmt2).one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    hashed = get_password_hash(payload.password)
    user = User(name=payload.name, email=payload.email, phone=payload.phone, role=Role.MASTER, password_hash=hashed)
    session.add(user)
    session.commit()
    session.refresh(user)
    # create token for convenience
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, session: Session = Depends(get_session)):
    user = authenticate_user(payload.email, payload.password, session)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=MeOut)
def read_current_user(user: User = Depends(get_current_user)):
    return user

@router.post("/change-password")
def change_password(payload: ChangePasswordIn, user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    # verify old password
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Old password incorrect")
    user.password_hash = get_password_hash(payload.new_password)
    session.add(user)
    session.commit()
    return {"status": "password_changed"}
