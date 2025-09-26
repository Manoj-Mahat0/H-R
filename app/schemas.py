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
    address: Optional[str] = None
    profile_pic: Optional[str] = None
    aadhaar_number: Optional[str] = None
    aadhaar_front: Optional[str] = None
    aadhaar_back: Optional[str] = None
    profile_update_count: int   # <-- new

    class Config:
        orm_mode = True

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    aadhaar_number: Optional[str] = None

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
    gst_rate: float = 0.0   # <-- new field
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    image_url: Optional[str] = None   # frontend can pass an image URL, or upload via image endpoint
    description: Optional[str] = None

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



class VehicleCreate(BaseModel):
    driver_mobile: Optional[str] = None
    vehicle_number: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    capacity_weight: Optional[float] = None
    capacity_unit: Optional[str] = "kg"
    details: Optional[str] = None

class VehicleRead(VehicleCreate):
    id: int
    driver_id: int
    active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True

class VehicleUpdate(BaseModel):
    driver_mobile: Optional[str] = None
    vehicle_number: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    capacity_weight: Optional[float] = None
    capacity_unit: Optional[str] = None
    details: Optional[str] = None
    active: Optional[bool] = None

class VendorLimitCreate(BaseModel):
    vendor_id: int
    limit_amount: float = 0.0
    limit_boxes: int = 0
    month: Optional[str] = None   # "YYYY-MM"
    note: Optional[str] = None

class VendorLimitRead(BaseModel):
    id: int
    vendor_id: int
    limit_amount: float
    limit_boxes: int
    month: Optional[str] = None
    note: Optional[str] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True



class PurchaseItemHistoryRead(BaseModel):
    id: int
    purchase_item_id: int
    purchase_order_id: Optional[int]
    old_qty: int
    new_qty: int
    changed_by: Optional[int]
    reason: Optional[str]
    changed_at: datetime

    class Config:
        orm_mode = True


class StockBatchCreate(BaseModel):
    product_id: int
    batch_no: Optional[str] = None
    quantity: int
    unit: Optional[str] = "pcs"
    expire_date: Optional[datetime] = None
    notes: Optional[str] = None

class StockBatchRead(StockBatchCreate):
    id: int
    added_at: datetime
    created_by: Optional[int]
    active: bool

    class Config:
        orm_mode = True

class StockConsumeIn(BaseModel):
    product_id: int
    qty: int   # how many pieces to consume
    method: Optional[str] = "fifo"  # fifo | lifo | specific_batch
    batch_id: Optional[int] = None  # used when method == 'specific_batch'
    reason: Optional[str] = None


class OrderItemCreate(BaseModel):
    product_id: int
    qty: int
    unit_price: Optional[float] = 0.0

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    shipping_address: Optional[str] = None
    notes: Optional[str] = None

class OrderItemRead(BaseModel):
    id: int
    product_id: int
    original_qty: int
    final_qty: int
    unit_price: float
    subtotal: float
    notes: Optional[str] = None

    class Config:
        orm_mode = True

class OrderRead(BaseModel):
    id: int
    customer_id: int
    created_at: datetime
    status: str
    total_amount: float
    items: List[OrderItemRead]
    shipping_address: Optional[str]
    notes: Optional[str]

    class Config:
        orm_mode = True

class OrderUpdateItemsIn(BaseModel):
    items: List[OrderItemCreate]  # admin can pass new list: add/remove/change qty
    reason: Optional[str] = None

class ConsumeAllocationResult(BaseModel):
    batch_id: int
    qty: int
