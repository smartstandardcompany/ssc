"""
Menu Analytics - Item sales & Add-on usage analytics
Aggregates POS order data for menu performance insights
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db, get_current_user
from models import User

router = APIRouter()


def _date_range(period: str):
    """Return (start_iso, end_iso) for a given period."""
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:  # all
        start = datetime(2020, 1, 1, tzinfo=timezone.utc)
    return start.isoformat(), now.isoformat()


@router.get("/menu-analytics/items")
async def get_item_analytics(
    period: str = Query("month", regex="^(today|week|month|year|all)$"),
    branch_id: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get menu item sales analytics: top sellers, revenue, qty sold."""
    start_iso, end_iso = _date_range(period)

    match_stage = {
        "created_at": {"$gte": start_iso, "$lte": end_iso},
        "status": {"$ne": "cancelled"},
    }
    if branch_id:
        match_stage["branch_id"] = branch_id

    pipeline = [
        {"$match": match_stage},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.item_id",
            "name": {"$first": "$items.name"},
            "name_ar": {"$first": "$items.name_ar"},
            "total_qty": {"$sum": "$items.quantity"},
            "total_revenue": {"$sum": "$items.subtotal"},
            "order_count": {"$sum": 1},
            "avg_qty_per_order": {"$avg": "$items.quantity"},
        }},
        {"$sort": {"total_revenue": -1}},
        {"$limit": 50},
    ]

    items = await db.pos_orders.aggregate(pipeline).to_list(50)

    # Enrich with category from menu_items
    item_ids = [i["_id"] for i in items if i["_id"]]
    menu_map = {}
    if item_ids:
        menu_docs = await db.menu_items.find({"id": {"$in": item_ids}}, {"_id": 0, "id": 1, "category": 1, "price": 1}).to_list(500)
        menu_map = {m["id"]: m for m in menu_docs}

    result = []
    for i in items:
        item_id = i["_id"]
        menu = menu_map.get(item_id, {})
        cat = menu.get("category", "unknown")
        if category and cat != category:
            continue
        result.append({
            "item_id": item_id,
            "name": i.get("name", "Unknown"),
            "name_ar": i.get("name_ar", ""),
            "category": cat,
            "total_qty": i["total_qty"],
            "total_revenue": round(i["total_revenue"], 2),
            "order_count": i["order_count"],
            "avg_qty_per_order": round(i.get("avg_qty_per_order", 0), 2),
            "current_price": menu.get("price", 0),
        })

    # Category summary
    cat_summary = {}
    for r in result:
        c = r["category"]
        if c not in cat_summary:
            cat_summary[c] = {"category": c, "total_qty": 0, "total_revenue": 0, "item_count": 0}
        cat_summary[c]["total_qty"] += r["total_qty"]
        cat_summary[c]["total_revenue"] += r["total_revenue"]
        cat_summary[c]["item_count"] += 1

    # Overall totals
    total_qty = sum(r["total_qty"] for r in result)
    total_revenue = sum(r["total_revenue"] for r in result)

    return {
        "items": result,
        "category_summary": sorted(cat_summary.values(), key=lambda x: -x["total_revenue"]),
        "total_qty": total_qty,
        "total_revenue": round(total_revenue, 2),
        "period": period,
    }


