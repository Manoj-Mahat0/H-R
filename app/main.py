from fastapi import FastAPI, Depends, HTTPException, status
from .database import init_db
from .routers import users, products, vendors, stock, purchases, reports, auth_extra, categories, tags, invoice, orders
from .config import settings
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="Stock Management API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

app.include_router(users.router)
app.include_router(products.router)
app.include_router(vendors.router)
app.include_router(purchases.router)
app.include_router(stock.router)
app.include_router(reports.router)
app.include_router(auth_extra.router)
app.include_router(categories.router)
app.include_router(tags.router)
app.include_router(invoice.router)
app.include_router(orders.router)



UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# Minimal auth token endpoint
from fastapi import APIRouter
from fastapi.security import OAuth2PasswordRequestForm
from .database import get_session
from .auth import create_access_token
from .deps import authenticate_user
from datetime import timedelta

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])

@auth_router.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), session = Depends(get_session)):
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

app.include_router(auth_router)
