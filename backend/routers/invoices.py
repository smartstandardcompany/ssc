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
    count = await db.invoices.count_documents({})
    inv_number = f"INV-{count + 1:05d}"
    if data.payment_details:
        payment_details = data.payment_details
    else:
        payment_details = [{"mode": data.payment_mode, "amount": total}]
    invoice = Invoice(
        invoice_number=inv_number, branch_id=data.branch_id or None,
        customer_id=data.customer_id or None, customer_name=customer_name,
        items=items, subtotal=subtotal, discount=discount, total=total,
        payment_mode=data.payment_mode, payment_details=payment_details,
        date=data.date, notes=data.notes, created_by=current_user.id
    )
    inv_dict = invoice.model_dump()
    inv_dict["date"] = inv_dict["date"].isoformat()
    inv_dict["created_at"] = inv_dict["created_at"].isoformat()
    await db.invoices.insert_one(inv_dict)
    cash_bank_paid = sum(p["amount"] for p in payment_details if p.get("mode") in ["cash", "bank"])
    credit_in_details = sum(p["amount"] for p in payment_details if p.get("mode") == "credit")
    credit_amount = max(0, credit_in_details if credit_in_details > 0 else total - cash_bank_paid)
    sale = Sale(
        sale_type="branch" if not data.customer_id else "online",
        branch_id=data.branch_id or None, customer_id=data.customer_id or None,
        amount=subtotal, discount=discount, final_amount=total,
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

@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, current_user: User = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if inv and inv.get("sale_id"):
        await db.sales.delete_one({"id": inv["sale_id"]})
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice and linked sale deleted"}
