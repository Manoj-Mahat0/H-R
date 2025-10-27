# app/bill.py
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP, getcontext
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, Flowable, Frame
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import qr
import os, json, typing, math

# ensure decimal precision
getcontext().prec = 28

# Optional: register better TTF if available on server for nicer rendering
# pdfmetrics.registerFont(TTFont("DejaVuSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))

def D(v):
    return Decimal(str(v or 0))

def money_str(d: Decimal) -> str:
    return f"{d.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,}"

# Indian number to words (crore, lakh etc.)
ONES = ["", "One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
        "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"]
TENS = ["", "", "Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"]
SCALES = [(10000000, "crore"), (100000, "lakh"), (1000, "thousand"), (100, "hundred")]

def _two_digit_word(n: int) -> str:
    if n < 20:
        return ONES[n]
    t = n // 10
    o = n % 10
    return TENS[t] + ((" " + ONES[o]) if o else "")

def number_to_words_inr(n: Decimal) -> str:
    n = n.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    whole = int(n)
    paise = int((n - whole) * 100)
    if whole == 0:
        rupees_part = "Zero"
    else:
        parts = []
        num = whole
        for scale_value, name in SCALES:
            if num >= scale_value:
                cnt = num // scale_value
                num = num % scale_value
                if cnt < 100:
                    if cnt < 20:
                        parts.append(ONES[cnt] + " " + name)
                    else:
                        parts.append(_two_digit_word(cnt) + " " + name)
                else:
                    h = cnt // 100
                    rem = cnt % 100
                    s = ONES[h] + " hundred"
                    if rem:
                        s += " " + (_two_digit_word(rem))
                    parts.append(s + " " + name)
        # final chunk (<1000)
        if num >= 100:
            h = num // 100
            rem = num % 100
            s = ONES[h] + " hundred"
            if rem:
                s += " " + _two_digit_word(rem)
            parts.append(s)
        elif num > 0:
            parts.append(_two_digit_word(num))
        rupees_part = " ".join([p for p in parts if p]).strip()
    if paise:
        paise_part = _two_digit_word(paise) if paise < 100 else str(paise)
        return f"INR {rupees_part} and {paise_part} paise Only"
    return f"INR {rupees_part} Only"

# Thin horizontal rule flowable
class HR(Flowable):
    def __init__(self, width="100%", thickness=0.5, color=colors.grey):
        super().__init__()
        self.width = width
        self.thickness = thickness
        self.color = color
    def draw(self):
        w = self._availWidth if isinstance(self.width, str) else self.width
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, 0, w, 0)

