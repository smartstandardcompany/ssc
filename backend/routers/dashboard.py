from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db, get_current_user
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

    if start_date and end_date:
        date_filter = {"$gte": start_date, "$lte": end_date}
        query["date"] = date_filter
        exp_query["date"] = date_filter
        sp_query["date"] = date_filter

    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find(exp_query, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find(sp_query, {"_id": 0}).to_list(10000)

    total_sales = sum(sale["amount"] - (sale.get("credit_amount", 0) - sale.get("credit_received", 0)) for sale in sales)
    total_expenses = sum(expense["amount"] for expense in expenses)
    total_supplier_payments = sum(payment["amount"] for payment in supplier_payments if payment.get("payment_mode") != "credit")

    pending_credits = sum(sale.get("credit_amount", 0) - sale.get("credit_received", 0) for sale in sales)

    cash_sales = 0
    bank_sales = 0
    credit_sales = pending_credits

    for sale in sales:
        for payment in sale.get("payment_details", []):
            if payment["mode"] == "cash":
                cash_sales += payment["amount"]
            elif payment["mode"] == "bank":
                bank_sales += payment["amount"]

    net_profit = total_sales - total_expenses - total_supplier_payments

    exp_cash = sum(e["amount"] for e in expenses if e.get("payment_mode") == "cash")
    exp_bank = sum(e["amount"] for e in expenses if e.get("payment_mode") == "bank")
    sp_cash = sum(p["amount"] for p in supplier_payments if p.get("payment_mode") == "cash")
    sp_bank = sum(p["amount"] for p in supplier_payments if p.get("payment_mode") == "bank")
    cash_in_hand = cash_sales - exp_cash - sp_cash
    bank_in_hand = bank_sales - exp_bank - sp_bank

    expense_by_category = {}
    for e in expenses:
        cat = e.get("category", "other")
        expense_by_category[cat] = expense_by_category.get(cat, 0) + e["amount"]

    all_suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    supplier_dues = sum(s.get("current_credit", 0) for s in all_suppliers)

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

    all_fines = await db.fines.find({"payment_status": {"$ne": "paid"}}, {"_id": 0}).to_list(1000)
    due_fines = sum(f["amount"] - f.get("paid_amount", 0) for f in all_fines)
    due_fines_list = [{"department": f.get("department",""), "amount": f["amount"] - f.get("paid_amount",0), "type": f.get("fine_type","")} for f in all_fines[:5]]

    # Branch loss alerts
    branch_alerts_list = []
    all_branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    for br in all_branches:
        bid = br["id"]
        br_sales = [s for s in sales if s.get("branch_id") == bid]
        br_exp = [e for e in expenses if e.get("branch_id") == bid]
        br_sp = [p for p in supplier_payments if p.get("branch_id") == bid]
        br_total_sales = sum(s.get("final_amount", s["amount"]) for s in br_sales)
        br_total_exp = sum(e["amount"] for e in br_exp)
        br_total_sp = sum(p["amount"] for p in br_sp)
        br_profit = br_total_sales - br_total_exp - br_total_sp
        if br_profit < 0:
            branch_alerts_list.append({"branch": br["name"], "profit": br_profit, "sales": br_total_sales, "expenses": br_total_exp + br_total_sp})

    return {
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "total_supplier_payments": total_supplier_payments,
        "net_profit": net_profit,
        "pending_credits": pending_credits,
        "cash_sales": cash_sales,
        "bank_sales": bank_sales,
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
