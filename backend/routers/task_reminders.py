from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid

from database import db, get_current_user
from models import User

router = APIRouter()

# Preset templates for common roles
PRESET_TEMPLATES = {
    "cleaner": [
        {"name": "Kitchen Cleaning", "message": "Time to clean the kitchen area - floors, counters, and equipment", "interval_hours": 2},
        {"name": "Dish Washing Check", "message": "Check dish station - wash any accumulated dishes and sanitize", "interval_hours": 1},
        {"name": "Restroom Inspection", "message": "Inspect and clean restrooms - restock supplies if needed", "interval_hours": 3},
        {"name": "Dining Area Sweep", "message": "Sweep and mop dining area - wipe down tables", "interval_hours": 2},
        {"name": "Trash Disposal", "message": "Empty all trash bins and replace liners", "interval_hours": 3},
    ],
    "waiter": [
        {"name": "Table Check", "message": "Check all assigned tables - refill water, clear plates, check on guests", "interval_hours": 1},
        {"name": "Station Setup", "message": "Restock service station - napkins, cutlery, condiments", "interval_hours": 3},
        {"name": "Menu Specials Update", "message": "Review today's specials and out-of-stock items with kitchen", "interval_hours": 4},
        {"name": "Side Work Reminder", "message": "Complete side work duties - polish glasses, fold napkins", "interval_hours": 2},
    ],
    "cashier": [
        {"name": "Cash Drawer Check", "message": "Verify cash drawer balance and organize bills", "interval_hours": 2},
        {"name": "Receipt Paper Check", "message": "Check receipt paper and POS supplies", "interval_hours": 4},
        {"name": "Queue Management", "message": "Check waiting queue - call for backup if needed", "interval_hours": 1},
        {"name": "End of Shift Prep", "message": "Start preparing end-of-shift cash count report", "interval_hours": 6},
    ],
    "chef": [
        {"name": "Food Temp Check", "message": "Check all holding temperatures and log readings", "interval_hours": 2},
        {"name": "Prep Station Audit", "message": "Inspect prep stations - restock ingredients, check freshness dates", "interval_hours": 3},
        {"name": "Order Queue Review", "message": "Review pending orders and prioritize preparation", "interval_hours": 1},
        {"name": "Kitchen Safety Check", "message": "Quick safety inspection - fire extinguisher, first aid, floor conditions", "interval_hours": 4},
        {"name": "Inventory Quick Count", "message": "Quick count of high-usage items - flag anything running low", "interval_hours": 4},
    ],
}


class TaskReminderCreate(BaseModel):
    name: str
    message: str
    target_type: str  # "role" or "employee"
    target_value: str  # job_title or employee_id
    interval_hours: float = 2
    active_start_hour: int = 8  # 8 AM
    active_end_hour: int = 22  # 10 PM
    days_of_week: list = [0, 1, 2, 3, 4, 5, 6]  # 0=Mon..6=Sun
    channels: list = ["push", "in_app"]
    enabled: bool = True


class TaskReminderUpdate(BaseModel):
    name: Optional[str] = None
    message: Optional[str] = None
    target_type: Optional[str] = None
    target_value: Optional[str] = None
    interval_hours: Optional[float] = None
    active_start_hour: Optional[int] = None
    active_end_hour: Optional[int] = None
    days_of_week: Optional[list] = None
    channels: Optional[list] = None
    enabled: Optional[bool] = None


@router.get("/task-reminders/presets")
async def get_preset_templates(current_user: User = Depends(get_current_user)):
    """Get preset reminder templates grouped by role."""
    return PRESET_TEMPLATES


@router.get("/task-reminders")
async def list_task_reminders(current_user: User = Depends(get_current_user)):
    """List all task reminders."""
    reminders = await db.task_reminders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return reminders


