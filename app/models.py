from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Text

class Role(str):
    MASTER = "master_admin"
    ADMIN = "admin"
    ACCOUNTANT = "accountant"
    VENDOR = "vendor"
    STAFF = "staff"
    DRIVER = "driver"

class UserBase(SQLModel):
    name: str
    email: str
    phone: Optional[str] = None
    role: str = Role.STAFF
    active: bool = True

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)



class VendorBase(SQLModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class Vendor(VendorBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

class StockLevel(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id")
    quantity: int = 0

class StockMovement(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id")
    qty: int
    type: str  # IN / OUT / ADJUST / TRANSFER
    ref: Optional[str] = None
    performed_by: Optional[int] = Field(default=None, foreign_key="user.id")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None



class PurchaseOrder(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # vendor_id now references user.id (vendors are users with role 'vendor')
    vendor_id: int = Field(foreign_key="user.id")
    created_by: int = Field(foreign_key="user.id")
    status: str = Field(default="placed")  # placed -> accepted -> received -> dispatched -> cancelled
    total: float = Field(default=0.0)
    expected_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PurchaseItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    purchase_order_id: int = Field(foreign_key="purchaseorder.id")
    product_id: int = Field(foreign_key="product.id")
    qty: int
    unit_price: float


class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    action: str
    meta: Optional[str] = Field(default=None, sa_column=Column("metadata", Text))
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    sku: str
    name: str
    weight: Optional[float] = 0.0
    min_quantity: Optional[int] = 0
    max_quantity: Optional[int] = 0
    price: float = 0.0
    description: Optional[str] = None
    image_path: Optional[str] = Field(default=None, sa_column=Column("image_path", Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    active: bool = Field(default=True)            # <-- NEW: active flag


# Association tables for many-to-many relations
class ProductCategory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id")
    category_id: int = Field(foreign_key="category.id")

class ProductTag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id")
    tag_id: int = Field(foreign_key="tag.id")

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
