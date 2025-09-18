from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class RegisterIn(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None

class MeOut(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    active: bool

    class Config:
        orm_mode = True

class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str

class LoginIn(BaseModel):
    email: str
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str

class UserRead(BaseModel):
    id: int
    name: str
    email: str
    role: str
    active: bool

    class Config:
        orm_mode = True



class ProductCreate(BaseModel):
    sku: str
    name: str
    weight: Optional[float] = 0.0
    min_quantity: Optional[int] = 0
    max_quantity: Optional[int] = 0
    price: float = 0.0
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None   # frontend can pass an image URL, or upload via image endpoint
    description: Optional[str] = None

class ProductRead(ProductCreate):
    id: int

    class Config:
        orm_mode = True

class ProductRead(ProductCreate):
    id: int

    class Config:
        orm_mode = True

class VendorCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None





class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        orm_mode = True

class TagCreate(BaseModel):
    name: str

class TagRead(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True



class PurchaseItemIn(BaseModel):
    product_id: int
    qty: int
    # unit_price: float

class PurchaseItemRead(PurchaseItemIn):
    id: int

class PurchaseOrderCreate(BaseModel):
    items: List[PurchaseItemIn]
    expected_date: Optional[datetime] = None

class PurchaseOrderRead(BaseModel):
    id: int
    vendor_id: int
    created_by: int
    status: str
    total: float
    expected_date: Optional[datetime] = None
    created_at: datetime
    items: List[PurchaseItemRead]
