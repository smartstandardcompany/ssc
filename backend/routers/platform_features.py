"""
White-Label Branding, Scheduled Reports, API Rate Limiting, Usage Limit Alerts
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from database import db, get_current_user, get_tenant_filter, stamp_tenant, ROOT_DIR
from models import User
from datetime import datetime, timezone, timedelta
import uuid
import os
import json
import asyncio
from collections import defaultdict
import time

router = APIRouter()

# ══════════════════════════════════════════════════════════════════
# 1. WHITE-LABEL BRANDING
# ══════════════════════════════════════════════════════════════════

DEFAULT_BRANDING = {
    "primary_color": "#f97316",
    "accent_color": "#d97706",
    "sidebar_color": "#1c1917",
    "logo_url": "",
    "favicon_url": "",
    "app_name": "SSC Track",
    "tagline": "Business Management Platform",
    "login_bg_color": "#ea580c",
    "hide_powered_by": False,
}


@router.get("/branding")
async def get_branding(current_user: User = Depends(get_current_user)):
    """Get tenant branding settings."""
    tf = get_tenant_filter(current_user)
    branding = await db.branding_settings.find_one(tf, {"_id": 0})
    return branding or {**DEFAULT_BRANDING, "tenant_id": current_user.tenant_id}


@router.put("/branding")
async def update_branding(body: dict, current_user: User = Depends(get_current_user)):
    """Update tenant branding settings."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    allowed = ["primary_color", "accent_color", "sidebar_color", "logo_url",
               "favicon_url", "app_name", "tagline", "login_bg_color", "hide_powered_by"]
    updates = {k: body[k] for k in allowed if k in body}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    existing = await db.branding_settings.find_one(tf)
    if existing:
        await db.branding_settings.update_one(tf, {"$set": updates})
    else:
        doc = {**DEFAULT_BRANDING, **updates, "id": str(uuid.uuid4())}
        stamp_tenant(doc, current_user)
        await db.branding_settings.insert_one(doc)
    return {"success": True}


