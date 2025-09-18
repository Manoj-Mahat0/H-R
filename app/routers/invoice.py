# app/routers/invoice.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import select
from ..database import get_session
from ..models import PurchaseOrder, PurchaseItem, Product, User
from ..deps import get_current_user
from ..models import Role
from sqlmodel import Session
import io
from datetime import datetime

# ReportLab imports
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle, Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

# helper to fetch items and totals
def _prepare_invoice_data(session: Session, po: PurchaseOrder):
    stmt = select(PurchaseItem).where(PurchaseItem.purchase_order_id == po.id)
    items = session.exec(stmt).all()

    items_out = []
    subtotal = 0.0
    for it in items:
        prod = session.get(Product, it.product_id)
        name = prod.name if prod else f"Product #{it.product_id}"
        unit_price = float(it.unit_price or 0.0)
        line_total = float(it.qty) * unit_price
        subtotal += line_total
        items_out.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_name": name,
            "qty": it.qty,
            "unit_price": unit_price,
            "line_total": line_total,
        })

    tax_percent = 0.0  # change if you want taxes
    tax = subtotal * (tax_percent / 100.0)
    total = subtotal + tax
    return items_out, {"subtotal": subtotal, "tax": tax, "total": total, "tax_percent": tax_percent}

# main endpoint: returns PDF bytes
@router.get("/{po_id}")
def get_invoice_pdf(po_id: int, session: Session = Depends(get_session), user: User = Depends(get_current_user)):
    """
    Generate invoice PDF using ReportLab and return as StreamingResponse.
    Vendor may only fetch their own PO; staff/admin/master can fetch any.
    """
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # permission check
    if user.role == Role.VENDOR and po.vendor_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    vendor = session.get(User, po.vendor_id)
    items, totals = _prepare_invoice_data(session, po)

    # company info - customize as needed
    company = {
        "name": "Your Company Pvt Ltd",
        "address": "Address line 1, City, Country",
        "phone": "0123-456789",
        "email": "billing@yourcompany.com",
    }

    # create PDF in memory
    buffer = io.BytesIO()
    # Use A4 portrait
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)

    styles = getSampleStyleSheet()
    normal = styles["Normal"]
    heading = styles["Heading2"]
    small_right = ParagraphStyle(name="SmallRight", parent=styles["Normal"], alignment=TA_RIGHT, fontSize=9)
    small_left = ParagraphStyle(name="SmallLeft", parent=styles["Normal"], alignment=TA_LEFT, fontSize=9)
    elements = []

    # Header
    elements.append(Paragraph(company["name"], ParagraphStyle(name="Company", fontSize=16, leading=18, spaceAfter=6)))
    elements.append(Paragraph(company["address"], small_left))
    elements.append(Paragraph(f"Phone: {company['phone']}", small_left))
    elements.append(Paragraph(f"Email: {company['email']}", small_left))
    elements.append(Spacer(1, 6))

    # Invoice meta (right aligned)
    created_str = po.created_at.strftime("%Y-%m-%d %H:%M") if getattr(po, "created_at", None) else datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    meta_table = Table([
        ["Invoice (PO)", ""],
        ["PO #", str(po.id)],
        ["Date", created_str],
        ["Status", po.status],
    ], colWidths=[60*mm, 80*mm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("ALIGN", (0,0), (-1,-1), "LEFT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 10))

    # Vendor block
    elements.append(Paragraph("<b>Vendor</b>", styles["Heading4"]))
    vendor_lines = []
    vendor_name = vendor.name if vendor else "Vendor"
    vendor_email = vendor.email if vendor else ""
    vendor_phone = vendor.phone if vendor else ""
    vendor_lines.append(Paragraph(vendor_name, normal))
    if vendor_email:
        vendor_lines.append(Paragraph(vendor_email, normal))
    if vendor_phone:
        vendor_lines.append(Paragraph(vendor_phone, normal))
    elements.extend(vendor_lines)
    elements.append(Spacer(1, 8))

    # Items table header + rows
    data = [["#", "Product", "Qty", "Unit Price", "Line Total"]]
    for idx, it in enumerate(items, start=1):
        data.append([
            str(idx),
            it["product_name"],
            str(it["qty"]),
            f"{it['unit_price']:.2f}",
            f"{it['line_total']:.2f}"
        ])

    # totals rows
    data.append(["", "", "", "Subtotal", f"{totals['subtotal']:.2f}"])
    data.append(["", "", "", f"Tax ({totals['tax_percent']}%)", f"{totals['tax']:.2f}"])
    data.append(["", "", "", "Total", f"{totals['total']:.2f}"])

    table = Table(data, colWidths=[10*mm, 90*mm, 20*mm, 30*mm, 30*mm])
    table.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-4), 0.25, colors.grey),
        ("LINEBELOW", (0,0), (-1,0), 1, colors.black),
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
        ("ALIGN", (2,1), (2,-1), "CENTER"),
        ("ALIGN", (3,1), (4,-1), "RIGHT"),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,0), 6),
        ("TOPPADDING", (0,0), (-1,0), 6),
        ("SPAN", (0, len(data)-3), (2, len(data)-3)),  # merge subtotal left cells if desired
    ]))

    elements.append(table)
    elements.append(Spacer(1, 12))

    # Notes if any
    if getattr(po, "notes", None):
        elements.append(Paragraph("<b>Notes</b>", styles["Heading5"]))
        elements.append(Paragraph(po.notes, normal))
        elements.append(Spacer(1, 8))

    # Footer - simple
    elements.append(Paragraph("Thank you for your business.", small_left))

    # build PDF
    doc.build(elements)

    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=invoice_po_{po.id}.pdf"})
