from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import db, get_current_user
from models import User

router = APIRouter()
scheduler = AsyncIOScheduler()
scheduler.start()


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
        ]
        for d in defaults:
            await db.scheduler_config.insert_one(d)
        configs = await db.scheduler_config.find({}, {"_id": 0}).to_list(50)
    return configs


@router.put("/scheduler/config/{job_type}")
async def update_scheduler_config(job_type: str, body: dict, current_user: User = Depends(get_current_user)):
    update = {}
    for field in ["enabled", "hour", "minute", "channels"]:
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
