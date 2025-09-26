# app/routers/invoice.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import select, Session
from ..database import get_session
from ..models import PurchaseOrder, PurchaseItem, Product, User, Role
from ..deps import get_current_user
import io
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
import os

# ReportLab imports
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    Table, TableStyle, Paragraph, SimpleDocTemplate, Spacer, Image, KeepTogether, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

# --------- Font registration ----------
def register_dejavu():
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:\\Windows\\Fonts\\DejaVuSans.ttf",
        os.path.join(os.getcwd(), "app", "fonts", "DejaVuSans.ttf"),
        os.path.join(os.getcwd(), "fonts", "DejaVuSans.ttf"),
    ]
    for p in candidates:
        try:
            if p and os.path.exists(p):
                pdfmetrics.registerFont(TTFont("DejaVuSans", p))
                return "DejaVuSans"
        except Exception:
            continue
    return "Helvetica"

DEFAULT_FONT = register_dejavu()

# --------- number to words (INR) ----------
def num_to_words_inr(n):
    if not n:
        return "Zero Only"
    n = Decimal(str(n))
    integer_part = int(n)
    paise_part = int((n - integer_part) * 100)

    def two_digits(num):
        units = ["", "One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"]
        tens = ["", "", "Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]
        if num < 20:
            return units[num]
        else:
            t = tens[num//10]
            u = units[num%10]
            return t + (" " + u if u else "")

    def int_to_words(num):
        if num == 0:
            return ""
        out = ""
        crores = num // 10000000
        if crores:
            out += two_digits(crores) + " Crore "
            num %= 10000000
        lakhs = num // 100000
        if lakhs:
            out += two_digits(lakhs) + " Lakh "
            num %= 100000
        thousands = num // 1000
        if thousands:
            out += two_digits(thousands) + " Thousand "
            num %= 1000
        hundreds = num // 100
        if hundreds:
            out += two_digits(hundreds) + " Hundred "
            num %= 100
        if num:
            out += two_digits(num)
        return out.strip()

    words = int_to_words(integer_part)
    result = (words + " Rupees") if words else ""
    if paise_part:
        result += " and " + two_digits(paise_part) + " Paise"
    if not result:
        result = "Zero"
    return result + " Only"

# --------- prepare invoice data ----------
def _prepare_invoice_data(session: Session, po: PurchaseOrder):
    stmt = select(PurchaseItem).where(PurchaseItem.purchase_order_id == po.id)
    items = session.exec(stmt).all()

    items_out = []
    subtotal = Decimal('0.0')
    tax_summary = {}
    for it in items:
        prod = session.get(Product, it.product_id)
        name = getattr(prod, "name", f"Product #{it.product_id}")
        hsn = getattr(prod, "hsn_code", "N/A")
        tax_rate = Decimal(str(getattr(prod, "tax_rate", "0.0")))
        unit_price = Decimal(str(it.unit_price or '0.0'))
        qty = Decimal(str(it.qty or '0'))
        line_total = (qty * unit_price).quantize(Decimal("0.0000"))
        items_out.append({
            "id": it.id,
            "product_name": name,
            "hsn_sac": hsn,
            "gst_rate": tax_rate,
            "alt_quantity": getattr(it, "alt_quantity", ""),
            "quantity": qty,
            "unit_price": unit_price,
            "line_total": line_total,
            "unit_of_measure": getattr(it, "unit_of_measure", ""),
        })
        subtotal += line_total
        tax_summary.setdefault(tax_rate, {"taxable_value": Decimal('0.0')})
        tax_summary[tax_rate]["taxable_value"] += line_total

    CASH_DISCOUNT_PERCENT = Decimal('0.5')
    cash_discount = (subtotal * CASH_DISCOUNT_PERCENT / Decimal('100')).quantize(Decimal('0.0000'))
    total_taxable_value = subtotal - Decimal('0.0')  # if any other adjustments
    total_cgst = Decimal('0.0')
    total_sgst = Decimal('0.0')
    for rate, vals in tax_summary.items():
        taxable = vals['taxable_value']
        cgst_rate = rate / Decimal('2.0')
        sgst_rate = rate / Decimal('2.0')
        cgst_amt = (taxable * cgst_rate / Decimal('100')).quantize(Decimal('0.00'))
        sgst_amt = (taxable * sgst_rate / Decimal('100')).quantize(Decimal('0.00'))
        vals['cgst_rate'] = cgst_rate
        vals['sgst_rate'] = sgst_rate
        vals['cgst_amount'] = cgst_amt
        vals['sgst_amount'] = sgst_amt
        total_cgst += cgst_amt
        total_sgst += sgst_amt

    total_tax = total_cgst + total_sgst
    grand_total = total_taxable_value - cash_discount + total_tax
    final_total = grand_total.quantize(Decimal('0'), rounding=ROUND_HALF_UP)
    round_off = final_total - grand_total

    return items_out, {
        "subtotal": subtotal,
        "cash_discount": cash_discount,
        "cash_discount_percent": CASH_DISCOUNT_PERCENT,
        "total_taxable_value": total_taxable_value,
        "total_cgst": total_cgst,
        "total_sgst": total_sgst,
        "total_tax": total_tax,
        "grand_total": grand_total,
        "round_off": round_off,
        "final_total": final_total,
        "tax_summary": tax_summary,
    }

# --------- Helper: draw QR as Drawing ----------
def make_qr_drawing(data, size_mm=40):
    try:
        qr_code = qr.QrCodeWidget(str(data))
        bounds = qr_code.getBounds()
        width = bounds[2] - bounds[0]
        height = bounds[3] - bounds[1]
        d = Drawing(size_mm*mm, size_mm*mm)
        scale = min((size_mm*mm)/width, (size_mm*mm)/height)
        qr_code.scale(scale, scale)
        d.add(qr_code)
        return d
    except Exception:
        return None

# --------- Main endpoint ----------
@router.get("/{po_id}")
def get_invoice_pdf(
    po_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
    buyer_name: Optional[str] = Query(None),
    buyer_address: Optional[str] = Query(None),
    buyer_gstin: Optional[str] = Query(None),
    buyer_state_name: Optional[str] = Query(None),
    buyer_state_code: Optional[str] = Query(None),
):
    po = session.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if user.role == Role.VENDOR and po.vendor_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    buyer = session.get(User, po.vendor_id)
    def safe_get(obj, attr):
        try:
            return getattr(obj, attr, None) if obj else None
        except Exception:
            return None

    final_buyer_name = buyer_name or safe_get(buyer, "name") or "N/A"
    final_buyer_address = buyer_address or safe_get(buyer, "address") or "N/A"
    final_buyer_gstin = buyer_gstin or safe_get(buyer, "gstin") or "N/A"
    final_buyer_state = buyer_state_name or safe_get(buyer, "state_name") or "N/A"
    final_buyer_state_code = buyer_state_code or safe_get(buyer, "state_code") or "N/A"

    items, totals = _prepare_invoice_data(session, po)

    # Seller info (customize)
    seller = {
        "name": "M/S Sri Gopal Traders",
        "address": "151-52, Block GE, Sharda Enclave,\nDhalbhum Rd, Near LG Service Center,\nJamshedpur, Jharkhand - 831001, India",
        "gstin": "20ACSFS7284C1ZY",
        "state_name": "Jharkhand",
        "state_code": "20",
        "email": "sripgopal@example.com",
        "pan": "ACSF7284C",
        "bank_name": "HDFC Bank",
        "account_no": "50200035496496",
        "branch_ifsc": "HDFC0001066"
    }

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            leftMargin=10*mm, rightMargin=10*mm,
                            topMargin=10*mm, bottomMargin=12*mm)

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='Base', fontName=DEFAULT_FONT, fontSize=9, leading=11))
    styles.add(ParagraphStyle(name='Heading', fontName=DEFAULT_FONT, fontSize=11, leading=13, alignment=TA_CENTER))
    styles.add(ParagraphStyle(name='Bold', fontName=DEFAULT_FONT, fontSize=9, leading=11))
    styles.add(ParagraphStyle(name='Small', fontName=DEFAULT_FONT, fontSize=7.5, leading=9))
    styles.add(ParagraphStyle(name='Right', fontName=DEFAULT_FONT, alignment=TA_RIGHT, fontSize=8))
    styles.add(ParagraphStyle(name='CenterSmall', fontName=DEFAULT_FONT, alignment=TA_CENTER, fontSize=8))
    styles.add(ParagraphStyle(name='LeftSmall', fontName=DEFAULT_FONT, alignment=TA_LEFT, fontSize=8))

    elements = []

    # --- Header row: logo left, title center, invoice meta right with QR ---
    left_flow = []
    logo_path = os.path.join(os.getcwd(), "app", "static", "logo.png")
    if os.path.exists(logo_path):
        try:
            im = Image(logo_path, width=38*mm, height=38*mm)
            left_flow.append(im)
        except Exception:
            left_flow.append(Paragraph(seller['name'], styles['Bold']))
    else:
        left_flow.append(Paragraph(seller['name'], styles['Bold']))

    # title (center)
    title = Paragraph("Tax Invoice", ParagraphStyle(name="TitleCentered", fontName=DEFAULT_FONT, alignment=TA_CENTER, fontSize=14))
    subtitle = Paragraph("(ORIGINAL FOR RECIPIENT)", ParagraphStyle(name="SubCentered", fontName=DEFAULT_FONT, alignment=TA_CENTER, fontSize=8))

    # invoice meta box (right)
    meta_table = Table([
        [Paragraph("<b>Invoice No.</b>", styles['Small']), Paragraph(str(po.id), styles['Small'])],
        [Paragraph("<b>Invoice Date</b>", styles['Small']), Paragraph(getattr(po, 'created_at', datetime.now()).strftime("%d-%b-%y"), styles['Small'])],
        [Paragraph("<b>IRN</b>", styles['Small']), Paragraph(getattr(po, 'irn', 'N/A'), styles['Small'])],
        [Paragraph("<b>Ack No.</b>", styles['Small']), Paragraph(getattr(po, 'ack_no', 'N/A'), styles['Small'])],
    ], colWidths=[34*mm, 46*mm])
    meta_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.45, colors.black),
        ('INNERGRID', (0,0), (-1,-1), 0.25, colors.grey),
        ('FONTNAME', (0,0), (-1,-1), DEFAULT_FONT),
        ('FONTSIZE', (0,0), (-1,-1), 7.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4)
    ]))

    # QR
    qr_d = make_qr_drawing(f"PO:{po.id}", size_mm=32)
    # combine header in a table: left, center title, right(meta+qr)
    right_cell = []
    right_cell.append(meta_table)
    if qr_d:
        # render drawing to image placeholder via renderPDF in a drawing wrapper
        right_cell.append(Spacer(1, 4*mm))
        right_cell.append(qr_d)

    header_table = Table([[left_flow, [title, subtitle], right_cell]], colWidths=[45*mm, 95*mm, 60*mm])
    header_table.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(header_table)
    elements.append(Spacer(1, 6*mm))

    # --- Seller / Buyer block ---
    seller_block = [
        Paragraph(f"<b>{seller['name']}</b>", styles['Bold']),
        Paragraph(seller['address'].replace("\n", "<br/>"), styles['Small']),
        Paragraph(f"GSTIN/UIN : {seller['gstin']}", styles['Small']),
        Paragraph(f"State : {seller['state_name']}  |  Code : {seller['state_code']}", styles['Small']),
    ]
    buyer_block = [
        Paragraph("<b>Buyer (Bill to)</b>", styles['Bold']),
        Paragraph(final_buyer_name, styles['Small']),
        Paragraph(str(final_buyer_address).replace("\n", "<br/>"), styles['Small']),
        Paragraph(f"GSTIN/UIN : {final_buyer_gstin}", styles['Small']),
        Paragraph(f"State : {final_buyer_state}  |  Code : {final_buyer_state_code}", styles['Small']),
    ]

    top_blocks = Table([[seller_block, buyer_block]], colWidths=[120*mm, 80*mm])
    top_blocks.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(top_blocks)
    elements.append(Spacer(1, 6*mm))

    # --- Items Table (many columns) ---
    headings = [
        Paragraph("<b>SI</b>", styles['CenterSmall']),
        Paragraph("<b>Description of Goods</b>", styles['CenterSmall']),
        Paragraph("<b>HSN/SAC</b>", styles['CenterSmall']),
        Paragraph("<b>GST<br/>Rate</b>", styles['CenterSmall']),
        Paragraph("<b>Alt Qty</b>", styles['CenterSmall']),
        Paragraph("<b>Quantity</b>", styles['CenterSmall']),
        Paragraph("<b>Rate</b>", styles['CenterSmall']),
        Paragraph("<b>Per</b>", styles['CenterSmall']),
        Paragraph("<b>Disc. %</b>", styles['CenterSmall']),
        Paragraph("<b>Amount</b>", styles['CenterSmall']),
    ]

    item_rows = [headings]
    for idx, it in enumerate(items, start=1):
        item_rows.append([
            Paragraph(str(idx), styles['CenterSmall']),
            Paragraph(it["product_name"], styles['Small']),
            Paragraph(str(it["hsn_sac"]), styles['CenterSmall']),
            Paragraph(f"{it['gst_rate']:.2f}%", styles['CenterSmall']),
            Paragraph(str(it.get("alt_quantity", "")), styles['CenterSmall']),
            Paragraph(f"{it['quantity']}", styles['CenterSmall']),
            Paragraph(f"{it['unit_price']:.2f}", styles['Right']),
            Paragraph(it.get("unit_of_measure", ""), styles['CenterSmall']),
            Paragraph("", styles['CenterSmall']),
            Paragraph(f"\u20B9 {it['line_total']:.2f}", styles['Right']),
        ])

    # Add cash discount + round off rows (these will sit inside items table)
    item_rows.append(["", "", "", "", "", "", "", "", Paragraph(f"LESS: CASH DISCOUNT (C.D)@{totals['cash_discount_percent']}%", styles['Right']), Paragraph(f"(-) {totals['cash_discount']:.4f}", styles['Right'])])
    item_rows.append(["", "", "", "", "", "", "", "", Paragraph("Round Off", styles['Right']), Paragraph(f"{totals['round_off']:.4f}", styles['Right'])])

    # define widths (tweak if need)
    col_widths = [10*mm, 80*mm, 18*mm, 14*mm, 16*mm, 20*mm, 20*mm, 14*mm, 12*mm, 30*mm]

    items_table = Table(item_rows, colWidths=col_widths, repeatRows=1, hAlign='LEFT')
    items_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,0), 0.5, colors.black),
        ('BOX', (0,0), (-1,-1), 0.6, colors.black),
        ('INNERGRID', (0,1), (-1,-1), 0.25, colors.grey),
        ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
        ('FONTNAME', (0,0), (-1,-1), DEFAULT_FONT),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (6,1), (6,-1), 'RIGHT'),
        ('ALIGN', (-1,1), (-1,-1), 'RIGHT'),
        ('LEFTPADDING', (1,0), (1,-1), 6),
        ('RIGHTPADDING', (1,0), (1,-1), 6),
    ]))

    elements.append(items_table)
    elements.append(Spacer(1, 6*mm))

    # final totals boxed on right
    final_table = Table([
        ["", "", "", "", "", "", "", "", Paragraph("<b>Total</b>", styles['Right']), Paragraph(f"\u20B9 {totals['final_total']:.2f}", styles['Right'])]
    ], colWidths=col_widths)
    final_table.setStyle(TableStyle([
        ('SPAN', (0,0), (7,0)),
        ('BACKGROUND', (8,0), (9,0), colors.lightgrey),
        ('BOX', (8,0), (9,0), 1.0, colors.black),
        ('FONTNAME', (0,0), (-1,-1), DEFAULT_FONT),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ALIGN', (9,0), (9,0), 'RIGHT'),
    ]))
    elements.append(final_table)
    elements.append(Spacer(1, 6*mm))

    # Amount in words
    elements.append(Paragraph(f"<b>Amount Chargeable (in words)</b>: INR {num_to_words_inr(totals['final_total'])}", styles['Bold']))
    elements.append(Spacer(1, 6*mm))

    # Tax summary (bottom)
    tax_summary_data = [[
        Paragraph("<b>Taxable Value</b>", styles['CenterSmall']),
        Paragraph("<b>CGST Rate</b>", styles['CenterSmall']),
        Paragraph("<b>CGST Amount</b>", styles['CenterSmall']),
        Paragraph("<b>SGST Rate</b>", styles['CenterSmall']),
        Paragraph("<b>SGST Amount</b>", styles['CenterSmall']),
        Paragraph("<b>Total Tax</b>", styles['CenterSmall'])
    ]]
    sorted_rates = sorted(totals['tax_summary'].keys(), key=lambda x: float(x))
    for r in sorted_rates:
        s = totals['tax_summary'][r]
        tax_summary_data.append([
            Paragraph(f"{s['taxable_value']:.2f}", styles['Right']),
            Paragraph(f"{s['cgst_rate']:.2f}%", styles['Right']),
            Paragraph(f"{s['cgst_amount']:.2f}", styles['Right']),
            Paragraph(f"{s['sgst_rate']:.2f}%", styles['Right']),
            Paragraph(f"{s['sgst_amount']:.2f}", styles['Right']),
            Paragraph(f"{(s['cgst_amount'] + s['sgst_amount']):.2f}", styles['Right'])
        ])
    tax_summary_data.append([
        Paragraph(f"<b>{totals['total_taxable_value']:.2f}</b>", styles['Right']),
        "", Paragraph(f"<b>{totals['total_cgst']:.2f}</b>", styles['Right']),
        "", Paragraph(f"<b>{totals['total_sgst']:.2f}</b>", styles['Right']),
        Paragraph(f"<b>{totals['total_tax']:.2f}</b>", styles['Right'])
    ])

    tax_table = Table(tax_summary_data, colWidths=[60*mm, 22*mm, 25*mm, 22*mm, 25*mm, 25*mm])
    tax_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.4, colors.grey),
        ('BOX', (0,0), (-1,-1), 0.6, colors.black),
        ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
        ('FONTNAME', (0,0), (-1,-1), DEFAULT_FONT),
        ('FONTSIZE', (0,0), (-1,-1), 8),
    ]))
    elements.append(tax_table)
    elements.append(Spacer(1, 6*mm))

    # Bank and signature footer
    bank_para = Paragraph(f"<b>Bank Details:</b><br/>Bank: {seller['bank_name']}<br/>A/c No.: {seller['account_no']}<br/>IFSC: {seller['branch_ifsc']}", styles['Small'])
    sign_para = Paragraph("<br/><br/>For M/S Sri Gopal Traders<br/><br/>Authorised Signatory", styles['LeftSmall'])
    footer_tbl = Table([[bank_para, sign_para]], colWidths=[110*mm, 70*mm])
    footer_tbl.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(footer_tbl)
    elements.append(Spacer(1, 6*mm))
    elements.append(Paragraph("This is a Computer Generated Invoice", styles['CenterSmall']))

    # build
    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=invoice_po_{po.id}.pdf"})
