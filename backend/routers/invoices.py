from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from database import db, get_current_user
from models import User, Sale, Invoice, InvoiceCreate

router = APIRouter()

@router.get("/invoices")
async def get_invoices(current_user: User = Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    for inv in invoices:
        for f in ['date', 'created_at']:
            if isinstance(inv.get(f), str):
                inv[f] = datetime.fromisoformat(inv[f])
    return invoices

@router.post("/invoices")
async def create_invoice(data: InvoiceCreate, current_user: User = Depends(get_current_user)):
    customer_name = None
    if data.customer_id:
        cust = await db.customers.find_one({"id": data.customer_id}, {"_id": 0})
        customer_name = cust["name"] if cust else None
    items = []
    subtotal = 0
    for item in data.items:
        qty = float(item.get("quantity", 1))
        price = float(item.get("unit_price", 0))
        item_total = qty * price
        items.append({"description": item["description"], "quantity": qty, "unit_price": price, "total": item_total})
        subtotal += item_total
    discount = data.discount or 0
    total = subtotal - discount
    # VAT calculation (ZATCA)
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    vat_enabled = company.get("vat_enabled", False)
    vat_rate = float(company.get("vat_rate", 15)) if vat_enabled else 0
    vat_amount = round(total * vat_rate / 100, 2) if vat_enabled else 0
    total_with_vat = round(total + vat_amount, 2)
    count = await db.invoices.count_documents({})
    inv_number = f"INV-{count + 1:05d}"
    if data.payment_details:
        payment_details = data.payment_details
    else:
        payment_details = [{"mode": data.payment_mode, "amount": total_with_vat if vat_enabled else total}]
    invoice = Invoice(
        invoice_number=inv_number, branch_id=data.branch_id or None,
        customer_id=data.customer_id or None, customer_name=customer_name,
        items=items, subtotal=subtotal, discount=discount,
        vat_rate=vat_rate, vat_amount=vat_amount,
        total=total, total_with_vat=total_with_vat,
        payment_mode=data.payment_mode, payment_details=payment_details,
        date=data.date, notes=data.notes, created_by=current_user.id,
        buyer_vat_number=data.buyer_vat_number,
    )
    inv_dict = invoice.model_dump()
    inv_dict["date"] = inv_dict["date"].isoformat()
    inv_dict["created_at"] = inv_dict["created_at"].isoformat()
    await db.invoices.insert_one(inv_dict)
    sale_total = total_with_vat if vat_enabled else total
    cash_bank_paid = sum(p["amount"] for p in payment_details if p.get("mode") in ["cash", "bank"])
    credit_in_details = sum(p["amount"] for p in payment_details if p.get("mode") == "credit")
    credit_amount = max(0, credit_in_details if credit_in_details > 0 else sale_total - cash_bank_paid)
    sale = Sale(
        sale_type="branch" if not data.customer_id else "online",
        branch_id=data.branch_id or None, customer_id=data.customer_id or None,
        amount=subtotal, discount=discount, final_amount=sale_total,
        payment_details=payment_details, credit_amount=credit_amount,
        credit_received=0, date=data.date, notes=f"Invoice {inv_number}",
        created_by=current_user.id
    )
    sale_dict = sale.model_dump()
    sale_dict["date"] = sale_dict["date"].isoformat()
    sale_dict["created_at"] = sale_dict["created_at"].isoformat()
    await db.sales.insert_one(sale_dict)
    await db.invoices.update_one({"id": invoice.id}, {"$set": {"sale_id": sale.id}})
    inv_dict["sale_id"] = sale.id
    return {k: v for k, v in inv_dict.items() if k != '_id'}


@router.get("/invoices/{invoice_id}/zatca-qr")
async def get_zatca_qr(invoice_id: str, current_user: User = Depends(get_current_user)):
    """Generate ZATCA Phase 1 TLV QR code data for an invoice."""
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    import base64, struct
    def tlv_encode(tag, value):
        value_bytes = value.encode('utf-8')
        return struct.pack(f'BB{len(value_bytes)}s', tag, len(value_bytes), value_bytes)
    seller_name = company.get("company_name", "SSC Track")
    vat_number = company.get("vat_number", "")
    timestamp = inv.get("date", inv.get("created_at", ""))
    if hasattr(timestamp, 'isoformat'):
        timestamp = timestamp.isoformat()
    total = str(round(inv.get("total_with_vat", inv.get("total", 0)), 2))
    vat_amount = str(round(inv.get("vat_amount", 0), 2))
    tlv_data = b''
    tlv_data += tlv_encode(1, seller_name)
    tlv_data += tlv_encode(2, vat_number)
    tlv_data += tlv_encode(3, timestamp)
    tlv_data += tlv_encode(4, total)
    tlv_data += tlv_encode(5, vat_amount)
    qr_base64 = base64.b64encode(tlv_data).decode('ascii')
    return {
        "qr_data": qr_base64,
        "seller_name": seller_name, "vat_number": vat_number,
        "timestamp": timestamp, "total": total, "vat_amount": vat_amount,
        "invoice_number": inv.get("invoice_number", ""),
    }

@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, current_user: User = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if inv and inv.get("sale_id"):
        await db.sales.delete_one({"id": inv["sale_id"]})
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice and linked sale deleted"}
