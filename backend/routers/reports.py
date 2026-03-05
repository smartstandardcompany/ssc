from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db, get_current_user, require_permission, get_branch_filter
from models import User

router = APIRouter()

@router.get("/reports/credit-sales")
async def get_credit_sales_report(current_user: User = Depends(get_current_user)):
    require_permission(current_user, "reports", "read")
    query = get_branch_filter(current_user)
    if not query and current_user.branch_id and current_user.role != "admin":
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
async def get_supplier_balance_report(period: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None, branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
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
    if branch_id: sp_query["branch_id"] = branch_id
    supplier_payments = await db.supplier_payments.find(sp_query, {"_id": 0}).to_list(10000)
    exp_query = {}
    if date_query: exp_query.update(date_query)
    if branch_id: exp_query["branch_id"] = branch_id
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

        # Collect branch breakdown for this supplier's transactions
        branch_breakdown = {}
        for p in payments:
            bid = p.get("branch_id")
            bname = branches.get(bid, "No Branch") if bid else "No Branch"
            if bname not in branch_breakdown:
                branch_breakdown[bname] = {"expenses": 0, "paid": 0}
            branch_breakdown[bname]["paid"] += p["amount"]
        for e in sup_expenses:
            bid = e.get("branch_id")
            bname = branches.get(bid, "No Branch") if bid else "No Branch"
            if bname not in branch_breakdown:
                branch_breakdown[bname] = {"expenses": 0, "paid": 0}
            branch_breakdown[bname]["expenses"] += e["amount"]

        # Skip suppliers with no transactions when branch filter is active
        if branch_id and total_expenses == 0 and cash_paid + bank_paid == 0:
            continue

        result.append({
            "id": sid, "name": supplier["name"], "category": supplier.get("category", "-"),
            "branch_id": supplier.get("branch_id"),
            "branch_name": branches.get(supplier.get("branch_id"), ""),
            "cash_paid": cash_paid, "bank_paid": bank_paid, "credit_added": credit_added,
            "total_paid": cash_paid + bank_paid, "total_expenses": total_expenses,
            "current_credit": supplier.get("current_credit", 0),
            "credit_limit": supplier.get("credit_limit", 0),
            "transaction_count": len(payments) + len(sup_expenses),
            "branch_breakdown": branch_breakdown,
        })
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


@router.get("/reports/expense-forecast")
async def get_expense_forecast(current_user: User = Depends(get_current_user)):
    """Predict next month's expenses by category using 3-month moving average."""
    now = datetime.now(timezone.utc)
    months_data = []
    for i in range(6, 0, -1):
        m_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        m_end = (m_start + timedelta(days=32)).replace(day=1)
        m_label = m_start.strftime("%b %Y")
        expenses = await db.expenses.find({"date": {"$gte": m_start.isoformat()[:10], "$lt": m_end.isoformat()[:10]}}, {"_id": 0}).to_list(10000)
        by_cat = {}
        for e in expenses:
            cat = e.get("category", "other")
            by_cat[cat] = by_cat.get(cat, 0) + e["amount"]
        months_data.append({"month": m_label, "total": round(sum(by_cat.values()), 2), "categories": by_cat})
    all_cats = set()
    for m in months_data:
        all_cats.update(m["categories"].keys())
    forecasts = []
    for cat in sorted(all_cats):
        vals = [m["categories"].get(cat, 0) for m in months_data]
        recent = vals[-3:] if len(vals) >= 3 else vals
        avg = sum(recent) / len(recent) if recent else 0
        trend = 0
        if len(vals) >= 2:
            diffs = [vals[i] - vals[i-1] for i in range(1, len(vals))]
            trend = sum(diffs[-3:]) / len(diffs[-3:]) if diffs else 0
        predicted = max(0, avg + trend * 0.5)
        forecasts.append({"category": cat.replace("_", " ").title(), "predicted": round(predicted, 2), "avg_3m": round(avg, 2), "trend": "up" if trend > 0 else "down" if trend < 0 else "stable", "history": [{"month": m["month"], "amount": m["categories"].get(cat, 0)} for m in months_data]})
    forecasts.sort(key=lambda x: -x["predicted"])
    total_forecast = sum(f["predicted"] for f in forecasts)
    return {"next_month": (now.replace(day=1) + timedelta(days=32)).replace(day=1).strftime("%b %Y"), "total_predicted": round(total_forecast, 2), "categories": forecasts, "history": [{"month": m["month"], "total": m["total"]} for m in months_data]}


@router.get("/reports/stock-reorder")
async def get_stock_reorder(current_user: User = Depends(get_current_user)):
    """Predict when items will run out and suggest reorder dates/quantities."""
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    entries = await db.stock_entries.find({}, {"_id": 0}).to_list(10000)
    usage_records = await db.stock_usage.find({}, {"_id": 0}).to_list(10000)
    stock_in = {}
    for e in entries:
        stock_in[e["item_id"]] = stock_in.get(e["item_id"], 0) + e["quantity"]
    stock_out = {}
    usage_dates = {}
    for u in usage_records:
        stock_out[u["item_id"]] = stock_out.get(u["item_id"], 0) + u["quantity"]
        if u["item_id"] not in usage_dates:
            usage_dates[u["item_id"]] = []
        usage_dates[u["item_id"]].append({"date": u.get("date", ""), "qty": u["quantity"]})
    now = datetime.now(timezone.utc)
    predictions = []
    for item in items:
        iid = item["id"]
        balance = stock_in.get(iid, 0) - stock_out.get(iid, 0)
        min_lvl = item.get("min_stock_level", 0)
        total_used = stock_out.get(iid, 0)
        dates = usage_dates.get(iid, [])
        if total_used <= 0 or not dates:
            continue
        sorted_dates = sorted(dates, key=lambda x: x["date"])
        if len(sorted_dates) >= 2:
            try:
                first = datetime.fromisoformat(sorted_dates[0]["date"][:10])
                last = datetime.fromisoformat(sorted_dates[-1]["date"][:10])
                days_span = max((last - first).days, 1)
                daily_usage = total_used / days_span
            except Exception:
                daily_usage = 0
        else:
            daily_usage = total_used / 30
        if daily_usage <= 0:
            continue
        days_left = balance / daily_usage if daily_usage > 0 else 999
        reorder_point = min_lvl if min_lvl > 0 else daily_usage * 7
        days_to_reorder = max(0, (balance - reorder_point) / daily_usage) if daily_usage > 0 else 999
        reorder_date = (now + timedelta(days=days_to_reorder)).strftime("%Y-%m-%d")
        suggested_qty = max(daily_usage * 30, min_lvl * 2) - balance
        urgency = "critical" if days_left <= 3 else "soon" if days_left <= 7 else "normal" if days_left <= 14 else "safe"
        predictions.append({
            "item_id": iid, "item_name": item["name"], "unit": item.get("unit", "piece"),
            "category": item.get("category", ""), "current_balance": round(balance, 2),
            "daily_usage": round(daily_usage, 2), "days_left": round(days_left, 1),
            "reorder_date": reorder_date, "suggested_reorder_qty": round(max(suggested_qty, 0), 1),
            "urgency": urgency, "min_stock_level": min_lvl,
        })
    predictions.sort(key=lambda x: x["days_left"])
    return {"predictions": predictions, "total_items": len(items), "items_needing_reorder": len([p for p in predictions if p["urgency"] in ["critical", "soon"]])}


@router.get("/reports/revenue-trends")
async def get_revenue_trends(current_user: User = Depends(get_current_user)):
    """Weekly/monthly revenue trend with growth rate predictions."""
    now = datetime.now(timezone.utc)
    weekly_data = []
    for i in range(12, 0, -1):
        w_end = now - timedelta(days=(i-1)*7)
        w_start = w_end - timedelta(days=7)
        sales = await db.sales.find({"date": {"$gte": w_start.isoformat()[:10], "$lt": w_end.isoformat()[:10]}}, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find({"date": {"$gte": w_start.isoformat()[:10], "$lt": w_end.isoformat()[:10]}}, {"_id": 0}).to_list(10000)
        ts = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
        te = sum(e["amount"] for e in expenses)
        weekly_data.append({"week": w_start.strftime("%d %b"), "sales": round(ts, 2), "expenses": round(te, 2), "profit": round(ts - te, 2), "txn_count": len(sales)})
    monthly_data = []
    for i in range(6, 0, -1):
        m_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        m_end = (m_start + timedelta(days=32)).replace(day=1)
        sales = await db.sales.find({"date": {"$gte": m_start.isoformat()[:10], "$lt": m_end.isoformat()[:10]}}, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find({"date": {"$gte": m_start.isoformat()[:10], "$lt": m_end.isoformat()[:10]}}, {"_id": 0}).to_list(10000)
        ts = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
        te = sum(e["amount"] for e in expenses)
        monthly_data.append({"month": m_start.strftime("%b %Y"), "sales": round(ts, 2), "expenses": round(te, 2), "profit": round(ts - te, 2), "txn_count": len(sales)})
    # Calculate growth rates
    growth_weekly = []
    for i in range(1, len(weekly_data)):
        prev_s = weekly_data[i-1]["sales"]
        curr_s = weekly_data[i]["sales"]
        g = ((curr_s - prev_s) / prev_s * 100) if prev_s > 0 else 0
        growth_weekly.append(round(g, 1))
    growth_monthly = []
    for i in range(1, len(monthly_data)):
        prev_s = monthly_data[i-1]["sales"]
        curr_s = monthly_data[i]["sales"]
        g = ((curr_s - prev_s) / prev_s * 100) if prev_s > 0 else 0
        growth_monthly.append(round(g, 1))
    avg_weekly_growth = round(sum(growth_weekly) / len(growth_weekly), 1) if growth_weekly else 0
    avg_monthly_growth = round(sum(growth_monthly) / len(growth_monthly), 1) if growth_monthly else 0
    last_week_sales = weekly_data[-1]["sales"] if weekly_data else 0
    predicted_next_week = round(last_week_sales * (1 + avg_weekly_growth / 100), 2) if last_week_sales else 0
    return {"weekly": weekly_data, "monthly": monthly_data, "growth": {"weekly_rates": growth_weekly, "monthly_rates": growth_monthly, "avg_weekly": avg_weekly_growth, "avg_monthly": avg_monthly_growth, "predicted_next_week": predicted_next_week}}


@router.get("/reports/customer-churn")
async def get_customer_churn(current_user: User = Depends(get_current_user)):
    """Identify customers who haven't purchased recently (churn risk)."""
    customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
    sales = await db.sales.find({"customer_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(50000)
    now = datetime.now(timezone.utc)
    customer_map = {c["id"]: c for c in customers}
    last_purchase = {}
    purchase_count = {}
    total_spent = {}
    for s in sales:
        cid = s.get("customer_id")
        if not cid or cid not in customer_map:
            continue
        sdate = s.get("date", "")
        if cid not in last_purchase or sdate > last_purchase[cid]:
            last_purchase[cid] = sdate
        purchase_count[cid] = purchase_count.get(cid, 0) + 1
        total_spent[cid] = total_spent.get(cid, 0) + s.get("final_amount", s["amount"] - s.get("discount", 0))
    result = []
    for cid, cust in customer_map.items():
        lp = last_purchase.get(cid)
        if not lp:
            days_inactive = 999
        else:
            try:
                days_inactive = (now - datetime.fromisoformat(lp[:10] if "T" not in lp[:10] else lp[:19]).replace(tzinfo=timezone.utc)).days
            except Exception:
                days_inactive = 999
        if days_inactive < 0:
            days_inactive = 0
        risk = "lost" if days_inactive > 90 else "high" if days_inactive > 60 else "medium" if days_inactive > 30 else "low"
        result.append({
            "customer_id": cid, "name": cust.get("name", "Unknown"), "phone": cust.get("phone", ""),
            "last_purchase_date": lp or "Never", "days_inactive": days_inactive,
            "purchase_count": purchase_count.get(cid, 0), "total_spent": round(total_spent.get(cid, 0), 2),
            "risk_level": risk,
        })
    result.sort(key=lambda x: -x["days_inactive"])
    return {"customers": result, "summary": {"total": len(result), "lost": len([r for r in result if r["risk_level"] == "lost"]), "high_risk": len([r for r in result if r["risk_level"] == "high"]), "medium_risk": len([r for r in result if r["risk_level"] == "medium"]), "active": len([r for r in result if r["risk_level"] == "low"])}}


@router.get("/reports/margin-optimizer")
async def get_margin_optimizer(current_user: User = Depends(get_current_user)):
    """Suggest items to promote based on profit margin vs volume analysis."""
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    sales = await db.sales.find({}, {"_id": 0}).to_list(50000)
    item_map = {i["id"]: i for i in items}
    item_sales = {}
    for s in sales:
        for si in s.get("items", []):
            iid = si.get("item_id")
            if not iid:
                continue
            if iid not in item_sales:
                item_sales[iid] = {"qty": 0, "revenue": 0}
            item_sales[iid]["qty"] += si.get("quantity", 1)
            item_sales[iid]["revenue"] += si.get("total", si.get("quantity", 1) * si.get("price", 0))
    result = []
    for iid, data in item_sales.items():
        item = item_map.get(iid)
        if not item:
            continue
        cost = item.get("cost_price", item.get("unit_price", 0) * 0.6)
        sell = item.get("unit_price", 0)
        margin_pct = ((sell - cost) / sell * 100) if sell > 0 else 0
        revenue = data["revenue"]
        qty = data["qty"]
        profit = revenue - (cost * qty)
        avg_qty_per_day = qty / 30 if qty > 0 else 0
        score = (margin_pct * 0.4) + (qty * 0.3) + (profit / 100 * 0.3) if profit > 0 else margin_pct * 0.2
        recommendation = "star" if margin_pct >= 40 and qty >= 10 else "promote" if margin_pct >= 30 else "review" if margin_pct < 15 else "maintain"
        result.append({
            "item_id": iid, "item_name": item["name"], "category": item.get("category", ""),
            "unit_price": round(sell, 2), "cost_price": round(cost, 2),
            "margin_pct": round(margin_pct, 1), "total_qty_sold": qty,
            "total_revenue": round(revenue, 2), "total_profit": round(profit, 2),
            "daily_avg_sold": round(avg_qty_per_day, 1), "score": round(score, 1),
            "recommendation": recommendation,
        })
    result.sort(key=lambda x: -x["score"])
    return {"items": result[:50], "total_analyzed": len(result), "stars": len([r for r in result if r["recommendation"] == "star"]), "to_promote": len([r for r in result if r["recommendation"] == "promote"]), "to_review": len([r for r in result if r["recommendation"] == "review"])}



@router.get("/reports/heatmap-data")
async def get_heatmap_data(current_user: User = Depends(get_current_user)):
    """Daily sales/expense totals for past 365 days for calendar heatmap."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=365)
    sales = await db.sales.find({"date": {"$gte": start.isoformat()[:10]}}, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find({"date": {"$gte": start.isoformat()[:10]}}, {"_id": 0}).to_list(50000)
    day_map = {}
    for s in sales:
        d = s.get("date", "")[:10]
        if d not in day_map:
            day_map[d] = {"date": d, "sales": 0, "expenses": 0, "count": 0}
        day_map[d]["sales"] += s.get("final_amount", s["amount"] - s.get("discount", 0))
        day_map[d]["count"] += 1
    for e in expenses:
        d = e.get("date", "")[:10]
        if d not in day_map:
            day_map[d] = {"date": d, "sales": 0, "expenses": 0, "count": 0}
        day_map[d]["expenses"] += e["amount"]
    result = sorted(day_map.values(), key=lambda x: x["date"])
    for r in result:
        r["sales"] = round(r["sales"], 2)
        r["expenses"] = round(r["expenses"], 2)
        r["profit"] = round(r["sales"] - r["expenses"], 2)
    return result


@router.get("/reports/sales-funnel")
async def get_sales_funnel(current_user: User = Depends(get_current_user)):
    """Sales pipeline funnel: total customers → active customers → sales → paid → fully collected."""
    customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
    sales = await db.sales.find({}, {"_id": 0}).to_list(50000)
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(50000)
    total_customers = len(customers)
    customer_with_sales = len(set(s.get("customer_id") for s in sales if s.get("customer_id")))
    total_sales_count = len(sales)
    total_sales_amount = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
    paid_sales = [s for s in sales if s.get("credit_amount", 0) <= 0]
    credit_sales = [s for s in sales if s.get("credit_amount", 0) > 0]
    fully_paid = len(paid_sales)
    credit_collected = len([s for s in credit_sales if s.get("credit_received", 0) >= s.get("credit_amount", 0)])
    total_invoiced = sum(i.get("total_amount", 0) for i in invoices)
    return {
        "funnel": [
            {"stage": "Total Customers", "value": total_customers, "amount": 0},
            {"stage": "Customers with Sales", "value": customer_with_sales, "amount": 0},
            {"stage": "Total Transactions", "value": total_sales_count, "amount": round(total_sales_amount, 2)},
            {"stage": "Fully Paid Sales", "value": fully_paid, "amount": round(sum(s.get("final_amount", s["amount"]) for s in paid_sales), 2)},
            {"stage": "Credit Collected", "value": credit_collected + fully_paid, "amount": round(sum(s.get("final_amount", s["amount"]) for s in paid_sales) + sum(s.get("credit_received", 0) for s in credit_sales), 2)},
        ],
        "summary": {"total_customers": total_customers, "active_customers": customer_with_sales, "conversion_rate": round(customer_with_sales / total_customers * 100, 1) if total_customers > 0 else 0, "collection_rate": round((fully_paid + credit_collected) / total_sales_count * 100, 1) if total_sales_count > 0 else 0}
    }


@router.get("/reports/expense-treemap")
async def get_expense_treemap(months: int = 3, current_user: User = Depends(get_current_user)):
    """Hierarchical expense breakdown for treemap visualization."""
    start = (datetime.now(timezone.utc) - timedelta(days=months * 30)).isoformat()[:10]
    expenses = await db.expenses.find({"date": {"$gte": start}}, {"_id": 0}).to_list(50000)
    cat_totals = {}
    cat_items = {}
    for e in expenses:
        cat = e.get("category", "other").replace("_", " ").title()
        desc = e.get("description", "Misc")[:40]
        cat_totals[cat] = cat_totals.get(cat, 0) + e["amount"]
        if cat not in cat_items:
            cat_items[cat] = {}
        cat_items[cat][desc] = cat_items[cat].get(desc, 0) + e["amount"]
    tree = []
    for cat, total in sorted(cat_totals.items(), key=lambda x: -x[1]):
        children = [{"name": k, "value": round(v, 2)} for k, v in sorted(cat_items.get(cat, {}).items(), key=lambda x: -x[1])[:8]]
        tree.append({"name": cat, "value": round(total, 2), "children": children})
    return {"tree": tree, "total": round(sum(cat_totals.values()), 2), "period_months": months}


@router.get("/reports/kpi-gauges")
async def get_kpi_gauges(current_user: User = Depends(get_current_user)):
    """KPI progress indicators for gauge charts."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).isoformat()[:10]
    month_end = ((now.replace(day=1) + timedelta(days=32)).replace(day=1)).isoformat()[:10]
    sales = await db.sales.find({"date": {"$gte": month_start, "$lt": month_end}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": month_start, "$lt": month_end}}, {"_id": 0}).to_list(10000)
    customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
    total_sales = sum(s.get("final_amount", s["amount"]) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    credit_given = sum(s.get("credit_amount", 0) for s in sales)
    credit_received = sum(s.get("credit_received", 0) for s in sales)
    targets = await db.targets.find({"month": now.strftime("%Y-%m")}, {"_id": 0}).to_list(50)
    target_total = sum(t.get("target_amount", 0) for t in targets)
    collection_rate = round(credit_received / credit_given * 100, 1) if credit_given > 0 else 100
    profit_margin = round((total_sales - total_expenses) / total_sales * 100, 1) if total_sales > 0 else 0
    target_pct = round(total_sales / target_total * 100, 1) if target_total > 0 else 0
    # Customer retention: customers with >1 purchase this month
    cust_sales = {}
    for s in sales:
        cid = s.get("customer_id")
        if cid:
            cust_sales[cid] = cust_sales.get(cid, 0) + 1
    repeat_customers = len([c for c in cust_sales.values() if c > 1])
    retention_rate = round(repeat_customers / len(cust_sales) * 100, 1) if cust_sales else 0
    return {"gauges": [
        {"name": "Sales Target", "value": target_pct, "max": 100, "current": round(total_sales, 2), "target": round(target_total, 2), "unit": "%", "color": "#22C55E"},
        {"name": "Profit Margin", "value": profit_margin, "max": 100, "current": round(total_sales - total_expenses, 2), "target": round(total_sales, 2), "unit": "%", "color": "#F5841F"},
        {"name": "Collection Rate", "value": collection_rate, "max": 100, "current": round(credit_received, 2), "target": round(credit_given, 2), "unit": "%", "color": "#0EA5E9"},
        {"name": "Customer Retention", "value": retention_rate, "max": 100, "current": repeat_customers, "target": len(cust_sales), "unit": "%", "color": "#8B5CF6"},
    ], "month": now.strftime("%b %Y")}


@router.get("/reports/branch-radar")
async def get_branch_radar(current_user: User = Depends(get_current_user)):
    """Multi-metric branch comparison for radar chart."""
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    now = datetime.now(timezone.utc)
    m_start = now.replace(day=1).isoformat()[:10]
    m_end = ((now.replace(day=1) + timedelta(days=32)).replace(day=1)).isoformat()[:10]
    sales = await db.sales.find({"date": {"$gte": m_start, "$lt": m_end}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": m_start, "$lt": m_end}}, {"_id": 0}).to_list(10000)
    customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
    if not branches:
        return {"branches": [], "metrics": []}
    max_sales = 1
    max_exp = 1
    max_txn = 1
    max_cust = 1
    branch_data = []
    for b in branches:
        bid = b["id"]
        bs = [s for s in sales if s.get("branch_id") == bid]
        be = [e for e in expenses if e.get("branch_id") == bid]
        bc = len(set(s.get("customer_id") for s in bs if s.get("customer_id")))
        total_s = sum(s.get("final_amount", s["amount"]) for s in bs)
        total_e = sum(e["amount"] for e in be)
        margin = round((total_s - total_e) / total_s * 100, 1) if total_s > 0 else 0
        max_sales = max(max_sales, total_s)
        max_exp = max(max_exp, total_e)
        max_txn = max(max_txn, len(bs))
        max_cust = max(max_cust, bc)
        branch_data.append({"branch_id": bid, "name": b["name"], "sales": round(total_s, 2), "expenses": round(total_e, 2), "transactions": len(bs), "customers": bc, "margin": margin})
    metrics = ["Sales", "Transactions", "Customers", "Margin", "Efficiency"]
    radar = []
    for m in metrics:
        entry = {"metric": m}
        for bd in branch_data:
            if m == "Sales":
                entry[bd["name"]] = round(bd["sales"] / max_sales * 100, 1) if max_sales > 0 else 0
            elif m == "Transactions":
                entry[bd["name"]] = round(bd["transactions"] / max_txn * 100, 1) if max_txn > 0 else 0
            elif m == "Customers":
                entry[bd["name"]] = round(bd["customers"] / max_cust * 100, 1) if max_cust > 0 else 0
            elif m == "Margin":
                entry[bd["name"]] = max(0, bd["margin"])
            elif m == "Efficiency":
                eff = round(bd["sales"] / max(bd["expenses"], 1) * 25, 1)
                entry[bd["name"]] = min(100, eff)
        radar.append(entry)
    return {"branches": branch_data, "radar": radar, "metrics": metrics, "month": now.strftime("%b %Y")}


@router.get("/reports/cashflow-waterfall")
async def get_cashflow_waterfall(current_user: User = Depends(get_current_user)):
    """Cash flow waterfall chart data."""
    now = datetime.now(timezone.utc)
    m_start = now.replace(day=1).isoformat()[:10]
    m_end = ((now.replace(day=1) + timedelta(days=32)).replace(day=1)).isoformat()[:10]
    sales = await db.sales.find({"date": {"$gte": m_start, "$lt": m_end}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": m_start, "$lt": m_end}}, {"_id": 0}).to_list(10000)
    sp = await db.supplier_payments.find({"date": {"$gte": m_start, "$lt": m_end}, "supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    salary_payments = await db.salary_payments.find({"date": {"$gte": m_start, "$lt": m_end}}, {"_id": 0}).to_list(10000)
    cash_sales = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    bank_sales = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
    online_sales = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "online")
    credit_received = sum(s.get("credit_received", 0) for s in sales)
    rent = sum(e["amount"] for e in expenses if "rent" in e.get("category", "").lower())
    utilities = sum(e["amount"] for e in expenses if "util" in e.get("category", "").lower() or "electric" in e.get("category", "").lower())
    salaries = sum(p.get("amount", 0) for p in salary_payments)
    other_exp = sum(e["amount"] for e in expenses) - rent - utilities
    supplier_total = sum(p["amount"] for p in sp)
    steps = [
        {"name": "Cash Sales", "value": round(cash_sales, 2), "type": "income"},
        {"name": "Bank Sales", "value": round(bank_sales, 2), "type": "income"},
        {"name": "Online Sales", "value": round(online_sales, 2), "type": "income"},
        {"name": "Credits Collected", "value": round(credit_received, 2), "type": "income"},
        {"name": "Salaries", "value": round(-salaries, 2), "type": "expense"},
        {"name": "Rent", "value": round(-rent, 2), "type": "expense"},
        {"name": "Utilities", "value": round(-utilities, 2), "type": "expense"},
        {"name": "Other Expenses", "value": round(-other_exp, 2), "type": "expense"},
        {"name": "Supplier Payments", "value": round(-supplier_total, 2), "type": "expense"},
    ]
    running = 0
    waterfall = []
    for s in steps:
        start_val = running
        running += s["value"]
        waterfall.append({**s, "start": round(start_val, 2), "end": round(running, 2)})
    waterfall.append({"name": "Net Balance", "value": round(running, 2), "type": "total", "start": 0, "end": round(running, 2)})
    return {"waterfall": waterfall, "net": round(running, 2), "month": now.strftime("%b %Y")}


@router.get("/reports/money-flow")
async def get_money_flow(current_user: User = Depends(get_current_user)):
    """Money flow data for Sankey-style visualization."""
    now = datetime.now(timezone.utc)
    m_start = now.replace(day=1).isoformat()[:10]
    m_end = ((now.replace(day=1) + timedelta(days=32)).replace(day=1)).isoformat()[:10]
    sales = await db.sales.find({"date": {"$gte": m_start, "$lt": m_end}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": m_start, "$lt": m_end}}, {"_id": 0}).to_list(10000)
    sp = await db.supplier_payments.find({"date": {"$gte": m_start, "$lt": m_end}, "supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    # Sources → Revenue
    sources = {}
    for s in sales:
        bn = branch_map.get(s.get("branch_id"), "Other")
        sources[bn] = sources.get(bn, 0) + s.get("final_amount", s["amount"])
    # Revenue → Payment modes
    modes = {"Cash": 0, "Bank": 0, "Online": 0, "Credit": 0}
    for s in sales:
        for p in s.get("payment_details", []):
            m = p.get("mode", "cash").title()
            modes[m] = modes.get(m, 0) + p["amount"]
        if s.get("credit_amount", 0) > 0:
            modes["Credit"] += s["credit_amount"]
    # Expenses by category
    exp_cats = {}
    for e in expenses:
        cat = e.get("category", "other").replace("_", " ").title()
        exp_cats[cat] = exp_cats.get(cat, 0) + e["amount"]
    total_sp = sum(p["amount"] for p in sp)
    total_rev = sum(sources.values())
    total_exp = sum(exp_cats.values())
    # Build flow links
    links = []
    for src, val in sources.items():
        if val > 0:
            links.append({"source": src, "target": "Revenue", "value": round(val, 2)})
    for mode, val in modes.items():
        if val > 0:
            links.append({"source": "Revenue", "target": mode, "value": round(val, 2)})
    if total_exp > 0:
        links.append({"source": "Revenue", "target": "Expenses", "value": round(total_exp, 2)})
    for cat, val in sorted(exp_cats.items(), key=lambda x: -x[1])[:6]:
        if val > 0:
            links.append({"source": "Expenses", "target": cat, "value": round(val, 2)})
    if total_sp > 0:
        links.append({"source": "Revenue", "target": "Suppliers", "value": round(total_sp, 2)})
    profit = total_rev - total_exp - total_sp
    if profit > 0:
        links.append({"source": "Revenue", "target": "Profit", "value": round(profit, 2)})
    return {"links": links, "total_revenue": round(total_rev, 2), "total_expenses": round(total_exp, 2), "total_supplier": round(total_sp, 2), "profit": round(profit, 2), "month": now.strftime("%b %Y")}


@router.get("/reports/time-series-compare")
async def get_time_series_compare(periods: str = "3", current_user: User = Depends(get_current_user)):
    """Multi-period comparison data for overlay charts."""
    num_periods = int(periods)
    now = datetime.now(timezone.utc)
    result = []
    for i in range(num_periods):
        m_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        m_end = (m_start + timedelta(days=32)).replace(day=1)
        m_label = m_start.strftime("%b %Y")
        sales = await db.sales.find({"date": {"$gte": m_start.isoformat()[:10], "$lt": m_end.isoformat()[:10]}}, {"_id": 0}).to_list(10000)
        # Build daily data
        daily = {}
        for s in sales:
            d = s.get("date", "")[:10]
            day_num = int(d[8:10]) if len(d) >= 10 else 0
            if day_num not in daily:
                daily[day_num] = 0
            daily[day_num] += s.get("final_amount", s["amount"] - s.get("discount", 0))
        days_data = [{"day": d, "sales": round(daily.get(d, 0), 2)} for d in range(1, 32)]
        total = sum(v for v in daily.values())
        result.append({"month": m_label, "total": round(total, 2), "daily": days_data})
    return {"periods": list(reversed(result))}



# =====================================================
# NEW AI PREDICTIVE ANALYTICS ENHANCEMENTS
# =====================================================

@router.get("/reports/cashflow-prediction")
async def get_cashflow_prediction(days: int = 14, current_user: User = Depends(get_current_user)):
    """
    AI Cash Flow Prediction - Predict daily/weekly cash balance based on historical patterns.
    Alerts when cash might run low.
    """
    now = datetime.now(timezone.utc)
    
    # Get historical data (last 90 days)
    start_date = (now - timedelta(days=90)).isoformat()[:10]
    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(10000)
    
    # Calculate daily patterns by day of week
    daily_income = {i: [] for i in range(7)}  # 0=Monday to 6=Sunday
    daily_expense = {i: [] for i in range(7)}
    
    for s in sales:
        try:
            d = datetime.fromisoformat(s["date"][:10])
            dow = d.weekday()
            cash_amt = sum(p["amount"] for p in s.get("payment_details", []) if p.get("mode") == "cash")
            daily_income[dow].append(cash_amt)
        except:
            pass
    
    for e in expenses:
        try:
            d = datetime.fromisoformat(e["date"][:10])
            dow = d.weekday()
            if e.get("payment_mode") == "cash":
                daily_expense[dow].append(e["amount"])
        except:
            pass
    
    for sp in supplier_payments:
        try:
            d = datetime.fromisoformat(sp["date"][:10])
            dow = d.weekday()
            if sp.get("payment_mode") == "cash":
                daily_expense[dow].append(sp["amount"])
        except:
            pass
    
    # Calculate averages per day of week
    avg_income = {i: sum(daily_income[i]) / max(len(daily_income[i]), 1) for i in range(7)}
    avg_expense = {i: sum(daily_expense[i]) / max(len(daily_expense[i]), 1) for i in range(7)}
    
    # Get current cash balance from branches
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    current_cash = sum(b.get("cash_balance", 0) for b in branches)
    
    # Predict future days
    predictions = []
    running_balance = current_cash
    low_cash_alerts = []
    min_threshold = current_cash * 0.2  # Alert if drops below 20% of current
    
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    for i in range(days):
        future_date = now + timedelta(days=i + 1)
        dow = future_date.weekday()
        
        predicted_income = avg_income[dow]
        predicted_expense = avg_expense[dow]
        net_change = predicted_income - predicted_expense
        running_balance += net_change
        
        prediction = {
            "date": future_date.strftime("%Y-%m-%d"),
            "day_name": day_names[dow],
            "predicted_income": round(predicted_income, 2),
            "predicted_expense": round(predicted_expense, 2),
            "net_change": round(net_change, 2),
            "predicted_balance": round(running_balance, 2),
            "is_weekend": dow >= 5
        }
        predictions.append(prediction)
        
        if running_balance < min_threshold and running_balance < current_cash * 0.5:
            low_cash_alerts.append({
                "date": prediction["date"],
                "predicted_balance": prediction["predicted_balance"],
                "shortfall": round(min_threshold - running_balance, 2)
            })
    
    # Weekly summary
    weekly_summary = {
        "avg_daily_income": round(sum(avg_income.values()) / 7, 2),
        "avg_daily_expense": round(sum(avg_expense.values()) / 7, 2),
        "best_day": day_names[max(avg_income, key=avg_income.get)],
        "worst_day": day_names[min(avg_income, key=avg_income.get)],
        "highest_expense_day": day_names[max(avg_expense, key=avg_expense.get)]
    }
    
    return {
        "current_cash_balance": round(current_cash, 2),
        "predictions": predictions,
        "low_cash_alerts": low_cash_alerts,
        "weekly_patterns": weekly_summary,
        "risk_level": "high" if len(low_cash_alerts) > 3 else "medium" if len(low_cash_alerts) > 0 else "low"
    }


@router.get("/reports/seasonal-forecast")
async def get_seasonal_forecast(current_user: User = Depends(get_current_user)):
    """
    AI Seasonal Sales Forecasting - Identify seasonal patterns and predict best/worst days.
    """
    now = datetime.now(timezone.utc)
    
    # Get 12 months of historical data
    start_date = (now - timedelta(days=365)).isoformat()[:10]
    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(50000)
    
    # Analyze by day of week
    dow_sales = {i: [] for i in range(7)}
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Analyze by month
    monthly_sales = {i: [] for i in range(1, 13)}
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    # Analyze by week of month
    week_sales = {i: [] for i in range(1, 6)}  # Weeks 1-5
    
    for s in sales:
        try:
            d = datetime.fromisoformat(s["date"][:10])
            amount = s.get("final_amount", s["amount"] - s.get("discount", 0))
            
            # Day of week
            dow_sales[d.weekday()].append(amount)
            
            # Month
            monthly_sales[d.month].append(amount)
            
            # Week of month
            week_num = min((d.day - 1) // 7 + 1, 5)
            week_sales[week_num].append(amount)
        except:
            pass
    
    # Calculate statistics
    dow_analysis = []
    for i in range(7):
        if dow_sales[i]:
            avg = sum(dow_sales[i]) / len(dow_sales[i])
            total = sum(dow_sales[i])
            count = len(dow_sales[i])
            dow_analysis.append({
                "day": day_names[i],
                "day_num": i,
                "avg_sales": round(avg, 2),
                "total_sales": round(total, 2),
                "transaction_count": count,
                "is_weekend": i >= 5
            })
    
    # Sort to find best/worst days
    sorted_days = sorted(dow_analysis, key=lambda x: x["avg_sales"], reverse=True)
    
    monthly_analysis = []
    for i in range(1, 13):
        if monthly_sales[i]:
            avg = sum(monthly_sales[i]) / len(monthly_sales[i])
            total = sum(monthly_sales[i])
            monthly_analysis.append({
                "month": month_names[i-1],
                "month_num": i,
                "avg_sales": round(avg, 2),
                "total_sales": round(total, 2),
                "transaction_count": len(monthly_sales[i])
            })
    
    sorted_months = sorted(monthly_analysis, key=lambda x: x["total_sales"], reverse=True)
    
    week_analysis = []
    for i in range(1, 6):
        if week_sales[i]:
            avg = sum(week_sales[i]) / len(week_sales[i])
            week_analysis.append({
                "week": f"Week {i}",
                "week_num": i,
                "avg_sales": round(avg, 2),
                "transaction_count": len(week_sales[i])
            })
    
    # Generate insights
    insights = []
    if sorted_days:
        best_day = sorted_days[0]
        worst_day = sorted_days[-1]
        diff_pct = ((best_day["avg_sales"] - worst_day["avg_sales"]) / max(worst_day["avg_sales"], 1)) * 100
        insights.append(f"{best_day['day']} is your best day ({diff_pct:.0f}% higher than {worst_day['day']})")
    
    if sorted_months and len(sorted_months) >= 2:
        insights.append(f"{sorted_months[0]['month']} is your peak sales month")
        insights.append(f"{sorted_months[-1]['month']} typically has lowest sales")
    
    # Weekend vs Weekday comparison
    weekend_avg = sum(d["avg_sales"] for d in dow_analysis if d["is_weekend"]) / max(len([d for d in dow_analysis if d["is_weekend"]]), 1)
    weekday_avg = sum(d["avg_sales"] for d in dow_analysis if not d["is_weekend"]) / max(len([d for d in dow_analysis if not d["is_weekend"]]), 1)
    
    if weekend_avg > weekday_avg:
        diff = ((weekend_avg - weekday_avg) / max(weekday_avg, 1)) * 100
        insights.append(f"Weekends average {diff:.0f}% more sales than weekdays")
    else:
        diff = ((weekday_avg - weekend_avg) / max(weekend_avg, 1)) * 100
        insights.append(f"Weekdays average {diff:.0f}% more sales than weekends")
    
    # Predict next 7 days
    next_week_predictions = []
    for i in range(7):
        future_date = now + timedelta(days=i + 1)
        dow = future_date.weekday()
        dow_data = next((d for d in dow_analysis if d["day_num"] == dow), None)
        if dow_data:
            next_week_predictions.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "day": day_names[dow],
                "predicted_sales": dow_data["avg_sales"],
                "confidence": "high" if dow_data["transaction_count"] > 10 else "medium"
            })
    
    return {
        "day_of_week_analysis": dow_analysis,
        "monthly_analysis": monthly_analysis,
        "week_of_month_analysis": week_analysis,
        "best_days": sorted_days[:3] if len(sorted_days) >= 3 else sorted_days,
        "worst_days": sorted_days[-3:] if len(sorted_days) >= 3 else sorted_days,
        "best_months": sorted_months[:3] if len(sorted_months) >= 3 else sorted_months,
        "weekend_vs_weekday": {
            "weekend_avg": round(weekend_avg, 2),
            "weekday_avg": round(weekday_avg, 2),
            "better": "weekend" if weekend_avg > weekday_avg else "weekday"
        },
        "insights": insights,
        "next_week_forecast": next_week_predictions
    }


@router.get("/reports/employee-performance")
async def get_employee_performance(current_user: User = Depends(get_current_user)):
    """
    AI Employee Performance Scoring - Combines sales, attendance patterns, and activity metrics.
    """
    now = datetime.now(timezone.utc)
    
    # Get employees
    employees = await db.employees.find({"status": "active"}, {"_id": 0}).to_list(500)
    
    # Get sales data (last 90 days)
    start_date = (now - timedelta(days=90)).isoformat()[:10]
    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(20000)
    
    # Get shifts for attendance
    shifts = await db.shifts.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(10000)
    
    # Get branches for context
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    
    # Calculate performance for each employee
    performance_data = []
    
    for emp in employees:
        emp_id = emp["id"]
        emp_name = emp["name"]
        emp_branch = emp.get("branch_id", "")
        
        # Sales metrics
        emp_sales = [s for s in sales if s.get("created_by") == emp_id or s.get("employee_id") == emp_id]
        total_sales = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in emp_sales)
        sales_count = len(emp_sales)
        avg_sale_value = total_sales / max(sales_count, 1)
        
        # Attendance/Shift metrics
        emp_shifts = [sh for sh in shifts if sh.get("employee_id") == emp_id]
        total_shifts = len(emp_shifts)
        completed_shifts = len([sh for sh in emp_shifts if sh.get("status") == "completed"])
        attendance_rate = (completed_shifts / max(total_shifts, 1)) * 100
        
        # Calculate scores (0-100 scale)
        # Sales score based on relative performance
        sales_score = min(100, (total_sales / 50000) * 100) if total_sales > 0 else 0
        
        # Consistency score (based on sales count)
        consistency_score = min(100, (sales_count / 100) * 100) if sales_count > 0 else 0
        
        # Attendance score
        attendance_score = attendance_rate
        
        # Average sale value score
        value_score = min(100, (avg_sale_value / 500) * 100) if avg_sale_value > 0 else 0
        
        # Overall score (weighted average)
        overall_score = (
            sales_score * 0.35 +
            consistency_score * 0.25 +
            attendance_score * 0.25 +
            value_score * 0.15
        )
        
        # Determine tier
        if overall_score >= 80:
            tier = "Top Performer"
            tier_color = "emerald"
        elif overall_score >= 60:
            tier = "Good"
            tier_color = "blue"
        elif overall_score >= 40:
            tier = "Average"
            tier_color = "amber"
        else:
            tier = "Needs Improvement"
            tier_color = "red"
        
        # Generate recommendations
        recommendations = []
        if sales_score < 40:
            recommendations.append("Focus on increasing sales volume")
        if consistency_score < 40:
            recommendations.append("Work on daily sales consistency")
        if attendance_score < 80:
            recommendations.append("Improve shift attendance")
        if value_score < 40:
            recommendations.append("Try upselling for higher transaction values")
        
        performance_data.append({
            "employee_id": emp_id,
            "name": emp_name,
            "branch": branch_map.get(emp_branch, "-"),
            "role": emp.get("job_title", emp.get("role", "-")),
            "metrics": {
                "total_sales": round(total_sales, 2),
                "sales_count": sales_count,
                "avg_sale_value": round(avg_sale_value, 2),
                "shifts_worked": completed_shifts,
                "attendance_rate": round(attendance_rate, 1)
            },
            "scores": {
                "sales": round(sales_score, 1),
                "consistency": round(consistency_score, 1),
                "attendance": round(attendance_score, 1),
                "value": round(value_score, 1),
                "overall": round(overall_score, 1)
            },
            "tier": tier,
            "tier_color": tier_color,
            "recommendations": recommendations
        })
    
    # Sort by overall score
    performance_data.sort(key=lambda x: x["scores"]["overall"], reverse=True)
    
    # Calculate team statistics
    all_scores = [p["scores"]["overall"] for p in performance_data]
    top_performers = [p for p in performance_data if p["tier"] == "Top Performer"]
    
    return {
        "employees": performance_data,
        "team_stats": {
            "total_employees": len(performance_data),
            "avg_score": round(sum(all_scores) / max(len(all_scores), 1), 1),
            "top_performers_count": len(top_performers),
            "needs_improvement_count": len([p for p in performance_data if p["tier"] == "Needs Improvement"])
        },
        "top_3": performance_data[:3] if len(performance_data) >= 3 else performance_data,
        "period": "Last 90 days"
    }


@router.get("/reports/expense-anomalies")
async def get_expense_anomalies(current_user: User = Depends(get_current_user)):
    """
    AI Smart Expense Alerts - Detect unusual spending patterns.
    """
    now = datetime.now(timezone.utc)
    
    # Get 6 months of expense data
    start_date = (now - timedelta(days=180)).isoformat()[:10]
    expenses = await db.expenses.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(20000)
    
    # Group by category
    category_data = {}
    for e in expenses:
        cat = e.get("category", "general")
        if cat not in category_data:
            category_data[cat] = {"amounts": [], "dates": []}
        category_data[cat]["amounts"].append(e["amount"])
        category_data[cat]["dates"].append(e.get("date", ""))
    
    # Calculate statistics per category
    anomalies = []
    category_analysis = []
    
    for cat, data in category_data.items():
        amounts = data["amounts"]
        if len(amounts) < 3:
            continue
        
        avg = sum(amounts) / len(amounts)
        # Calculate standard deviation
        variance = sum((x - avg) ** 2 for x in amounts) / len(amounts)
        std_dev = variance ** 0.5
        
        # Recent expenses (last 30 days)
        recent_date = (now - timedelta(days=30)).isoformat()[:10]
        recent_expenses = [e for e in expenses if e.get("category") == cat and e.get("date", "") >= recent_date]
        recent_total = sum(e["amount"] for e in recent_expenses)
        recent_avg = recent_total / max(len(recent_expenses), 1)
        
        # Monthly average for comparison
        monthly_avg = avg * (len(amounts) / 6)  # Approximate monthly avg
        
        # Detect anomalies
        threshold = avg + (2 * std_dev)  # 2 standard deviations
        
        for e in recent_expenses:
            if e["amount"] > threshold:
                deviation_pct = ((e["amount"] - avg) / max(avg, 1)) * 100
                anomalies.append({
                    "category": cat.replace("_", " ").title(),
                    "amount": e["amount"],
                    "date": e.get("date", ""),
                    "description": e.get("description", "-"),
                    "expected_avg": round(avg, 2),
                    "deviation_percent": round(deviation_pct, 1),
                    "severity": "high" if deviation_pct > 200 else "medium" if deviation_pct > 100 else "low"
                })
        
        # Category spending trend
        trend = "increasing" if recent_avg > avg * 1.2 else "decreasing" if recent_avg < avg * 0.8 else "stable"
        
        category_analysis.append({
            "category": cat.replace("_", " ").title(),
            "avg_transaction": round(avg, 2),
            "std_deviation": round(std_dev, 2),
            "threshold": round(threshold, 2),
            "recent_avg": round(recent_avg, 2),
            "transaction_count": len(amounts),
            "recent_count": len(recent_expenses),
            "trend": trend,
            "monthly_total": round(recent_total, 2)
        })
    
    # Sort anomalies by severity and amount
    severity_order = {"high": 0, "medium": 1, "low": 2}
    anomalies.sort(key=lambda x: (severity_order[x["severity"]], -x["amount"]))
    
    # Overall spending trend
    last_month_total = sum(e["amount"] for e in expenses if e.get("date", "") >= (now - timedelta(days=30)).isoformat()[:10])
    prev_month_total = sum(e["amount"] for e in expenses if (now - timedelta(days=60)).isoformat()[:10] <= e.get("date", "") < (now - timedelta(days=30)).isoformat()[:10])
    
    spending_change = ((last_month_total - prev_month_total) / max(prev_month_total, 1)) * 100
    
    # Generate alerts
    alerts = []
    if spending_change > 30:
        alerts.append({
            "type": "spending_spike",
            "message": f"Overall spending increased {spending_change:.0f}% compared to last month",
            "severity": "high" if spending_change > 50 else "medium"
        })
    
    high_anomalies = [a for a in anomalies if a["severity"] == "high"]
    if high_anomalies:
        alerts.append({
            "type": "unusual_expenses",
            "message": f"{len(high_anomalies)} unusually high expenses detected this month",
            "severity": "high"
        })
    
    return {
        "anomalies": anomalies[:10],  # Top 10 anomalies
        "category_analysis": sorted(category_analysis, key=lambda x: -x["monthly_total"]),
        "alerts": alerts,
        "spending_trend": {
            "last_month": round(last_month_total, 2),
            "previous_month": round(prev_month_total, 2),
            "change_percent": round(spending_change, 1),
            "direction": "up" if spending_change > 0 else "down"
        },
        "period": "Last 30 days analysis (6-month baseline)"
    }


@router.get("/reports/supplier-optimization")
async def get_supplier_optimization(current_user: User = Depends(get_current_user)):
    """
    AI Supplier Payment Optimization - Recommend optimal payment timing and predict cash impact.
    """
    now = datetime.now(timezone.utc)
    
    # Get suppliers
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(500)
    
    # Get payment history
    all_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(20000)
    
    # Get expenses linked to suppliers
    expenses = await db.expenses.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    
    # Get current cash balance
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    total_cash = sum(b.get("cash_balance", 0) for b in branches)
    total_bank = sum(b.get("bank_balance", 0) for b in branches)
    
    supplier_analysis = []
    total_pending = 0
    urgent_payments = []
    
    for supplier in suppliers:
        sup_id = supplier["id"]
        sup_name = supplier["name"]
        
        # Get payment history
        sup_payments = [p for p in all_payments if p.get("supplier_id") == sup_id]
        sup_expenses = [e for e in expenses if e.get("supplier_id") == sup_id]
        
        # Current balance
        current_credit = supplier.get("current_credit", 0)
        credit_limit = supplier.get("credit_limit", 0)
        
        # Calculate payment patterns
        payment_amounts = [p["amount"] for p in sup_payments]
        avg_payment = sum(payment_amounts) / max(len(payment_amounts), 1) if payment_amounts else 0
        
        # Calculate payment frequency
        payment_dates = sorted([p.get("date", "") for p in sup_payments if p.get("date")])
        if len(payment_dates) >= 2:
            try:
                date_diffs = []
                for i in range(1, len(payment_dates)):
                    d1 = datetime.fromisoformat(payment_dates[i-1][:10])
                    d2 = datetime.fromisoformat(payment_dates[i][:10])
                    date_diffs.append((d2 - d1).days)
                avg_days_between = sum(date_diffs) / len(date_diffs) if date_diffs else 30
            except:
                avg_days_between = 30
        else:
            avg_days_between = 30
        
        # Last payment date
        last_payment_date = payment_dates[-1] if payment_dates else None
        
        # Calculate urgency
        days_since_payment = 0
        if last_payment_date:
            try:
                last_date = datetime.fromisoformat(last_payment_date[:10])
                days_since_payment = (now - last_date.replace(tzinfo=timezone.utc)).days
            except:
                pass
        
        # Determine priority
        credit_utilization = (current_credit / max(credit_limit, 1)) * 100 if credit_limit > 0 else 0
        
        if credit_utilization > 90:
            priority = "critical"
            priority_reason = "Near credit limit"
        elif credit_utilization > 70:
            priority = "high"
            priority_reason = "High credit utilization"
        elif days_since_payment > avg_days_between * 1.5:
            priority = "medium"
            priority_reason = "Overdue for payment"
        else:
            priority = "low"
            priority_reason = "On schedule"
        
        # Recommended payment
        if current_credit > 0:
            if priority == "critical":
                recommended_payment = current_credit * 0.5  # Pay 50%
            elif priority == "high":
                recommended_payment = current_credit * 0.3  # Pay 30%
            else:
                recommended_payment = min(current_credit, avg_payment) if avg_payment > 0 else current_credit * 0.25
        else:
            recommended_payment = 0
        
        # Next suggested payment date
        if last_payment_date:
            try:
                next_date = datetime.fromisoformat(last_payment_date[:10]) + timedelta(days=int(avg_days_between))
                suggested_date = max(next_date, now).strftime("%Y-%m-%d")
            except:
                suggested_date = now.strftime("%Y-%m-%d")
        else:
            suggested_date = now.strftime("%Y-%m-%d")
        
        total_pending += current_credit
        
        analysis = {
            "supplier_id": sup_id,
            "name": sup_name,
            "category": supplier.get("category", "-"),
            "current_balance": round(current_credit, 2),
            "credit_limit": round(credit_limit, 2),
            "credit_utilization": round(credit_utilization, 1),
            "avg_payment": round(avg_payment, 2),
            "payment_frequency_days": round(avg_days_between, 0),
            "days_since_last_payment": days_since_payment,
            "priority": priority,
            "priority_reason": priority_reason,
            "recommended_payment": round(recommended_payment, 2),
            "suggested_payment_date": suggested_date
        }
        
        supplier_analysis.append(analysis)
        
        if priority in ["critical", "high"] and current_credit > 0:
            urgent_payments.append(analysis)
    
    # Sort by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    supplier_analysis.sort(key=lambda x: (priority_order[x["priority"]], -x["current_balance"]))
    urgent_payments.sort(key=lambda x: (priority_order[x["priority"]], -x["current_balance"]))
    
    # Cash impact analysis
    total_recommended = sum(s["recommended_payment"] for s in supplier_analysis)
    cash_after_payments = total_cash - total_recommended
    
    # Payment schedule recommendation
    schedule = []
    remaining_cash = total_cash
    
    for sup in supplier_analysis[:10]:  # Top 10 by priority
        if sup["recommended_payment"] > 0 and remaining_cash > sup["recommended_payment"]:
            schedule.append({
                "supplier": sup["name"],
                "amount": sup["recommended_payment"],
                "date": sup["suggested_payment_date"],
                "priority": sup["priority"]
            })
            remaining_cash -= sup["recommended_payment"]
    
    return {
        "suppliers": supplier_analysis,
        "urgent_payments": urgent_payments[:5],
        "summary": {
            "total_suppliers": len(suppliers),
            "total_pending_amount": round(total_pending, 2),
            "critical_count": len([s for s in supplier_analysis if s["priority"] == "critical"]),
            "high_priority_count": len([s for s in supplier_analysis if s["priority"] == "high"])
        },
        "cash_impact": {
            "current_cash": round(total_cash, 2),
            "current_bank": round(total_bank, 2),
            "total_recommended_payments": round(total_recommended, 2),
            "cash_after_payments": round(cash_after_payments, 2),
            "can_afford_all": cash_after_payments > 0
        },
        "recommended_schedule": schedule
    }


@router.get("/reports/trend-comparison")
async def get_trend_comparison(current_user: User = Depends(get_current_user)):
    """
    Compare this week vs last week and this month vs last month
    for sales, expenses, and profit.
    """
    require_permission(current_user, "reports", "read")
    query_base = get_branch_filter(current_user)
    
    now = datetime.now(timezone.utc)
    
    # Week boundaries
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=today.weekday())  # Monday
    last_week_start = week_start - timedelta(days=7)
    
    # Month boundaries
    month_start = today.replace(day=1)
    if month_start.month == 1:
        last_month_start = month_start.replace(year=month_start.year - 1, month=12)
    else:
        last_month_start = month_start.replace(month=month_start.month - 1)
    
    async def get_period_stats(start, end):
        date_filter = {"$gte": start.isoformat(), "$lte": end.isoformat()}
        
        s_query = {**query_base, "date": date_filter}
        e_query = {**query_base, "date": date_filter}
        
        sales_agg = await db.sales.aggregate([
            {"$match": s_query},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        
        exp_agg = await db.expenses.aggregate([
            {"$match": e_query},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
        ]).to_list(1)
        
        sales_total = sales_agg[0]["total"] if sales_agg else 0
        sales_count = sales_agg[0]["count"] if sales_agg else 0
        exp_total = exp_agg[0]["total"] if exp_agg else 0
        exp_count = exp_agg[0]["count"] if exp_agg else 0
        
        return {
            "sales": sales_total, "sales_count": sales_count,
            "expenses": exp_total, "expenses_count": exp_count,
            "profit": sales_total - exp_total,
        }
    
    this_week = await get_period_stats(week_start, now)
    last_week = await get_period_stats(last_week_start, week_start)
    this_month = await get_period_stats(month_start, now)
    last_month = await get_period_stats(last_month_start, month_start)
    
    def calc_change(current, previous):
        if previous == 0:
            return 100 if current > 0 else 0
        return round(((current - previous) / abs(previous)) * 100, 1)
    
    # Daily trend for chart (last 14 days)
    daily_trend = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        day_end = day + timedelta(days=1)
        stats = await get_period_stats(day, day_end)
        daily_trend.append({
            "date": day.strftime("%Y-%m-%d"),
            "label": day.strftime("%d %b"),
            **stats,
        })
    
    return {
        "weekly": {
            "this_week": this_week,
            "last_week": last_week,
            "sales_change": calc_change(this_week["sales"], last_week["sales"]),
            "expenses_change": calc_change(this_week["expenses"], last_week["expenses"]),
            "profit_change": calc_change(this_week["profit"], last_week["profit"]),
        },
        "monthly": {
            "this_month": this_month,
            "last_month": last_month,
            "sales_change": calc_change(this_month["sales"], last_month["sales"]),
            "expenses_change": calc_change(this_month["expenses"], last_month["expenses"]),
            "profit_change": calc_change(this_month["profit"], last_month["profit"]),
        },
        "daily_trend": daily_trend,
    }
