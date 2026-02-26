from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
import os
import uuid

from database import db, get_current_user
from models import User, StockEntry, StockUsage, Item

router = APIRouter()

@router.get("/stock/entries")
async def get_stock_entries(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    entries = await db.stock_entries.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    for e in entries:
        for f in ['date', 'created_at']:
            if isinstance(e.get(f), str):
                e[f] = datetime.fromisoformat(e[f])
    return entries

@router.post("/stock/entries")
async def create_stock_entry(body: dict, current_user: User = Depends(get_current_user)):
    item = await db.items.find_one({"id": body["item_id"]}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    entry = StockEntry(
        item_id=body["item_id"], item_name=item["name"],
        branch_id=body["branch_id"], quantity=float(body["quantity"]),
        unit_cost=float(body.get("unit_cost", 0)),
        supplier_id=body.get("supplier_id") or None,
        source=body.get("source", "manual"), notes=body.get("notes", ""),
        date=datetime.fromisoformat(body["date"]) if isinstance(body.get("date"), str) else datetime.now(timezone.utc),
        created_by=current_user.id
    )
    e_dict = entry.model_dump()
    e_dict["date"] = e_dict["date"].isoformat()
    e_dict["created_at"] = e_dict["created_at"].isoformat()
    await db.stock_entries.insert_one(e_dict)
    return {k: v for k, v in e_dict.items() if k != '_id'}

@router.post("/stock/entries/bulk")
async def create_stock_entries_bulk(body: dict, current_user: User = Depends(get_current_user)):
    items_data = body.get("items", [])
    branch_id = body.get("branch_id")
    supplier_id = body.get("supplier_id") or None
    source = body.get("source", "manual")
    date_str = body.get("date", datetime.now(timezone.utc).isoformat())
    created = []
    for item_data in items_data:
        item_id = item_data.get("item_id")
        item_name = item_data.get("item_name", "")
        if not item_id:
            existing = await db.items.find_one({"name": {"$regex": f"^{item_name}$", "$options": "i"}}, {"_id": 0})
            if existing:
                item_id = existing["id"]
                item_name = existing["name"]
            else:
                new_item = Item(name=item_name, cost_price=float(item_data.get("unit_cost", 0)),
                               unit_price=float(item_data.get("unit_price", 0)),
                               unit=item_data.get("unit", "piece"), category=item_data.get("category", ""))
                ni_dict = new_item.model_dump()
                ni_dict["created_at"] = ni_dict["created_at"].isoformat()
                await db.items.insert_one(ni_dict)
                item_id = new_item.id
                item_name = new_item.name
        entry = StockEntry(
            item_id=item_id, item_name=item_name, branch_id=branch_id,
            quantity=float(item_data.get("quantity", 0)),
            unit_cost=float(item_data.get("unit_cost", 0)),
            supplier_id=supplier_id, source=source, notes=item_data.get("notes", ""),
            date=datetime.fromisoformat(date_str) if isinstance(date_str, str) else date_str,
            created_by=current_user.id
        )
        e_dict = entry.model_dump()
        e_dict["date"] = e_dict["date"].isoformat()
        e_dict["created_at"] = e_dict["created_at"].isoformat()
        await db.stock_entries.insert_one(e_dict)
        created.append({k: v for k, v in e_dict.items() if k != '_id'})
    return {"created": len(created), "entries": created}

@router.get("/stock/usage")
async def get_stock_usage(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    usage = await db.stock_usage.find(query, {"_id": 0}).sort("date", -1).to_list(5000)
    for u in usage:
        for f in ['date', 'created_at']:
            if isinstance(u.get(f), str):
                u[f] = datetime.fromisoformat(u[f])
    return usage

@router.post("/stock/usage")
async def create_stock_usage(body: dict, current_user: User = Depends(get_current_user)):
    item = await db.items.find_one({"id": body["item_id"]}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    usage = StockUsage(
        item_id=body["item_id"], item_name=item["name"],
        branch_id=body["branch_id"], quantity=float(body["quantity"]),
        used_by=body.get("used_by", "Kitchen"),
        notes=body.get("notes", ""),
        date=datetime.fromisoformat(body["date"]) if isinstance(body.get("date"), str) else datetime.now(timezone.utc),
        created_by=current_user.id
    )
    u_dict = usage.model_dump()
    u_dict["date"] = u_dict["date"].isoformat()
    u_dict["created_at"] = u_dict["created_at"].isoformat()
    await db.stock_usage.insert_one(u_dict)
    return {k: v for k, v in u_dict.items() if k != '_id'}

@router.post("/stock/usage/bulk")
async def create_stock_usage_bulk(body: dict, current_user: User = Depends(get_current_user)):
    items_data = body.get("items", [])
    branch_id = body.get("branch_id")
    used_by = body.get("used_by", "Kitchen")
    date_str = body.get("date", datetime.now(timezone.utc).isoformat())
    created = []
    for item_data in items_data:
        item = await db.items.find_one({"id": item_data["item_id"]}, {"_id": 0})
        if not item:
            continue
        usage = StockUsage(
            item_id=item_data["item_id"], item_name=item["name"],
            branch_id=branch_id, quantity=float(item_data["quantity"]),
            used_by=used_by, notes=item_data.get("notes", ""),
            date=datetime.fromisoformat(date_str) if isinstance(date_str, str) else date_str,
            created_by=current_user.id
        )
        u_dict = usage.model_dump()
        u_dict["date"] = u_dict["date"].isoformat()
        u_dict["created_at"] = u_dict["created_at"].isoformat()
        await db.stock_usage.insert_one(u_dict)
        created.append({k: v for k, v in u_dict.items() if k != '_id'})
    return {"created": len(created), "entries": created}

@router.get("/stock/balance")
async def get_stock_balance(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    e_query = {"branch_id": branch_id} if branch_id else {}
    u_query = {"branch_id": branch_id} if branch_id else {}
    entries = await db.stock_entries.find(e_query, {"_id": 0}).to_list(10000)
    usage = await db.stock_usage.find(u_query, {"_id": 0}).to_list(10000)
    stock_in = {}
    cost_total = {}
    for e in entries:
        stock_in[e["item_id"]] = stock_in.get(e["item_id"], 0) + e["quantity"]
        cost_total[e["item_id"]] = cost_total.get(e["item_id"], 0) + (e["quantity"] * e.get("unit_cost", 0))
    stock_out = {}
    for u in usage:
        stock_out[u["item_id"]] = stock_out.get(u["item_id"], 0) + u["quantity"]
    balance = []
    for item in items:
        si = stock_in.get(item["id"], 0)
        so = stock_out.get(item["id"], 0)
        if si > 0 or so > 0:
            avg_cost = cost_total.get(item["id"], 0) / si if si > 0 else item.get("cost_price", 0)
            balance.append({
                "item_id": item["id"], "item_name": item["name"],
                "unit": item.get("unit", "piece"), "category": item.get("category", ""),
                "stock_in": si, "stock_used": so, "balance": si - so,
                "avg_cost": round(avg_cost, 2),
                "total_cost": round(cost_total.get(item["id"], 0), 2),
                "min_level": item.get("min_stock_level", 0),
                "low_stock": (si - so) <= item.get("min_stock_level", 0) and item.get("min_stock_level", 0) > 0
            })
    return balance

@router.get("/stock/report")
async def get_stock_report(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    balance = await get_stock_balance(branch_id, current_user)
    total_stock_value = sum(b["avg_cost"] * b["balance"] for b in balance)
    total_consumed_value = sum(b["avg_cost"] * b["stock_used"] for b in balance)
    low_stock_items = [b for b in balance if b["low_stock"]]
    return {
        "items": balance,
        "total_stock_value": round(total_stock_value, 2),
        "total_consumed_value": round(total_consumed_value, 2),
        "low_stock_count": len(low_stock_items),
        "low_stock_items": low_stock_items
    }

# Invoice OCR - Scan invoice image
@router.post("/stock/scan-invoice")
async def scan_invoice_image(body: dict, current_user: User = Depends(get_current_user)):
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
            session_id=f"invoice-scan-{uuid.uuid4()}",
            system_message="""You are an invoice/receipt data extractor. Extract all items from the invoice image.
Return ONLY valid JSON with this structure:
{
  "supplier_name": "name if visible",
  "invoice_number": "number if visible",
  "date": "date if visible (YYYY-MM-DD)",
  "items": [
    {"name": "item name", "quantity": 1, "unit": "piece", "unit_cost": 0.00, "total": 0.00}
  ],
  "subtotal": 0.00,
  "vat": 0.00,
  "total": 0.00
}
Extract every line item. For Arabic text, translate item names to English. If quantity or price is unclear, make best estimate. Return ONLY the JSON, no markdown."""
        ).with_model("openai", "gpt-4o")
        image_content = ImageContent(image_base64=image_base64)
        user_message = UserMessage(
            text="Extract all items, quantities, prices and totals from this invoice/receipt image. Return as JSON.",
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
            return {"raw_text": str(e), "items": [], "error": "Could not parse structured data"}
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
