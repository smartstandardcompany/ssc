"""Duplicate Report - Scans all modules for potential duplicate entries."""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from database import db, get_current_user, get_tenant_filter, stamp_tenant
from models import User

router = APIRouter()


@router.get("/duplicate-report/scan")
async def scan_duplicates(
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_user)
):
    """Scan sales, expenses, and supplier payments for duplicate entries."""
    now = datetime.now(timezone.utc)
    next_day = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    cutoff = (now - timedelta(days=days)).strftime("%Y-%m-%d")
    date_filter = {"$gte": f"{cutoff}T00:00:00", "$lt": f"{next_day}T00:00:00"}

    branches = await db.branches.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    suppliers = await db.suppliers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
    supplier_map = {s["id"]: s["name"] for s in suppliers}

    results = {"sales": [], "expenses": [], "supplier_payments": [], "summary": {}}

    # --- Sales Duplicates: same branch + same amount on same day ---
    sales = await db.sales.find(
        {"date": date_filter},
        {"_id": 0, "id": 1, "date": 1, "branch_id": 1, "amount": 1, "final_amount": 1,
         "sale_type": 1, "payment_details": 1, "notes": 1, "created_at": 1}
    ).to_list(100000)

    sale_groups = defaultdict(list)
    for s in sales:
        date_key = str(s.get("date", ""))[:10]
        amt = s.get("final_amount") or s.get("amount", 0)
        key = f"{date_key}_{s.get('branch_id', 'none')}_{amt:.2f}"
        sale_groups[key].append(s)

    for key, group in sale_groups.items():
        if len(group) > 1:
            date_key = key.split("_")[0]
            amt = group[0].get("final_amount") or group[0].get("amount", 0)
            bid = group[0].get("branch_id")
            results["sales"].append({
                "date": date_key,
                "branch": branch_map.get(bid, bid or "Unassigned"),
                "branch_id": bid,
                "amount": round(amt, 2),
                "count": len(group),
                "potential_excess": round(amt * (len(group) - 1), 2),
                "entries": [{
                    "id": s["id"],
                    "sale_type": s.get("sale_type", ""),
                    "payment_modes": ", ".join(p.get("mode", "") for p in (s.get("payment_details") or [])),
                    "notes": s.get("notes", ""),
                    "created_at": s.get("created_at", ""),
                } for s in group]
            })

    # --- Expense Duplicates: same branch + same amount on same day ---
    expenses = await db.expenses.find(
        {"date": date_filter},
        {"_id": 0, "id": 1, "date": 1, "branch_id": 1, "amount": 1,
         "category": 1, "description": 1, "payment_mode": 1, "notes": 1, "created_at": 1}
    ).to_list(100000)

    exp_groups = defaultdict(list)
    for e in expenses:
        date_key = str(e.get("date", ""))[:10]
        amt = e.get("amount", 0)
        key = f"{date_key}_{e.get('branch_id', 'none')}_{amt:.2f}"
        exp_groups[key].append(e)

    for key, group in exp_groups.items():
        if len(group) > 1:
            date_key = key.split("_")[0]
            amt = group[0].get("amount", 0)
            bid = group[0].get("branch_id")
            results["expenses"].append({
                "date": date_key,
                "branch": branch_map.get(bid, bid or "Unassigned"),
                "branch_id": bid,
                "amount": round(amt, 2),
                "count": len(group),
                "potential_excess": round(amt * (len(group) - 1), 2),
                "entries": [{
                    "id": e["id"],
                    "category": e.get("category", ""),
                    "description": e.get("description", ""),
                    "payment_mode": e.get("payment_mode", ""),
                    "notes": e.get("notes", ""),
                    "created_at": e.get("created_at", ""),
                } for e in group]
            })

    # --- Supplier Payment Duplicates: same supplier + same amount on same day ---
    sp = await db.supplier_payments.find(
        {"date": date_filter},
        {"_id": 0, "id": 1, "date": 1, "supplier_id": 1, "amount": 1,
         "payment_mode": 1, "notes": 1, "branch_id": 1, "created_at": 1}
    ).to_list(100000)

    sp_groups = defaultdict(list)
    for p in sp:
        date_key = str(p.get("date", ""))[:10]
        amt = p.get("amount", 0)
        key = f"{date_key}_{p.get('supplier_id', 'none')}_{amt:.2f}"
        sp_groups[key].append(p)

    for key, group in sp_groups.items():
        if len(group) > 1:
            date_key = key.split("_")[0]
            amt = group[0].get("amount", 0)
            sid = group[0].get("supplier_id")
            bid = group[0].get("branch_id")
            results["supplier_payments"].append({
                "date": date_key,
                "supplier": supplier_map.get(sid, sid or "Unknown"),
                "supplier_id": sid,
                "branch": branch_map.get(bid, bid or ""),
                "amount": round(amt, 2),
                "count": len(group),
                "potential_excess": round(amt * (len(group) - 1), 2),
                "entries": [{
                    "id": p["id"],
                    "payment_mode": p.get("payment_mode", ""),
                    "notes": p.get("notes", ""),
                    "created_at": p.get("created_at", ""),
                } for p in group]
            })

    # Sort by amount descending (highest potential excess first)
    results["sales"].sort(key=lambda x: x["potential_excess"], reverse=True)
    results["expenses"].sort(key=lambda x: x["potential_excess"], reverse=True)
    results["supplier_payments"].sort(key=lambda x: x["potential_excess"], reverse=True)

    total_excess = (
        sum(g["potential_excess"] for g in results["sales"]) +
        sum(g["potential_excess"] for g in results["expenses"]) +
        sum(g["potential_excess"] for g in results["supplier_payments"])
    )

    results["summary"] = {
        "scan_period": f"Last {days} days",
        "total_duplicate_groups": len(results["sales"]) + len(results["expenses"]) + len(results["supplier_payments"]),
        "sales_groups": len(results["sales"]),
        "expense_groups": len(results["expenses"]),
        "sp_groups": len(results["supplier_payments"]),
        "total_potential_excess": round(total_excess, 2),
        "sales_excess": round(sum(g["potential_excess"] for g in results["sales"]), 2),
        "expense_excess": round(sum(g["potential_excess"] for g in results["expenses"]), 2),
        "sp_excess": round(sum(g["potential_excess"] for g in results["supplier_payments"]), 2),
    }

    return results
