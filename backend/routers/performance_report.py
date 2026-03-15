from fastapi import APIRouter, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from database import db, get_current_user, get_tenant_filter, stamp_tenant
from models import User

router = APIRouter()


@router.get("/performance-report")
async def get_performance_report(
    period: str = "30",
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    days = int(period)
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).isoformat()
    prev_cutoff = (now - timedelta(days=days * 2)).isoformat()

    # Build queries
    q_current = {"date": {"$gte": cutoff}}
    q_prev = {"date": {"$gte": prev_cutoff, "$lt": cutoff}}
    if branch_id:
        q_current["branch_id"] = branch_id
        q_prev["branch_id"] = branch_id
    elif current_user.branch_id and current_user.role != "admin":
        q_current["branch_id"] = current_user.branch_id
        q_prev["branch_id"] = current_user.branch_id

    # Fetch data
    sales = await db.sales.find(q_current, {"_id": 0}).to_list(50000)
    prev_sales = await db.sales.find(q_prev, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find(q_current, {"_id": 0}).to_list(50000)
    prev_expenses = await db.expenses.find(q_prev, {"_id": 0}).to_list(50000)
    employees = await db.employees.find({"status": {"$ne": "terminated"}}, {"_id": 0}).to_list(1000)
    branches = await db.branches.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100)
    job_titles = await db.job_titles.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100)
    salary_payments = await db.salary_payments.find({"date": {"$gte": cutoff}}, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find(q_current, {"_id": 0}).to_list(10000)

    # Task compliance data
    alerts = await db.reminder_alerts.find({"sent_at": {"$gte": cutoff}}, {"_id": 0}).to_list(50000)
    acks = await db.reminder_acknowledgements.find({"acknowledged_at": {"$gte": cutoff}}, {"_id": 0}).to_list(50000)

    jt_map = {jt["id"]: jt.get("title", "") for jt in job_titles}
    branch_map = {b["id"]: b.get("name", "") for b in branches}

    # === KPI Summary ===
    total_sales = sum(s.get("amount", 0) for s in sales)
    prev_total_sales = sum(s.get("amount", 0) for s in prev_sales)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    prev_total_expenses = sum(e.get("amount", 0) for e in prev_expenses)
    total_supplier_pay = sum(p.get("amount", 0) for p in supplier_payments if p.get("payment_mode") != "credit")
    net_profit = total_sales - total_expenses - total_supplier_pay
    total_salary = sum(p.get("amount", 0) for p in salary_payments)

    sales_growth = round(((total_sales - prev_total_sales) / max(prev_total_sales, 1)) * 100, 1) if prev_total_sales else 0
    expense_growth = round(((total_expenses - prev_total_expenses) / max(prev_total_expenses, 1)) * 100, 1) if prev_total_expenses else 0

    total_alerts_sent = sum(a.get("employees_notified", 0) for a in alerts)
    total_acks = len(acks)
    task_compliance = round((total_acks / max(total_alerts_sent, 1)) * 100, 1) if total_alerts_sent else 100

    kpi = {
        "total_sales": total_sales,
        "prev_total_sales": prev_total_sales,
        "sales_growth": sales_growth,
        "total_expenses": total_expenses,
        "prev_total_expenses": prev_total_expenses,
        "expense_growth": expense_growth,
        "net_profit": net_profit,
        "profit_margin": round((net_profit / max(total_sales, 1)) * 100, 1) if total_sales else 0,
        "total_transactions": len(sales),
        "avg_transaction": round(total_sales / max(len(sales), 1), 2),
        "total_salary_paid": total_salary,
        "employee_count": len(employees),
        "task_compliance": task_compliance,
    }

    # === Sales Trend (daily) ===
    daily_sales = defaultdict(float)
    daily_expenses = defaultdict(float)
    for s in sales:
        day = s.get("date", "")[:10]
        if day:
            daily_sales[day] += s.get("amount", 0)
    for e in expenses:
        day = e.get("date", "")[:10]
        if day:
            daily_expenses[day] += e.get("amount", 0)

    all_days = sorted(set(list(daily_sales.keys()) + list(daily_expenses.keys())))
    sales_trend = []
    for day in all_days:
        s_val = daily_sales.get(day, 0)
        e_val = daily_expenses.get(day, 0)
        sales_trend.append({
            "date": day,
            "sales": round(s_val, 2),
            "expenses": round(e_val, 2),
            "profit": round(s_val - e_val, 2),
        })

    # === Branch Performance ===
    branch_perf = {}
    for b in branches:
        bid = b["id"]
        if branch_id and bid != branch_id:
            continue
        b_sales = sum(s.get("amount", 0) for s in sales if s.get("branch_id") == bid)
        b_expenses = sum(e.get("amount", 0) for e in expenses if e.get("branch_id") == bid)
        b_txns = len([s for s in sales if s.get("branch_id") == bid])
        branch_perf[bid] = {
            "branch_id": bid,
            "name": b.get("name", "Unknown"),
            "sales": round(b_sales, 2),
            "expenses": round(b_expenses, 2),
            "profit": round(b_sales - b_expenses, 2),
            "transactions": b_txns,
            "avg_ticket": round(b_sales / max(b_txns, 1), 2),
        }
    branch_ranking = sorted(branch_perf.values(), key=lambda x: -x["sales"])

    # === Employee Performance ===
    emp_map = {}
    for e in employees:
        role = jt_map.get(e.get("job_title_id", ""), e.get("pos_role", "staff"))
        emp_map[e["id"]] = {"name": e.get("name", "Unknown"), "role": role, "branch_id": e.get("branch_id", "")}

    acks_by_employee = defaultdict(int)
    for a in acks:
        acks_by_employee[a.get("employee_id", "")] += 1

    emp_alert_count = defaultdict(int)
    reminders = await db.task_reminders.find(get_tenant_filter(current_user), {"_id": 0}).to_list(500)
    reminder_by_id = {r["id"]: r for r in reminders}
    for a in alerts:
        rid = a.get("reminder_id")
        r = reminder_by_id.get(rid)
        if not r:
            continue
        if r["target_type"] == "employee":
            emp_alert_count[r["target_value"]] += 1
        elif r["target_type"] == "role":
            target_role = r["target_value"].lower()
            for eid, einfo in emp_map.items():
                if einfo["role"].lower() == target_role:
                    emp_alert_count[eid] += 1

    employee_performance = []
    for eid, einfo in emp_map.items():
        alert_sent = emp_alert_count.get(eid, 0)
        alert_acked = acks_by_employee.get(eid, 0)
        compliance = round((alert_acked / max(alert_sent, 1)) * 100, 1) if alert_sent > 0 else 100
        sal = sum(p.get("amount", 0) for p in salary_payments if p.get("employee_id") == eid)
        status = "excellent" if compliance >= 80 else "good" if compliance >= 60 else "needs_attention" if compliance >= 40 else "critical"
        employee_performance.append({
            "id": eid,
            "name": einfo["name"],
            "role": einfo["role"],
            "branch": branch_map.get(einfo.get("branch_id", ""), "-"),
            "tasks_received": alert_sent,
            "tasks_completed": alert_acked,
            "compliance": min(compliance, 100),
            "salary_paid": round(sal, 2),
            "status": status,
        })
    employee_performance.sort(key=lambda x: -x["compliance"])

    # === Expense Breakdown by Category ===
    expense_by_cat = defaultdict(float)
    for e in expenses:
        cat = e.get("category", "Other")
        expense_by_cat[cat] += e.get("amount", 0)
    expense_breakdown = [{"category": k, "amount": round(v, 2)} for k, v in sorted(expense_by_cat.items(), key=lambda x: -x[1])]

    # === Payment Mode Distribution ===
    payment_modes = defaultdict(float)
    for s in sales:
        for pd in s.get("payment_details", []):
            payment_modes[pd.get("mode", "other")] += pd.get("amount", 0)
    payment_distribution = [{"mode": k.title(), "amount": round(v, 2)} for k, v in sorted(payment_modes.items(), key=lambda x: -x[1])]

    return {
        "kpi": kpi,
        "sales_trend": sales_trend,
        "branch_ranking": branch_ranking,
        "employee_performance": employee_performance,
        "expense_breakdown": expense_breakdown,
        "payment_distribution": payment_distribution,
        "period_days": days,
    }
