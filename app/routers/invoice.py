# app/routers/new_invoices.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from app.templates.bill import generate_invoice_pdf as _generate_pdf
from sqlmodel import Session, select
from ..database import get_session
from ..models import NewInvoice, NewInvoiceItem, Product, Role
from ..schemas import InvoiceIn, InvoiceOut, InvoiceItemOut
from ..deps import require_roles, get_current_user
from decimal import Decimal, ROUND_HALF_UP, getcontext
from datetime import datetime
import json, os, re


router = APIRouter(prefix="/api/new-invoices", tags=["new-invoices"])

# ensure decimal precision high enough
getcontext().prec = 28

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _D(v):
    return Decimal(str(v or 0))

def _money_str(d: Decimal) -> str:
    return f"{d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,.2f}"

def _sanitize_filename(s: str) -> str:
    # remove problematic characters
    return re.sub(r"[^A-Za-z0-9_\-\.]", "_", s)


# POST endpoint: create invoice and generate PDF
@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_invoice_and_pdf(payload: InvoiceIn, session: Session = Depends(get_session),
                           user = Depends(require_roles(Role.STAFF, Role.ADMIN, Role.MASTER, Role.ACCOUNTANT))):
    # validate items
    if not payload.items or len(payload.items) == 0:
        raise HTTPException(status_code=400, detail="Invoice must contain at least one item")

    invoice_date = payload.invoice_date or datetime.utcnow()
    vendor_name = None
    if payload.vendor and isinstance(payload.vendor, dict):
        vendor_name = payload.vendor.get("name")
    customer_addr = None
    if payload.customer and isinstance(payload.customer, dict):
        customer_addr = payload.customer.get("shipping_address") or payload.customer.get("address")

    discount_total = _D(payload.discount_total or 0)

    # compute item-level decimals
    items_calc = []
    subtotal_sum = _D(0)
    gst_sum = _D(0)
    for it in payload.items:
        prod = session.exec(select(Product).where(Product.sku == it.sku)).one_or_none()
        product_id = prod.id if prod else None
        name = prod.name if prod else it.sku

        qty = _D(it.qty)
        unit_price = _D(it.unit_price)
        subtotal = (qty * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        gst_rate = _D(it.gst_rate)
        gst_amt = (subtotal * gst_rate / _D(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        cgst = (gst_amt / _D(2)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        sgst = (gst_amt - cgst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        items_calc.append({
            "sku": it.sku,
            "name": name,
            "product_id": product_id,
            "qty": int(qty),
            "unit_price": float(unit_price),
            "subtotal": float(subtotal),
            "gst_rate": float(gst_rate),
            "gst_amt": float(gst_amt),
            "cgst": float(cgst),
            "sgst": float(sgst),
        })
        subtotal_sum += subtotal
        gst_sum += gst_amt

    total_amount = (subtotal_sum + gst_sum).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net_before_round = (total_amount - discount_total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net_rounded = net_before_round.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    round_off = (net_rounded - net_before_round).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    cgst_total = (gst_sum / _D(2)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    sgst_total = (gst_sum - cgst_total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # create DB invoice
    inv = NewInvoice(
        invoice_id=payload.invoice_id,
        order_id=payload.order_id,
        invoice_date=invoice_date,
        vendor_name=vendor_name,
        customer_shipping_address=customer_addr,
        discount_total=float(discount_total),
        total_amount=float(total_amount),
        gst_total=float(gst_sum),
        cgst_total=float(cgst_total),
        sgst_total=float(sgst_total),
        round_off=float(round_off),
        net_total=float(net_rounded),
        notes=payload.notes,
        meta=json.dumps(payload.meta) if payload.meta is not None else None
    )
    session.add(inv)
    session.commit()
    session.refresh(inv)

    # create items
    for it in items_calc:
        ni = NewInvoiceItem(
            new_invoice_id=inv.id,
            sku=it["sku"],
            product_id=it["product_id"],
            name=it["name"],
            qty=it["qty"],
            unit_price=it["unit_price"],
            subtotal=it["subtotal"],
            gst_rate=it["gst_rate"],
            gst_amount=it["gst_amt"],
            cgst=it["cgst"],
            sgst=it["sgst"]
        )
        session.add(ni)
    session.commit()

    # regenerate items from DB for PDF accuracy
    items_db = []
    for row in session.exec(select(NewInvoiceItem).where(NewInvoiceItem.new_invoice_id == inv.id)).all():
        items_db.append({
            "sku": row.sku,
            "name": row.name or row.sku,
            "qty": row.qty,
            "unit_price": row.unit_price,
            "subtotal": row.subtotal,
            "gst_rate": row.gst_rate,
            "gst_amt": row.gst_amount,
            "cgst": row.cgst,
            "sgst": row.sgst,
        })

    # generate pdf file
    fname = _sanitize_filename(f"invoice_{inv.invoice_id}.pdf")
    filepath = os.path.join(UPLOAD_DIR, fname)
    try:
        _generate_pdf(inv, items_db, filepath)
    except Exception as e:
        # don't fail DB creation because of PDF error, but return error info
        return {
            "status": "invoice_saved_but_pdf_failed",
            "error": str(e),
            "invoice_id": inv.invoice_id
        }

    pdf_url = f"/uploads/{fname}"  # main.py already mounts uploads/ at /uploads
    return {
        "status": "ok",
        "invoice_id": inv.invoice_id,
        "id": inv.id,
        "pdf_url": pdf_url,
        "net_total": float(inv.net_total),
        "total_amount": float(inv.total_amount)
    }

# GET endpoint to download PDF by invoice_id
@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: str, session: Session = Depends(get_session), user = Depends(get_current_user)):
    inv = session.exec(select(NewInvoice).where(NewInvoice.invoice_id == invoice_id)).one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    fname = _sanitize_filename(f"invoice_{inv.invoice_id}.pdf")
    filepath = os.path.join(UPLOAD_DIR, fname)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="PDF not found on server")
    return FileResponse(filepath, media_type="application/pdf", filename=fname)
