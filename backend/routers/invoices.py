from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
import uuid
import os
from pathlib import Path

from database import db, get_current_user, ROOT_DIR, require_permission, get_branch_filter
from models import User, Sale, Invoice, InvoiceCreate

router = APIRouter()

UPLOAD_DIR = ROOT_DIR / "uploads" / "invoices"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/invoices/ocr-scan")
async def ocr_scan_invoice(body: dict, current_user: User = Depends(get_current_user)):
    """OCR scan an invoice image and extract items/totals."""
    image_base64 = body.get("image")
    if not image_base64:
        raise HTTPException(status_code=400, detail="No image provided")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"invoice-ocr-{uuid.uuid4()}",
            system_message="""You are an invoice/receipt data extractor. Extract all items from the invoice image.
Return ONLY valid JSON with this structure:
{
  "customer_name": "customer name if visible",
  "invoice_number": "number if visible",
  "date": "date if visible (YYYY-MM-DD)",
  "items": [
    {"description": "item name", "quantity": 1, "unit_price": 0.00}
  ],
  "subtotal": 0.00,
  "discount": 0.00,
  "vat": 0.00,
  "total": 0.00,
  "payment_mode": "cash or bank or credit",
  "notes": "any additional notes"
}
Extract every line item. For Arabic text, translate item names to English. If quantity or price is unclear, make best estimate. Return ONLY the JSON, no markdown."""
        ).with_model("openai", "gpt-4o")
        image_content = ImageContent(image_base64=image_base64)
        user_message = UserMessage(
            text="Extract all items, quantities, prices and totals from this invoice/receipt. Return as JSON.",
            file_contents=[image_content]
        )
        response = await chat.send_message(user_message)
        import json as json_module
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        result = json_module.loads(cleaned)
        return result
    except Exception as e:
        if "JSONDecodeError" in type(e).__name__:
            raise HTTPException(status_code=422, detail="Could not parse invoice data from image")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)[:100]}")

@router.get("/invoices")
async def get_invoices(current_user: User = Depends(get_current_user)):
    require_permission(current_user, "invoices", "read")
    query = get_branch_filter(current_user)
    invoices = await db.invoices.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    for inv in invoices:
        for f in ['date', 'created_at']:
            if isinstance(inv.get(f), str):
                inv[f] = datetime.fromisoformat(inv[f])
    return invoices

@router.post("/invoices")
async def create_invoice(data: InvoiceCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "invoices", "write")
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
    import base64
    import struct
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


@router.get("/invoices/{invoice_id}/zatca-phase2")
async def get_zatca_phase2(invoice_id: str, current_user: User = Depends(get_current_user)):
    """Generate ZATCA Phase 2 compliant XML and 9-tag QR code for an invoice."""
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    customer = None
    if inv.get("customer_id"):
        customer = await db.customers.find_one({"id": inv["customer_id"]}, {"_id": 0})
    
    from services.zatca_phase2 import get_zatca_service
    zatca_service = get_zatca_service(company)
    
    # Prepare invoice data
    invoice_data = {
        "uuid": inv.get("uuid") or str(uuid.uuid4()),
        "invoice_number": inv.get("invoice_number"),
        "date": inv.get("date", "").split("T")[0] if isinstance(inv.get("date"), str) else datetime.now().strftime("%Y-%m-%d"),
        "time": inv.get("date", "").split("T")[1][:8] if isinstance(inv.get("date"), str) and "T" in inv.get("date", "") else datetime.now().strftime("%H:%M:%S"),
        "timestamp": inv.get("date") if isinstance(inv.get("date"), str) else datetime.now(timezone.utc).isoformat(),
        "items": inv.get("items", []),
        "subtotal": inv.get("subtotal", 0),
        "discount": inv.get("discount", 0),
        "total": inv.get("total", 0),
        "vat_rate": inv.get("vat_rate", 15),
        "vat_amount": inv.get("vat_amount", 0),
        "total_with_vat": inv.get("total_with_vat", inv.get("total", 0)),
        "payment_mode": inv.get("payment_mode", "cash"),
    }
    
    customer_data = None
    if customer:
        customer_data = {
            "name": customer.get("name"),
            "vat_number": inv.get("buyer_vat_number") or customer.get("vat_number"),
            "id_number": customer.get("id_number", ""),
        }
    
    result = zatca_service.prepare_for_submission(invoice_data, customer_data)
    
    # Save UUID to invoice if not present
    if not inv.get("uuid"):
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"uuid": result["uuid"]}})
    
    return result