@router.get("/menu-analytics/addons")
async def get_addon_analytics(
    period: str = Query("month", regex="^(today|week|month|year|all)$"),
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get add-on usage analytics: frequency, revenue, popular combos."""
    start_iso, end_iso = _date_range(period)

    match_stage = {
        "created_at": {"$gte": start_iso, "$lte": end_iso},
        "status": {"$ne": "cancelled"},
    }
    if branch_id:
        match_stage["branch_id"] = branch_id

    # Aggregate modifiers from order items
    pipeline = [
        {"$match": match_stage},
        {"$unwind": "$items"},
        {"$match": {"items.modifiers": {"$ne": []}, "items.modifiers": {"$exists": True}}},
        {"$unwind": "$items.modifiers"},
        {"$group": {
            "_id": {
                "group": "$items.modifiers.group",
                "name": "$items.modifiers.name",
            },
            "usage_count": {"$sum": "$items.quantity"},
            "total_revenue": {"$sum": {"$multiply": [
                {"$ifNull": ["$items.modifiers.price", 0]},
                "$items.quantity"
            ]}},
            "order_count": {"$sum": 1},
            "items_used_with": {"$addToSet": "$items.name"},
        }},
        {"$sort": {"usage_count": -1}},
        {"$limit": 50},
    ]

    modifiers = await db.pos_orders.aggregate(pipeline).to_list(50)

    # Separate into sizes, add-ons, and option groups
    sizes = []
    addons = []
    options = []

    for m in modifiers:
        group_name = m["_id"].get("group", "")
        entry = {
            "group": group_name,
            "name": m["_id"].get("name", ""),
            "usage_count": m["usage_count"],
            "total_revenue": round(m["total_revenue"], 2),
            "order_count": m["order_count"],
            "used_with_items": m.get("items_used_with", [])[:5],
        }
        if group_name == "Size":
            sizes.append(entry)
        elif group_name == "Add-ons":
            addons.append(entry)
        else:
            options.append(entry)

    # Overall stats
    total_modifier_usage = sum(m["usage_count"] for m in modifiers)
    total_modifier_revenue = sum(m["total_revenue"] for m in modifiers)

    # Orders with vs without modifiers
    total_orders = await db.pos_orders.count_documents(match_stage)
    orders_with_mods = await db.pos_orders.count_documents({
        **match_stage,
        "items.modifiers": {"$ne": []}
    })

    return {
        "sizes": sizes,
        "addons": addons,
        "options": options,
        "all_modifiers": [{"group": m["_id"].get("group",""), "name": m["_id"].get("name",""), "usage_count": m["usage_count"], "total_revenue": round(m["total_revenue"],2)} for m in modifiers],
        "total_modifier_usage": total_modifier_usage,
        "total_modifier_revenue": round(total_modifier_revenue, 2),
        "total_orders": total_orders,
        "orders_with_modifiers": orders_with_mods,
        "modifier_adoption_rate": round((orders_with_mods / total_orders * 100) if total_orders > 0 else 0, 1),
        "period": period,
    }


@router.get("/menu-analytics/trends")
async def get_item_trends(
    item_id: str = Query(...),
    period: str = Query("month", regex="^(today|week|month|year|all)$"),
    current_user: User = Depends(get_current_user)
):
    """Get daily sales trend for a specific menu item."""
    start_iso, end_iso = _date_range(period)

    pipeline = [
        {"$match": {
            "created_at": {"$gte": start_iso, "$lte": end_iso},
            "status": {"$ne": "cancelled"},
            "items.item_id": item_id,
        }},
        {"$unwind": "$items"},
        {"$match": {"items.item_id": item_id}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "qty": {"$sum": "$items.quantity"},
            "revenue": {"$sum": "$items.subtotal"},
        }},
        {"$sort": {"_id": 1}},
    ]

    data = await db.pos_orders.aggregate(pipeline).to_list(365)
    return {
        "item_id": item_id,
        "daily": [{"date": d["_id"], "qty": d["qty"], "revenue": round(d["revenue"], 2)} for d in data],
        "period": period,
    }


@router.get("/menu-analytics/peak-hours")
async def get_peak_hours(
    period: str = Query("month", regex="^(today|week|month|year|all)$"),
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get order volume by hour of day and day of week for peak hours analysis."""
    start_iso, end_iso = _date_range(period)

    match_stage = {
        "created_at": {"$gte": start_iso, "$lte": end_iso},
        "status": {"$ne": "cancelled"},
    }
    if branch_id:
        match_stage["branch_id"] = branch_id

    orders = await db.pos_orders.find(match_stage, {"_id": 0, "created_at": 1, "total": 1, "items": 1}).to_list(10000)

    # Aggregate by hour and day of week
    hourly = {h: {"hour": h, "orders": 0, "revenue": 0, "items_sold": 0} for h in range(24)}
    daily = {d: {"day": d, "orders": 0, "revenue": 0} for d in range(7)}  # 0=Mon, 6=Sun
    DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    heatmap = {}  # (day, hour) -> count

    for order in orders:
        created = order.get("created_at", "")
        total = order.get("total", 0) or 0
        item_count = sum(i.get("quantity", 1) for i in order.get("items", []))
        try:
            if isinstance(created, str):
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            else:
                dt = created
            h = dt.hour
            dow = dt.weekday()  # 0=Mon, 6=Sun
            hourly[h]["orders"] += 1
            hourly[h]["revenue"] += total
            hourly[h]["items_sold"] += item_count
            daily[dow]["orders"] += 1
            daily[dow]["revenue"] += total
            key = f"{dow}_{h}"
            heatmap[key] = heatmap.get(key, 0) + 1
        except (ValueError, AttributeError):
            continue

    hourly_list = sorted(hourly.values(), key=lambda x: x["hour"])
    for h in hourly_list:
        h["revenue"] = round(h["revenue"], 2)
        h["label"] = f"{h['hour']:02d}:00"

    daily_list = sorted(daily.values(), key=lambda x: x["day"])
    for d in daily_list:
        d["revenue"] = round(d["revenue"], 2)
        d["name"] = DAY_NAMES[d["day"]]

    # Find peak hour and day
    peak_hour = max(hourly_list, key=lambda x: x["orders"]) if orders else None
    peak_day = max(daily_list, key=lambda x: x["orders"]) if orders else None

    # Build heatmap data for day x hour grid
    heatmap_data = []
    for dow in range(7):
        for h in range(24):
            heatmap_data.append({
                "day": DAY_NAMES[dow][:3],
                "day_index": dow,
                "hour": h,
                "label": f"{h:02d}:00",
                "count": heatmap.get(f"{dow}_{h}", 0),
            })

    total_orders = len(orders)
    total_revenue = round(sum(o.get("total", 0) or 0 for o in orders), 2)

    # Rush hours: hours with above-average orders
    avg_per_hour = total_orders / 24 if total_orders > 0 else 0
    rush_hours = [h for h in hourly_list if h["orders"] > avg_per_hour and h["orders"] > 0]

    return {
        "hourly": hourly_list,
        "daily": daily_list,
        "heatmap": heatmap_data,
        "peak_hour": {"hour": peak_hour["label"], "orders": peak_hour["orders"], "revenue": peak_hour["revenue"]} if peak_hour and peak_hour["orders"] > 0 else None,
        "peak_day": {"day": peak_day["name"], "orders": peak_day["orders"], "revenue": peak_day["revenue"]} if peak_day and peak_day["orders"] > 0 else None,
        "rush_hours": [{"hour": h["label"], "orders": h["orders"]} for h in rush_hours],
        "total_orders": total_orders,
        "total_revenue": total_revenue,
        "avg_orders_per_hour": round(avg_per_hour, 1),
        "period": period,
    }
