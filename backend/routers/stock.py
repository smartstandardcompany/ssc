from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone
import os
import uuid

from database import db, get_current_user, require_permission, get_branch_filter
from models import User, StockEntry, StockUsage, Item

router = APIRouter()

@router.get("/stock/alerts")
async def get_stock_alerts(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Return items where current balance is at or below min_stock_level."""
    items = await db.items.find({"min_stock_level": {"$gt": 0}}, {"_id": 0}).to_list(1000)
    if not items:
        return []
    e_query = {"branch_id": branch_id} if branch_id else {}
    u_query = {"branch_id": branch_id} if branch_id else {}
    entries = await db.stock_entries.find(e_query, {"_id": 0}).to_list(10000)
    usage = await db.stock_usage.find(u_query, {"_id": 0}).to_list(10000)
    stock_in = {}
    for e in entries:
        stock_in[e["item_id"]] = stock_in.get(e["item_id"], 0) + e["quantity"]
    stock_out = {}
    for u in usage:
        stock_out[u["item_id"]] = stock_out.get(u["item_id"], 0) + u["quantity"]
    alerts = []
    for item in items:
        balance = stock_in.get(item["id"], 0) - stock_out.get(item["id"], 0)
        if balance <= item["min_stock_level"]:
            alerts.append({
                "item_id": item["id"],
                "item_name": item["name"],
                "unit": item.get("unit", "piece"),
                "category": item.get("category", ""),
                "current_balance": round(balance, 2),
                "min_level": item["min_stock_level"],
                "deficit": round(item["min_stock_level"] - balance, 2),
            })
    alerts.sort(key=lambda x: x["deficit"], reverse=True)
    return alerts


@router.get("/stock/smart-alerts")
async def get_smart_stock_alerts(
    branch_id: Optional[str] = None,
    days_lookback: int = 30,
    days_forecast: int = 7,
    current_user: User = Depends(get_current_user)
):
    """
    Advanced stock alerts based on sales velocity.
    Predicts when items will run out based on consumption patterns.
    """
    from datetime import timedelta
    
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    if not items:
        return {"alerts": [], "summary": {}}
    
    # Get stock entries and usage
    e_query = {"branch_id": branch_id} if branch_id else {}
    u_query = {"branch_id": branch_id} if branch_id else {}
    
    entries = await db.stock_entries.find(e_query, {"_id": 0}).to_list(10000)
    usage = await db.stock_usage.find(u_query, {"_id": 0}).to_list(10000)
    
    # Calculate current stock
    stock_in = {}
    for e in entries:
        stock_in[e["item_id"]] = stock_in.get(e["item_id"], 0) + e["quantity"]
    stock_out = {}
    for u in usage:
        stock_out[u["item_id"]] = stock_out.get(u["item_id"], 0) + u["quantity"]
    
    # Calculate daily usage rate for each item (last N days)
    now = datetime.now(timezone.utc)
    lookback_start = now - timedelta(days=days_lookback)
    
    daily_usage = {}
    for u in usage:
        date = u.get("date")
        if isinstance(date, str):
            date = datetime.fromisoformat(date)
        if date and date.tzinfo is None:
            date = date.replace(tzinfo=timezone.utc)
        if date and date >= lookback_start:
            item_id = u["item_id"]
            if item_id not in daily_usage:
                daily_usage[item_id] = []
            daily_usage[item_id].append(u["quantity"])
    
    # Build alerts
    alerts = []
    for item in items:
        item_id = item["id"]
        current_balance = stock_in.get(item_id, 0) - stock_out.get(item_id, 0)
        min_level = item.get("min_stock_level", 0)
        
        # Calculate velocity (avg daily usage)
        usage_records = daily_usage.get(item_id, [])
        total_used = sum(usage_records)
        avg_daily_usage = total_used / days_lookback if days_lookback > 0 else 0
        
        # Calculate days until stockout
        days_until_stockout = None
        if avg_daily_usage > 0:
            days_until_stockout = round(current_balance / avg_daily_usage, 1)
        
        # Calculate forecasted balance after N days
        forecasted_balance = current_balance - (avg_daily_usage * days_forecast)
        
        # Determine alert level
        alert_level = None
        alert_reason = None
        
        if current_balance <= 0:
            alert_level = "critical"
            alert_reason = "Out of stock"
        elif current_balance <= min_level:
            alert_level = "critical"
            alert_reason = "Below minimum level"
        elif days_until_stockout is not None and days_until_stockout <= 3:
            alert_level = "critical"
            alert_reason = f"Will run out in ~{days_until_stockout} days"
        elif days_until_stockout is not None and days_until_stockout <= 7:
            alert_level = "warning"
            alert_reason = f"Will run out in ~{days_until_stockout} days"
        elif forecasted_balance <= min_level and min_level > 0:
            alert_level = "warning"
            alert_reason = f"Will fall below min in {days_forecast} days"
        elif days_until_stockout is not None and days_until_stockout <= 14:
            alert_level = "info"
            alert_reason = f"Monitor: ~{days_until_stockout} days of stock"
        
        if alert_level:
            # Calculate suggested reorder quantity (enough for 2 weeks at current velocity)
            suggested_order = 0
            if avg_daily_usage > 0:
                suggested_order = max(min_level, round(avg_daily_usage * 14 - current_balance, 0))
            
            alerts.append({
                "item_id": item_id,
                "item_name": item["name"],
                "unit": item.get("unit", "piece"),
                "category": item.get("category", ""),
                "current_balance": round(current_balance, 2),
                "min_level": min_level,
                "avg_daily_usage": round(avg_daily_usage, 2),
                "days_until_stockout": days_until_stockout,
                "forecasted_balance_7d": round(forecasted_balance, 2),
                "alert_level": alert_level,
                "alert_reason": alert_reason,
                "suggested_order_qty": suggested_order,
                "usage_trend": "high" if avg_daily_usage > 0 and len(usage_records) > days_lookback * 0.7 else "normal"
            })
    
    # Sort by priority (critical > warning > info) and then by days until stockout
    priority_map = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda x: (priority_map.get(x["alert_level"], 3), x.get("days_until_stockout") or 999))
    
    # Summary
    summary = {
        "total_alerts": len(alerts),
        "critical": len([a for a in alerts if a["alert_level"] == "critical"]),
        "warning": len([a for a in alerts if a["alert_level"] == "warning"]),
        "info": len([a for a in alerts if a["alert_level"] == "info"]),
        "lookback_days": days_lookback,
        "forecast_days": days_forecast
    }
    
    return {"alerts": alerts, "summary": summary}


@router.get("/stock/entries")
async def get_stock_entries(
    branch_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "stock", "read")
    query = get_branch_filter(current_user)
    if branch_id:
        query["branch_id"] = branch_id
    total = await db.stock_entries.count_documents(query)
    skip = (page - 1) * limit
    entries = await db.stock_entries.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    for e in entries:
        for f in ['date', 'created_at']:
            if isinstance(e.get(f), str):
                e[f] = datetime.fromisoformat(e[f])
    return {"data": entries, "total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit if total > 0 else 1}

@router.post("/stock/entries")
async def create_stock_entry(body: dict, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "stock", "write")
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
    require_permission(current_user, "stock", "write")
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
async def get_stock_usage(
    branch_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "stock", "read")
    query = get_branch_filter(current_user)
    if branch_id:
        query["branch_id"] = branch_id
    total = await db.stock_usage.count_documents(query)
    skip = (page - 1) * limit
    usage = await db.stock_usage.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    for u in usage:
        for f in ['date', 'created_at']:
            if isinstance(u.get(f), str):
                u[f] = datetime.fromisoformat(u[f])
    return {"data": usage, "total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit if total > 0 else 1}

@router.post("/stock/usage")
async def create_stock_usage(body: dict, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "stock", "write")
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

@router.get("/stock/report/consumption")
async def get_consumption_report(branch_id: Optional[str] = None, days: int = 30, current_user: User = Depends(get_current_user)):
    """Consumption analysis: usage per item over time with daily averages."""
    cutoff = (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=days)).isoformat()
    u_query = {"date": {"$gte": cutoff}}
    if branch_id:
        u_query["branch_id"] = branch_id
    usage = await db.stock_usage.find(u_query, {"_id": 0}).to_list(50000)
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    item_map = {i["id"]: i for i in items}
    # Per item: total used, daily average, daily breakdown
    item_usage = {}
    daily_totals = {}
    for u in usage:
        iid = u["item_id"]
        qty = u.get("quantity", 0)
        date_str = (u.get("date", "")[:10]) if isinstance(u.get("date"), str) else ""
        if iid not in item_usage:
            item_usage[iid] = {"total": 0, "days": {}}
        item_usage[iid]["total"] += qty
        item_usage[iid]["days"][date_str] = item_usage[iid]["days"].get(date_str, 0) + qty
        daily_totals[date_str] = daily_totals.get(date_str, 0) + qty
    result = []
    for iid, data in sorted(item_usage.items(), key=lambda x: -x[1]["total"]):
        item = item_map.get(iid, {})
        active_days = len(data["days"]) or 1
        result.append({
            "item_id": iid, "item_name": item.get("name", "Unknown"),
            "unit": item.get("unit", "pc"), "category": item.get("category", ""),
            "total_used": round(data["total"], 2),
            "daily_avg": round(data["total"] / active_days, 2),
            "active_days": active_days,
            "cost_per_unit": item.get("cost_price", 0),
            "total_cost": round(data["total"] * item.get("cost_price", 0), 2),
        })
    # Daily trend
    daily_trend = [{"date": d, "total": round(v, 2)} for d, v in sorted(daily_totals.items())]
    return {"items": result, "daily_trend": daily_trend, "period_days": days, "total_consumption_cost": round(sum(r["total_cost"] for r in result), 2)}


@router.get("/stock/report/profitability")
async def get_profitability_report(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Item profitability: cost price vs sale price, margin analysis."""
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    e_query = {"branch_id": branch_id} if branch_id else {}
    entries = await db.stock_entries.find(e_query, {"_id": 0}).to_list(50000)
    usage = await db.stock_usage.find(e_query, {"_id": 0}).to_list(50000)
    # Calculate avg cost from entries
    item_costs = {}
    item_qty_in = {}
    for e in entries:
        iid = e["item_id"]
        item_costs[iid] = item_costs.get(iid, 0) + (e["quantity"] * e.get("unit_cost", 0))
        item_qty_in[iid] = item_qty_in.get(iid, 0) + e["quantity"]
    item_qty_out = {}
    for u in usage:
        item_qty_out[u["item_id"]] = item_qty_out.get(u["item_id"], 0) + u["quantity"]
    result = []
    total_cost = 0
    total_revenue_potential = 0
    for item in items:
        iid = item["id"]
        qi = item_qty_in.get(iid, 0)
        qo = item_qty_out.get(iid, 0)
        if qi == 0 and qo == 0:
            continue
        avg_cost = item_costs.get(iid, 0) / qi if qi > 0 else item.get("cost_price", 0)
        sale_price = item.get("unit_price", 0)
        margin = sale_price - avg_cost if sale_price > 0 else 0
        margin_pct = (margin / sale_price * 100) if sale_price > 0 else 0
        consumed_cost = qo * avg_cost
        consumed_revenue = qo * sale_price
        total_cost += consumed_cost
        total_revenue_potential += consumed_revenue
        result.append({
            "item_id": iid, "item_name": item["name"],
            "unit": item.get("unit", "pc"), "category": item.get("category", ""),
            "avg_cost": round(avg_cost, 2), "sale_price": round(sale_price, 2),
            "margin": round(margin, 2), "margin_pct": round(margin_pct, 1),
            "qty_purchased": round(qi, 2), "qty_consumed": round(qo, 2),
            "balance": round(qi - qo, 2),
            "consumed_cost": round(consumed_cost, 2),
            "consumed_revenue": round(consumed_revenue, 2),
            "consumed_profit": round(consumed_revenue - consumed_cost, 2),
        })
    result.sort(key=lambda x: -x["consumed_profit"])
    return {
        "items": result,
        "total_consumed_cost": round(total_cost, 2),
        "total_consumed_revenue": round(total_revenue_potential, 2),
        "total_profit": round(total_revenue_potential - total_cost, 2),
        "avg_margin_pct": round(sum(r["margin_pct"] for r in result) / len(result), 1) if result else 0,
    }


@router.get("/stock/report/wastage")
async def get_wastage_report(branch_id: Optional[str] = None, days: int = 30, current_user: User = Depends(get_current_user)):
    """Wastage tracking: items with usage marked as waste/expired."""
    cutoff = (datetime.now(timezone.utc) - __import__('datetime').timedelta(days=days)).isoformat()
    u_query = {"date": {"$gte": cutoff}}
    if branch_id:
        u_query["branch_id"] = branch_id
    all_usage = await db.stock_usage.find(u_query, {"_id": 0}).to_list(50000)
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    item_map = {i["id"]: i for i in items}
    # Separate wastage from regular usage
    waste_usage = [u for u in all_usage if u.get("used_by", "").lower() in ("waste", "wastage", "expired", "damaged")]
    normal_usage = [u for u in all_usage if u.get("used_by", "").lower() not in ("waste", "wastage", "expired", "damaged")]
    waste_by_item = {}
    for u in waste_usage:
        iid = u["item_id"]
        waste_by_item[iid] = waste_by_item.get(iid, 0) + u["quantity"]
    normal_by_item = {}
    for u in normal_usage:
        iid = u["item_id"]
        normal_by_item[iid] = normal_by_item.get(iid, 0) + u["quantity"]
    result = []
    total_waste_cost = 0
    for iid, waste_qty in sorted(waste_by_item.items(), key=lambda x: -x[1]):
        item = item_map.get(iid, {})
        normal_qty = normal_by_item.get(iid, 0)
        total_qty = waste_qty + normal_qty
        waste_pct = (waste_qty / total_qty * 100) if total_qty > 0 else 0
        cost = waste_qty * item.get("cost_price", 0)
        total_waste_cost += cost
        result.append({
            "item_id": iid, "item_name": item.get("name", "Unknown"),
            "unit": item.get("unit", "pc"),
            "waste_qty": round(waste_qty, 2), "normal_qty": round(normal_qty, 2),
            "waste_pct": round(waste_pct, 1), "waste_cost": round(cost, 2),
        })
    return {
        "items": result,
        "total_waste_cost": round(total_waste_cost, 2),
        "total_waste_entries": len(waste_usage),
        "period_days": days,
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
