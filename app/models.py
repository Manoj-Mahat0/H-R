
from typing import List, Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Chat(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user1_id: int = Field(foreign_key="user.id")
    user2_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chat_id: int = Field(foreign_key="chat.id")
    sender_id: int = Field(foreign_key="user.id")
    content: Optional[str] = None
    file_url: Optional[str] = None  # For image, video, pdf, etc.
    file_type: Optional[str] = None  # 'image', 'video', 'pdf', etc.
    created_at: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column, Text

class Role(str):
    MASTER = "master_admin"
    ADMIN = "admin"
    ACCOUNTANT = "accountant"
    VENDOR = "vendor"
    STAFF = "staff"
    DRIVER = "driver"
    SECURITY = "security"

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

    # --- Profile fields ---
    address: Optional[str] = None
    profile_pic: Optional[str] = None
    aadhaar_number: Optional[str] = None
    aadhaar_front: Optional[str] = None
    aadhaar_back: Optional[str] = None

    # --- New field ---
    profile_update_count: int = Field(default=0)   # <-- count updates


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
    gst_rate: float = 0.0   # ✅ New field
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

class Vehicle(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    driver_id: int = Field(foreign_key="user.id", index=True)
    driver_mobile: Optional[str] = None
    vehicle_number: Optional[str] = None   # truck/vehicle registration no.
    lat: Optional[float] = None
    lng: Optional[float] = None

    # NEW structured capacity fields
    capacity_weight: Optional[float] = None   # numeric weight capacity (e.g. 10000)
    capacity_unit: Optional[str] = Field(default="kg")  # unit: 'kg', 'ton', etc.

    details: Optional[str] = None   # free-text / notes (kept for backward compatibility)
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

class VendorLimit(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    vendor_id: int = Field(foreign_key="user.id", index=True)

    # ✅ new fields
    limit_amount: float = Field(default=0.0)    # monthly purchase limit in rupees
    limit_boxes: int = Field(default=0)         # monthly purchase limit in boxes

    month: Optional[str] = None                 # "YYYY-MM"
    note: Optional[str] = None
    created_by: Optional[int] = Field(default=None, foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PurchaseItemHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    purchase_item_id: int = Field(foreign_key="purchaseitem.id", index=True)
    purchase_order_id: Optional[int] = Field(foreign_key="purchaseorder.id", index=True)
    old_qty: int
    new_qty: int
    changed_by: Optional[int] = Field(foreign_key="user.id")
    reason: Optional[str] = None
    changed_at: datetime = Field(default_factory=datetime.utcnow)


class StockBatch(SQLModel, table=True):
    """
    Represents a batch/lot of a product in stock with an expiry date.
    We keep quantity as integer (number of pieces) and also allow an optional weight if needed.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    batch_no: Optional[str] = None
    quantity: int = Field(default=0)          # number of pieces in this batch
    unit: Optional[str] = Field(default="pcs")# unit e.g. pcs, box, kg
    expire_date: Optional[datetime] = None
    added_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    notes: Optional[str] = None
    active: bool = Field(default=True)        # for soft-delete



class OrderStatus:
    PLACED = "placed"
    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    RECEIVED = "received"
    PAYMENT_CHECKED = "payment_checked"
    CANCELLED = "cancelled"
    RETURNED = "returned"

class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_id: int = Field(foreign_key="user.id", index=True)   # customer or vendor who placed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default=OrderStatus.PLACED, index=True)
    total_amount: float = Field(default=0.0)
    vehicle_id: Optional[int] = Field(default=None, foreign_key="vehicle.id", index=True)   # <-- add this
    notes: Optional[str] = None
    shipping_address: Optional[str] = None
    payment_checked_by: Optional[int] = Field(default=None, foreign_key="user.id")
    confirmed_by: Optional[int] = Field(default=None, foreign_key="user.id")
    processed_by: Optional[int] = Field(default=None, foreign_key="user.id")
    shipped_by: Optional[int] = Field(default=None, foreign_key="user.id")
    received_by: Optional[int] = Field(default=None, foreign_key="user.id")
    cancelled_by: Optional[int] = Field(default=None, foreign_key="user.id")

class OrderItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="order.id", index=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    original_qty: int = Field(default=0)  # what customer originally ordered
    final_qty: int = Field(default=0)     # quantity currently assigned to the order (may be changed by admin)
    unit_price: float = Field(default=0.0)
    subtotal: float = Field(default=0.0)
    notes: Optional[str] = None

class OrderItemHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_item_id: int = Field(foreign_key="orderitem.id", index=True)
    changed_by: Optional[int] = Field(default=None, foreign_key="user.id")
    old_final_qty: int = Field(default=0)
    new_final_qty: int = Field(default=0)
    reason: Optional[str] = None
    changed_at: datetime = Field(default_factory=datetime.utcnow)



# --- NewOrder tables (explicit table names) ---
class NewOrder(SQLModel, table=True):
    __tablename__ = "new_order"
    id: Optional[int] = Field(default=None, primary_key=True)
    vendor_id: int = Field(foreign_key="user.id", index=True)   # vendor (user with role 'vendor')
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="placed", index=True)           # placed / processing / dispatched / received / cancelled
    total_amount: float = Field(default=0.0)
    vehicle_id: Optional[int] = Field(default=None, foreign_key="vehicle.id", index=True)
    notes: Optional[str] = None
    shipping_address: Optional[str] = None

    # verification / workflow fields
    verified: bool = Field(default=False)
    verified_by: Optional[int] = Field(default=None, foreign_key="user.id")
    verified_at: Optional[datetime] = None

    # small convenience: who last modified (optional)
    last_modified_by: Optional[int] = Field(default=None, foreign_key="user.id")
    last_modified_at: Optional[datetime] = None

class NewOrderItem(SQLModel, table=True):
    __tablename__ = "new_order_item"
    id: Optional[int] = Field(default=None, primary_key=True)
    new_order_id: int = Field(foreign_key="new_order.id", index=True)
    product_id: int = Field(foreign_key="product.id", index=True)
    qty: int = Field(default=0)
    unit_price: float = Field(default=0.0)
    subtotal: float = Field(default=0.0)
    notes: Optional[str] = None



# New Invoice models (explicit table names)
class NewInvoice(SQLModel, table=True):
    __tablename__ = "new_invoice"
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: str = Field(index=True)            # e.g. "INV-2025-09-27-2"
    order_id: Optional[int] = Field(default=None, foreign_key="new_order.id", index=True)
    invoice_date: Optional[datetime] = Field(default_factory=datetime.utcnow)
    vendor_name: Optional[str] = None
    customer_shipping_address: Optional[str] = None
    discount_total: float = Field(default=0.0)
    total_amount: float = Field(default=0.0)       # total before discounts and rounding? we'll store computed
    gst_total: float = Field(default=0.0)
    cgst_total: float = Field(default=0.0)
    sgst_total: float = Field(default=0.0)
    round_off: float = Field(default=0.0)
    net_total: float = Field(default=0.0)         # final rounded net total
    notes: Optional[str] = None
    meta: Optional[str] = Field(default=None, sa_column=Column("meta", Text))  # store JSON as text
    created_at: datetime = Field(default_factory=datetime.utcnow)


class NewInvoiceItem(SQLModel, table=True):
    __tablename__ = "new_invoice_item"
    id: Optional[int] = Field(default=None, primary_key=True)
    new_invoice_id: int = Field(foreign_key="new_invoice.id", index=True)
    sku: str
    product_id: Optional[int] = Field(default=None, foreign_key="product.id", index=True)
    name: Optional[str] = None
    qty: int = Field(default=0)
    unit_price: float = Field(default=0.0)
    subtotal: float = Field(default=0.0)     # qty * unit_price
    gst_rate: float = Field(default=0.0)     # percentage, e.g. 12
    gst_amount: float = Field(default=0.0)   # subtotal * gst_rate/100
    cgst: float = Field(default=0.0)         # half of gst_amount
    sgst: float = Field(default=0.0)



class Attendance(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    type: str  # "in" or "out"
    timestamp_utc: datetime = Field(default_factory=datetime.utcnow)
    timestamp_ist: datetime | None = None
    lat: float | None = None
    lng: float | None = None
    device_id: str | None = None
    site_name: str | None = None   # optional site identifier
    recorded_by: int | None = Field(default=None, foreign_key="user.id")  # who recorded (security/admin) or same as user_id
    note: str | None = None
