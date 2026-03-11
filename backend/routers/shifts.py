from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db, get_current_user
from models import User, Shift, ShiftAssignment

router = APIRouter()

@router.get("/shifts")
async def get_shifts(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    shifts = await db.shifts.find(query, {"_id": 0}).to_list(200)
    return shifts

@router.post("/shifts")
async def create_shift(body: dict, current_user: User = Depends(get_current_user)):
    shift = Shift(
        name=body["name"], branch_id=body["branch_id"],
        start_time=body["start_time"], end_time=body["end_time"],
        break_minutes=int(body.get("break_minutes", 60)),
        days=body.get("days", ["Mon","Tue","Wed","Thu","Fri"]),
        color=body.get("color", "#F5841F")
    )
    sd = shift.model_dump()
    sd["created_at"] = sd["created_at"].isoformat()
    await db.shifts.insert_one(sd)
    return {k: v for k, v in sd.items() if k != '_id'}

@router.put("/shifts/{shift_id}")
async def update_shift(shift_id: str, body: dict, current_user: User = Depends(get_current_user)):
    update = {k: v for k, v in body.items() if k in ["name","start_time","end_time","break_minutes","days","color","active"]}
    await db.shifts.update_one({"id": shift_id}, {"$set": update})
    return await db.shifts.find_one({"id": shift_id}, {"_id": 0})

@router.delete("/shifts/{shift_id}")
async def delete_shift(shift_id: str, current_user: User = Depends(get_current_user)):
    await db.shifts.delete_one({"id": shift_id})
    await db.shift_assignments.delete_many({"shift_id": shift_id})
    return {"message": "Shift deleted"}

@router.get("/shift-assignments")
async def get_shift_assignments(branch_id: Optional[str] = None, week_start: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    if week_start:
        week_end = (datetime.fromisoformat(week_start) + timedelta(days=7)).strftime("%Y-%m-%d")
        query["date"] = {"$gte": week_start, "$lt": week_end}
    assignments = await db.shift_assignments.find(query, {"_id": 0}).sort("date", 1).to_list(5000)
    return assignments

@router.post("/shift-assignments")
async def create_shift_assignment(body: dict, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": body["employee_id"]}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    shift = await db.shifts.find_one({"id": body["shift_id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    existing = await db.shift_assignments.find_one({"employee_id": body["employee_id"], "date": body["date"]}, {"_id": 0})
    if existing:
        await db.shift_assignments.update_one({"id": existing["id"]}, {"$set": {"shift_id": body["shift_id"], "shift_name": shift["name"]}})
        updated = await db.shift_assignments.find_one({"id": existing["id"]}, {"_id": 0})
        return updated
    assignment = ShiftAssignment(
        employee_id=body["employee_id"], employee_name=emp["name"],
        shift_id=body["shift_id"], shift_name=shift["name"],
        branch_id=body.get("branch_id", shift["branch_id"]),
        week_start=body.get("week_start", body["date"][:10]),
        date=body["date"]
    )
    ad = assignment.model_dump()
    ad["created_at"] = ad["created_at"].isoformat()
    await db.shift_assignments.insert_one(ad)
    return {k: v for k, v in ad.items() if k != '_id'}

@router.post("/shift-assignments/bulk")
async def create_bulk_assignments(body: dict, current_user: User = Depends(get_current_user)):
    assignments_data = body.get("assignments", [])
    created = 0
    for a in assignments_data:
        try:
            await create_shift_assignment(a, current_user)
            created += 1
        except:
            pass
    return {"created": created}

@router.put("/shift-assignments/{assignment_id}")
async def update_shift_assignment(assignment_id: str, body: dict, current_user: User = Depends(get_current_user)):
    update = {}
    for f in ["actual_in", "actual_out", "status", "overtime_hours", "notes"]:
        if f in body:
            update[f] = body[f]
    if "actual_in" in update and "actual_out" in update and update["actual_in"] and update["actual_out"]:
        try:
            t_in = datetime.strptime(update["actual_in"], "%H:%M")
            t_out = datetime.strptime(update["actual_out"], "%H:%M")
            worked_hours = (t_out - t_in).total_seconds() / 3600
            assignment = await db.shift_assignments.find_one({"id": assignment_id}, {"_id": 0})
            if assignment:
                shift = await db.shifts.find_one({"id": assignment["shift_id"]}, {"_id": 0})
                if shift:
                    s_in = datetime.strptime(shift["start_time"], "%H:%M")
                    s_out = datetime.strptime(shift["end_time"], "%H:%M")
                    shift_hours = (s_out - s_in).total_seconds() / 3600 - shift.get("break_minutes", 60) / 60
                    overtime = max(0, worked_hours - shift.get("break_minutes", 60) / 60 - shift_hours)
                    update["overtime_hours"] = round(overtime, 2)
        except:
            pass
    if update.get("actual_in"):
        assignment = await db.shift_assignments.find_one({"id": assignment_id}, {"_id": 0})
        if assignment:
            shift = await db.shifts.find_one({"id": assignment.get("shift_id")}, {"_id": 0})
            if shift:
                try:
                    actual = datetime.strptime(update["actual_in"], "%H:%M")
                    expected = datetime.strptime(shift["start_time"], "%H:%M")
                    if actual > expected + timedelta(minutes=15):
                        update["status"] = "late"
                    else:
                        update["status"] = "present"
                except:
                    update["status"] = "present"
    await db.shift_assignments.update_one({"id": assignment_id}, {"$set": update})
    return await db.shift_assignments.find_one({"id": assignment_id}, {"_id": 0})

@router.get("/shift-assignments/attendance-summary")
async def get_attendance_summary(branch_id: Optional[str] = None, month: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if branch_id:
        query["branch_id"] = branch_id
    if month:
        query["date"] = {"$regex": f"^{month}"}
    else:
        today = datetime.now(timezone.utc)
        query["date"] = {"$regex": f"^{today.strftime('%Y-%m')}"}
    assignments = await db.shift_assignments.find(query, {"_id": 0}).to_list(10000)
    emp_summary = {}
    for a in assignments:
        eid = a["employee_id"]
        if eid not in emp_summary:
            emp_summary[eid] = {"employee_id": eid, "employee_name": a["employee_name"],
                "scheduled": 0, "present": 0, "late": 0, "absent": 0, "overtime_hours": 0}
        emp_summary[eid]["scheduled"] += 1
        s = a.get("status", "scheduled")
        if s == "present":
            emp_summary[eid]["present"] += 1
        elif s == "late":
            emp_summary[eid]["late"] += 1
            emp_summary[eid]["present"] += 1
        elif s == "absent":
            emp_summary[eid]["absent"] += 1
        emp_summary[eid]["overtime_hours"] += a.get("overtime_hours", 0)
    return list(emp_summary.values())



# AI Shift Recommendation - Enhanced with Peak Hours Data
@router.post("/shifts/ai-recommend")
async def ai_recommend_shifts(body: dict, current_user: User = Depends(get_current_user)):
    branch_id = body.get("branch_id")
    week_start = body.get("week_start", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    if not branch_id:
        raise HTTPException(status_code=400, detail="branch_id required")
    # Gather data for AI
    employees = await db.employees.find({"active": True, "branch_id": branch_id}, {"_id": 0}).to_list(100)
    if not employees:
        employees = await db.employees.find({"active": True}, {"_id": 0}).to_list(100)
    shifts = await db.shifts.find({"branch_id": branch_id}, {"_id": 0}).to_list(50)
    if not shifts:
        raise HTTPException(status_code=400, detail="No shifts defined for this branch")
    # Get last 30 days of assignment history for attendance analysis
    past_start = (datetime.fromisoformat(week_start) - timedelta(days=30)).strftime("%Y-%m-%d")
    past_assignments = await db.shift_assignments.find(
        {"branch_id": branch_id, "date": {"$gte": past_start}}, {"_id": 0}
    ).to_list(10000)
    # Build employee attendance stats
    emp_stats = {}
    for a in past_assignments:
        eid = a["employee_id"]
        if eid not in emp_stats:
            emp_stats[eid] = {"scheduled": 0, "present": 0, "late": 0, "absent": 0, "overtime": 0}
        emp_stats[eid]["scheduled"] += 1
        s = a.get("status", "scheduled")
        if s in ("present", "late"):
            emp_stats[eid]["present"] += 1
        if s == "late":
            emp_stats[eid]["late"] += 1
        if s == "absent":
            emp_stats[eid]["absent"] += 1
        emp_stats[eid]["overtime"] += a.get("overtime_hours", 0)

    # Fetch peak hours data for this branch (last 30 days)
    peak_hours_data = await _get_branch_peak_hours(branch_id, days=30)

    # Build prompt
    emp_lines = []
    for e in employees[:20]:
        stats = emp_stats.get(e["id"], {})
        reliability = round(stats.get("present", 0) / max(stats.get("scheduled", 1), 1) * 100)
        emp_lines.append(f"- {e['name']} (ID: {e['id'][:8]}, Position: {e.get('position','N/A')}, Reliability: {reliability}%, Late: {stats.get('late',0)}x, OT: {stats.get('overtime',0):.1f}h)")
    shift_lines = [f"- {s['name']} ({s['start_time']}-{s['end_time']}, Days: {','.join(s.get('days',[]))})" for s in shifts]

    # Peak hours context
    peak_context = ""
    if peak_hours_data.get("peak_hour"):
        ph = peak_hours_data
        busy_hours = [h for h in ph.get("hourly", []) if h["orders"] > 0]
        busy_days = [d for d in ph.get("daily", []) if d["orders"] > 0]
        peak_context = f"""
PEAK HOURS DATA (last 30 days at this branch):
- Busiest hour: {ph['peak_hour']['hour']} ({ph['peak_hour']['orders']} orders, SAR {ph['peak_hour']['revenue']})
- Busiest day: {ph['peak_day']['day']} ({ph['peak_day']['orders']} orders)
- Rush hours (above average): {', '.join(h['hour'] for h in ph.get('rush_hours', []))}
- Order distribution by day: {', '.join(f"{d['name']}: {d['orders']} orders" for d in busy_days)}
- Order distribution by hour: {', '.join(f"{h['label']}: {h['orders']} orders" for h in busy_hours[:8])}
"""

    prompt = f"""You are a restaurant shift scheduling AI. Based on employee attendance data AND peak hours analysis, create an optimal 7-day schedule.

Branch shifts available:
{chr(10).join(shift_lines)}

Employees:
{chr(10).join(emp_lines)}
{peak_context}
Week starting: {week_start}

Rules:
1. CRITICAL: Assign MORE staff to shifts covering peak/rush hours (see peak hours data above)
2. Busiest days of the week need maximum coverage
3. Prioritize reliable employees for busy shifts (peak hours)
4. Give employees with high overtime some lighter days on quieter days
5. Frequently late employees should get later shifts when possible
6. Distribute workload fairly but favor coverage during high-demand periods
7. Quieter days/hours can have minimum staff

Return ONLY valid JSON array with this structure (no markdown):
[
  {{"employee_id": "first-8-chars", "employee_name": "Name", "shift_name": "Shift Name", "day": "Mon", "date": "YYYY-MM-DD", "reason": "brief reason"}}
]
Assign shifts for 7 days (Mon-Sun). Each employee should work 5-6 days."""
    try:
        import os
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM key not configured")
        import uuid as _uuid
        chat = LlmChat(api_key=api_key, session_id=f"shift-ai-{_uuid.uuid4()}", system_message="You are a shift scheduling AI assistant.").with_model("openai", "gpt-4o")
        response = await chat.send_message(UserMessage(text=prompt))
        import json as json_module
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        recommendations = json_module.loads(cleaned)
        # Map truncated IDs back to full IDs
        emp_map = {e["id"][:8]: e["id"] for e in employees}
        shift_map = {s["name"]: s["id"] for s in shifts}
        for rec in recommendations:
            short_id = rec.get("employee_id", "")
            rec["employee_id"] = emp_map.get(short_id, short_id)
            rec["shift_id"] = shift_map.get(rec.get("shift_name", ""), "")
        return {"recommendations": recommendations, "employee_count": len(employees), "shift_count": len(shifts)}
    except Exception as e:
        if "JSONDecodeError" in type(e).__name__:
            return {"recommendations": [], "error": "AI returned invalid format", "raw": str(e)[:200]}
        raise HTTPException(status_code=500, detail=f"AI recommendation failed: {str(e)[:200]}")



async def _get_branch_peak_hours(branch_id: str, days: int = 30):
    """Helper to get peak hours data for a specific branch."""
    DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days)).isoformat()
    end = now.isoformat()

    match_stage = {"created_at": {"$gte": start, "$lte": end}, "status": {"$ne": "cancelled"}}
    if branch_id:
        match_stage["branch_id"] = branch_id

    orders = await db.pos_orders.find(match_stage, {"_id": 0, "created_at": 1, "total": 1, "items": 1}).to_list(10000)

    hourly = {h: {"hour": h, "orders": 0, "revenue": 0, "items_sold": 0} for h in range(24)}
    daily = {d: {"day": d, "orders": 0, "revenue": 0} for d in range(7)}

    for order in orders:
        created = order.get("created_at", "")
        total = order.get("total", 0) or 0
        item_count = sum(i.get("quantity", 1) for i in order.get("items", []))
        try:
            dt = datetime.fromisoformat(created.replace("Z", "+00:00")) if isinstance(created, str) else created
            h = dt.hour
            dow = dt.weekday()
            hourly[h]["orders"] += 1
            hourly[h]["revenue"] += total
            hourly[h]["items_sold"] += item_count
            daily[dow]["orders"] += 1
            daily[dow]["revenue"] += total
        except:
            continue

    hourly_list = sorted(hourly.values(), key=lambda x: x["hour"])
    for h in hourly_list:
        h["revenue"] = round(h["revenue"], 2)
        h["label"] = f"{h['hour']:02d}:00"

    daily_list = sorted(daily.values(), key=lambda x: x["day"])
    for d in daily_list:
        d["revenue"] = round(d["revenue"], 2)
        d["name"] = DAY_NAMES[d["day"]]

    peak_hour = max(hourly_list, key=lambda x: x["orders"]) if orders else None
    peak_day = max(daily_list, key=lambda x: x["orders"]) if orders else None
    total_orders = len(orders)
    avg_per_hour = total_orders / 24 if total_orders > 0 else 0
    rush_hours = [h for h in hourly_list if h["orders"] > avg_per_hour and h["orders"] > 0]

    return {
        "hourly": hourly_list,
        "daily": daily_list,
        "peak_hour": {"hour": peak_hour["label"], "orders": peak_hour["orders"], "revenue": peak_hour["revenue"]} if peak_hour and peak_hour["orders"] > 0 else None,
        "peak_day": {"day": peak_day["name"], "orders": peak_day["orders"], "revenue": peak_day["revenue"]} if peak_day and peak_day["orders"] > 0 else None,
        "rush_hours": [{"hour": h["label"], "orders": h["orders"]} for h in rush_hours],
        "total_orders": total_orders,
        "avg_orders_per_hour": round(avg_per_hour, 1),
    }


@router.get("/staffing-insights")
async def get_staffing_insights(
    branch_id: str,
    week_start: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Staffing insights: peak hours vs shift coverage analysis."""
    DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    if not week_start:
        week_start = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Get peak hours for this branch
    peak = await _get_branch_peak_hours(branch_id, days=60)

    # 2. Get shifts for this branch
    shifts = await db.shifts.find({"branch_id": branch_id, "active": {"$ne": False}}, {"_id": 0}).to_list(50)

    # 3. Get current week assignments
    week_end = (datetime.fromisoformat(week_start) + timedelta(days=7)).strftime("%Y-%m-%d")
    assignments = await db.shift_assignments.find({
        "branch_id": branch_id,
        "date": {"$gte": week_start, "$lt": week_end}
    }, {"_id": 0}).to_list(5000)

    # 4. Get employees
    employees = await db.employees.find({"active": True, "branch_id": branch_id}, {"_id": 0, "id": 1, "name": 1, "position": 1}).to_list(200)

    # 5. Build shift coverage map: for each day, how many staff per shift
    week_dates = []
    start_dt = datetime.fromisoformat(week_start)
    for i in range(7):
        d = start_dt + timedelta(days=i)
        week_dates.append(d.strftime("%Y-%m-%d"))

    # Coverage per day
    daily_coverage = []
    for i, date in enumerate(week_dates):
        day_abbr = DAY_ABBR[i]
        day_assignments = [a for a in assignments if a["date"] == date]
        staff_count = len(set(a["employee_id"] for a in day_assignments))

        # Demand from peak hours: get order volume for this day of week
        dow = (start_dt + timedelta(days=i)).weekday()
        day_demand = next((d for d in peak.get("daily", []) if d["day"] == dow), {})
        avg_daily_orders = day_demand.get("orders", 0)

        # Calculate demand level
        avg_orders = peak.get("total_orders", 0) / 7 if peak.get("total_orders", 0) > 0 else 0
        if avg_daily_orders > avg_orders * 1.3:
            demand_level = "high"
        elif avg_daily_orders > avg_orders * 0.7:
            demand_level = "medium"
        else:
            demand_level = "low"

        # Shift breakdown
        shift_breakdown = []
        for s in shifts:
            if day_abbr not in s.get("days", []):
                continue
            assigned = [a for a in day_assignments if a["shift_id"] == s["id"]]
            shift_breakdown.append({
                "shift_name": s["name"],
                "shift_id": s["id"],
                "start_time": s["start_time"],
                "end_time": s["end_time"],
                "assigned_count": len(assigned),
                "assigned_employees": [a["employee_name"] for a in assigned],
            })

        daily_coverage.append({
            "date": date,
            "day": DAY_NAMES[dow],
            "day_abbr": day_abbr,
            "staff_count": staff_count,
            "order_demand": avg_daily_orders,
            "demand_level": demand_level,
            "shifts": shift_breakdown,
        })

    # 6. Build suggestions
    suggestions = []
    total_staff = len(employees)

    for dc in daily_coverage:
        if dc["demand_level"] == "high" and dc["staff_count"] < total_staff * 0.7:
            suggestions.append({
                "type": "understaffed",
                "priority": "high",
                "day": dc["day"],
                "date": dc["date"],
                "message": f"{dc['day']} is a high-demand day ({dc['order_demand']} orders avg) but only {dc['staff_count']} of {total_staff} staff scheduled.",
                "action": f"Consider adding {max(1, int(total_staff * 0.7) - dc['staff_count'])} more staff.",
            })
        elif dc["demand_level"] == "low" and dc["staff_count"] > total_staff * 0.6:
            suggestions.append({
                "type": "overstaffed",
                "priority": "low",
                "day": dc["day"],
                "date": dc["date"],
                "message": f"{dc['day']} is a low-demand day ({dc['order_demand']} orders avg) with {dc['staff_count']} staff.",
                "action": "You could reduce staff or use this day for training/inventory.",
            })

        # Check for shifts without coverage
        for sb in dc["shifts"]:
            if sb["assigned_count"] == 0:
                suggestions.append({
                    "type": "no_coverage",
                    "priority": "high",
                    "day": dc["day"],
                    "date": dc["date"],
                    "message": f"{sb['shift_name']} ({sb['start_time']}-{sb['end_time']}) on {dc['day']} has no staff assigned.",
                    "action": "Assign at least one employee to this shift.",
                })

    # 7. Peak hour to shift mapping
    shift_demand = []
    for s in shifts:
        try:
            s_start = int(s["start_time"].split(":")[0])
            s_end = int(s["end_time"].split(":")[0])
            if s_end <= s_start:
                s_end += 24
            overlap_orders = sum(
                h["orders"] for h in peak.get("hourly", [])
                if s_start <= h["hour"] < s_end or (s_end > 24 and h["hour"] < s_end - 24)
            )
            shift_demand.append({
                "shift_name": s["name"],
                "shift_id": s["id"],
                "start_time": s["start_time"],
                "end_time": s["end_time"],
                "orders_during_shift": overlap_orders,
                "demand_level": "high" if overlap_orders > peak.get("avg_orders_per_hour", 0) * (s_end - s_start) else "normal",
            })
        except:
            continue

    return {
        "branch_id": branch_id,
        "week_start": week_start,
        "total_employees": total_staff,
        "total_shifts": len(shifts),
        "peak_hours": peak,
        "daily_coverage": daily_coverage,
        "shift_demand": shift_demand,
        "suggestions": sorted(suggestions, key=lambda x: 0 if x["priority"] == "high" else 1),
        "total_suggestions": len(suggestions),
    }
