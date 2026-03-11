"""
Staff Performance Dashboard
Aggregates attendance, punctuality, overtime, and task compliance per employee
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from database import db, get_current_user
from models import User

router = APIRouter()


@router.get("/staff-performance")
async def get_staff_performance(
    branch_id: Optional[str] = None,
    period_days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive staff performance metrics."""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=period_days)).isoformat()

    # Get employees
    emp_query = {"active": True}
    if branch_id:
        emp_query["branch_id"] = branch_id
    employees = await db.employees.find(emp_query, {"_id": 0}).to_list(200)
    if not employees and branch_id:
        employees = await db.employees.find({"active": True}, {"_id": 0}).to_list(200)

    emp_map = {e["id"]: e for e in employees}
    emp_ids = list(emp_map.keys())

    # Get shift assignments
    sa_query = {"date": {"$gte": cutoff[:10]}}
    if branch_id:
        sa_query["branch_id"] = branch_id
    assignments = await db.shift_assignments.find(sa_query, {"_id": 0}).to_list(50000)

    # Get task reminder compliance data
    acks = await db.reminder_acknowledgements.find(
        {"acknowledged_at": {"$gte": cutoff}}, {"_id": 0}
    ).to_list(50000)
    alerts = await db.reminder_alerts.find(
        {"sent_at": {"$gte": cutoff}}, {"_id": 0}
    ).to_list(50000)

    # Job titles for role resolution
    job_titles = await db.job_titles.find({}, {"_id": 0}).to_list(100)
    jt_map = {jt["id"]: jt.get("title", "") for jt in job_titles}

    # Build per-employee metrics
    emp_stats = {}
    for eid in emp_ids:
        emp_stats[eid] = {
            "scheduled": 0, "present": 0, "late": 0, "absent": 0,
            "overtime_hours": 0, "days_worked": set(), "total_shifts": 0,
        }

    for a in assignments:
        eid = a.get("employee_id")
        if eid not in emp_stats:
            emp_stats[eid] = {
                "scheduled": 0, "present": 0, "late": 0, "absent": 0,
                "overtime_hours": 0, "days_worked": set(), "total_shifts": 0,
            }
        s = emp_stats[eid]
        s["scheduled"] += 1
        s["total_shifts"] += 1
        status = a.get("status", "scheduled")
        if status in ("present", "late"):
            s["present"] += 1
            s["days_worked"].add(a.get("date", ""))
        if status == "late":
            s["late"] += 1
        if status == "absent":
            s["absent"] += 1
        s["overtime_hours"] += a.get("overtime_hours", 0) or 0

    # Task compliance per employee
    acks_by_emp = defaultdict(int)
    for a in acks:
        acks_by_emp[a.get("employee_id", "")] += 1

    # Count expected alerts per employee (approximate)
    reminders = await db.task_reminders.find({"enabled": True}, {"_id": 0}).to_list(500)
    emp_expected_alerts = defaultdict(int)
    total_alert_count = len(alerts)
    for a in alerts:
        # Approximate: distribute alerts to matching employees
        emp_expected_alerts["_total"] += a.get("employees_notified", 0)

    # Build performance entries
    performances = []
    for e in employees:
        eid = e["id"]
        s = emp_stats.get(eid, {})
        scheduled = s.get("scheduled", 0)
        present = s.get("present", 0)
        late = s.get("late", 0)
        absent = s.get("absent", 0)
        ot = round(s.get("overtime_hours", 0), 1)
        days_worked = len(s.get("days_worked", set()))
        task_acks = acks_by_emp.get(eid, 0)

        # Calculate scores
        attendance_rate = round((present / max(scheduled, 1)) * 100, 1) if scheduled > 0 else 0
        punctuality_rate = round(((present - late) / max(present, 1)) * 100, 1) if present > 0 else 0
        absence_rate = round((absent / max(scheduled, 1)) * 100, 1) if scheduled > 0 else 0

        # Overall score (weighted)
        reliability_score = min(100, round(
            attendance_rate * 0.4 +
            punctuality_rate * 0.3 +
            (100 - absence_rate) * 0.2 +
            min(task_acks * 5, 100) * 0.1
        , 1))

        # Performance tier
        if reliability_score >= 85:
            tier = "excellent"
        elif reliability_score >= 70:
            tier = "good"
        elif reliability_score >= 50:
            tier = "average"
        else:
            tier = "needs_improvement"

        role = jt_map.get(e.get("job_title_id", ""), e.get("position", "N/A"))

        performances.append({
            "employee_id": eid,
            "name": e.get("name", "Unknown"),
            "role": role,
            "branch_id": e.get("branch_id"),
            "scheduled_shifts": scheduled,
            "present": present,
            "late": late,
            "absent": absent,
            "days_worked": days_worked,
            "overtime_hours": ot,
            "task_completions": task_acks,
            "attendance_rate": attendance_rate,
            "punctuality_rate": punctuality_rate,
            "absence_rate": absence_rate,
            "reliability_score": reliability_score,
            "tier": tier,
        })

    performances.sort(key=lambda x: -x["reliability_score"])

    # Summary stats
    total_employees = len(performances)
    avg_attendance = round(sum(p["attendance_rate"] for p in performances) / max(total_employees, 1), 1)
    avg_punctuality = round(sum(p["punctuality_rate"] for p in performances) / max(total_employees, 1), 1)
    total_overtime = round(sum(p["overtime_hours"] for p in performances), 1)
    tier_counts = defaultdict(int)
    for p in performances:
        tier_counts[p["tier"]] += 1

    # Weekly trends (last N weeks)
    weeks = min(period_days // 7, 12)
    weekly_trends = []
    for w in range(weeks):
        w_start = (now - timedelta(weeks=weeks - w)).strftime("%Y-%m-%d")
        w_end = (now - timedelta(weeks=weeks - w - 1)).strftime("%Y-%m-%d")
        w_assignments = [a for a in assignments if w_start <= a.get("date", "") < w_end]
        w_present = sum(1 for a in w_assignments if a.get("status") in ("present", "late"))
        w_total = len(w_assignments)
        w_late = sum(1 for a in w_assignments if a.get("status") == "late")
        weekly_trends.append({
            "week": w_start,
            "attendance_rate": round((w_present / max(w_total, 1)) * 100, 1) if w_total > 0 else 0,
            "total_shifts": w_total,
            "late_count": w_late,
        })

    return {
        "employees": performances,
        "summary": {
            "total_employees": total_employees,
            "avg_attendance_rate": avg_attendance,
            "avg_punctuality_rate": avg_punctuality,
            "total_overtime_hours": total_overtime,
            "total_shifts_tracked": sum(p["scheduled_shifts"] for p in performances),
            "tier_breakdown": dict(tier_counts),
        },
        "weekly_trends": weekly_trends,
        "period_days": period_days,
    }


@router.get("/staff-performance/{employee_id}")
async def get_employee_performance(
    employee_id: str,
    period_days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_user)
):
    """Get detailed performance for a single employee."""
    emp = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=period_days)).isoformat()

    assignments = await db.shift_assignments.find(
        {"employee_id": employee_id, "date": {"$gte": cutoff[:10]}}, {"_id": 0}
    ).sort("date", 1).to_list(5000)

    # Daily breakdown
    daily = []
    for a in assignments:
        daily.append({
            "date": a.get("date"),
            "shift": a.get("shift_name", ""),
            "status": a.get("status", "scheduled"),
            "actual_in": a.get("actual_in"),
            "actual_out": a.get("actual_out"),
            "overtime_hours": a.get("overtime_hours", 0),
        })

    # Stats
    total = len(assignments)
    present = sum(1 for a in assignments if a.get("status") in ("present", "late"))
    late = sum(1 for a in assignments if a.get("status") == "late")
    absent = sum(1 for a in assignments if a.get("status") == "absent")
    ot = round(sum(a.get("overtime_hours", 0) or 0 for a in assignments), 1)

    # Task compliance
    acks = await db.reminder_acknowledgements.find(
        {"employee_id": employee_id, "acknowledged_at": {"$gte": cutoff}}, {"_id": 0}
    ).to_list(1000)

    return {
        "employee": {
            "id": emp["id"],
            "name": emp.get("name"),
            "position": emp.get("position"),
            "branch_id": emp.get("branch_id"),
        },
        "stats": {
            "scheduled": total,
            "present": present,
            "late": late,
            "absent": absent,
            "overtime_hours": ot,
            "attendance_rate": round((present / max(total, 1)) * 100, 1),
            "punctuality_rate": round(((present - late) / max(present, 1)) * 100, 1) if present > 0 else 0,
            "task_completions": len(acks),
        },
        "daily": daily,
        "period_days": period_days,
    }
