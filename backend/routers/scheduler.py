from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import uuid

from database import db, get_current_user
from models import User

router = APIRouter()
scheduler = AsyncIOScheduler()
scheduler.start()


async def _run_task_reminders():
    """Periodic job to process task reminders."""
    try:
        from routers.task_reminders import process_task_reminders
        await process_task_reminders()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Task reminder processing error: {e}")


# Schedule task reminders to run every 5 minutes
scheduler.add_job(_run_task_reminders, 'interval', minutes=5, id='task_reminders_job', replace_existing=True)


async def _build_daily_sales_report():
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    sales = await db.sales.find({"date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find({"date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}, {"_id": 0}).to_list(5000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    total_sales = sum(s.get("final_amount", s["amount"]) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    branch_lines = ""
    for b in branches:
        bt = sum(s.get("final_amount", s["amount"]) for s in sales if s.get("branch_id") == b["id"])
        if bt > 0:
            branch_lines += f"  {b['name']}: SAR {bt:,.2f}\n"
    report = f"*SSC Track - Daily Sales*\n{datetime.now().strftime('%d %b %Y')}\n\nTotal Sales: SAR {total_sales:,.2f}\nTotal Expenses: SAR {total_expenses:,.2f}\nNet: SAR {(total_sales - total_expenses):,.2f}\n"
    if branch_lines:
        report += f"\nBranch Sales:\n{branch_lines}"
    return report


async def _build_low_stock_report():
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    entries = await db.stock_entries.find({}, {"_id": 0}).to_list(10000)
    usage_records = await db.stock_usage.find({}, {"_id": 0}).to_list(10000)
    stock_in = {}
    for e in entries:
        stock_in[e["item_id"]] = stock_in.get(e["item_id"], 0) + e["quantity"]
    stock_out = {}
    for u in usage_records:
        stock_out[u["item_id"]] = stock_out.get(u["item_id"], 0) + u["quantity"]
    low_items = []
    for item in items:
        bal = stock_in.get(item["id"], 0) - stock_out.get(item["id"], 0)
        min_lvl = item.get("min_stock_level", 0)
        if min_lvl > 0 and bal <= min_lvl:
            low_items.append(f"  {item['name']}: {bal} {item.get('unit', 'pc')} (min: {min_lvl})")
    msg = f"*SSC Track - Low Stock Alert*\n{datetime.now().strftime('%d %b %Y')}\n\n"
    if low_items:
        msg += "\n".join(low_items)
    else:
        msg += "All items are above minimum stock level."
    return msg


async def _build_expense_report():
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    expenses = await db.expenses.find({"date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}, {"_id": 0}).to_list(5000)
    total = sum(e["amount"] for e in expenses)
    cat_totals = {}
    for e in expenses:
        cat_totals[e["category"]] = cat_totals.get(e["category"], 0) + e["amount"]
    cat_lines = "\n".join(f"  {k}: SAR {v:,.2f}" for k, v in sorted(cat_totals.items(), key=lambda x: -x[1]))
    msg = f"*SSC Track - Expense Summary*\n{datetime.now().strftime('%d %b %Y')}\n\nTotal: SAR {total:,.2f}\n"
    if cat_lines:
        msg += f"\nBy Category:\n{cat_lines}"
    return msg


async def _send_wa(message: str):
    try:
        from twilio.rest import Client
        config = await db.whatsapp_config.find_one({}, {"_id": 0})
        if not config or not config.get("account_sid") or not config.get("auth_token"):
            return
        client = Client(config["account_sid"], config["auth_token"])
        recipients = [r.strip() for r in config.get("recipient_number", "").split(",") if r.strip()]
        for recipient in recipients:
            try:
                client.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=message, to=f'whatsapp:{recipient}')
            except:
                pass
    except:
        pass


async def _send_email(subject: str, body_text: str):
    try:
        import aiosmtplib
        from email.mime.text import MIMEText
        settings = await db.email_settings.find_one({}, {"_id": 0})
        if not settings or not settings.get("smtp_host") or not settings.get("password"):
            return
        msg = MIMEText(body_text)
        msg["Subject"] = subject
        msg["From"] = settings.get("from_email", settings["username"])
        msg["To"] = settings.get("from_email", settings["username"])
        await aiosmtplib.send(msg, hostname=settings["smtp_host"], port=settings["smtp_port"],
                              username=settings["username"], password=settings["password"],
                              use_tls=settings.get("use_tls", True))
    except:
        pass


async def _build_period_digest(days: int):
    """Build a weekly or monthly sales/expense digest report."""
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    start_str = start.strftime("%Y-%m-%d")
    end_str = end.strftime("%Y-%m-%d")
    period_label = f"Last {days} Days" if days != 7 else "Weekly" if days == 7 else "Monthly"

    sales = await db.sales.find({"date": {"$gte": start_str, "$lte": end_str}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": start_str, "$lte": end_str}}, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)

    total_sales = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    net_profit = total_sales - total_expenses
    cash = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    bank = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "bank")

    lines = [
        f"*SSC Track - {period_label} Digest*",
        f"Period: {start_str} to {end_str}",
        f"",
        f"*Summary:*",
        f"Total Sales: SAR {total_sales:,.2f} ({len(sales)} transactions)",
        f"Total Expenses: SAR {total_expenses:,.2f} ({len(expenses)} entries)",
        f"Net Profit: SAR {net_profit:,.2f}",
        f"",
        f"*Payment Breakdown:*",
        f"Cash: SAR {cash:,.2f}",
        f"Bank: SAR {bank:,.2f}",
        f"",
    ]

    # Branch breakdown
    if branches:
        lines.append("*Branch Summary:*")
        for b in branches:
            bs = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales if s.get("branch_id") == b["id"])
            be = sum(e["amount"] for e in expenses if e.get("branch_id") == b["id"])
            if bs > 0 or be > 0:
                lines.append(f"  {b['name']}: Sales SAR {bs:,.0f} | Exp SAR {be:,.0f} | Profit SAR {bs-be:,.0f}")

    # Top expense categories
    cats = {}
    for e in expenses:
        cats[e.get("category", "Other")] = cats.get(e.get("category", "Other"), 0) + e["amount"]
    if cats:
        lines.append("")
        lines.append("*Top Expense Categories:*")
        for cat, amt in sorted(cats.items(), key=lambda x: -x[1])[:5]:
            lines.append(f"  {cat.replace('_', ' ').title()}: SAR {amt:,.0f}")

    return "\n".join(lines)


async def _build_eod_report():
    """Build comprehensive End-of-Day report for auto-send."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day_start = f"{today}T00:00:00"
    day_end = f"{today}T23:59:59"
    sales = await db.sales.find({"date": {"$gte": day_start, "$lte": day_end}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": day_start, "$lte": day_end}}, {"_id": 0}).to_list(10000)
    sp = await db.supplier_payments.find({"date": {"$gte": day_start, "$lte": day_end}, "supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    ts = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
    te = sum(e["amount"] for e in expenses)
    tsp = sum(p["amount"] for p in sp)
    s_cash = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    s_bank = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
    e_cash = sum(e["amount"] for e in expenses if e.get("payment_mode") == "cash")
    e_bank = sum(e["amount"] for e in expenses if e.get("payment_mode") == "bank")
    sp_cash = sum(p["amount"] for p in sp if p.get("payment_mode") == "cash")
    lines = [
        f"*SSC Track - EOD Summary*",
        f"{datetime.now().strftime('%d %b %Y')}",
        f"",
        f"*Sales:* SAR {ts:,.2f} ({len(sales)} txn)",
        f"  Cash: SAR {s_cash:,.2f} | Bank: SAR {s_bank:,.2f}",
        f"*Expenses:* SAR {te:,.2f} ({len(expenses)} items)",
        f"*Supplier:* SAR {tsp:,.2f}",
        f"",
        f"*Net Profit:* SAR {(ts - te - tsp):,.2f}",
        f"*Cash in Hand:* SAR {(s_cash - e_cash - sp_cash):,.2f}",
    ]
    if branches:
        lines.append("")
        lines.append("*Branch Summary:*")
        for b in branches:
            bs = sum(s.get("final_amount", s["amount"]) for s in sales if s.get("branch_id") == b["id"])
            be = sum(e["amount"] for e in expenses if e.get("branch_id") == b["id"])
            if bs > 0 or be > 0:
                lines.append(f"  {b['name']}: Sales SAR {bs:,.0f} | Exp SAR {be:,.0f}")
    # Top expense categories
    cats = {}
    for e in expenses:
        cats[e.get("category", "Other")] = cats.get(e.get("category", "Other"), 0) + e["amount"]
    if cats:
        lines.append("")
        lines.append("*Expenses by Category:*")
        for cat, amt in sorted(cats.items(), key=lambda x: -x[1])[:5]:
            lines.append(f"  {cat.replace('_', ' ').title()}: SAR {amt:,.0f}")
    return "\n".join(lines)


async def run_scheduled_job(job_type: str):
    """Execute a scheduled notification job."""
    log_entry = {"job_type": job_type, "triggered_at": datetime.now(timezone.utc).isoformat(), "status": "running"}
    try:
        if job_type == "daily_sales":
            report = await _build_daily_sales_report()
        elif job_type == "low_stock":
            report = await _build_low_stock_report()
        elif job_type == "expense_summary":
            report = await _build_expense_report()
        elif job_type == "weekly_digest":
            report = await _build_period_digest(7)
        elif job_type == "monthly_digest":
            report = await _build_period_digest(30)
        elif job_type == "eod_summary":
            report = await _build_eod_report()
        elif job_type == "daily_digest":
            report = await _build_daily_digest()
        else:
            log_entry["status"] = "unknown_type"
            await db.scheduler_logs.insert_one(log_entry)
            return
        schedule = await db.scheduler_config.find_one({"job_type": job_type}, {"_id": 0})
        channels = schedule.get("channels", ["whatsapp"]) if schedule else ["whatsapp"]
        if "whatsapp" in channels:
            await _send_wa(report)
        if "email" in channels:
            await _send_email(f"SSC Track - {job_type.replace('_', ' ').title()}", report)
        log_entry["status"] = "completed"
        log_entry["channels"] = channels
    except Exception as e:
        log_entry["status"] = "error"
        log_entry["error"] = str(e)[:200]
    await db.scheduler_logs.insert_one(log_entry)


def _sync_scheduler():
    """Reload all scheduled jobs from DB config (called on startup and after config changes)."""
    import asyncio
    loop = asyncio.get_event_loop()
    loop.create_task(_async_sync_scheduler())


async def _async_sync_scheduler():
    # Remove all existing jobs
    for job in scheduler.get_jobs():
        scheduler.remove_job(job.id)
    configs = await db.scheduler_config.find({"enabled": True}, {"_id": 0}).to_list(50)
    for cfg in configs:
        job_type = cfg["job_type"]
        hour = cfg.get("hour", 21)
        minute = cfg.get("minute", 0)
        try:
            if job_type == "weekly_digest":
                day_of_week = cfg.get("day_of_week", "sun")
                scheduler.add_job(
                    run_scheduled_job, CronTrigger(day_of_week=day_of_week, hour=hour, minute=minute),
                    args=[job_type], id=f"ssc_{job_type}", replace_existing=True
                )
            elif job_type == "monthly_digest":
                day = cfg.get("day", 1)
                scheduler.add_job(
                    run_scheduled_job, CronTrigger(day=day, hour=hour, minute=minute),
                    args=[job_type], id=f"ssc_{job_type}", replace_existing=True
                )
            else:
                scheduler.add_job(
                    run_scheduled_job, CronTrigger(hour=hour, minute=minute),
                    args=[job_type], id=f"ssc_{job_type}", replace_existing=True
                )
        except:
            pass


@router.get("/scheduler/config")
async def get_scheduler_config(current_user: User = Depends(get_current_user)):
    configs = await db.scheduler_config.find({}, {"_id": 0}).to_list(50)
    if not configs:
        defaults = [
            {"job_type": "daily_sales", "label": "Daily Sales Summary", "enabled": False, "hour": 21, "minute": 0, "channels": ["whatsapp"]},
            {"job_type": "low_stock", "label": "Low Stock Alert", "enabled": False, "hour": 8, "minute": 0, "channels": ["whatsapp"]},
            {"job_type": "expense_summary", "label": "Expense Summary", "enabled": False, "hour": 21, "minute": 30, "channels": ["whatsapp"]},
            {"job_type": "eod_summary", "label": "EOD Summary (Auto)", "enabled": False, "hour": 22, "minute": 0, "channels": ["whatsapp", "email"]},
            {"job_type": "weekly_digest", "label": "Weekly Digest", "enabled": False, "hour": 9, "minute": 0, "day_of_week": "sun", "channels": ["email"]},
            {"job_type": "monthly_digest", "label": "Monthly Digest", "enabled": False, "hour": 9, "minute": 0, "day": 1, "channels": ["email"]},
        ]
        for d in defaults:
            await db.scheduler_config.insert_one(d)
        configs = await db.scheduler_config.find({}, {"_id": 0}).to_list(50)
    # Ensure new job types exist for existing users
    existing_types = [c["job_type"] for c in configs]
    new_defaults = []
    if "weekly_digest" not in existing_types:
        new_defaults.append({"job_type": "weekly_digest", "label": "Weekly Digest", "enabled": False, "hour": 9, "minute": 0, "day_of_week": "sun", "channels": ["email"]})
    if "monthly_digest" not in existing_types:
        new_defaults.append({"job_type": "monthly_digest", "label": "Monthly Digest", "enabled": False, "hour": 9, "minute": 0, "day": 1, "channels": ["email"]})
    if "eod_summary" not in existing_types:
        new_defaults.append({"job_type": "eod_summary", "label": "EOD Summary (Auto)", "enabled": False, "hour": 22, "minute": 0, "channels": ["whatsapp", "email"]})
    if "daily_digest" not in existing_types:
        new_defaults.append({"job_type": "daily_digest", "label": "Daily Digest Email", "enabled": False, "hour": 6, "minute": 0, "channels": ["email"]})
    for d in new_defaults:
        await db.scheduler_config.insert_one(d)
    if new_defaults:
        configs = await db.scheduler_config.find({}, {"_id": 0}).to_list(50)
    return configs


@router.put("/scheduler/config/{job_type}")
async def update_scheduler_config(job_type: str, body: dict, current_user: User = Depends(get_current_user)):
    update = {}
    for field in ["enabled", "hour", "minute", "channels", "day_of_week", "day"]:
        if field in body:
            update[field] = body[field]
    if "hour" in update:
        update["hour"] = int(update["hour"])
    if "minute" in update:
        update["minute"] = int(update["minute"])
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.scheduler_config.update_one({"job_type": job_type}, {"$set": update})
    await _async_sync_scheduler()
    updated = await db.scheduler_config.find_one({"job_type": job_type}, {"_id": 0})
    return updated


@router.post("/scheduler/trigger/{job_type}")
async def trigger_scheduler_job(job_type: str, current_user: User = Depends(get_current_user)):
    """Manually trigger a scheduled job for testing."""
    await run_scheduled_job(job_type)
    return {"message": f"Job '{job_type}' triggered"}


@router.get("/scheduler/logs")
async def get_scheduler_logs(current_user: User = Depends(get_current_user)):
    logs = await db.scheduler_logs.find({}, {"_id": 0}).sort("triggered_at", -1).to_list(50)
    return logs



# =====================================================
# AI PREDICTIVE ANALYTICS SCHEDULED REPORTS
# =====================================================

async def _build_cashflow_alert():
    """Build weekly cash flow alert report."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    
    # Get historical data (last 90 days)
    start_date = (now - timedelta(days=90)).isoformat()[:10]
    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(10000)
    
    # Calculate daily averages
    daily_income = {}
    daily_expense = {}
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    
    for s in sales:
        try:
            d = datetime.fromisoformat(s["date"][:10])
            dow = d.weekday()
            cash_amt = sum(p["amount"] for p in s.get("payment_details", []) if p.get("mode") == "cash")
            daily_income[dow] = daily_income.get(dow, []) + [cash_amt]
        except: pass
    
    for e in expenses:
        try:
            d = datetime.fromisoformat(e["date"][:10])
            dow = d.weekday()
            if e.get("payment_mode") == "cash":
                daily_expense[dow] = daily_expense.get(dow, []) + [e["amount"]]
        except: pass
    
    avg_income = {i: sum(daily_income.get(i, [0])) / max(len(daily_income.get(i, [1])), 1) for i in range(7)}
    avg_expense = {i: sum(daily_expense.get(i, [0])) / max(len(daily_expense.get(i, [1])), 1) for i in range(7)}
    
    # Get current cash
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    current_cash = sum(b.get("cash_balance", 0) for b in branches)
    
    # Predict next 7 days
    predictions = []
    running_balance = current_cash
    alerts = []
    
    for i in range(7):
        future_date = now + timedelta(days=i + 1)
        dow = future_date.weekday()
        net_change = avg_income.get(dow, 0) - avg_expense.get(dow, 0)
        running_balance += net_change
        predictions.append(f"  {day_names[dow]} ({future_date.strftime('%d/%m')}): SAR {running_balance:,.0f}")
        
        if running_balance < current_cash * 0.3:
            alerts.append(f"⚠️ {day_names[dow]} ({future_date.strftime('%d/%m')}): Low cash predicted - SAR {running_balance:,.0f}")
    
    best_day = day_names[max(avg_income, key=avg_income.get)]
    worst_day = day_names[min(avg_income, key=avg_income.get)]
    
    lines = [
        "*SSC Track - Weekly Cash Flow Alert*",
        f"Generated: {now.strftime('%d %b %Y')}",
        "",
        f"*Current Cash Balance:* SAR {current_cash:,.2f}",
        "",
        "*7-Day Cash Forecast:*",
    ] + predictions + [
        "",
        "*Weekly Patterns:*",
        f"  Best Day: {best_day}",
        f"  Slowest Day: {worst_day}",
    ]
    
    if alerts:
        lines += ["", "*⚠️ ALERTS:*"] + alerts
    
    return "\n".join(lines)


async def _build_employee_performance_report():
    """Build weekly employee performance summary."""
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=7)).isoformat()[:10]
    
    employees = await db.employees.find({"status": "active"}, {"_id": 0}).to_list(500)
    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(20000)
    
    # Calculate performance
    performance = []
    for emp in employees:
        emp_sales = [s for s in sales if s.get("created_by") == emp.get("user_id") or s.get("employee_id") == emp["id"]]
        total_sales = sum(s.get("final_amount", s["amount"]) for s in emp_sales)
        
        if total_sales > 0:
            performance.append({
                "name": emp["name"],
                "sales": total_sales,
                "count": len(emp_sales)
            })
    
    performance.sort(key=lambda x: x["sales"], reverse=True)
    
    lines = [
        "*SSC Track - Weekly Employee Performance*",
        f"Week: {start_date} to {now.strftime('%Y-%m-%d')}",
        "",
        "*🏆 Top Performers:*",
    ]
    
    for i, emp in enumerate(performance[:5], 1):
        medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else f"#{i}"
        lines.append(f"  {medal} {emp['name']}: SAR {emp['sales']:,.0f} ({emp['count']} sales)")
    
    if len(performance) > 5:
        lines += [
            "",
            "*Other Team Members:*",
        ]
        for emp in performance[5:10]:
            lines.append(f"  • {emp['name']}: SAR {emp['sales']:,.0f}")
    
    total_team_sales = sum(p["sales"] for p in performance)
    lines += [
        "",
        f"*Team Total:* SAR {total_team_sales:,.2f}",
        f"*Active Employees:* {len(performance)}",
    ]
    
    return "\n".join(lines)


async def _build_expense_anomaly_alert():
    """Build daily expense anomaly alert."""
    now = datetime.now(timezone.utc)
    
    # Get 6 months of data for baseline
    start_date = (now - timedelta(days=180)).isoformat()[:10]
    recent_date = (now - timedelta(days=1)).isoformat()[:10]
    
    expenses = await db.expenses.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(20000)
    
    # Calculate category averages
    category_data = {}
    for e in expenses:
        cat = e.get("category", "general")
        if cat not in category_data:
            category_data[cat] = []
        category_data[cat].append(e["amount"])
    
    # Find anomalies in recent expenses
    anomalies = []
    recent_expenses = [e for e in expenses if e.get("date", "") >= recent_date]
    
    for e in recent_expenses:
        cat = e.get("category", "general")
        if cat in category_data and len(category_data[cat]) > 5:
            avg = sum(category_data[cat]) / len(category_data[cat])
            std = (sum((x - avg) ** 2 for x in category_data[cat]) / len(category_data[cat])) ** 0.5
            threshold = avg + (2 * std)
            
            if e["amount"] > threshold:
                pct = ((e["amount"] - avg) / avg) * 100
                anomalies.append({
                    "category": cat.replace("_", " ").title(),
                    "amount": e["amount"],
                    "avg": avg,
                    "pct": pct,
                    "desc": e.get("description", "-")[:30]
                })
    
    lines = [
        "*SSC Track - Daily Expense Alert*",
        f"Date: {now.strftime('%d %b %Y')}",
        "",
    ]
    
    if anomalies:
        lines.append(f"*⚠️ {len(anomalies)} Unusual Expenses Detected:*")
        for a in anomalies[:5]:
            lines.append(f"  • {a['category']}: SAR {a['amount']:,.0f} (+{a['pct']:.0f}% above avg)")
            lines.append(f"    Note: {a['desc']}")
    else:
        lines.append("✅ No unusual spending patterns detected.")
    
    # Overall spending trend
    last_week = sum(e["amount"] for e in expenses if e.get("date", "") >= (now - timedelta(days=7)).isoformat()[:10])
    prev_week = sum(e["amount"] for e in expenses if (now - timedelta(days=14)).isoformat()[:10] <= e.get("date", "") < (now - timedelta(days=7)).isoformat()[:10])
    
    if prev_week > 0:
        change = ((last_week - prev_week) / prev_week) * 100
        trend = "📈 UP" if change > 0 else "📉 DOWN"
        lines += [
            "",
            "*Weekly Spending Trend:*",
            f"  Last 7 days: SAR {last_week:,.0f}",
            f"  Previous week: SAR {prev_week:,.0f}",
            f"  Change: {trend} {abs(change):.0f}%"
        ]
    
    return "\n".join(lines)


async def _build_supplier_payment_reminder():
    """Build weekly supplier payment reminder."""
    now = datetime.now(timezone.utc)
    
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(500)
    payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(20000)
    
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    total_cash = sum(b.get("cash_balance", 0) for b in branches)
    
    urgent = []
    upcoming = []
    
    for sup in suppliers:
        credit = sup.get("current_credit", 0)
        limit = sup.get("credit_limit", 0)
        
        if credit > 0:
            utilization = (credit / limit * 100) if limit > 0 else 100
            
            sup_payments = [p for p in payments if p.get("supplier_id") == sup["id"]]
            last_payment = max([p.get("date", "") for p in sup_payments], default="")
            
            if utilization > 80:
                urgent.append({
                    "name": sup["name"],
                    "balance": credit,
                    "util": utilization,
                    "last": last_payment[:10] if last_payment else "Never"
                })
            elif credit > 0:
                upcoming.append({
                    "name": sup["name"],
                    "balance": credit,
                    "util": utilization
                })
    
    urgent.sort(key=lambda x: x["util"], reverse=True)
    
    lines = [
        "*SSC Track - Supplier Payment Reminder*",
        f"Week of {now.strftime('%d %b %Y')}",
        "",
        f"*Available Cash:* SAR {total_cash:,.2f}",
        "",
    ]
    
    if urgent:
        lines.append(f"*URGENT ({len(urgent)} suppliers):*")
        for s in urgent[:5]:
            lines.append(f"  - {s['name']}: SAR {s['balance']:,.0f} ({s['util']:.0f}% used)")
            lines.append(f"    Last payment: {s['last']}")
    else:
        lines.append("No urgent payments required.")
    
    if upcoming:
        lines += [
            "",
            f"*UPCOMING ({len(upcoming)} suppliers):*",
        ]
        for s in upcoming[:5]:
            lines.append(f"  - {s['name']}: SAR {s['balance']:,.0f}")
    
    total_pending = sum(s.get("current_credit", 0) for s in suppliers)
    lines += [
        "",
        f"*Total Pending:* SAR {total_pending:,.2f}",
    ]
    
    return "\n".join(lines)


async def _build_reconciliation_alert(threshold: float = 500):
    """Build weekly reconciliation alert — flags unmatched bank transactions above threshold."""
    now = datetime.now(timezone.utc)

    statements = await db.bank_statements.find({}, {"_id": 0}).to_list(100)
    if not statements:
        return None  # nothing to reconcile

    sales = await db.sales.find({}, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(20000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(20000)
    suppliers_list = await db.suppliers.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    suppliers_map = {s["id"]: s["name"] for s in suppliers_list}

    total_flagged = 0
    total_unmatched = 0
    flagged_items = []
    stmt_summaries = []

    for stmt in statements:
        txns = stmt.get("transactions", [])
        if not txns:
            continue
        matches = await db.auto_matches.find({"statement_id": stmt["id"]}, {"_id": 0}).to_list(50000)
        matched_indices = {m["txn_index"] for m in matches}

        stmt_unmatched = 0
        stmt_flagged = 0
        stmt_flagged_amount = 0

        for idx, txn in enumerate(txns):
            if idx in matched_indices:
                continue
            cat = txn.get("category", "")
            if cat in ("bank_fees", "vat_fees", "pos_fees"):
                continue
            amt = txn.get("credit", 0) or txn.get("debit", 0)
            if amt == 0:
                continue
            stmt_unmatched += 1
            if amt >= threshold:
                stmt_flagged += 1
                stmt_flagged_amount += amt
                flagged_items.append({
                    "statement_id": stmt["id"],
                    "statement_name": stmt.get("file_name", "Unknown"),
                    "bank": stmt.get("bank_name", ""),
                    "txn_index": idx,
                    "date": txn.get("date", ""),
                    "amount": round(amt, 2),
                    "type": "credit" if txn.get("credit", 0) > 0 else "debit",
                    "description": (txn.get("description", "") or "")[:100],
                    "beneficiary": txn.get("beneficiary", ""),
                })

        total_unmatched += stmt_unmatched
        total_flagged += stmt_flagged

        match_rate = round(len(matched_indices) / max(len(txns), 1) * 100, 1)
        stmt_summaries.append({
            "statement_id": stmt["id"],
            "file_name": stmt.get("file_name", ""),
            "bank_name": stmt.get("bank_name", ""),
            "total_txns": len(txns),
            "matched": len(matched_indices),
            "unmatched": stmt_unmatched,
            "flagged": stmt_flagged,
            "flagged_amount": round(stmt_flagged_amount, 2),
            "match_rate": match_rate,
        })

    # Save alert to DB
    alert_record = {
        "id": str(uuid.uuid4()),
        "type": "reconciliation_weekly",
        "created_at": now.isoformat(),
        "threshold": threshold,
        "total_statements": len(statements),
        "total_unmatched": total_unmatched,
        "total_flagged": total_flagged,
        "flagged_items": flagged_items[:50],
        "statement_summaries": stmt_summaries,
        "status": "flagged" if total_flagged > 0 else "clean",
    }
    await db.reconciliation_alerts.insert_one(alert_record)
    del alert_record["_id"]

    # Build WhatsApp/Email message
    lines = [
        "*SSC Track - Weekly Reconciliation Alert*",
        f"Report Date: {now.strftime('%d %b %Y')}",
        f"Threshold: SAR {threshold:,.0f}+",
        "",
    ]

    if total_flagged > 0:
        flagged_total_amt = sum(f["amount"] for f in flagged_items)
        lines.append(f"*WARNING: {total_flagged} unmatched transactions above SAR {threshold:,.0f}*")
        lines.append(f"Total flagged amount: SAR {flagged_total_amt:,.2f}")
        lines.append("")
        for fi in flagged_items[:8]:
            lines.append(f"  - {fi['date']} | SAR {fi['amount']:,.2f} ({fi['type']})")
            if fi["description"]:
                lines.append(f"    {fi['description'][:60]}")
        if len(flagged_items) > 8:
            lines.append(f"  ... and {len(flagged_items) - 8} more")
    else:
        lines.append("All high-value bank transactions are matched.")

    lines += [
        "",
        "*Statement Summary:*",
    ]
    for ss in stmt_summaries:
        lines.append(f"  {ss['file_name']}: {ss['match_rate']}% matched ({ss['matched']}/{ss['total_txns']})")
        if ss["flagged"] > 0:
            lines.append(f"    {ss['flagged']} flagged (SAR {ss['flagged_amount']:,.0f})")

    lines += [
        "",
        f"*Total Unmatched:* {total_unmatched}",
        f"*Total Flagged:* {total_flagged}",
    ]

    return "\n".join(lines)


async def _build_daily_digest():
    """Build comprehensive daily digest email with all key metrics."""
    now = datetime.now(timezone.utc)
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")

    # Yesterday's data
    sales = await db.sales.find({"date": {"$gte": yesterday, "$lt": today}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"date": {"$gte": yesterday, "$lt": today}}, {"_id": 0}).to_list(10000)
    sp = await db.supplier_payments.find({"date": {"$gte": yesterday, "$lt": today}}, {"_id": 0}).to_list(5000)

    total_sales = sum(s.get("final_amount", s.get("amount", 0) - s.get("discount", 0)) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    total_sp = sum(p["amount"] for p in sp)
    net_profit = total_sales - total_expenses - total_sp

    # Payment breakdown
    cash = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    bank = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
    online = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "online")
    credit_sales = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "credit")

    # Pending items
    pending_leaves = await db.leaves.count_documents({"status": "pending"})
    pending_loans = await db.loans.count_documents({"status": "active"})

    # Low stock items
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    low_stock_items = [i for i in items if i.get("min_stock_level", 0) > 0 and i.get("balance", 0) <= i.get("min_stock_level", 0)]

    # Loan installments due in next 7 days
    next_week = (now + timedelta(days=7)).isoformat()
    due_installments = await db.loan_installments.count_documents({"status": "pending", "due_date": {"$lte": next_week}})

    # Expiring documents in next 30 days
    next_month = (now + timedelta(days=30)).strftime("%Y-%m-%d")
    exp_docs = await db.documents.count_documents({"expiry_date": {"$lte": next_month, "$gte": today}})

    # Branch breakdown
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_lines = []
    for b in branches:
        bs = sum(s.get("final_amount", s.get("amount", 0)) for s in sales if s.get("branch_id") == b["id"])
        be = sum(e["amount"] for e in expenses if e.get("branch_id") == b["id"])
        if bs > 0 or be > 0:
            branch_lines.append(f"  {b['name']}: Sales SAR {bs:,.0f} | Expenses SAR {be:,.0f} | Net SAR {bs - be:,.0f}")

    # Expense categories
    cats = {}
    for e in expenses:
        cats[e.get("category", "other")] = cats.get(e.get("category", "other"), 0) + e["amount"]

    lines = [
        f"*SSC Track - Daily Digest*",
        f"Report Date: {yesterday}",
        f"",
        f"*FINANCIAL SUMMARY*",
        f"Total Sales: SAR {total_sales:,.2f} ({len(sales)} transactions)",
        f"Total Expenses: SAR {total_expenses:,.2f}",
        f"Supplier Payments: SAR {total_sp:,.2f}",
        f"Net Profit: SAR {net_profit:,.2f}",
        f"",
        f"*PAYMENT BREAKDOWN*",
        f"  Cash: SAR {cash:,.2f}",
        f"  Bank: SAR {bank:,.2f}",
        f"  Online: SAR {online:,.2f}",
        f"  Credit: SAR {credit_sales:,.2f}",
    ]

    if branch_lines:
        lines += [f"", f"*BRANCH PERFORMANCE*"] + branch_lines

    if cats:
        lines += [f"", f"*TOP EXPENSES*"]
        for cat, amt in sorted(cats.items(), key=lambda x: -x[1])[:5]:
            lines.append(f"  {cat.replace('_', ' ').title()}: SAR {amt:,.0f}")

    # Action items
    alerts = []
    if len(low_stock_items) > 0:
        alerts.append(f"  {len(low_stock_items)} items below minimum stock level")
    if pending_leaves > 0:
        alerts.append(f"  {pending_leaves} leave requests pending approval")
    if due_installments > 0:
        alerts.append(f"  {due_installments} loan installments due this week")
    if exp_docs > 0:
        alerts.append(f"  {exp_docs} documents expiring within 30 days")

    if alerts:
        lines += [f"", f"*ACTION REQUIRED*"] + alerts
    else:
        lines += [f"", f"No urgent items requiring attention."]

    return "\n".join(lines)


# Register new AI report types
AI_REPORT_BUILDERS = {
    "cashflow_alert": _build_cashflow_alert,
    "employee_performance": _build_employee_performance_report,
    "expense_anomaly": _build_expense_anomaly_alert,
    "supplier_reminder": _build_supplier_payment_reminder,
    "daily_digest": _build_daily_digest,
    "reconciliation_alert": _build_reconciliation_alert,
}

async def run_ai_report(report_type: str):
    """Run an AI report and send via WhatsApp and Email."""
    if report_type not in AI_REPORT_BUILDERS:
        return
    
    try:
        report = await AI_REPORT_BUILDERS[report_type]()
        await _send_wa(report)
        await _send_email(f"SSC Track - {report_type.replace('_', ' ').title()}", report.replace("*", ""))
        
        # Log execution
        log = {
            "id": str(uuid.uuid4()),
            "job_type": f"ai_{report_type}",
            "triggered_at": datetime.now(timezone.utc).isoformat(),
            "status": "success"
        }
        await db.scheduler_logs.insert_one(log)
    except Exception as e:
        log = {
            "id": str(uuid.uuid4()),
            "job_type": f"ai_{report_type}",
            "triggered_at": datetime.now(timezone.utc).isoformat(),
            "status": "error",
            "error": str(e)
        }
        await db.scheduler_logs.insert_one(log)


@router.post("/scheduler/ai-reports")
async def create_ai_report_schedule(body: dict, current_user: User = Depends(get_current_user)):
    """Create a scheduled AI report."""
    report_type = body.get("report_type")
    if report_type not in AI_REPORT_BUILDERS:
        raise HTTPException(status_code=400, detail=f"Invalid report type. Valid: {list(AI_REPORT_BUILDERS.keys())}")
    
    job_type = f"ai_{report_type}"
    existing = await db.scheduler_config.find_one({"job_type": job_type})
    
    config = {
        "job_type": job_type,
        "schedule_type": body.get("schedule_type", "weekly"),  # daily, weekly
        "day_of_week": body.get("day_of_week", "mon"),
        "hour": int(body.get("hour", 8)),
        "minute": int(body.get("minute", 0)),
        "channels": body.get("channels", ["whatsapp", "email"]),
        "enabled": body.get("enabled", True),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        await db.scheduler_config.update_one({"job_type": job_type}, {"$set": config})
    else:
        config["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.scheduler_config.insert_one(config)
    
    await _async_sync_scheduler()
    return {k: v for k, v in config.items() if k != '_id'}


@router.get("/scheduler/ai-reports")
async def get_ai_report_schedules(current_user: User = Depends(get_current_user)):
    """Get all AI report schedules."""
    schedules = await db.scheduler_config.find({"job_type": {"$regex": "^ai_"}}, {"_id": 0}).to_list(20)
    return {
        "schedules": schedules,
        "available_reports": [
            {"type": "daily_digest", "name": "Daily Digest", "description": "Comprehensive daily business summary with alerts"},
            {"type": "cashflow_alert", "name": "Cash Flow Alert", "description": "Weekly cash flow prediction and alerts"},
            {"type": "employee_performance", "name": "Employee Performance", "description": "Weekly team performance summary"},
            {"type": "expense_anomaly", "name": "Expense Anomaly Alert", "description": "Daily unusual spending detection"},
            {"type": "supplier_reminder", "name": "Supplier Payment Reminder", "description": "Weekly supplier payment priorities"},
        ]
    }


@router.post("/scheduler/ai-reports/{report_type}/trigger")
async def trigger_ai_report(report_type: str, current_user: User = Depends(get_current_user)):
    """Manually trigger an AI report for testing."""
    if report_type not in AI_REPORT_BUILDERS:
        raise HTTPException(status_code=400, detail=f"Invalid report type")
    
    report = await AI_REPORT_BUILDERS[report_type]()
    await run_ai_report(report_type)
    return {"message": f"Report '{report_type}' triggered", "preview": report}



# =====================================================
# ZATCA CSID EXPIRY CHECK (Daily at 8 AM)
# =====================================================

async def check_zatca_csid_expiry_job():
    """Daily job to check ZATCA CSID expiry and send alerts"""
    from routers.settings import create_csid_expiry_notification
    
    settings = await db.zatca_settings.find_one({}, {"_id": 0})
    
    if not settings or not settings.get("enabled"):
        return {"checked": False, "reason": "ZATCA not enabled"}
    
    environment = settings.get("environment", "sandbox")
    expiry_date_str = settings.get("production_csid_expiry") if environment == "production" else settings.get("csid_expiry")
    
    if not expiry_date_str:
        return {"checked": False, "reason": "No expiry date configured"}
    
    try:
        expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d")
        days_until_expiry = (expiry_date - datetime.now()).days
        alert_days = settings.get("expiry_alert_days", 30)
        
        if days_until_expiry <= alert_days:
            await create_csid_expiry_notification(days_until_expiry, expiry_date_str, environment)
            return {
                "checked": True,
                "alert_sent": True,
                "days_until_expiry": days_until_expiry,
                "environment": environment
            }
        
        return {
            "checked": True,
            "alert_sent": False,
            "days_until_expiry": days_until_expiry,
            "environment": environment
        }
        
    except ValueError as e:
        return {"checked": False, "reason": f"Invalid date: {str(e)}"}


@router.post("/scheduler/zatca-expiry-check/trigger")
async def trigger_zatca_expiry_check(current_user: User = Depends(get_current_user)):
    """Manually trigger ZATCA CSID expiry check"""
    result = await check_zatca_csid_expiry_job()
    return {"message": "ZATCA expiry check completed", "result": result}