def generate_invoice_pdf(
    invoice_obj,
    items: typing.List[dict],
    out_path: str,
    logo_path: typing.Optional[str] = None,
    company_info: typing.Optional[dict] = None
) -> str:
    """
    invoice_obj: object/dict with fields:
      invoice_id, invoice_date (datetime), vendor_name (seller), buyer_name, customer_shipping_address,
      order_id, irn, ack_no, ack_date, meta (json string), notes,
      cgst_total, sgst_total, igst_total, gst_total, discount_total, round_off, net_total, pan
    items: list of dicts: sku, name, hsn, alt_qty, qty, unit_price, discount_pct, subtotal, gst_rate, gst_amt, cgst, sgst
    """
    # Document setup
    doc = SimpleDocTemplate(out_path, pagesize=A4, leftMargin=10*mm, rightMargin=10*mm, topMargin=10*mm, bottomMargin=12*mm)
    styles = getSampleStyleSheet()
    normal = ParagraphStyle("normal", parent=styles["Normal"], fontSize=8, leading=10)
    bold = ParagraphStyle("bold", parent=styles["Normal"], fontSize=9, leading=11)
    small_bold = ParagraphStyle("small_bold", parent=styles["Normal"], fontSize=7.5, leading=9)
    right_small = ParagraphStyle("right_small", parent=styles["Normal"], fontSize=8, alignment=2)
    right_bold = ParagraphStyle("right_bold", parent=styles["Normal"], fontSize=9, alignment=2)

    elements = []

    comp = company_info or {}
    comp_name = comp.get("name", "Your Company Name")
    comp_addr = comp.get("address", "")
    comp_gstin = comp.get("gstin", "")
    comp_state = comp.get("state", "")
    comp_pan = comp.get("pan", "")

    # Top: Logo + company block and meta (IRN / Invoice / QR)
    left_cell_parts = []
    if logo_path and os.path.exists(logo_path):
        try:
            im = Image(logo_path, width=30*mm, height=30*mm)
            left_cell_parts.append(im)
        except Exception:
            pass
    # company text
    comp_lines = f"<b>{comp_name}</b><br/>{comp_addr}"
    if comp_gstin:
        comp_lines += f"<br/>GSTIN: {comp_gstin}"
    if comp_pan:
        comp_lines += f"<br/>PAN: {comp_pan}"
    if comp_state:
        comp_lines += f"<br/>State: {comp_state}"
    left_cell_parts.append(Paragraph(comp_lines, normal))

    # Right meta table (IRN, Ack No, Ack Date, Invoice no, Date, eWay etc.)
    meta_rows = []
    irn = getattr(invoice_obj, "irn", None) or (json.loads(invoice_obj.meta).get("irn") if getattr(invoice_obj, "meta", None) else None)
    if irn:
        meta_rows.append(["IRN :", irn])
    ack_no = getattr(invoice_obj, "ack_no", None)
    ack_date = getattr(invoice_obj, "ack_date", None)
    if ack_no:
        meta_rows.append(["Ack No :", ack_no])
    if ack_date:
        if isinstance(ack_date, datetime):
            ack_date_str = ack_date.strftime("%d-%b-%Y")
        else:
            ack_date_str = str(ack_date)
        meta_rows.append(["Ack Date :", ack_date_str])

    invoice_no = getattr(invoice_obj, "invoice_id", "")
    invoice_dt = getattr(invoice_obj, "invoice_date", getattr(invoice_obj, "created_at", None))
    inv_dt_str = invoice_dt.strftime("%d-%b-%Y") if isinstance(invoice_dt, datetime) else str(invoice_dt or "")
    meta_rows.append(["Invoice No :", str(invoice_no)])
    meta_rows.append(["Date :", inv_dt_str])
    # other meta like order id, vehicle id from meta JSON
    try:
        meta_json = json.loads(getattr(invoice_obj, "meta", "{}") or "{}")
    except Exception:
        meta_json = {}
    if meta_json.get("order_no"):
        meta_rows.append(["Order No :", str(meta_json.get("order_no"))])
    if meta_json.get("vehicle_id"):
        meta_rows.append(["Vehicle ID :", str(meta_json.get("vehicle_id"))])

    meta_table = Table(meta_rows, colWidths=[28*mm, 55*mm])
    meta_table.setStyle(TableStyle([
        ("ALIGN",(0,0),(-1,-1),"LEFT"),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("INNERGRID",(0,0),(-1,-1),0.25,colors.lightgrey),
        ("BOX",(0,0),(-1,-1),0.5,colors.grey),
        ("FONTNAME",(0,0),(-1,-1),"Helvetica")
    ]))

    # Build header table with left & right (and QR if IRN present)
    header_cells = []
    left_block = left_cell_parts
    right_block = [meta_table]
    if irn:
        try:
            qr_code = qr.QrCodeWidget(irn)
            bounds = qr_code.getBounds()
            size = 60  # px
            width = bounds[2] - bounds[0]
            height = bounds[3] - bounds[1]
            d = Drawing(size, size)
            d.add(qr_code)
            right_block.append(d)
        except Exception:
            pass

    header_table = Table([[left_block, right_block]], colWidths=[110*mm, 80*mm])
    header_table.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1,6))

    # Buyer / Ship To blocks
    buyer_left = []
    buyer_left.append(Paragraph("<b>Buyer (Bill To)</b>", small_bold))
    buyer_name = getattr(invoice_obj, "buyer_name", getattr(invoice_obj, "customer_name", "") or "")
    buyer_addr = getattr(invoice_obj, "customer_billing_address", getattr(invoice_obj, "customer_shipping_address", "") or "")
    buyer_gstin = getattr(invoice_obj, "buyer_gstin", meta_json.get("buyer_gstin", ""))
    buyer_text = f"{buyer_name}<br/>{buyer_addr}"
    if buyer_gstin:
        buyer_text += f"<br/>GSTIN: {buyer_gstin}"
    buyer_left.append(Paragraph(buyer_text, normal))

    ship_right = []
    ship_right.append(Paragraph("<b>Ship To</b>", small_bold))
    ship_to = getattr(invoice_obj, "customer_shipping_address", "") or ""
    ship_right.append(Paragraph(ship_to, normal))

    parties_table = Table([[buyer_left, ship_right]], colWidths=[95*mm,95*mm])
    parties_table.setStyle(TableStyle([
        ("BOX",(0,0),(-1,-1),0.25,colors.grey),
        ("VALIGN",(0,0),(-1,-1),"TOP")
    ]))
    elements.append(parties_table)
    elements.append(Spacer(1,8))

    # Items table header (matching sample columns)
    items_header = ["Sl", "Description of Goods", "HSN/SAC", "GST Rate", "Alt Qty", "Qty", "Rate", "Disc %", "Amount"]
    table_data = [items_header]
    taxable_sum = D(0)
    gst_sum = D(0)
    cgst_total = D(0)
    sgst_total = D(0)
    igst_total = D(0)
    idx = 1
    # Fill items rows
    for it in items:
        hsn = it.get("hsn", "")
        name = it.get("name", it.get("sku", ""))
        gst_rate = D(it.get("gst_rate", 0))
        alt_qty = it.get("alt_qty", "")
        qty = D(it.get("qty", 0))
        rate = D(it.get("unit_price", 0))
        disc_pct = D(it.get("discount_pct", 0))
        # compute subtotal and tax if not provided
        raw_amount = (qty * rate)
        discount_amount = (raw_amount * disc_pct / D(100)) if disc_pct else D(0)
        taxable_amount = (raw_amount - discount_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        gst_amt = D(it.get("gst_amt", (taxable_amount * gst_rate / D(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)))
        # split cgst/sgst for intra-state
        cgst = D(it.get("cgst", (gst_amt/2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)))
        sgst = D(it.get("sgst", (gst_amt/2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)))
        igst = D(it.get("igst", 0))
        taxable_sum += taxable_amount
        gst_sum += gst_amt
        cgst_total += cgst
        sgst_total += sgst
        igst_total += igst
        table_data.append([
            str(idx),
            Paragraph(str(name), normal),
            str(hsn),
            f"{gst_rate}%",
            str(alt_qty),
            f"{qty}",
            money_str(rate),
            f"{disc_pct}%",
            money_str(taxable_amount + gst_amt)
        ])
        idx += 1

    # Add a few empty rows if needed (visual)
    while len(table_data) < 15:
        table_data.append(["", "", "", "", "", "", "", "", ""])

    col_widths = [10*mm, 78*mm, 20*mm, 16*mm, 18*mm, 16*mm, 20*mm, 15*mm, 24*mm]
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#efefef")),
        ("GRID", (0,0), (-1,-1), 0.25, colors.lightgrey),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("ALIGN",(0,0),(0,-1),"CENTER"),
        ("ALIGN",(3,1),(3,-1),"CENTER"),
        ("ALIGN",(4,1),(6,-1),"CENTER"),
        ("ALIGN",(8,1),(8,-1),"RIGHT"),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1,6))

    # Totals rows on right
    discount_total = D(getattr(invoice_obj, "discount_total", 0))
    round_off = D(getattr(invoice_obj, "round_off", 0))
    gst_total_obj = D(getattr(invoice_obj, "gst_total", gst_sum))
    cgst_total_obj = D(getattr(invoice_obj, "cgst_total", cgst_total))
    sgst_total_obj = D(getattr(invoice_obj, "sgst_total", sgst_total))
    igst_total_obj = D(getattr(invoice_obj, "igst_total", igst_total))
    net_total = D(getattr(invoice_obj, "net_total", (taxable_sum + gst_total_obj - discount_total + round_off).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)))

    totals_rows = [
        ["Taxable Value", money_str(taxable_sum)],
        ["CGST", money_str(cgst_total_obj)],
        ["SGST", money_str(sgst_total_obj)],
    ]
    if igst_total_obj and igst_total_obj != D(0):
        totals_rows.append(["IGST", money_str(igst_total_obj)])
    totals_rows.extend([
        ["GST Total", money_str(gst_total_obj)],
        ["Discount", money_str(discount_total)],
        ["Round Off", money_str(round_off)],
        ["Net Amount", money_str(net_total)]
    ])
    totals_table = Table(totals_rows, colWidths=[90*mm, 40*mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN",(0,0),(-1,-1),"RIGHT"),
        ("FONTNAME",(0,0),(-1,-1),"Helvetica"),
        ("INNERGRID",(0,0),(-1,-1),0.25,colors.lightgrey),
        ("BOX",(0,0),(-1,-1),0.5,colors.lightgrey),
    ]))
    # Put totals to the right by using a wrapper table with blank left cell
    wrapper = Table([[Spacer(1,1), totals_table]], colWidths=[100*mm, 90*mm])
    wrapper.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP")]))
    elements.append(wrapper)
    elements.append(Spacer(1,8))

    # Amount in words (bold)
    try:
        words = number_to_words_inr(net_total)
    except Exception:
        words = f"INR {money_str(net_total)}"
    elements.append(Paragraph(f"<b>Amount Chargeable (in words):</b> {words}", normal))
    elements.append(Spacer(1,6))

    # GST breakup table (Taxable value by rate) - simple representation
    # You can expand this section to group by GST % if you want
    gst_break_rows = [
        ["Taxable", "CGST", "SGST", "Total Tax"]
    ]
    gst_break_rows.append([money_str(taxable_sum), money_str(cgst_total_obj), money_str(sgst_total_obj), money_str(gst_total_obj)])
    gst_break_table = Table(gst_break_rows, colWidths=[50*mm, 40*mm, 40*mm, 40*mm])
    gst_break_table.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#f2f2f2")),
        ("GRID",(0,0),(-1,-1),0.25,colors.lightgrey),
        ("ALIGN",(0,0),(-1,-1),"CENTER"),
    ]))
    elements.append(gst_break_table)
    elements.append(Spacer(1,8))

    # Bank details, PAN, remarks and signature
    bank_left = []
    bank_left.append(Paragraph("<b>Company's Bank Details</b>", small_bold))
    bank_details = comp.get("bank_details", {})
    bname = bank_details.get("bank_name", "")
    bac = bank_details.get("account_no", "")
    bbranch = bank_details.get("branch", "")
    bifsc = bank_details.get("ifsc", "")
    if bname:
        bank_left.append(Paragraph(f"Bank Name : {bname}", normal))
    if bac:
        bank_left.append(Paragraph(f"A/c No. : {bac}", normal))
    if bbranch or bifsc:
        bank_left.append(Paragraph(f"Branch & IFSC : {bbranch} {bifsc}", normal))
    if comp_pan:
        bank_left.append(Paragraph(f"Company's PAN : {comp_pan}", normal))
    if getattr(invoice_obj, "notes", None):
        bank_left.append(Paragraph(f"<b>Remarks:</b> {invoice_obj.notes}", normal))

    sign_right = []
    sign_right.append(Spacer(1,18))
    sign_right.append(Paragraph("For " + comp.get("name", "Your Company"), normal))
    sign_right.append(Spacer(1,18))
    sign_right.append(Paragraph("Authorised Signatory", right_bold))

    bottom_table = Table([[bank_left, sign_right]], colWidths=[120*mm, 70*mm])
    bottom_table.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    elements.append(bottom_table)
    elements.append(Spacer(1,6))

    # Footer small print
    elements.append(Paragraph("This is a computer generated invoice.", ParagraphStyle("foot", parent=styles["Normal"], fontSize=7, alignment=1)))

    # Build PDF
    doc.build(elements)
    return out_path

# Example usage (commented)
# from datetime import datetime
# inv = SimpleNamespace(invoice_id="SGT25/26/1336", invoice_date=datetime.now(), vendor_name="MS Sri Gopal Traders", ...)
# items = [{"sku":"KHT-001","name":"Khatta Meetha 27.5 Gm","hsn":"21069099","gst_rate":12,"qty":10080,"unit_price":3.5798,"discount_pct":0,"gst_amt":4320}, ...]
# filepath = generate_invoice_pdf(inv, items, "/tmp/test_invoice.pdf", logo_path="/path/to/logo.png", company_info={"name":"MS Sri Gopal Traders","address":"151-152 ...","gstin":"20ACFS...","pan":"ACSF...","bank_details":{...}})
