from .database import engine
from .models import User
from .auth import get_password_hash
from sqlmodel import Session, select

def seed():
    with Session(engine) as session:
        stmt = select(User).where(User.role == "master_admin")
        existing = session.exec(stmt).one_or_none()
        if existing:
            print("Master admin already exists:", existing.email)
            return
        u = User(name="Master Admin", email="master@local.test", phone="0000000000", role="master_admin", password_hash=get_password_hash("ChangeMe123"))
        session.add(u)
        session.commit()
        session.refresh(u)
        print("Created master admin: master@local.test with password ChangeMe123")

if __name__ == "__main__":
    seed()
