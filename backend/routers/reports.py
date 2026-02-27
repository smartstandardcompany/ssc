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


@router.get("/reports/daily-summary")
async def get_daily_summary(start_date: Optional[str] = None, end_date: Optional[str] = None, branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    exp_query = {}
    if branch_id:
        query["branch_id"] = branch_id
        exp_query["branch_id"] = branch_id
    elif current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id
        exp_query["branch_id"] = current_user.branch_id
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
        exp_query["date"] = {"$gte": start_date, "$lte": end_date}
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find(exp_query, {"_id": 0}).to_list(10000)
    daily = {}
    for s in sales:
        day = s["date"][:10]
        if day not in daily:
            daily[day] = {"date": day, "sales": 0, "expenses": 0, "cash": 0, "bank": 0, "online": 0, "credit": 0, "txn_count": 0}
        daily[day]["sales"] += s.get("final_amount", s["amount"] - s.get("discount", 0))
        daily[day]["txn_count"] += 1
        for p in s.get("payment_details", []):
            mode = p.get("mode", "cash")
            if mode in daily[day]:
                daily[day][mode] += p.get("amount", 0)
    for e in expenses:
        day = e["date"][:10]
        if day not in daily:
            daily[day] = {"date": day, "sales": 0, "expenses": 0, "cash": 0, "bank": 0, "online": 0, "credit": 0, "txn_count": 0}
        daily[day]["expenses"] += e["amount"]
    rows = sorted(daily.values(), key=lambda x: x["date"], reverse=True)
    for r in rows:
        r["profit"] = round(r["sales"] - r["expenses"], 2)
        r["sales"] = round(r["sales"], 2)
        r["expenses"] = round(r["expenses"], 2)
    return rows


@router.get("/reports/top-customers")
async def get_top_customers(current_user: User = Depends(get_current_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    result = []
    for c in customers:
        cid = c["id"]
        cust_sales = [s for s in sales if s.get("customer_id") == cid]
        total_purchases = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in cust_sales)
        credit_given = sum(s.get("credit_amount", 0) for s in cust_sales)
        credit_received = sum(s.get("credit_received", 0) for s in cust_sales)
        result.append({
            "id": cid, "name": c["name"], "phone": c.get("phone", ""),
            "total_purchases": round(total_purchases, 2),
            "transaction_count": len(cust_sales),
            "credit_given": round(credit_given, 2),
            "credit_received": round(credit_received, 2),
            "credit_outstanding": round(credit_given - credit_received, 2),
        })
    result.sort(key=lambda x: -x["total_purchases"])
    return result


@router.get("/reports/cashier-performance")
async def get_cashier_performance(current_user: User = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(500)
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    result = []
    for u in users:
        uid = u["id"]
        user_sales = [s for s in sales if s.get("created_by") == uid]
        total_amount = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in user_sales)
        cash = sum(p["amount"] for s in user_sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
        bank = sum(p["amount"] for s in user_sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
        branch_name = next((b["name"] for b in branches if b["id"] == u.get("branch_id")), "-")
        if len(user_sales) > 0:
            result.append({
                "user_id": uid, "name": u.get("name", "Unknown"), "email": u.get("email", ""),
                "role": u.get("role", ""), "branch": branch_name,
                "total_sales": round(total_amount, 2), "transaction_count": len(user_sales),
                "cash_collected": round(cash, 2), "bank_collected": round(bank, 2),
                "avg_transaction": round(total_amount / len(user_sales), 2) if user_sales else 0,
            })
    result.sort(key=lambda x: -x["total_sales"])
    return result


@router.get("/reports/analytics-pdf")
async def export_analytics_pdf(current_user: User = Depends(get_current_user)):
    """Generate a PDF report of analytics data."""
    from fastapi.responses import StreamingResponse
    from io import BytesIO
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed")

    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)

    total_sales = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    net_profit = total_sales - total_expenses

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("SSC Track - Analytics Report", styles['Title']))
    elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", styles['Normal']))
    elements.append(Spacer(1, 20))

    # Summary
    elements.append(Paragraph("Financial Summary", styles['Heading2']))
    summary_data = [
        ["Metric", "Amount (SAR)"],
        ["Total Sales", f"{total_sales:,.2f}"],
        ["Total Expenses", f"{total_expenses:,.2f}"],
        ["Net Profit", f"{net_profit:,.2f}"],
        ["Transactions", str(len(sales))],
    ]
    t = Table(summary_data, colWidths=[3*inch, 3*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F5841F')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))

    # Branch breakdown
    elements.append(Paragraph("Branch Performance", styles['Heading2']))
    branch_data = [["Branch", "Sales", "Expenses", "Net"]]
    for b in branches:
        bs = sum(s.get("final_amount", s["amount"]) for s in sales if s.get("branch_id") == b["id"])
        be = sum(e["amount"] for e in expenses if e.get("branch_id") == b["id"])
        branch_data.append([b["name"], f"{bs:,.2f}", f"{be:,.2f}", f"{bs-be:,.2f}"])
    t2 = Table(branch_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#22C55E')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 20))

    # Top expense categories
    cats = {}
    for e in expenses:
        cats[e.get("category", "Other")] = cats.get(e.get("category", "Other"), 0) + e["amount"]
    if cats:
        elements.append(Paragraph("Expense Categories", styles['Heading2']))
        cat_data = [["Category", "Amount"]]
        for cat, amt in sorted(cats.items(), key=lambda x: -x[1]):
            cat_data.append([cat.replace("_", " ").title(), f"{amt:,.2f}"])
        t3 = Table(cat_data, colWidths=[3*inch, 3*inch])
        t3.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EF4444')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ]))
        elements.append(t3)

    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf",
                           headers={"Content-Disposition": "attachment; filename=ssc_analytics_report.pdf"})


@router.get("/reports/sales-forecast")
async def get_sales_forecast(current_user: User = Depends(get_current_user)):
    """AI-powered sales forecast for next 7 days based on historical patterns."""
    import os
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    if len(sales) < 5:
        return {"forecast": [], "message": "Need more historical data for forecasting"}

    # Build daily summary for last 30 days
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    daily = {}
    for s in sales:
        day = s["date"][:10]
        daily[day] = daily.get(day, 0) + s.get("final_amount", s["amount"] - s.get("discount", 0))

    history = []
    for i in range(30, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        history.append({"date": d, "sales": round(daily.get(d, 0), 2)})

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return _simple_forecast(history, now)
        chat = LlmChat(
            api_key=api_key,
            session_id=f"forecast-{now.isoformat()}",
            system_message="""You are a sales forecasting AI. Given historical daily sales data, predict the next 7 days. 
Return ONLY valid JSON array: [{"date": "YYYY-MM-DD", "predicted_sales": number, "confidence": "high"|"medium"|"low"}]
Consider: day-of-week patterns, trends, seasonality. Return ONLY the JSON array."""
        ).with_model("openai", "gpt-4o-mini")

        import json as json_module
        history_str = json_module.dumps(history[-14:])
        response = await chat.send_message(UserMessage(text=f"Here is the last 14 days of sales data. Predict next 7 days:\n{history_str}"))
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        forecast = json_module.loads(cleaned)
        return {"forecast": forecast, "history": history[-14:], "method": "ai"}
    except:
        return _simple_forecast(history, now)


def _simple_forecast(history, now):
    """Simple moving average forecast as fallback."""
    from datetime import timedelta
    recent = [h["sales"] for h in history[-7:] if h["sales"] > 0]
    avg = sum(recent) / len(recent) if recent else 0
    forecast = []
    for i in range(1, 8):
        d = (now + timedelta(days=i)).strftime("%Y-%m-%d")
        forecast.append({"date": d, "predicted_sales": round(avg, 2), "confidence": "low"})
    return {"forecast": forecast, "history": history[-14:], "method": "moving_average"}



@router.get("/reports/eod-summary")
async def get_eod_summary(date: str, branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """End-of-Day summary for a specific date: sales, expenses, supplier payments, cash flow."""
    from datetime import timedelta
    day_start = f"{date}T00:00:00"
    day_end = f"{date}T23:59:59"
    s_query = {"date": {"$gte": day_start, "$lte": day_end}}
    e_query = {"date": {"$gte": day_start, "$lte": day_end}}
    sp_query = {"date": {"$gte": day_start, "$lte": day_end}, "supplier_id": {"$exists": True, "$ne": None}}
    if branch_id:
        s_query["branch_id"] = branch_id
        e_query["branch_id"] = branch_id
        sp_query["branch_id"] = branch_id

    sales = await db.sales.find(s_query, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find(e_query, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find(sp_query, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}

    # Sales breakdown
    total_sales = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
    sales_cash = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    sales_bank = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
    sales_online = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "online")
    sales_credit = sum(s.get("credit_amount", 0) for s in sales)
    credit_received = sum(s.get("credit_received", 0) for s in sales)

    # Expenses breakdown
    total_expenses = sum(e["amount"] for e in expenses)
    exp_by_category = {}
    for e in expenses:
        cat = e.get("category", "Other")
        exp_by_category[cat] = exp_by_category.get(cat, 0) + e["amount"]
    exp_cash = sum(e["amount"] for e in expenses if e.get("payment_mode") == "cash")
    exp_bank = sum(e["amount"] for e in expenses if e.get("payment_mode") == "bank")

    # Supplier payments
    total_sp = sum(p["amount"] for p in supplier_payments)
    sp_cash = sum(p["amount"] for p in supplier_payments if p.get("payment_mode") == "cash")
    sp_bank = sum(p["amount"] for p in supplier_payments if p.get("payment_mode") == "bank")

    # Branch breakdown
    branch_summary = []
    branch_ids = set(s.get("branch_id") for s in sales if s.get("branch_id"))
    branch_ids |= set(e.get("branch_id") for e in expenses if e.get("branch_id"))
    for bid in branch_ids:
        bs = sum(s.get("final_amount", s["amount"]) for s in sales if s.get("branch_id") == bid)
        be = sum(e["amount"] for e in expenses if e.get("branch_id") == bid)
        bsp = sum(p["amount"] for p in supplier_payments if p.get("branch_id") == bid)
        branch_summary.append({
            "branch_id": bid,
            "branch_name": branch_map.get(bid, "Unknown"),
            "sales": round(bs, 2),
            "expenses": round(be, 2),
            "supplier_payments": round(bsp, 2),
            "net": round(bs - be - bsp, 2),
        })

    net_profit = total_sales - total_expenses - total_sp
    cash_in_hand = sales_cash - exp_cash - sp_cash

    return {
        "date": date,
        "branch_id": branch_id,
        "branch_name": branch_map.get(branch_id, "All Branches") if branch_id else "All Branches",
        "sales": {
            "total": round(total_sales, 2),
            "cash": round(sales_cash, 2),
            "bank": round(sales_bank, 2),
            "online": round(sales_online, 2),
            "credit_given": round(sales_credit, 2),
            "credit_received": round(credit_received, 2),
            "transaction_count": len(sales),
        },
        "expenses": {
            "total": round(total_expenses, 2),
            "cash": round(exp_cash, 2),
            "bank": round(exp_bank, 2),
            "by_category": [{"category": k.replace("_", " ").title(), "amount": round(v, 2)} for k, v in sorted(exp_by_category.items(), key=lambda x: -x[1])],
            "count": len(expenses),
        },
        "supplier_payments": {
            "total": round(total_sp, 2),
            "cash": round(sp_cash, 2),
            "bank": round(sp_bank, 2),
            "count": len(supplier_payments),
        },
        "summary": {
            "net_profit": round(net_profit, 2),
            "cash_in_hand": round(cash_in_hand, 2),
            "bank_total": round(sales_bank - exp_bank - sp_bank, 2),
        },
        "branch_breakdown": branch_summary,
    }


@router.get("/reports/partner-pnl")
async def get_partner_pnl(current_user: User = Depends(get_current_user)):
    """Partner P&L: calculate profit/loss per partner based on investments, withdrawals, and share."""
    partners = await db.partners.find({}, {"_id": 0}).to_list(100)
    transactions = await db.partner_transactions.find({}, {"_id": 0}).to_list(10000)
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)

    total_revenue = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    total_sp = sum(p["amount"] for p in supplier_payments)
    company_net_profit = total_revenue - total_expenses - total_sp

    result = []
    total_share_pct = sum(p.get("share_percentage", 0) for p in partners)

    for partner in partners:
        pid = partner["id"]
        pt = [t for t in transactions if t.get("partner_id") == pid]
        invested = sum(t["amount"] for t in pt if t.get("transaction_type") == "investment")
        withdrawn = sum(t["amount"] for t in pt if t.get("transaction_type") in ["withdrawal", "profit_share", "expense"])
        salary_paid = sum(t["amount"] for t in pt if "salary" in t.get("description", "").lower() or "Salary" in t.get("description", ""))

        share_pct = partner.get("share_percentage", 0)
        profit_share_amount = (company_net_profit * share_pct / 100) if share_pct > 0 else 0
        net_balance = invested - withdrawn
        roi = ((profit_share_amount / invested) * 100) if invested > 0 else 0

        # Monthly breakdown for last 6 months
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        monthly = []
        for i in range(5, -1, -1):
            m_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1)
            m_end = (m_start + timedelta(days=32)).replace(day=1)
            m_label = m_start.strftime("%b %Y")
            m_invested = sum(t["amount"] for t in pt if t.get("transaction_type") == "investment" and m_start.isoformat() <= t.get("date", "") < m_end.isoformat())
            m_withdrawn = sum(t["amount"] for t in pt if t.get("transaction_type") in ["withdrawal", "profit_share", "expense"] and m_start.isoformat() <= t.get("date", "") < m_end.isoformat())
            monthly.append({"month": m_label, "invested": round(m_invested, 2), "withdrawn": round(m_withdrawn, 2), "net": round(m_invested - m_withdrawn, 2)})

        result.append({
            "partner_id": pid,
            "name": partner["name"],
            "share_percentage": share_pct,
            "total_invested": round(invested, 2),
            "total_withdrawn": round(withdrawn, 2),
            "salary_paid": round(salary_paid, 2),
            "current_balance": round(net_balance, 2),
            "profit_share_entitled": round(profit_share_amount, 2),
            "roi_pct": round(roi, 1),
            "monthly": monthly,
        })

    return {
        "partners": result,
        "company_summary": {
            "total_revenue": round(total_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "total_supplier_payments": round(total_sp, 2),
            "net_profit": round(company_net_profit, 2),
            "total_partner_shares": round(total_share_pct, 1),
        }
    }
