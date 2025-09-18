from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from .auth import decode_token, verify_password, bearer_scheme
from .database import get_session
from sqlmodel import select
from .models import User
from .auth import create_access_token
from .config import settings
from datetime import timedelta

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
                     session=Depends(get_session)) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth credentials")
    user_id = int(payload["sub"])
    statement = select(User).where(User.id == user_id)
    user = session.exec(statement).one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_roles(*roles):
    def role_checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation not permitted")
        return user
    return role_checker

def authenticate_user(email: str, password: str, session):
    stmt = select(User).where(User.email == email)
    user = session.exec(stmt).one_or_none()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