@router.post("/invoices/{invoice_id}/zatca-submit")
async def submit_to_zatca(invoice_id: str, current_user: User = Depends(get_current_user)):
    """
    Submit invoice to ZATCA Fatoora Portal (Phase 2).
    Note: Actual submission requires CSID (Cryptographic Stamp Identifier) from ZATCA.
    This endpoint prepares the invoice for submission and returns the required data.
    """
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    
    # Check required company settings for ZATCA submission
    required_fields = ["company_name", "vat_number"]
    missing = [f for f in required_fields if not company.get(f)]
    if missing:
        raise HTTPException(
            status_code=400, 
            detail=f"Company settings missing required fields for ZATCA: {', '.join(missing)}. Please configure in Settings."
        )
    
    customer = None
    if inv.get("customer_id"):
        customer = await db.customers.find_one({"id": inv["customer_id"]}, {"_id": 0})
    
    from services.zatca_phase2 import get_zatca_service
    zatca_service = get_zatca_service(company)
    
    invoice_data = {
        "uuid": inv.get("uuid") or str(uuid.uuid4()),
        "invoice_number": inv.get("invoice_number"),
        "date": inv.get("date", "").split("T")[0] if isinstance(inv.get("date"), str) else datetime.now().strftime("%Y-%m-%d"),
        "time": inv.get("date", "").split("T")[1][:8] if isinstance(inv.get("date"), str) and "T" in inv.get("date", "") else datetime.now().strftime("%H:%M:%S"),
        "timestamp": inv.get("date") if isinstance(inv.get("date"), str) else datetime.now(timezone.utc).isoformat(),
        "items": inv.get("items", []),
        "subtotal": inv.get("subtotal", 0),
        "discount": inv.get("discount", 0),
        "total": inv.get("total", 0),
        "vat_rate": inv.get("vat_rate", 15),
        "vat_amount": inv.get("vat_amount", 0),
        "total_with_vat": inv.get("total_with_vat", inv.get("total", 0)),
        "payment_mode": inv.get("payment_mode", "cash"),
    }
    
    customer_data = {"name": customer.get("name"), "vat_number": inv.get("buyer_vat_number")} if customer else None
    
    result = zatca_service.prepare_for_submission(invoice_data, customer_data)
    
    # Update invoice with ZATCA data
    await db.invoices.update_one({"id": invoice_id}, {"$set": {
        "uuid": result["uuid"],
        "zatca_qr_phase2": result["qr_code_base64"],
        "zatca_xml_hash": result["xml_hash"],
        "zatca_status": "ready_for_submission",
        "zatca_updated_at": datetime.now(timezone.utc).isoformat()
    }})
    
    return {
        "success": True,
        "invoice_id": invoice_id,
        "uuid": result["uuid"],
        "qr_code_base64": result["qr_code_base64"],
        "is_b2c": result["is_b2c"],
        "status": "ready_for_submission",
        "message": "Invoice prepared for ZATCA Phase 2 submission. To complete submission, you need to register with ZATCA and obtain CSID.",
        "next_steps": [
            "1. Register on ZATCA Fatoora Developer Portal",
            "2. Generate and register CSR (Certificate Signing Request)",
            "3. Obtain CSID (Cryptographic Stamp Identifier)",
            "4. Configure CSID in Settings",
            "5. Resubmit for actual clearance"
        ]
    }


@router.post("/invoices/{invoice_id}/upload-image")
async def upload_invoice_image(invoice_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'png'
    if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'):
        raise HTTPException(status_code=400, detail="Only image files allowed (jpg, png, webp, gif)")
    filename = f"{invoice_id}_{uuid.uuid4().hex[:8]}.{ext}"
    file_path = UPLOAD_DIR / filename
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    image_url = f"/api/invoices/images/{filename}"
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"image_url": image_url}})
    return {"message": "Image uploaded", "image_url": image_url}


@router.get("/invoices/images/{filename}")
async def get_invoice_image(filename: str):
    from fastapi.responses import FileResponse
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)


@router.delete("/invoices/{invoice_id}/image")
async def delete_invoice_image(invoice_id: str, current_user: User = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.get("image_url"):
        filename = inv["image_url"].split("/")[-1]
        file_path = UPLOAD_DIR / filename
        if file_path.exists():
            file_path.unlink()
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"image_url": None}})
    return {"message": "Image removed"}


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, current_user: User = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if inv and inv.get("sale_id"):
        await db.sales.delete_one({"id": inv["sale_id"]})
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice and linked sale deleted"}
