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



# AI Shift Recommendation
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
    # Build prompt
    emp_lines = []
    for e in employees[:20]:
        stats = emp_stats.get(e["id"], {})
        reliability = round(stats.get("present", 0) / max(stats.get("scheduled", 1), 1) * 100)
        emp_lines.append(f"- {e['name']} (ID: {e['id'][:8]}, Position: {e.get('position','N/A')}, Reliability: {reliability}%, Late: {stats.get('late',0)}x, OT: {stats.get('overtime',0):.1f}h)")
    shift_lines = [f"- {s['name']} ({s['start_time']}-{s['end_time']}, Days: {','.join(s.get('days',[]))})" for s in shifts]
    prompt = f"""You are a restaurant shift scheduling AI. Based on employee attendance data, create an optimal 7-day schedule.

Branch shifts available:
{chr(10).join(shift_lines)}

Employees:
{chr(10).join(emp_lines)}

Week starting: {week_start}

Rules:
1. Prioritize reliable employees for busy shifts
2. Give employees with high overtime some lighter days
3. Ensure each shift has adequate coverage
4. Frequently late employees should get later shifts when possible
5. Distribute workload fairly across the week

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
