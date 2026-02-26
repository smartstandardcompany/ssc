from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone

from database import db, get_current_user
from models import User

router = APIRouter()

@router.get("/reports/credit-sales")
async def get_credit_sales_report(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    credit_sales = []
    total_credit_given = 0; total_credit_received = 0; total_credit_remaining = 0
    for sale in sales:
        credit_amount = sale.get('credit_amount', 0); credit_received = sale.get('credit_received', 0); remaining = credit_amount - credit_received
        if credit_amount > 0:
            branch_name = next((b["name"] for b in branches if b["id"] == sale.get("branch_id")), "-")
            customer_name = next((c["name"] for c in customers if c["id"] == sale.get("customer_id")), "-")
            credit_sales.append({"id": sale["id"], "date": sale["date"], "sale_type": sale["sale_type"], "reference": branch_name if sale["sale_type"] == "branch" else customer_name, "branch": branch_name, "total_amount": sale["amount"], "discount": sale.get("discount", 0), "final_amount": sale.get("final_amount", sale["amount"] - sale.get("discount", 0)), "credit_given": credit_amount, "credit_received": credit_received, "remaining": remaining, "status": "paid" if remaining == 0 else "partial" if credit_received > 0 else "pending"})
            total_credit_given += credit_amount; total_credit_received += credit_received; total_credit_remaining += remaining
    return {"credit_sales": credit_sales, "summary": {"total_credit_given": total_credit_given, "total_credit_received": total_credit_received, "total_credit_remaining": total_credit_remaining}}

@router.get("/reports/suppliers")
async def get_supplier_report(current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    supplier_report = []
    for supplier in suppliers:
        payments = [p for p in supplier_payments if p.get("supplier_id") == supplier["id"]]
        total_paid = sum(p["amount"] for p in payments if p.get("payment_mode") != "credit")
        supplier_expenses = [e for e in expenses if e.get("supplier_id") == supplier["id"]]
        total_expenses = sum(e["amount"] for e in supplier_expenses)
        supplier_report.append({"id": supplier["id"], "name": supplier["name"], "category": supplier.get("category", "-"), "total_expenses": total_expenses, "total_paid": total_paid, "current_credit": supplier.get("current_credit", 0), "credit_limit": supplier.get("credit_limit", 0), "transaction_count": len(payments) + len(supplier_expenses)})
    return supplier_report

@router.get("/reports/supplier-categories")
async def get_supplier_category_report(current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    category_report = {}
    for supplier in suppliers:
        category = supplier.get("category", "Uncategorized")
        if category not in category_report:
            category_report[category] = {"category": category, "supplier_count": 0, "total_expenses": 0, "total_paid": 0, "total_credit": 0}
        category_report[category]["supplier_count"] += 1
        supplier_expenses = [e for e in expenses if e.get("supplier_id") == supplier["id"]]
        category_report[category]["total_expenses"] += sum(e["amount"] for e in supplier_expenses)
        payments = [p for p in supplier_payments if p.get("supplier_id") == supplier["id"]]
        category_report[category]["total_paid"] += sum(p["amount"] for p in payments if p.get("payment_mode") != "credit")
        category_report[category]["total_credit"] += supplier.get("current_credit", 0)
    return list(category_report.values())

@router.get("/reports/branch-cashbank")
async def get_branch_cashbank_report(current_user: User = Depends(get_current_user)):
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    branch_data = []
    for branch in branches:
        bid = branch["id"]
        branch_sales = [s for s in sales if s.get("branch_id") == bid]
        sales_cash = sum(p["amount"] for s in branch_sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
        sales_bank = sum(p["amount"] for s in branch_sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
        sales_credit = sum(s.get("credit_amount", 0) - s.get("credit_received", 0) for s in branch_sales)
        branch_expenses = [e for e in expenses if e.get("branch_id") == bid]
        exp_cash = sum(e["amount"] for e in branch_expenses if e.get("payment_mode") == "cash")
        exp_bank = sum(e["amount"] for e in branch_expenses if e.get("payment_mode") == "bank")
        branch_sp = [p for p in supplier_payments if p.get("branch_id") == bid]
        sp_cash = sum(p["amount"] for p in branch_sp if p.get("payment_mode") == "cash")
        sp_bank = sum(p["amount"] for p in branch_sp if p.get("payment_mode") == "bank")
        branch_data.append({"branch_id": bid, "branch_name": branch["name"], "sales_cash": sales_cash, "sales_bank": sales_bank, "sales_credit": sales_credit, "sales_total": sales_cash + sales_bank + sales_credit, "expenses_cash": exp_cash, "expenses_bank": exp_bank, "expenses_total": exp_cash + exp_bank, "supplier_cash": sp_cash, "supplier_bank": sp_bank, "supplier_total": sp_cash + sp_bank})
    return branch_data

@router.get("/reports/supplier-balance")
async def get_supplier_balance_report(period: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    date_query = {}
    if period == "today":
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        date_query = {"date": {"$gte": today.isoformat()}}
    elif period == "month":
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        date_query = {"date": {"$gte": month_start.isoformat()}}
    elif period == "year":
        year_start = datetime.now(timezone.utc).replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        date_query = {"date": {"$gte": year_start.isoformat()}}
    elif start_date and end_date:
        date_query = {"date": {"$gte": start_date, "$lte": end_date}}
    sp_query = {"supplier_id": {"$exists": True, "$ne": None}}
    if date_query: sp_query.update(date_query)
    supplier_payments = await db.supplier_payments.find(sp_query, {"_id": 0}).to_list(10000)
    exp_query = {}
    if date_query: exp_query.update(date_query)
    expenses = await db.expenses.find(exp_query, {"_id": 0}).to_list(10000)
    result = []
    for supplier in suppliers:
        sid = supplier["id"]
        payments = [p for p in supplier_payments if p.get("supplier_id") == sid]
        cash_paid = sum(p["amount"] for p in payments if p.get("payment_mode") == "cash")
        bank_paid = sum(p["amount"] for p in payments if p.get("payment_mode") == "bank")
        credit_added = sum(p["amount"] for p in payments if p.get("payment_mode") == "credit")
        sup_expenses = [e for e in expenses if e.get("supplier_id") == sid]
        total_expenses = sum(e["amount"] for e in sup_expenses)
        result.append({"id": sid, "name": supplier["name"], "category": supplier.get("category", "-"), "branch_id": supplier.get("branch_id"), "cash_paid": cash_paid, "bank_paid": bank_paid, "credit_added": credit_added, "total_paid": cash_paid + bank_paid, "total_expenses": total_expenses, "current_credit": supplier.get("current_credit", 0), "credit_limit": supplier.get("credit_limit", 0), "transaction_count": len(payments) + len(sup_expenses)})
    return result

@router.get("/reports/branch-dues")
async def get_branch_dues(current_user: User = Depends(get_current_user)):
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    expenses = await db.expenses.find({"branch_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    sp = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}, "branch_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    salary_payments = await db.salary_payments.find({"branch_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    employees = {e["id"]: e for e in await db.employees.find({}, {"_id": 0}).to_list(1000)}
    suppliers = {s["id"]: s for s in await db.suppliers.find({}, {"_id": 0}).to_list(1000)}
    transfers = await db.cash_transfers.find({}, {"_id": 0}).to_list(10000)
    dues = {}
    for p in sp:
        pay_b = p.get("branch_id"); sup = suppliers.get(p.get("supplier_id"), {}); sup_b = sup.get("branch_id")
        if pay_b and sup_b and pay_b != sup_b:
            key = f"{branch_map.get(pay_b, '?')} paid for {branch_map.get(sup_b, '?')} (supplier)"
            dues[key] = dues.get(key, 0) + p["amount"]
    for p in salary_payments:
        pay_b = p.get("branch_id"); emp = employees.get(p.get("employee_id"), {}); emp_b = emp.get("branch_id")
        if pay_b and emp_b and pay_b != emp_b:
            key = f"{branch_map.get(pay_b, '?')} paid for {branch_map.get(emp_b, '?')} (salary)"
            dues[key] = dues.get(key, 0) + p["amount"]
    for e in expenses:
        pay_b = e.get("branch_id"); expense_for_b = e.get("expense_for_branch_id")
        if expense_for_b and pay_b and expense_for_b != pay_b:
            key = f"{branch_map.get(pay_b, '?')} paid for {branch_map.get(expense_for_b, '?')} (expense)"
            dues[key] = dues.get(key, 0) + e["amount"]
        elif e.get("supplier_id"):
            sup = suppliers.get(e["supplier_id"], {}); sup_b = sup.get("branch_id")
            if pay_b and sup_b and pay_b != sup_b:
                key = f"{branch_map.get(pay_b, '?')} paid for {branch_map.get(sup_b, '?')} (expense)"
                dues[key] = dues.get(key, 0) + e["amount"]
    for t in transfers:
        from_b = t.get("from_branch_id"); to_b = t.get("to_branch_id")
        if from_b and to_b and from_b != to_b:
            key = f"{branch_map.get(from_b, 'Office')} sent to {branch_map.get(to_b, 'Office')} (transfer)"
            dues[key] = dues.get(key, 0) + t["amount"]
    return {"dues": dues, "total_cross_branch": sum(dues.values())}

@router.get("/reports/branch-dues-net")
async def get_branch_dues_net(current_user: User = Depends(get_current_user)):
    dues_resp = await get_branch_dues(current_user)
    paybacks = await db.branch_paybacks.find({}, {"_id": 0}).to_list(10000)
    payback_totals = {}
    for p in paybacks:
        key = f"{p['from_branch_name']} paid back {p['to_branch_name']}"
        payback_totals[key] = payback_totals.get(key, 0) + p["amount"]
    return {"dues": dues_resp["dues"], "paybacks": payback_totals, "total_dues": dues_resp["total_cross_branch"], "total_paybacks": sum(payback_totals.values())}

@router.get("/reports/item-pnl")
async def get_item_pnl(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    e_query = {"branch_id": branch_id} if branch_id else {}
    u_query = {"branch_id": branch_id} if branch_id else {}
    i_query = {"branch_id": branch_id} if branch_id else {}
    entries = await db.stock_entries.find(e_query, {"_id": 0}).to_list(10000)
    usage_records = await db.stock_usage.find(u_query, {"_id": 0}).to_list(10000)
    invoices = await db.invoices.find(i_query, {"_id": 0}).to_list(10000)
    purchased_qty = {}; purchased_cost = {}
    for e in entries:
        purchased_qty[e["item_id"]] = purchased_qty.get(e["item_id"], 0) + e["quantity"]
        purchased_cost[e["item_id"]] = purchased_cost.get(e["item_id"], 0) + (e["quantity"] * e.get("unit_cost", 0))
    used_qty = {}
    for u in usage_records:
        used_qty[u["item_id"]] = used_qty.get(u["item_id"], 0) + u["quantity"]
    item_name_map = {item["name"].lower(): item["id"] for item in items}
    sold_qty = {}; sold_revenue = {}
    for inv in invoices:
        for line in inv.get("items", []):
            desc = (line.get("description") or line.get("name", "")).lower().strip()
            item_id = item_name_map.get(desc)
            if item_id:
                qty = float(line.get("quantity", 0)); total = float(line.get("total", 0))
                sold_qty[item_id] = sold_qty.get(item_id, 0) + qty
                sold_revenue[item_id] = sold_revenue.get(item_id, 0) + total
    rows = []; total_cost = 0; total_revenue = 0; total_profit = 0
    for item in items:
        iid = item["id"]; p_qty = purchased_qty.get(iid, 0); p_cost = purchased_cost.get(iid, 0)
        u_qty = used_qty.get(iid, 0); s_qty = sold_qty.get(iid, 0); s_rev = sold_revenue.get(iid, 0)
        if p_qty == 0 and u_qty == 0 and s_qty == 0: continue
        avg_cost = p_cost / p_qty if p_qty > 0 else item.get("cost_price", 0)
        cost_of_sold = avg_cost * s_qty; profit = s_rev - cost_of_sold
        margin = (profit / s_rev * 100) if s_rev > 0 else 0; current_stock = p_qty - u_qty
        total_cost += cost_of_sold; total_revenue += s_rev; total_profit += profit
        rows.append({"item_id": iid, "item_name": item["name"], "category": item.get("category", ""), "unit": item.get("unit", "piece"), "purchased_qty": round(p_qty, 2), "purchased_cost": round(p_cost, 2), "avg_cost": round(avg_cost, 2), "used_qty": round(u_qty, 2), "sold_qty": round(s_qty, 2), "sold_revenue": round(s_rev, 2), "cost_of_sold": round(cost_of_sold, 2), "profit": round(profit, 2), "margin": round(margin, 1), "current_stock": round(current_stock, 2)})
    rows.sort(key=lambda x: -x["sold_revenue"])
    return {"rows": rows, "summary": {"total_items": len(rows), "total_cost": round(total_cost, 2), "total_revenue": round(total_revenue, 2), "total_profit": round(total_profit, 2), "overall_margin": round((total_profit / total_revenue * 100) if total_revenue > 0 else 0, 1)}}
