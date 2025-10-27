from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from ..schemas import UserCreate, UserRead
from ..database import get_session
from ..models import User, Role
from ..auth import get_password_hash
from ..deps import require_roles

router = APIRouter(prefix="/api/users", tags=["users"])

@router.post("/", response_model=UserRead, dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def create_user(payload: UserCreate, session: Session = Depends(get_session)):
    # ensure unique email
    stmt = select(User).where(User.email == payload.email)
    exists = session.exec(stmt).one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="Email already exists")
    user = User(name=payload.name, email=payload.email, password_hash=get_password_hash(payload.password), role=payload.role)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@router.get("/", response_model=list[UserRead], dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF, Role.ACCOUNTANT, Role.VENDOR, Role.SECURITY))])
def list_users(session: Session = Depends(get_session)):
    stmt = select(User)
    users = session.exec(stmt).all()
    return users

@router.put("/{user_id}", response_model=UserRead, dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def update_user(user_id: int, payload: UserCreate, session: Session = Depends(get_session)):
    stmt = select(User).where(User.id == user_id)
    user = session.exec(stmt).one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name = payload.name
    user.email = payload.email
    user.role = payload.role
    if payload.password:
        user.password_hash = get_password_hash(payload.password)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

@router.delete("/{user_id}", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"status": "deleted", "user_id": user_id}


@router.patch("/{user_id}/block", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def block_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.active = False
    session.add(user)
    session.commit()
    return {"status": "blocked", "user_id": user.id}


@router.patch("/{user_id}/activate", dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN))])
def activate_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.active = True
    session.add(user)
    session.commit()
    return {"status": "activated", "user_id": user.id}
