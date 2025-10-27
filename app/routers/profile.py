# app/routers/profile.py
from typing import List
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session
from ..database import get_session
from ..models import Role, User
from ..deps import get_current_user, require_roles
from ..schemas import MeOut, ProfileUpdate
import os, shutil
from uuid import uuid4

router = APIRouter(prefix="/api/profile", tags=["profile"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ✅ View my profile
@router.get("/me", response_model=MeOut)
def view_profile(user: User = Depends(get_current_user)):
    return user

# ✅ Update profile (basic info)
@router.patch("/me", response_model=MeOut)
def update_profile(
    payload: ProfileUpdate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    db_user = session.get(User, user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(db_user, field, value)

    db_user.profile_update_count += 1
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

# ✅ Upload profile / Aadhaar docs
@router.post("/me", response_model=MeOut)
def update_full_profile(
    name: str = Form(None),
    email: str = Form(None),
    phone: str = Form(None),
    address: str = Form(None),
    aadhaar_number: str = Form(None),
    profile_pic: UploadFile = File(None),
    aadhaar_front: UploadFile = File(None),
    aadhaar_back: UploadFile = File(None),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    import os, shutil
    from uuid import uuid4

    UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    db_user = session.get(User, user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # text fields update
    if name: db_user.name = name
    if email: db_user.email = email
    if phone: db_user.phone = phone
    if address: db_user.address = address
    if aadhaar_number: db_user.aadhaar_number = aadhaar_number

    # file save helper
    def save_file(file: UploadFile, prefix: str):
        ext = os.path.splitext(file.filename)[1]
        fname = f"{prefix}_{uuid4().hex}{ext}"
        path = os.path.join(UPLOAD_DIR, fname)
        with open(path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return f"/uploads/{fname}"

    # file uploads update
    if profile_pic:
        db_user.profile_pic = save_file(profile_pic, "profile")
    if aadhaar_front:
        db_user.aadhaar_front = save_file(aadhaar_front, "aadhaar_front")
    if aadhaar_back:
        db_user.aadhaar_back = save_file(aadhaar_back, "aadhaar_back")

    # update count
    db_user.profile_update_count += 1

    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user



# ✅ Master Admin & Admin can view any user's profile by ID
@router.get("/all", response_model=List[MeOut], dependencies=[Depends(require_roles(Role.MASTER, Role.ADMIN, Role.STAFF, Role.ACCOUNTANT, Role.VENDOR))])
def get_all_profiles(session: Session = Depends(get_session)):
    users = session.query(User).all()
    return users
