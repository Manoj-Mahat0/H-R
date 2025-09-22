from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlmodel import Session, select
from ..database import get_session
from ..models import Chat, Message, User, Role
from sqlalchemy import or_
from ..redis_client import redis_client
from ..deps import get_current_user
from typing import List, Optional
import os
import uuid


router = APIRouter(prefix="/api/chat", tags=["chat"])


# --- Role-based chat permission matrix ---
CHAT_RULES = {
    Role.ADMIN:    [Role.MASTER, Role.ADMIN, Role.ACCOUNTANT, Role.STAFF, Role.VENDOR],
    Role.MASTER:   [Role.MASTER, Role.ADMIN, Role.ACCOUNTANT, Role.STAFF, Role.VENDOR],
    Role.ACCOUNTANT: [Role.ADMIN, Role.MASTER, Role.ACCOUNTANT, Role.STAFF],
    Role.STAFF:    [Role.ADMIN, Role.MASTER, Role.ACCOUNTANT],
    Role.VENDOR:   [Role.ADMIN, Role.MASTER],
}

# Endpoint to get or create a chat between two users and return its numeric chat id
@router.get("/get_or_create_chat_id")
def get_or_create_chat_id(
    other_user_id: int = Query(..., description="The other user's id to chat with"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Check permission
    other_user = session.get(User, other_user_id)
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not can_chat(user, other_user):
        raise HTTPException(status_code=403, detail="Not allowed to chat with this user")
    # Find or create chat
    from sqlalchemy import or_ as sa_or
    chat = session.exec(select(Chat).where(
        sa_or(
            ((Chat.user1_id == user.id) & (Chat.user2_id == other_user_id)),
            ((Chat.user1_id == other_user_id) & (Chat.user2_id == user.id))
        )
    )).first()
    if not chat:
        chat = Chat(user1_id=user.id, user2_id=other_user_id)
        session.add(chat)
        session.commit()
        session.refresh(chat)
    return {"chat_id": chat.id}

def can_chat(sender: User, receiver: User) -> bool:
    allowed = CHAT_RULES.get(sender.role, [])
    return receiver.role in allowed

@router.get("/users", response_model=List[User])
def chat_users(session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    allowed_roles = CHAT_RULES.get(user.role, [])
    return session.exec(select(User).where(User.role.in_(allowed_roles))).all()

@router.post("/send")
def send_message(
    receiver_id: int = Form(...),
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    receiver = session.get(User, receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")
    if not can_chat(user, receiver):
        raise HTTPException(status_code=403, detail="Not allowed to chat with this user")
    # Find or create chat
    chat = session.exec(select(Chat).where(
        or_(
            ((Chat.user1_id == user.id) & (Chat.user2_id == receiver_id)),
            ((Chat.user1_id == receiver_id) & (Chat.user2_id == user.id))
        )
    )).first()
    if not chat:
        chat = Chat(user1_id=user.id, user2_id=receiver_id)
        session.add(chat)
        session.commit()
        session.refresh(chat)
    file_url = None
    file_type = None
    if file:
        ext = os.path.splitext(file.filename)[1]
        file_type = _get_file_type(ext)
        fname = f"chat_{uuid.uuid4().hex}{ext}"
        fpath = os.path.join("uploads", fname)
        with open(fpath, "wb") as f:
            f.write(file.file.read())
        file_url = f"/uploads/{fname}"
    msg = Message(chat_id=chat.id, sender_id=user.id, content=content, file_url=file_url, file_type=file_type)
    session.add(msg)
    session.commit()
    # Optionally, push to Redis for real-time delivery
    # Publish to Redis channel for real-time chat (optional)
    redis_client.publish(f"chat:{chat.id}", msg.content or "[file]")
    return {"success": True, "message_id": msg.id}

def _get_file_type(ext):
    ext = ext.lower()
    if ext in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        return "image"
    if ext in [".mp4", ".mov", ".avi", ".webm"]:
        return "video"
    if ext in [".pdf"]:
        return "pdf"
    return "file"

@router.get("/messages/{chat_id}")
def get_messages(chat_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    chat = session.get(Chat, chat_id)
    if not chat or (user.id not in [chat.user1_id, chat.user2_id]):
        raise HTTPException(status_code=403, detail="Not allowed")
    msgs = session.exec(select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)).all()
    return msgs