@router.post("/branding/upload-logo")
async def upload_brand_logo(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    upload_dir = ROOT_DIR / "uploads" / "logos"
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    filename = f"brand_{current_user.tenant_id}.{ext}"
    path = upload_dir / filename
    with open(path, "wb") as f:
        content = await file.read()
        f.write(content)
    logo_url = f"/uploads/logos/{filename}"
    tf = get_tenant_filter(current_user)
    await db.branding_settings.update_one(tf, {"$set": {"logo_url": logo_url}}, upsert=True)
    return {"logo_url": logo_url}


# ══════════════════════════════════════════════════════════════════
# 2. SCHEDULED REPORTS
# ══════════════════════════════════════════════════════════════════

@router.get("/scheduled-reports")
async def get_scheduled_reports(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    reports = await db.scheduled_report_configs.find(tf, {"_id": 0}).sort("created_at", -1).to_list(50)
    return reports


@router.post("/scheduled-reports")
async def create_scheduled_report(body: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    report = {
        "id": str(uuid.uuid4()),
        "name": body.get("name", "Untitled Report"),
        "report_type": body.get("report_type", "daily_summary"),
        "schedule": body.get("schedule", "daily"),
        "recipients": body.get("recipients", []),
        "branch_id": body.get("branch_id"),
        "is_active": True,
        "last_run": None,
        "next_run": _calc_next_run(body.get("schedule", "daily")),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    stamp_tenant(report, current_user)
    await db.scheduled_report_configs.insert_one(report)
    return {k: v for k, v in report.items() if k != "_id"}


@router.put("/scheduled-reports/{report_id}")
async def update_scheduled_report(report_id: str, body: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    existing = await db.scheduled_report_configs.find_one({"id": report_id, **tf})
    if not existing:
        raise HTTPException(status_code=404, detail="Report not found")
    updates = {}
    for f in ["name", "report_type", "schedule", "recipients", "branch_id", "is_active"]:
        if f in body:
            updates[f] = body[f]
    if "schedule" in updates:
        updates["next_run"] = _calc_next_run(updates["schedule"])
    if updates:
        await db.scheduled_report_configs.update_one({"id": report_id, **tf}, {"$set": updates})
    return {"success": True}


@router.delete("/scheduled-reports/{report_id}")
async def delete_scheduled_report(report_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    await db.scheduled_report_configs.delete_one({"id": report_id, **tf})
    return {"success": True}


@router.get("/scheduled-reports/history")
async def get_report_history(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    history = await db.scheduled_report_history.find(tf, {"_id": 0}).sort("generated_at", -1).to_list(50)
    return history


@router.post("/scheduled-reports/generate-now/{report_id}")
async def generate_report_now(report_id: str, current_user: User = Depends(get_current_user)):
    """Manually trigger a scheduled report generation."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    config = await db.scheduled_report_configs.find_one({"id": report_id, **tf}, {"_id": 0})
    if not config:
        raise HTTPException(status_code=404, detail="Report config not found")

    now = datetime.now(timezone.utc)
    report_date = now.strftime("%Y-%m-%d")

    # Generate report data based on type
    report_data = await _generate_report_data(config, current_user)

    history_entry = {
        "id": str(uuid.uuid4()),
        "config_id": report_id,
        "report_name": config["name"],
        "report_type": config["report_type"],
        "report_date": report_date,
        "data": report_data,
        "status": "generated",
        "delivery_status": "pending",
        "generated_at": now.isoformat(),
    }
    stamp_tenant(history_entry, current_user)
    await db.scheduled_report_history.insert_one(history_entry)

    # Update last_run
    await db.scheduled_report_configs.update_one(
        {"id": report_id, **tf},
        {"$set": {"last_run": now.isoformat(), "next_run": _calc_next_run(config["schedule"])}}
    )

    return {k: v for k, v in history_entry.items() if k != "_id"}


def _calc_next_run(schedule):
    now = datetime.now(timezone.utc)
    if schedule == "daily":
        return (now + timedelta(days=1)).replace(hour=6, minute=0, second=0).isoformat()
    elif schedule == "weekly":
        days_until_sunday = (6 - now.weekday()) % 7 or 7
        return (now + timedelta(days=days_until_sunday)).replace(hour=6, minute=0, second=0).isoformat()
    elif schedule == "monthly":
        if now.month == 12:
            next_month = now.replace(year=now.year + 1, month=1, day=1, hour=6, minute=0, second=0)
        else:
            next_month = now.replace(month=now.month + 1, day=1, hour=6, minute=0, second=0)
        return next_month.isoformat()
    return (now + timedelta(days=1)).isoformat()


async def _generate_report_data(config, user):
    """Generate report data based on report type."""
    tf = get_tenant_filter(user)
    report_type = config.get("report_type", "daily_summary")
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    if report_type == "daily_summary":
        date_filter = {"$gte": f"{today}T00:00:00", "$lt": f"{today}T23:59:59"}
        sales = await db.sales.find({"date": date_filter, **tf}, {"_id": 0, "total": 1, "branch_id": 1}).to_list(10000)
        expenses = await db.expenses.find({"date": date_filter, **tf}, {"_id": 0, "amount": 1}).to_list(10000)
        return {
            "date": today,
            "total_sales": round(sum(s.get("total", 0) for s in sales), 2),
            "sales_count": len(sales),
            "total_expenses": round(sum(e.get("amount", 0) for e in expenses), 2),
            "expense_count": len(expenses),
            "net_profit": round(sum(s.get("total", 0) for s in sales) - sum(e.get("amount", 0) for e in expenses), 2),
        }
    elif report_type == "sales_report":
        sales = await db.sales.find(tf, {"_id": 0, "total": 1, "date": 1, "branch_id": 1}).sort("date", -1).to_list(100)
        return {"sales_count": len(sales), "total": round(sum(s.get("total", 0) for s in sales), 2)}
    elif report_type == "pnl":
        month_start = now.replace(day=1).strftime("%Y-%m-%d")
        sales = await db.sales.find({"date": {"$gte": month_start}, **tf}, {"_id": 0, "total": 1}).to_list(10000)
        expenses = await db.expenses.find({"date": {"$gte": month_start}, **tf}, {"_id": 0, "amount": 1}).to_list(10000)
        total_rev = sum(s.get("total", 0) for s in sales)
        total_exp = sum(e.get("amount", 0) for e in expenses)
        return {"period": f"{month_start} to {today}", "revenue": round(total_rev, 2), "expenses": round(total_exp, 2), "net_income": round(total_rev - total_exp, 2)}
    return {"type": report_type, "message": "Report generated"}


# ══════════════════════════════════════════════════════════════════
# 3. API RATE LIMITING
# ══════════════════════════════════════════════════════════════════

PLAN_RATE_LIMITS = {
    "starter": 100,
    "business": 500,
    "enterprise": -1,  # unlimited
}

# In-memory rate tracking (per-tenant)
_rate_store = defaultdict(lambda: {"count": 0, "window_start": 0})


async def check_rate_limit(request: Request):
    """Rate limit middleware function. Call from server.py middleware."""
    # Extract tenant from auth header
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None  # No auth, no rate limit

    # Get tenant_id from token (lightweight check)
    try:
        import jwt
        token = auth.split(" ")[1]
        secret = os.environ.get("JWT_SECRET", "ssc-track-jwt-secret-key-2024")
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            return None
    except Exception:
        return None

    # Look up user's tenant and plan
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "tenant_id": 1})
    if not user or not user.get("tenant_id"):
        return None

    tenant_id = user["tenant_id"]
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "plan": 1})
    if not tenant:
        return None

    plan = tenant.get("plan", "starter")
    limit = PLAN_RATE_LIMITS.get(plan, 100)
    if limit == -1:
        return {"limit": -1, "remaining": -1, "reset": 0}  # Unlimited

    now = time.time()
    window = 60  # 1 minute window
    key = tenant_id
    store = _rate_store[key]

    if now - store["window_start"] > window:
        store["count"] = 0
        store["window_start"] = now

    store["count"] += 1
    remaining = max(0, limit - store["count"])
    reset = int(store["window_start"] + window - now)

    if store["count"] > limit:
        return {"exceeded": True, "limit": limit, "remaining": 0, "reset": reset}

    return {"limit": limit, "remaining": remaining, "reset": reset}


# ══════════════════════════════════════════════════════════════════
# 4. USAGE LIMIT ALERTS
# ══════════════════════════════════════════════════════════════════

PLANS = {
    "starter": {"max_branches": 1, "max_users": 5},
    "business": {"max_branches": 5, "max_users": 20},
    "enterprise": {"max_branches": -1, "max_users": -1},
}


@router.get("/usage-alerts")
async def get_usage_alerts(current_user: User = Depends(get_current_user)):
    """Check if current tenant is near or at plan limits."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        return {"alerts": []}

    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        return {"alerts": []}

    plan = tenant.get("plan", "starter")
    limits = PLANS.get(plan, PLANS["starter"])
    alerts = []

    # Check user count
    user_count = await db.users.count_documents({"tenant_id": tenant_id})
    max_users = limits["max_users"]
    if max_users > 0:
        pct = (user_count / max_users) * 100
        if pct >= 100:
            alerts.append({"type": "users", "level": "critical", "message": f"User limit reached ({user_count}/{max_users})", "usage": user_count, "limit": max_users, "percentage": min(pct, 100)})
        elif pct >= 80:
            alerts.append({"type": "users", "level": "warning", "message": f"Approaching user limit ({user_count}/{max_users})", "usage": user_count, "limit": max_users, "percentage": pct})

    # Check branch count
    branch_count = await db.branches.count_documents({"tenant_id": tenant_id})
    max_branches = limits["max_branches"]
    if max_branches > 0:
        pct = (branch_count / max_branches) * 100
        if pct >= 100:
            alerts.append({"type": "branches", "level": "critical", "message": f"Branch limit reached ({branch_count}/{max_branches})", "usage": branch_count, "limit": max_branches, "percentage": min(pct, 100)})
        elif pct >= 80:
            alerts.append({"type": "branches", "level": "warning", "message": f"Approaching branch limit ({branch_count}/{max_branches})", "usage": branch_count, "limit": max_branches, "percentage": pct})

    return {"alerts": alerts, "plan": plan, "usage": {"users": user_count, "branches": branch_count}, "limits": limits}


@router.post("/admin/check-all-usage-alerts")
async def check_all_usage_alerts(current_user: User = Depends(get_current_user)):
    """Super admin: check usage alerts for all tenants and create notifications."""
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin required")

    tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    alert_count = 0

    for tenant in tenants:
        tenant_id = tenant["id"]
        plan = tenant.get("plan", "starter")
        limits = PLANS.get(plan, PLANS["starter"])

        checks = []
        user_count = await db.users.count_documents({"tenant_id": tenant_id})
        branch_count = await db.branches.count_documents({"tenant_id": tenant_id})

        if limits["max_users"] > 0 and user_count >= limits["max_users"] * 0.8:
            checks.append(f"Users: {user_count}/{limits['max_users']}")
        if limits["max_branches"] > 0 and branch_count >= limits["max_branches"] * 0.8:
            checks.append(f"Branches: {branch_count}/{limits['max_branches']}")

        if checks:
            # Create notification for tenant admins
            admin = await db.users.find_one({"tenant_id": tenant_id, "role": "admin"}, {"_id": 0, "id": 1})
            if admin:
                notif = {
                    "id": str(uuid.uuid4()),
                    "user_id": admin["id"],
                    "tenant_id": tenant_id,
                    "type": "usage_alert",
                    "title": "Plan Usage Alert",
                    "message": f"Approaching limits: {', '.join(checks)}. Consider upgrading your plan.",
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.notifications.insert_one(notif)
                alert_count += 1

    return {"alerts_created": alert_count, "tenants_checked": len(tenants)}
