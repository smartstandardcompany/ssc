from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db, get_current_user, get_branch_filter
from models import User

router = APIRouter()

@router.get("/dashboard/stats")
async def get_dashboard_stats(branch_ids: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    exp_query = {}
    sp_query = {"supplier_id": {"$exists": True, "$ne": None}}

    if branch_ids:
        bid_list = [b.strip() for b in branch_ids.split(",") if b.strip()]
        if bid_list:
            query["branch_id"] = {"$in": bid_list}
            exp_query["branch_id"] = {"$in": bid_list}
            sp_query["branch_id"] = {"$in": bid_list}
    elif current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id
        exp_query["branch_id"] = current_user.branch_id
        sp_query["branch_id"] = current_user.branch_id

    if start_date and end_date:
        date_filter = {"$gte": start_date, "$lte": end_date}
        query["date"] = date_filter
        exp_query["date"] = date_filter
        sp_query["date"] = date_filter

    # Use aggregation pipelines for expenses and supplier payments (heavy collections)
    exp_pipeline = [
        {"$match": exp_query},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$amount"},
            "cash": {"$sum": {"$cond": [{"$eq": ["$payment_mode", "cash"]}, "$amount", 0]}},
            "bank": {"$sum": {"$cond": [{"$eq": ["$payment_mode", "bank"]}, "$amount", 0]}},
        }}
    ]
    exp_agg = await db.expenses.aggregate(exp_pipeline).to_list(1)
    exp_stats = exp_agg[0] if exp_agg else {"total": 0, "cash": 0, "bank": 0}
    
    sp_pipeline = [
        {"$match": sp_query},
        {"$group": {
            "_id": None,
            "total": {"$sum": {"$cond": [{"$ne": ["$payment_mode", "credit"]}, "$amount", 0]}},
            "cash": {"$sum": {"$cond": [{"$eq": ["$payment_mode", "cash"]}, "$amount", 0]}},
            "bank": {"$sum": {"$cond": [{"$eq": ["$payment_mode", "bank"]}, "$amount", 0]}},
        }}
    ]
    sp_agg = await db.supplier_payments.aggregate(sp_pipeline).to_list(1)
    sp_stats = sp_agg[0] if sp_agg else {"total": 0, "cash": 0, "bank": 0}

    # Sales still need full fetch for payment_details breakdown
    sales = await db.sales.find(query, {"_id": 0, "amount": 1, "credit_amount": 1, "credit_received": 1, "payment_details": 1, "sale_type": 1, "payment_mode": 1}).to_list(10000)

    total_sales = sum(sale["amount"] - (sale.get("credit_amount", 0) - sale.get("credit_received", 0)) for sale in sales)
    total_expenses = exp_stats["total"]
    total_supplier_payments = sp_stats["total"]

    pending_credits = sum(sale.get("credit_amount", 0) - sale.get("credit_received", 0) for sale in sales)

    cash_sales = 0
    bank_sales = 0
    online_sales = 0
    credit_sales = pending_credits

    for sale in sales:
        for payment in sale.get("payment_details", []):
            if payment["mode"] == "cash":
                cash_sales += payment["amount"]
            elif payment["mode"] == "bank":
                bank_sales += payment["amount"]
            elif payment["mode"] in ["online", "online_platform"]:
                online_sales += payment["amount"]
        if sale.get("sale_type") in ["online", "online_platform"] and sale.get("payment_mode") == "online_platform":
            if not sale.get("payment_details"):
                online_sales += sale.get("amount", 0)

    net_profit = total_sales - total_expenses - total_supplier_payments

    exp_cash = exp_stats["cash"]
    exp_bank = exp_stats["bank"]
    sp_cash = sp_stats["cash"]
    sp_bank = sp_stats["bank"]
    cash_in_hand = cash_sales - exp_cash - sp_cash
    bank_in_hand = bank_sales - exp_bank - sp_bank

    # Expense by category using aggregation
    cat_pipeline = [{"$match": exp_query}, {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}}]
    cat_agg = await db.expenses.aggregate(cat_pipeline).to_list(100)
    expense_by_category = {r["_id"] or "other": r["total"] for r in cat_agg}

    # Supplier dues using aggregation (filtered by branch)
    sup_dues_query = {}
    if branch_ids:
        bid_list = [b.strip() for b in branch_ids.split(",") if b.strip()]
        if bid_list:
            sup_dues_query["branch_id"] = {"$in": bid_list}
    elif current_user.branch_id and current_user.role != "admin":
        sup_dues_query["branch_id"] = current_user.branch_id
    sup_dues_pipeline = [{"$match": sup_dues_query}, {"$group": {"_id": None, "total": {"$sum": "$current_credit"}}}]
    sup_dues_agg = await db.suppliers.aggregate(sup_dues_pipeline).to_list(1)
    supplier_dues = sup_dues_agg[0]["total"] if sup_dues_agg else 0

    recurring = await db.recurring_expenses.find({"active": True}, {"_id": 0}).to_list(100)
    now = datetime.now(timezone.utc)
    upcoming_expenses = []
    for r in recurring:
        due = r.get("next_due_date")
        if isinstance(due, str):
            due = datetime.fromisoformat(due)
        if due and due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        if due:
            days_left = (due - now).days
            if days_left <= r.get("alert_days", 7):
                upcoming_expenses.append({"name": r["name"], "category": r.get("category", ""), "amount": r["amount"], "due_date": due.isoformat(), "days_left": days_left})

    transfers = await db.cash_transfers.find({}, {"_id": 0}).to_list(10000)
    branch_dues = {}
    for t in transfers:
        from_b = t.get("from_branch_name", "Office")
        to_b = t.get("to_branch_name", "Office")
        if from_b != to_b:
            key = f"{to_b} → {from_b}"
            branch_dues[key] = branch_dues.get(key, 0) + t["amount"]

    prev_month_start = (now.replace(day=1) - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_end = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0) - timedelta(seconds=1)
    pms = prev_month_start.isoformat()
    pme = prev_month_end.isoformat()

    prev_sales_q = {"date": {"$gte": pms, "$lte": pme}}
    prev_exp_q = {"date": {"$gte": pms, "$lte": pme}}
    if branch_ids:
        bid_list = [b.strip() for b in branch_ids.split(",") if b.strip()]
        if bid_list:
            prev_sales_q["branch_id"] = {"$in": bid_list}
            prev_exp_q["branch_id"] = {"$in": bid_list}

    prev_sales = await db.sales.find(prev_sales_q, {"_id": 0}).to_list(10000)
    prev_expenses = await db.expenses.find(prev_exp_q, {"_id": 0}).to_list(10000)

    prev_total_sales = sum(s.get("final_amount", s["amount"]) for s in prev_sales)
    prev_total_expenses = sum(e["amount"] for e in prev_expenses)
    prev_net = prev_total_sales - prev_total_expenses

    fines_query = {"payment_status": {"$ne": "paid"}}
    if branch_ids:
        bid_list = [b.strip() for b in branch_ids.split(",") if b.strip()]
        if bid_list:
            fines_query["branch_id"] = {"$in": bid_list}
    elif current_user.branch_id and current_user.role != "admin":
        fines_query["branch_id"] = current_user.branch_id
    all_fines = await db.fines.find(fines_query, {"_id": 0}).to_list(1000)
    due_fines = sum(f["amount"] - f.get("paid_amount", 0) for f in all_fines)
    due_fines_list = [{"department": f.get("department",""), "amount": f["amount"] - f.get("paid_amount",0), "type": f.get("fine_type","")} for f in all_fines[:5]]

    # Branch loss alerts - use aggregation for expenses and supplier payments per branch
    branch_alerts_list = []
    all_branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    
    # Get per-branch expense totals
    br_exp_pipeline = [{"$match": exp_query}, {"$group": {"_id": "$branch_id", "total": {"$sum": "$amount"}}}]
    br_exp_agg = await db.expenses.aggregate(br_exp_pipeline).to_list(100)
    br_exp_totals = {r["_id"]: r["total"] for r in br_exp_agg}
    
    # Get per-branch supplier payment totals
    br_sp_pipeline = [{"$match": sp_query}, {"$group": {"_id": "$branch_id", "total": {"$sum": "$amount"}}}]
    br_sp_agg = await db.supplier_payments.aggregate(br_sp_pipeline).to_list(100)
    br_sp_totals = {r["_id"]: r["total"] for r in br_sp_agg}
    
    for br in all_branches:
        bid = br["id"]
        br_sales = [s for s in sales if s.get("branch_id") == bid]
        br_total_sales = sum(s.get("final_amount", s["amount"]) for s in br_sales)
        br_total_exp = br_exp_totals.get(bid, 0)
        br_total_sp = br_sp_totals.get(bid, 0)
        br_profit = br_total_sales - br_total_exp - br_total_sp
        if br_profit < 0:
            branch_alerts_list.append({"branch": br["name"], "profit": br_profit, "sales": br_total_sales, "expenses": br_total_exp + br_total_sp})

    return {
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "total_supplier_payments": total_supplier_payments,
        "total_sales_count": len(sales),
        "net_profit": net_profit,
        "pending_credits": pending_credits,
        "cash_sales": cash_sales,
        "bank_sales": bank_sales,
        "online_sales": online_sales,
        "credit_sales": credit_sales,
        "cash_in_hand": cash_in_hand,
        "bank_in_hand": bank_in_hand,
        "expenses_cash": exp_cash,
        "expenses_bank": exp_bank,
        "sp_cash": sp_cash,
        "sp_bank": sp_bank,
        "expense_by_category": expense_by_category,
        "supplier_dues": supplier_dues,
        "upcoming_expenses": upcoming_expenses,
        "branch_dues": branch_dues,
        "prev_sales": prev_total_sales,
        "prev_expenses": prev_total_expenses,
        "prev_net": prev_net,
        "expenses_pct_of_sales": round(total_expenses / total_sales * 100, 1) if total_sales > 0 else 0,
        "sp_pct_of_sales": round(total_supplier_payments / total_sales * 100, 1) if total_sales > 0 else 0,
        "profit_pct_of_sales": round(net_profit / total_sales * 100, 1) if total_sales > 0 else 0,
        "due_fines": due_fines,
        "due_fines_list": due_fines_list,
        "vat_on_sales": round(total_sales * 0.15, 2),
        "vat_on_purchases": round(total_supplier_payments * 0.15, 2),
        "vat_payable": round((total_sales - total_supplier_payments) * 0.15, 2),
        "branch_loss_alerts": branch_alerts_list,
    }