@router.post("/task-reminders")
async def create_task_reminder(reminder: TaskReminderCreate, current_user: User = Depends(get_current_user)):
    """Create a new task reminder."""
    doc = {
        "id": str(uuid.uuid4()),
        "name": reminder.name,
        "message": reminder.message,
        "target_type": reminder.target_type,
        "target_value": reminder.target_value,
        "interval_hours": reminder.interval_hours,
        "active_start_hour": reminder.active_start_hour,
        "active_end_hour": reminder.active_end_hour,
        "days_of_week": reminder.days_of_week,
        "channels": reminder.channels,
        "enabled": reminder.enabled,
        "last_triggered": None,
        "trigger_count": 0,
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.task_reminders.insert_one(doc)
    del doc["_id"]
    return doc


@router.post("/task-reminders/bulk")
async def create_bulk_reminders(body: dict, current_user: User = Depends(get_current_user)):
    """Create multiple reminders from a preset role template."""
    role = body.get("role", "")
    target_type = body.get("target_type", "role")
    target_value = body.get("target_value", "")
    active_start = body.get("active_start_hour", 8)
    active_end = body.get("active_end_hour", 22)

    templates = PRESET_TEMPLATES.get(role.lower(), [])
    if not templates:
        raise HTTPException(status_code=400, detail=f"No presets for role: {role}")

    created = []
    for t in templates:
        doc = {
            "id": str(uuid.uuid4()),
            "name": t["name"],
            "message": t["message"],
            "target_type": target_type,
            "target_value": target_value,
            "interval_hours": t["interval_hours"],
            "active_start_hour": active_start,
            "active_end_hour": active_end,
            "days_of_week": [0, 1, 2, 3, 4, 5, 6],
            "channels": ["push", "in_app"],
            "enabled": True,
            "last_triggered": None,
            "trigger_count": 0,
            "created_by": current_user.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.task_reminders.insert_one(doc)
        del doc["_id"]
        created.append(doc)

    return {"created": len(created), "reminders": created}


@router.put("/task-reminders/{reminder_id}")
async def update_task_reminder(reminder_id: str, update: TaskReminderUpdate, current_user: User = Depends(get_current_user)):
    existing = await db.task_reminders.find_one({"id": reminder_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Reminder not found")
    updates = {}
    for field in ["name", "message", "target_type", "target_value", "interval_hours", "active_start_hour", "active_end_hour", "days_of_week", "channels", "enabled"]:
        val = getattr(update, field)
        if val is not None:
            updates[field] = val
    if updates:
        await db.task_reminders.update_one({"id": reminder_id}, {"$set": updates})
    return {"message": "Updated"}


@router.delete("/task-reminders/{reminder_id}")
async def delete_task_reminder(reminder_id: str, current_user: User = Depends(get_current_user)):
    result = await db.task_reminders.delete_one({"id": reminder_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Deleted"}


@router.post("/task-reminders/{reminder_id}/acknowledge")
async def acknowledge_reminder(reminder_id: str, current_user: User = Depends(get_current_user)):
    """Employee acknowledges a task reminder."""
    ack = {
        "id": str(uuid.uuid4()),
        "reminder_id": reminder_id,
        "employee_id": current_user.id,
        "employee_name": current_user.name,
        "acknowledged_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reminder_acknowledgements.insert_one(ack)
    return {"message": "Acknowledged"}


@router.get("/task-reminders/history")
async def get_reminder_history(limit: int = 50, current_user: User = Depends(get_current_user)):
    """Get recent reminder alert history."""
    history = await db.reminder_alerts.find({}, {"_id": 0}).sort("sent_at", -1).to_list(limit)
    return history


@router.get("/task-reminders/my-reminders")
async def get_my_reminders(current_user: User = Depends(get_current_user)):
    """Get reminders targeted at the current employee."""
    emp = await db.employees.find_one({"email": current_user.email}, {"_id": 0})
    if not emp:
        return []

    job_title_id = emp.get("job_title_id", "")
    pos_role = emp.get("pos_role", "")
    emp_id = emp.get("id", "")

    # Get the job title name
    job_title_name = ""
    if job_title_id:
        jt = await db.job_titles.find_one({"id": job_title_id}, {"_id": 0})
        if jt:
            job_title_name = jt.get("title", "").lower()

    # Find matching reminders
    reminders = await db.task_reminders.find({"enabled": True}, {"_id": 0}).to_list(500)

    my_reminders = []
    for r in reminders:
        if r["target_type"] == "employee" and r["target_value"] == emp_id:
            my_reminders.append(r)
        elif r["target_type"] == "role":
            target_role = r["target_value"].lower()
            if target_role == job_title_name or target_role == pos_role:
                my_reminders.append(r)

    # Get recent acknowledgements
    acks = await db.reminder_acknowledgements.find(
        {"employee_id": current_user.id},
        {"_id": 0}
    ).sort("acknowledged_at", -1).to_list(100)
    ack_map = {}
    for a in acks:
        if a["reminder_id"] not in ack_map:
            ack_map[a["reminder_id"]] = a["acknowledged_at"]

    for r in my_reminders:
        r["last_acknowledged"] = ack_map.get(r["id"])

    return my_reminders


@router.get("/task-reminders/acknowledgements/{reminder_id}")
async def get_acknowledgements(reminder_id: str, current_user: User = Depends(get_current_user)):
    """Get acknowledgement history for a specific reminder."""
    acks = await db.reminder_acknowledgements.find(
        {"reminder_id": reminder_id}, {"_id": 0}
    ).sort("acknowledged_at", -1).to_list(200)
    return acks


@router.get("/task-reminders/compliance")
async def get_compliance_dashboard(days: int = 30, current_user: User = Depends(get_current_user)):
    """Comprehensive compliance analytics for task reminders."""
    from collections import defaultdict
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=days)).isoformat()

    reminders = await db.task_reminders.find({}, {"_id": 0}).to_list(500)
    alerts = await db.reminder_alerts.find({"sent_at": {"$gte": cutoff}}, {"_id": 0}).to_list(50000)
    acks = await db.reminder_acknowledgements.find({"acknowledged_at": {"$gte": cutoff}}, {"_id": 0}).to_list(50000)
    employees = await db.employees.find({"status": {"$ne": "terminated"}}, {"_id": 0}).to_list(1000)
    job_titles = await db.job_titles.find({}, {"_id": 0}).to_list(100)
    jt_map = {jt["id"]: jt.get("title", "") for jt in job_titles}

    # Build employee info map
    emp_map = {}
    for e in employees:
        role = jt_map.get(e.get("job_title_id", ""), e.get("pos_role", "unknown"))
        emp_map[e["id"]] = {"name": e.get("name", "Unknown"), "role": role}

    # Index alerts by reminder_id
    alerts_by_reminder = defaultdict(int)
    alerts_by_role = defaultdict(int)
    for a in alerts:
        alerts_by_reminder[a.get("reminder_id")] += a.get("employees_notified", 0)
        alerts_by_role[a.get("target_value", "Other")] += a.get("employees_notified", 0)

    # Index acks by employee + reminder
    acks_by_employee = defaultdict(int)
    acks_by_role = defaultdict(int)
    acks_by_reminder = defaultdict(int)
    ack_hours = defaultdict(int)  # hour -> count
    ack_dow = defaultdict(int)    # dow -> count
    ack_hour_dow = defaultdict(lambda: defaultdict(int))  # dow -> hour -> count
    daily_acks = defaultdict(int)

    for a in acks:
        acks_by_employee[a.get("employee_id", "")] += 1
        acks_by_reminder[a.get("reminder_id", "")] += 1
        emp_info = emp_map.get(a.get("employee_id", ""), {})
        acks_by_role[emp_info.get("role", "Unknown")] += 1
        try:
            ack_dt = datetime.fromisoformat(a["acknowledged_at"].replace("Z", "+00:00"))
            ack_hours[ack_dt.hour] += 1
            ack_dow[ack_dt.weekday()] += 1
            ack_hour_dow[ack_dt.weekday()][ack_dt.hour] += 1
            daily_acks[ack_dt.strftime("%Y-%m-%d")] += 1
        except Exception:
            pass

    total_alerts_sent = sum(alerts_by_reminder.values())
    total_acks = len(acks)
    overall_compliance = round((total_acks / max(total_alerts_sent, 1)) * 100, 1)

    # Role compliance
    role_compliance = []
    all_roles = set(list(alerts_by_role.keys()) + list(acks_by_role.keys()))
    for role in sorted(all_roles):
        sent = alerts_by_role.get(role, 0)
        acked = acks_by_role.get(role, 0)
        pct = round((acked / max(sent, 1)) * 100, 1) if sent > 0 else 0
        role_compliance.append({"role": role, "alerts_sent": sent, "acknowledged": acked, "compliance": pct})
    role_compliance.sort(key=lambda x: -x["compliance"])

    # Employee leaderboard
    employee_scores = []
    reminder_by_id = {r["id"]: r for r in reminders}
    # Count how many alerts each employee should have received
    emp_alert_count = defaultdict(int)
    for a in alerts:
        rid = a.get("reminder_id")
        r = reminder_by_id.get(rid)
        if not r:
            continue
        notified = a.get("employees_notified", 0)
        # Distribute among matching employees
        if r["target_type"] == "employee":
            emp_alert_count[r["target_value"]] += 1
        elif r["target_type"] == "role":
            target_role = r["target_value"].lower()
            for eid, einfo in emp_map.items():
                if einfo["role"].lower() == target_role:
                    emp_alert_count[eid] += 1

    all_emp_ids = set(list(emp_alert_count.keys()) + list(acks_by_employee.keys()))
    for eid in all_emp_ids:
        einfo = emp_map.get(eid, {"name": "Unknown", "role": "Unknown"})
        sent = emp_alert_count.get(eid, 0)
        acked = acks_by_employee.get(eid, 0)
        pct = round((acked / max(sent, 1)) * 100, 1) if sent > 0 else (100 if acked > 0 else 0)
        status = "excellent" if pct >= 80 else "good" if pct >= 60 else "needs_attention" if pct >= 40 else "critical"
        employee_scores.append({
            "employee_id": eid, "name": einfo["name"], "role": einfo["role"],
            "alerts_received": sent, "acknowledged": acked, "compliance": min(pct, 100), "status": status
        })
    employee_scores.sort(key=lambda x: -x["compliance"])

    # Heatmap: day of week x hour
    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    heatmap = []
    for dow in range(7):
        for h in range(24):
            count = ack_hour_dow[dow][h]
            if count > 0:
                heatmap.append({"day": day_names[dow], "day_num": dow, "hour": h, "label": f"{h:02d}:00", "count": count})

    # Daily trend
    trend = []
    daily_alert_count = defaultdict(int)
    for a in alerts:
        try:
            d = a["sent_at"][:10]
            daily_alert_count[d] += a.get("employees_notified", 0)
        except Exception:
            pass

    for i in range(days):
        d = (now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        sent = daily_alert_count.get(d, 0)
        acked = daily_acks.get(d, 0)
        pct = round((acked / max(sent, 1)) * 100, 1) if sent > 0 else 0
        trend.append({"date": d, "alerts_sent": sent, "acknowledged": acked, "compliance": pct})

    # Flagged employees (below 50%)
    flagged = [e for e in employee_scores if e["compliance"] < 50 and e["alerts_received"] > 0]

    # Best performing role
    best_role = role_compliance[0]["role"] if role_compliance and role_compliance[0]["compliance"] > 0 else "-"

    return {
        "overview": {
            "overall_compliance": overall_compliance,
            "total_alerts_sent": total_alerts_sent,
            "total_acknowledgements": total_acks,
            "active_reminders": len([r for r in reminders if r.get("enabled")]),
            "best_role": best_role,
            "employees_tracked": len(employee_scores),
            "flagged_count": len(flagged),
            "period_days": days,
        },
        "role_compliance": role_compliance,
        "employee_leaderboard": employee_scores[:30],
        "heatmap": heatmap,
        "trend": trend,
        "flagged_employees": flagged,
    }


@router.post("/task-reminders/ai-generate")
async def ai_generate_duties(body: dict, current_user: User = Depends(get_current_user)):
    """Use AI to generate a duty plan for a specific role or employee."""
    import json as json_lib
    role = body.get("role", "")
    employee_name = body.get("employee_name", "")
    branch_name = body.get("branch_name", "")
    custom_context = body.get("context", "")
    shift_hours = body.get("shift_hours", "08:00 - 22:00")

    if not role:
        raise HTTPException(status_code=400, detail="Role is required (e.g., cleaner, waiter, cashier, chef)")

    prompt = f"""You are a restaurant operations manager. Generate a smart daily duty plan with recurring task reminders for a {role}.

{"Employee: " + employee_name if employee_name else ""}
{"Branch: " + branch_name if branch_name else ""}
Shift hours: {shift_hours}
{"Additional context: " + custom_context if custom_context else ""}

Create 5-8 practical, actionable tasks that this {role} should perform during their shift. Each task should have:
- A clear task name
- A reminder message (specific, actionable instruction)
- Interval in hours (how often this should repeat during the shift)
- Priority: high, medium, or low

Consider:
- Food safety regulations
- Customer experience
- Hygiene standards
- Efficiency and workflow
- Peak hours (lunch 12-14, dinner 19-22) need more frequent checks

Return ONLY a valid JSON array (no markdown):
[
  {{"name": "Task Name", "message": "Specific instruction", "interval_hours": 2, "priority": "high"}}
]"""

    try:
        from emergentintegrations.llm.chat import chat, ChatMessage
        import os
        response = await chat(
            api_key=os.environ.get("EMERGENT_API_KEY", ""),
            model="gpt-4o",
            messages=[ChatMessage(role="user", content=prompt)],
        )

        text = response.message.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        tasks = json_lib.loads(text)

        if not isinstance(tasks, list):
            raise ValueError("AI returned non-list")

        return {
            "role": role,
            "tasks": tasks,
            "total": len(tasks),
            "note": "Review and adjust before creating reminders",
        }
    except json_lib.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON. Please try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)[:200]}")




async def process_task_reminders():
    """Called by scheduler - check and fire due reminders."""
    now = datetime.now(timezone.utc)
    current_hour = now.hour
    current_dow = now.weekday()

    reminders = await db.task_reminders.find({"enabled": True}, {"_id": 0}).to_list(500)

    for r in reminders:
        # Check if within active hours
        if current_hour < r.get("active_start_hour", 8) or current_hour >= r.get("active_end_hour", 22):
            continue

        # Check day of week
        if current_dow not in r.get("days_of_week", [0, 1, 2, 3, 4, 5, 6]):
            continue

        # Check interval
        last = r.get("last_triggered")
        if last:
            try:
                last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                hours_since = (now - last_dt).total_seconds() / 3600
                if hours_since < r.get("interval_hours", 2):
                    continue
            except Exception:
                pass

        # Find target employees
        target_employees = []
        if r["target_type"] == "employee":
            emp = await db.employees.find_one({"id": r["target_value"]}, {"_id": 0})
            if emp:
                target_employees.append(emp)
        elif r["target_type"] == "role":
            target_role = r["target_value"].lower()
            # Match by job title name
            job_titles = await db.job_titles.find({}, {"_id": 0}).to_list(100)
            matching_jt_ids = [jt["id"] for jt in job_titles if jt.get("title", "").lower() == target_role]

            all_employees = await db.employees.find({"status": {"$ne": "terminated"}}, {"_id": 0}).to_list(1000)
            for emp in all_employees:
                if emp.get("job_title_id") in matching_jt_ids or emp.get("pos_role", "").lower() == target_role:
                    target_employees.append(emp)

        if not target_employees:
            continue

        # Send notifications
        for emp in target_employees:
            # Find user account
            user = await db.users.find_one({"email": emp.get("email")}, {"_id": 0})
            user_id = user["id"] if user else None
            emp_id = emp.get("id")

            # Check employee notification preferences
            prefs = await db.notification_preferences.find_one(
                {"$or": [{"user_id": user_id}, {"employee_id": emp_id}]}, {"_id": 0}
            ) if (user_id or emp_id) else None
            # Defaults: all channels enabled, no quiet hours
            pref_channels = prefs.get("channels", {}) if prefs else {}
            # Support both new format (channels.in_app) and legacy (channel_push)
            in_app_enabled = pref_channels.get("in_app", prefs.get("channel_in_app", True) if prefs else True)
            push_enabled = pref_channels.get("push", prefs.get("channel_push", True) if prefs else True)
            whatsapp_enabled = pref_channels.get("whatsapp", prefs.get("channel_whatsapp", True) if prefs else True)
            quiet_enabled = prefs.get("quiet_hours_enabled", False) if prefs else False
            quiet_start = prefs.get("quiet_hours_start") if prefs else None
            quiet_end = prefs.get("quiet_hours_end") if prefs else None

            # Check quiet hours
            in_quiet = False
            if quiet_enabled and quiet_start is not None and quiet_end is not None:
                current_hour = now.hour
                if quiet_start <= quiet_end:
                    in_quiet = quiet_start <= current_hour < quiet_end
                else:
                    in_quiet = current_hour >= quiet_start or current_hour < quiet_end

            # Create in-app notification (always, unless disabled)
            if in_app_enabled:
                notif = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id or emp_id,
                    "employee_id": emp_id,
                    "type": "task_reminder",
                    "title": f"Task: {r['name']}",
                    "message": r["message"],
                    "reminder_id": r["id"],
                    "read": False,
                    "created_at": now.isoformat()
                }
                await db.notifications.insert_one(notif)

            # Send push if configured and not in quiet hours
            if push_enabled and not in_quiet and "push" in r.get("channels", []) and user_id:
                try:
                    from routers.push_notifications import send_push_to_user
                    await send_push_to_user(user_id, f"Task: {r['name']}", r["message"])
                except Exception:
                    pass

            # Send WhatsApp if configured, not in quiet hours, and employee has phone
            if whatsapp_enabled and not in_quiet and "whatsapp" in r.get("channels", []):
                emp_phone = emp.get("phone", "").strip()
                if emp_phone:
                    try:
                        await _send_whatsapp_to_employee(
                            emp_phone,
                            f"*{r['name']}*\n{r['message']}\n\n_Please acknowledge in the Employee Portal._"
                        )
                    except Exception:
                        pass

        # Log alert
        alert_log = {
            "id": str(uuid.uuid4()),
            "reminder_id": r["id"],
            "reminder_name": r["name"],
            "target_type": r["target_type"],
            "target_value": r["target_value"],
            "employees_notified": len(target_employees),
            "sent_at": now.isoformat()
        }
        await db.reminder_alerts.insert_one(alert_log)

        # Update last triggered
        await db.task_reminders.update_one(
            {"id": r["id"]},
            {"$set": {"last_triggered": now.isoformat()}, "$inc": {"trigger_count": 1}}
        )


async def _send_whatsapp_to_employee(phone: str, message: str):
    """Send WhatsApp message to a specific employee phone number."""
    config = await db.whatsapp_config.find_one({}, {"_id": 0})
    if not config or not config.get("account_sid") or not config.get("auth_token"):
        return False
    try:
        from twilio.rest import Client
        client_tw = Client(config["account_sid"], config["auth_token"])
        # Ensure phone format
        if not phone.startswith("+"):
            phone = f"+{phone}"
        client_tw.messages.create(
            from_=f'whatsapp:{config["phone_number"]}',
            body=message,
            to=f'whatsapp:{phone}'
        )
        return True
    except Exception:
        return False


# ---- Employee Notification Endpoints ----

@router.get("/my/notifications")
async def get_my_notifications(current_user: User = Depends(get_current_user)):
    """Get notifications for the current user (employee portal)."""
    notifs = await db.notifications.find(
        {"$or": [{"user_id": current_user.id}, {"employee_id": current_user.id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    unread = sum(1 for n in notifs if not n.get("read"))
    return {"notifications": notifs, "unread_count": unread}


@router.put("/my/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: str, current_user: User = Depends(get_current_user)):
    """Mark a notification as read."""
    result = await db.notifications.update_one(
        {"id": notif_id, "$or": [{"user_id": current_user.id}, {"employee_id": current_user.id}]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}


@router.put("/my/notifications/read-all")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read."""
    await db.notifications.update_many(
        {"$or": [{"user_id": current_user.id}, {"employee_id": current_user.id}], "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "All notifications marked as read"}


# ---- Notification Preferences Endpoints ----

@router.get("/my/notification-preferences")
async def get_notification_preferences(current_user: User = Depends(get_current_user)):
    """Get notification preferences for the current user."""
    prefs = await db.notification_preferences.find_one(
        {"user_id": current_user.id}, {"_id": 0}
    )
    if not prefs:
        # Return defaults
        return {
            "user_id": current_user.id,
            "channels": {"in_app": True, "push": True, "whatsapp": True},
            "quiet_hours_enabled": False,
            "quiet_hours_start": 22,
            "quiet_hours_end": 7,
            "task_reminders": True,
            "schedule_alerts": True,
            "system_alerts": True,
        }
    return prefs


@router.put("/my/notification-preferences")
async def update_notification_preferences(body: dict, current_user: User = Depends(get_current_user)):
    """Update notification preferences."""
    update = {"user_id": current_user.id, "updated_at": datetime.now(timezone.utc).isoformat()}

    if "channels" in body:
        channels = body["channels"]
        update["channels"] = {
            "in_app": channels.get("in_app", True),
            "push": channels.get("push", True),
            "whatsapp": channels.get("whatsapp", True),
        }
    if "quiet_hours_enabled" in body:
        update["quiet_hours_enabled"] = bool(body["quiet_hours_enabled"])
    if "quiet_hours_start" in body:
        update["quiet_hours_start"] = int(body["quiet_hours_start"])
    if "quiet_hours_end" in body:
        update["quiet_hours_end"] = int(body["quiet_hours_end"])
    if "task_reminders" in body:
        update["task_reminders"] = bool(body["task_reminders"])
    if "schedule_alerts" in body:
        update["schedule_alerts"] = bool(body["schedule_alerts"])
    if "system_alerts" in body:
        update["system_alerts"] = bool(body["system_alerts"])

    await db.notification_preferences.update_one(
        {"user_id": current_user.id},
        {"$set": update},
        upsert=True
    )
    return await db.notification_preferences.find_one({"user_id": current_user.id}, {"_id": 0})
