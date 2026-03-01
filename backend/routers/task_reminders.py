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

            # Create in-app notification
            notif = {
                "id": str(uuid.uuid4()),
                "user_id": user_id or emp.get("id"),
                "type": "task_reminder",
                "title": f"Task: {r['name']}",
                "message": r["message"],
                "reminder_id": r["id"],
                "read": False,
                "created_at": now.isoformat()
            }
            await db.notifications.insert_one(notif)

            # Send push if configured
            if "push" in r.get("channels", []) and user_id:
                try:
                    from routers.push_notifications import send_push_to_user
                    await send_push_to_user(user_id, f"Task: {r['name']}", r["message"])
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