@router.get("/dashboard/today-vs-yesterday")
async def get_today_vs_yesterday(branch_ids: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Compare today's performance vs yesterday."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = (now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()
    yest_start = (now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)).isoformat()
    yest_end = today_start

    query = {}
    if branch_ids:
        bid_list = [b.strip() for b in branch_ids.split(",") if b.strip()]
        if bid_list:
            query["branch_id"] = {"$in": bid_list}
    elif current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id

    today_sales = await db.sales.find({**query, "date": {"$gte": today_start, "$lt": today_end}}, {"_id": 0}).to_list(5000)
    today_exp = await db.expenses.find({**query, "date": {"$gte": today_start, "$lt": today_end}}, {"_id": 0}).to_list(5000)
    yest_sales = await db.sales.find({**query, "date": {"$gte": yest_start, "$lt": yest_end}}, {"_id": 0}).to_list(5000)
    yest_exp = await db.expenses.find({**query, "date": {"$gte": yest_start, "$lt": yest_end}}, {"_id": 0}).to_list(5000)

    t_sales = sum(s.get("final_amount", s["amount"]) for s in today_sales)
    t_exp = sum(e["amount"] for e in today_exp)
    y_sales = sum(s.get("final_amount", s["amount"]) for s in yest_sales)
    y_exp = sum(e["amount"] for e in yest_exp)

    t_cash = sum(p["amount"] for s in today_sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    t_bank = sum(p["amount"] for s in today_sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
    y_cash = sum(p["amount"] for s in yest_sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    y_bank = sum(p["amount"] for s in yest_sales for p in s.get("payment_details", []) if p.get("mode") == "bank")

    def pct(curr, prev):
        if prev == 0:
            return 100.0 if curr > 0 else 0.0
        return round((curr - prev) / abs(prev) * 100, 1)

    return {
        "today": {
            "sales": round(t_sales, 2), "expenses": round(t_exp, 2),
            "profit": round(t_sales - t_exp, 2), "count": len(today_sales),
            "cash": round(t_cash, 2), "bank": round(t_bank, 2),
        },
        "yesterday": {
            "sales": round(y_sales, 2), "expenses": round(y_exp, 2),
            "profit": round(y_sales - y_exp, 2), "count": len(yest_sales),
            "cash": round(y_cash, 2), "bank": round(y_bank, 2),
        },
        "change": {
            "sales": pct(t_sales, y_sales), "expenses": pct(t_exp, y_exp),
            "profit": pct(t_sales - t_exp, y_sales - y_exp),
            "count": pct(len(today_sales), len(yest_sales)),
            "cash": pct(t_cash, y_cash), "bank": pct(t_bank, y_bank),
        }
    }




@router.get("/dashboard/live-analytics")
async def get_live_analytics(current_user: User = Depends(get_current_user)):
    """Real-time POS analytics: recent sales, branch leaderboard, cashier stats."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_end = (now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()

    sales = await db.sales.find({"date": {"$gte": today_start, "$lt": today_end}}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    expenses = await db.expenses.find({"date": {"$gte": today_start, "$lt": today_end}}, {"_id": 0}).to_list(5000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    users = await db.users.find({}, {"_id": 0}).to_list(500)
    branch_map = {b["id"]: b["name"] for b in branches}
    user_map = {u["id"]: u["name"] for u in users}

    total_sales = sum(s.get("final_amount", s["amount"]) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    total_count = len(sales)
    avg_ticket = round(total_sales / total_count, 2) if total_count > 0 else 0

    # Recent 15 sales
    recent = []
    for s in sales[:15]:
        modes = [p["mode"] for p in s.get("payment_details", [])]
        recent.append({
            "id": s["id"], "amount": s.get("final_amount", s["amount"]),
            "branch": branch_map.get(s.get("branch_id"), "N/A"),
            "cashier": user_map.get(s.get("created_by"), "N/A"),
            "mode": ", ".join(modes) if modes else s.get("payment_mode", "cash"),
            "time": s.get("created_at", s.get("date", "")),
            "description": s.get("description", s.get("notes", ""))[:40],
        })

    # Branch leaderboard
    branch_stats = {}
    for s in sales:
        bid = s.get("branch_id", "unknown")
        if bid not in branch_stats:
            branch_stats[bid] = {"name": branch_map.get(bid, "N/A"), "total": 0, "count": 0}
        branch_stats[bid]["total"] += s.get("final_amount", s["amount"])
        branch_stats[bid]["count"] += 1
    leaderboard = sorted(branch_stats.values(), key=lambda x: -x["total"])

    # Cashier stats
    cashier_stats = {}
    for s in sales:
        cid = s.get("created_by", "unknown")
        if cid not in cashier_stats:
            cashier_stats[cid] = {"name": user_map.get(cid, "N/A"), "total": 0, "count": 0}
        cashier_stats[cid]["total"] += s.get("final_amount", s["amount"])
        cashier_stats[cid]["count"] += 1
    top_cashiers = sorted(cashier_stats.values(), key=lambda x: -x["total"])

    # Hourly breakdown
    hourly = {}
    for s in sales:
        t = s.get("created_at", s.get("date", ""))
        if isinstance(t, str) and len(t) >= 13:
            h = t[11:13]
            hourly[h] = hourly.get(h, 0) + s.get("final_amount", s["amount"])
    hourly_chart = [{"hour": f"{h}:00", "amount": round(v, 2)} for h, v in sorted(hourly.items())]

    # Payment mode breakdown
    mode_totals = {"cash": 0, "bank": 0, "online": 0, "credit": 0}
    for s in sales:
        for p in s.get("payment_details", []):
            m = p.get("mode", "cash")
            mode_totals[m] = mode_totals.get(m, 0) + p.get("amount", 0)

    return {
        "total_sales": round(total_sales, 2), "total_expenses": round(total_expenses, 2),
        "net": round(total_sales - total_expenses, 2),
        "sales_count": total_count, "avg_ticket": avg_ticket,
        "recent_sales": recent, "branch_leaderboard": leaderboard,
        "top_cashiers": top_cashiers[:10], "hourly_chart": hourly_chart,
        "payment_modes": mode_totals,
        "timestamp": now.isoformat(),
    }


# =====================================================
# DASHBOARD LAYOUT PREFERENCES (Per User)
# =====================================================

@router.get("/dashboard/layout")
async def get_dashboard_layout(current_user: User = Depends(get_current_user)):
    """Get user's saved dashboard layout preferences"""
    prefs = await db.dashboard_layouts.find_one({"user_id": current_user.id}, {"_id": 0})
    if not prefs:
        return {
            "user_id": current_user.id,
            "layout": None,
            "widgets": None,
            "theme": "default"
        }
    return prefs


@router.post("/dashboard/layout")
async def save_dashboard_layout(body: dict, current_user: User = Depends(get_current_user)):
    """Save user's dashboard layout preferences"""
    layout = body.get("layout")  # Grid layout positions
    widgets = body.get("widgets")  # Widget visibility settings
    theme = body.get("theme", "default")
    
    existing = await db.dashboard_layouts.find_one({"user_id": current_user.id})
    
    update_data = {
        "user_id": current_user.id,
        "layout": layout,
        "widgets": widgets,
        "theme": theme,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        await db.dashboard_layouts.update_one(
            {"user_id": current_user.id},
            {"$set": update_data}
        )
    else:
        update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.dashboard_layouts.insert_one(update_data)
    
    return {"success": True, "message": "Dashboard layout saved"}


@router.delete("/dashboard/layout")
async def reset_dashboard_layout(current_user: User = Depends(get_current_user)):
    """Reset user's dashboard layout to default"""
    await db.dashboard_layouts.delete_one({"user_id": current_user.id})
    return {"success": True, "message": "Dashboard layout reset to default"}



@router.get("/dashboard/daily-summary")
async def get_daily_summary(
    date: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get comprehensive daily summary of sales, expenses, and supplier activity.
    
    Args:
        date: Date to get summary for (YYYY-MM-DD format). Defaults to today.
        branch_id: Filter by specific branch
    """
    # Default to today
    if date:
        target_date = date
    else:
        target_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Build queries - use $lt next_day to handle timezone-suffixed dates
    date_start = f"{target_date}T00:00:00"
    from datetime import timedelta as td
    next_day = (datetime.strptime(target_date, "%Y-%m-%d") + td(days=1)).strftime("%Y-%m-%d")
    date_end = f"{next_day}T00:00:00"
    
    base_query = {"date": {"$gte": date_start, "$lt": date_end}}
    
    # Apply branch filter for sales
    sale_query = dict(base_query)
    if branch_id:
        sale_query["branch_id"] = branch_id
    elif current_user.branch_id and current_user.role != "admin":
        sale_query["branch_id"] = current_user.branch_id
    
    # Apply branch filter for expenses (include cross-branch expenses)
    if branch_id:
        exp_query = {"date": {"$gte": date_start, "$lt": date_end}, "$or": [
            {"branch_id": branch_id},
            {"expense_for_branch_id": branch_id}
        ]}
    elif current_user.branch_id and current_user.role != "admin":
        exp_query = {"date": {"$gte": date_start, "$lt": date_end}, "$or": [
            {"branch_id": current_user.branch_id},
            {"expense_for_branch_id": current_user.branch_id}
        ]}
    else:
        exp_query = dict(base_query)
    
    # Fetch data
    sales = await db.sales.find(sale_query, {"_id": 0}).to_list(10000)
    
    expenses = await db.expenses.find(exp_query, {"_id": 0}).to_list(10000)
    
    sp_query = {"date": {"$gte": date_start, "$lt": date_end}}
    if branch_id:
        sp_query["branch_id"] = branch_id
    elif current_user.branch_id and current_user.role != "admin":
        sp_query["branch_id"] = current_user.branch_id
    supplier_payments = await db.supplier_payments.find(sp_query, {"_id": 0}).to_list(1000)
    
    # Get branches for names
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b.get("name", "Unknown") for b in branches}
    
    # Get suppliers for names
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    supplier_map = {s["id"]: s for s in suppliers if "id" in s}
    
    # Get customers for names
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    customer_map = {c["id"]: c.get("name", "Unknown") for c in customers if "id" in c}
    
    # === SALES SUMMARY ===
    total_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
    sales_count = len(sales)
    
    cash_sales = 0
    bank_sales = 0
    credit_sales = 0
    online_sales = 0
    
    for sale in sales:
        for p in sale.get("payment_details", []):
            amt = p.get("amount", 0)
            mode = p.get("mode", "cash")
            if mode == "cash":
                cash_sales += amt
            elif mode == "bank":
                bank_sales += amt
            elif mode == "credit":
                credit_sales += amt
            elif mode in ["online", "online_platform"]:
                online_sales += amt
    
    # Pending credit from today's sales
    pending_credit = sum(s.get("credit_amount", 0) - s.get("credit_received", 0) for s in sales)
    
    # Sales by branch
    sales_by_branch = {}
    for s in sales:
        bid = s.get("branch_id")
        bname = branch_map.get(bid, "Unknown")
        if bname not in sales_by_branch:
            sales_by_branch[bname] = {"count": 0, "amount": 0}
        sales_by_branch[bname]["count"] += 1
        sales_by_branch[bname]["amount"] += s.get("final_amount", s.get("amount", 0))
    
    # Top items sold today
    item_sales = {}
    for s in sales:
        for item in s.get("items", []):
            iname = item.get("name", item.get("item_name", "Unknown"))
            qty = item.get("quantity", 1)
            if iname not in item_sales:
                item_sales[iname] = {"qty": 0, "revenue": 0}
            item_sales[iname]["qty"] += qty
            item_sales[iname]["revenue"] += item.get("price", 0) * qty
    
    top_items = sorted(item_sales.items(), key=lambda x: x[1]["revenue"], reverse=True)[:5]
    
    # Recent sales (last 10)
    recent_sales = sorted(sales, key=lambda x: x.get("date", ""), reverse=True)[:10]
    recent_sales_list = []
    for s in recent_sales:
        recent_sales_list.append({
            "id": s.get("id"),
            "time": s.get("date", "")[11:19] if len(s.get("date", "")) > 19 else s.get("date", "")[-8:] if len(s.get("date", "")) > 8 else "",
            "amount": s.get("final_amount", s.get("amount", 0)),
            "customer": customer_map.get(s.get("customer_id"), "Walk-in") if s.get("customer_id") else "Walk-in",
            "payment_mode": s.get("payment_details", [{}])[0].get("mode", "cash") if s.get("payment_details") else "cash",
            "branch": branch_map.get(s.get("branch_id"), "Unknown")
        })
    
    # === EXPENSES SUMMARY ===
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    expenses_count = len(expenses)
    
    exp_cash = sum(e["amount"] for e in expenses if e.get("payment_mode") == "cash")
    exp_bank = sum(e["amount"] for e in expenses if e.get("payment_mode") == "bank")
    exp_credit = sum(e["amount"] for e in expenses if e.get("payment_mode") == "credit")
    
    # Expenses by category
    expenses_by_category = {}
    for e in expenses:
        cat = e.get("category", "Other")
        if cat not in expenses_by_category:
            expenses_by_category[cat] = {"count": 0, "amount": 0}
        expenses_by_category[cat]["count"] += 1
        expenses_by_category[cat]["amount"] += e.get("amount", 0)
    
    # Recent expenses (last 10)
    recent_expenses = sorted(expenses, key=lambda x: x.get("date", ""), reverse=True)[:10]
    recent_expenses_list = []
    for e in recent_expenses:
        recent_expenses_list.append({
            "id": e.get("id"),
            "description": e.get("description", "")[:50],
            "category": e.get("category", "Other"),
            "amount": e.get("amount", 0),
            "payment_mode": e.get("payment_mode", "cash"),
            "supplier": supplier_map.get(e.get("supplier_id"), {}).get("name") if e.get("supplier_id") else None
        })
    
    # === SUPPLIER ACTIVITY ===
    supplier_payments_total = sum(p.get("amount", 0) for p in supplier_payments)
    supplier_payments_count = len(supplier_payments)
    
    # Credit purchases from suppliers today (expenses on credit)
    supplier_credit_purchases = [e for e in expenses if e.get("supplier_id") and e.get("payment_mode") == "credit"]
    total_supplier_credit = sum(e.get("amount", 0) for e in supplier_credit_purchases)
    
    # Recent supplier payments
    recent_supplier_payments = sorted(supplier_payments, key=lambda x: x.get("date", ""), reverse=True)[:10]
    supplier_payments_list = []
    for p in recent_supplier_payments:
        supplier_payments_list.append({
            "id": p.get("id"),
            "supplier": supplier_map.get(p.get("supplier_id"), {}).get("name", "Unknown"),
            "amount": p.get("amount", 0),
            "payment_mode": p.get("payment_mode", "cash")
        })
    
    # === NET SUMMARY ===
    net_cash_flow = (cash_sales - exp_cash)
    net_bank_flow = (bank_sales - exp_bank)
    net_profit = total_sales - total_expenses
    
    return {
        "date": target_date,
        "sales": {
            "total": total_sales,
            "count": sales_count,
            "cash": cash_sales,
            "bank": bank_sales,
            "credit": credit_sales,
            "online": online_sales,
            "pending_credit": pending_credit,
            "by_branch": sales_by_branch,
            "top_items": [{"name": k, "qty": v["qty"], "revenue": v["revenue"]} for k, v in top_items],
            "recent": recent_sales_list
        },
        "expenses": {
            "total": total_expenses,
            "count": expenses_count,
            "cash": exp_cash,
            "bank": exp_bank,
            "credit": exp_credit,
            "by_category": expenses_by_category,
            "recent": recent_expenses_list
        },
        "suppliers": {
            "payments_total": supplier_payments_total,
            "payments_count": supplier_payments_count,
            "credit_purchases": total_supplier_credit,
            "recent_payments": supplier_payments_list
        },
        "summary": {
            "net_cash_flow": net_cash_flow,
            "net_bank_flow": net_bank_flow,
            "net_profit": net_profit,
            "total_in": total_sales,
            "total_out": total_expenses + supplier_payments_total
        }
    }



@router.get("/dashboard/daily-summary-range")
async def get_daily_summary_range(
    start_date: str,
    end_date: str,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get aggregated and day-by-day summary for a date range."""
    from datetime import date as dt_date, timedelta as td

    # Parse dates
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    next_day = (end + td(days=1)).strftime("%Y-%m-%d")
    
    # Use $lt next_day to properly include dates with timezone suffixes like +00:00
    date_filter = {"$gte": f"{start_date}T00:00:00", "$lt": f"{next_day}T00:00:00"}

    # --- Sales query: filter by branch_id ---
    sale_query = {"date": date_filter}
    if branch_id:
        sale_query["branch_id"] = branch_id
    elif current_user.branch_id and current_user.role != "admin":
        sale_query["branch_id"] = current_user.branch_id

    # --- Expense query: filter by branch_id OR expense_for_branch_id ---
    if branch_id:
        exp_query = {"date": date_filter, "$or": [
            {"branch_id": branch_id},
            {"expense_for_branch_id": branch_id}
        ]}
    elif current_user.branch_id and current_user.role != "admin":
        exp_query = {"date": date_filter, "$or": [
            {"branch_id": current_user.branch_id},
            {"expense_for_branch_id": current_user.branch_id}
        ]}
    else:
        exp_query = {"date": date_filter}

    # --- Supplier payment query ---
    sp_query = {"date": date_filter}
    if branch_id:
        sp_query["branch_id"] = branch_id
    elif current_user.branch_id and current_user.role != "admin":
        sp_query["branch_id"] = current_user.branch_id

    # Fetch all data for the range
    sales = await db.sales.find(sale_query, {"_id": 0, "date": 1, "amount": 1, "final_amount": 1, "payment_details": 1, "credit_amount": 1, "credit_received": 1}).to_list(50000)
    expenses = await db.expenses.find(exp_query, {"_id": 0, "date": 1, "amount": 1, "payment_mode": 1, "category": 1}).to_list(50000)
    supplier_payments = await db.supplier_payments.find(sp_query, {"_id": 0, "date": 1, "amount": 1, "payment_mode": 1}).to_list(50000)

    # Compute totals
    total_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
    total_sales_cash = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    total_sales_bank = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
    total_sales_credit = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "credit")
    total_sales_online = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") in ("online", "online_platform"))

    total_expenses = sum(e.get("amount", 0) for e in expenses)
    total_exp_cash = sum(e["amount"] for e in expenses if e.get("payment_mode") == "cash")
    total_exp_bank = sum(e["amount"] for e in expenses if e.get("payment_mode") == "bank")
    total_exp_credit = sum(e["amount"] for e in expenses if e.get("payment_mode") == "credit")

    total_sp = sum(p.get("amount", 0) for p in supplier_payments)
    total_sp_cash = sum(p["amount"] for p in supplier_payments if p.get("payment_mode") == "cash")
    total_sp_bank = sum(p["amount"] for p in supplier_payments if p.get("payment_mode") == "bank")

    # Expense by category
    exp_by_cat = {}
    for e in expenses:
        cat = e.get("category", "Other")
        exp_by_cat[cat] = exp_by_cat.get(cat, 0) + e.get("amount", 0)

    # Day-by-day breakdown
    daily = {}
    for s in sales:
        d = s.get("date", "")[:10]
        if d not in daily:
            daily[d] = {"date": d, "sales": 0, "sales_cash": 0, "sales_bank": 0, "sales_credit": 0, "sales_online": 0, "sales_count": 0, "expenses": 0, "exp_cash": 0, "exp_bank": 0, "exp_credit": 0, "exp_count": 0, "sp_total": 0, "sp_cash": 0, "sp_bank": 0}
        daily[d]["sales"] += s.get("final_amount", s.get("amount", 0))
        daily[d]["sales_count"] += 1
        for p in s.get("payment_details", []):
            mode = p.get("mode", "cash")
            if mode == "cash": daily[d]["sales_cash"] += p["amount"]
            elif mode == "bank": daily[d]["sales_bank"] += p["amount"]
            elif mode == "credit": daily[d]["sales_credit"] += p["amount"]
            elif mode in ("online", "online_platform"): daily[d]["sales_online"] += p["amount"]

    for e in expenses:
        d = e.get("date", "")[:10]
        if d not in daily:
            daily[d] = {"date": d, "sales": 0, "sales_cash": 0, "sales_bank": 0, "sales_credit": 0, "sales_online": 0, "sales_count": 0, "expenses": 0, "exp_cash": 0, "exp_bank": 0, "exp_credit": 0, "exp_count": 0, "sp_total": 0, "sp_cash": 0, "sp_bank": 0}
        daily[d]["expenses"] += e.get("amount", 0)
        daily[d]["exp_count"] += 1
        mode = e.get("payment_mode", "cash")
        if mode == "cash": daily[d]["exp_cash"] += e["amount"]
        elif mode == "bank": daily[d]["exp_bank"] += e["amount"]
        elif mode == "credit": daily[d]["exp_credit"] += e["amount"]

    for p in supplier_payments:
        d = p.get("date", "")[:10]
        if d not in daily:
            daily[d] = {"date": d, "sales": 0, "sales_cash": 0, "sales_bank": 0, "sales_credit": 0, "sales_online": 0, "sales_count": 0, "expenses": 0, "exp_cash": 0, "exp_bank": 0, "exp_credit": 0, "exp_count": 0, "sp_total": 0, "sp_cash": 0, "sp_bank": 0}
        daily[d]["sp_total"] += p.get("amount", 0)
        mode = p.get("payment_mode", "cash")
        if mode == "cash": daily[d]["sp_cash"] += p["amount"]
        elif mode == "bank": daily[d]["sp_bank"] += p["amount"]

    daily_list = sorted(daily.values(), key=lambda x: x["date"], reverse=True)
    # Round values and add net cash/bank per day
    for row in daily_list:
        row["net_cash"] = round((row.get("sales_cash", 0) or 0) - (row.get("exp_cash", 0) or 0), 2)
        row["net_bank"] = round((row.get("sales_bank", 0) or 0) - (row.get("exp_bank", 0) or 0), 2)
        for k, v in row.items():
            if isinstance(v, float):
                row[k] = round(v, 2)

    return {
        "start_date": start_date,
        "end_date": end_date,
        "totals": {
            "sales": round(total_sales, 2),
            "sales_cash": round(total_sales_cash, 2),
            "sales_bank": round(total_sales_bank, 2),
            "sales_credit": round(total_sales_credit, 2),
            "sales_online": round(total_sales_online, 2),
            "sales_count": len(sales),
            "expenses": round(total_expenses, 2),
            "exp_cash": round(total_exp_cash, 2),
            "exp_bank": round(total_exp_bank, 2),
            "exp_credit": round(total_exp_credit, 2),
            "exp_count": len(expenses),
            "supplier_payments": round(total_sp, 2),
            "sp_cash": round(total_sp_cash, 2),
            "sp_bank": round(total_sp_bank, 2),
            "net_profit": round(total_sales - total_expenses, 2),
            "net_cash": round(total_sales_cash - total_exp_cash - total_sp_cash, 2),
            "net_bank": round(total_sales_bank - total_exp_bank - total_sp_bank, 2),
        },
        "expense_by_category": exp_by_cat,
        "daily": daily_list,
        "days_count": len(daily_list),
    }



@router.get("/dashboard/missing-data-alerts")
async def get_missing_data_alerts(current_user: User = Depends(get_current_user)):
    """Check which branches have no sales or expenses entered for yesterday and today."""
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    branches = await db.branches.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    if not branches:
        return {"alerts": [], "check_date": today}

    alerts = []
    for check_date in [yesterday, today]:
        date_start = check_date + "T00:00:00"
        date_end = check_date + "T23:59:59"

        for branch in branches:
            bid = branch["id"]
            bname = branch["name"]

            # Check sales
            sales_count = await db.sales.count_documents({
                "branch_id": bid,
                "date": {"$gte": date_start, "$lte": date_end}
            })
            # Check expenses
            expenses_count = await db.expenses.count_documents({
                "branch_id": bid,
                "date": {"$gte": date_start, "$lte": date_end}
            })

            missing = []
            if sales_count == 0:
                missing.append("sales")
            if expenses_count == 0:
                missing.append("expenses")

            if missing:
                alerts.append({
                    "branch_id": bid,
                    "branch_name": bname,
                    "date": check_date,
                    "missing": missing,
                    "is_today": check_date == today,
                    "message": f"{bname}: No {' or '.join(missing)} entered for {check_date}"
                })

    return {"alerts": alerts, "check_dates": [yesterday, today]}
