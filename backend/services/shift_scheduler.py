"""
AI-Powered Shift Scheduling Service
Optimizes staff schedules based on peak hours, employee availability, and business needs
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from collections import defaultdict
import random


class ShiftScheduler:
    """AI-powered shift scheduler that optimizes staffing based on business data"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_peak_hours_data(self, days: int = 30) -> Dict[int, float]:
        """Analyze historical data to find peak hours"""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Get sales data
        sales = await self.db.sales.find(
            {"date": {"$gte": start_date.isoformat()}},
            {"_id": 0, "date": 1, "amount": 1}
        ).to_list(10000)
        
        # Aggregate by hour
        hourly_data = defaultdict(lambda: {"count": 0, "revenue": 0})
        
        for sale in sales:
            try:
                dt = datetime.fromisoformat(sale["date"].replace("Z", "+00:00"))
                hour = dt.hour
                hourly_data[hour]["count"] += 1
                hourly_data[hour]["revenue"] += sale.get("amount", 0)
            except:
                continue
        
        # Calculate normalized scores (0-1)
        max_count = max((h["count"] for h in hourly_data.values()), default=1)
        max_revenue = max((h["revenue"] for h in hourly_data.values()), default=1)
        
        scores = {}
        for hour in range(24):
            data = hourly_data.get(hour, {"count": 0, "revenue": 0})
            count_score = data["count"] / max_count if max_count > 0 else 0
            revenue_score = data["revenue"] / max_revenue if max_revenue > 0 else 0
            scores[hour] = (count_score * 0.6 + revenue_score * 0.4)  # Weighted score
        
        return scores
    
    async def get_employees_availability(self, branch_id: Optional[str] = None) -> List[Dict]:
        """Get employee availability and preferences"""
        query = {"status": "active"}
        if branch_id:
            query["branch_id"] = branch_id
        
        employees = await self.db.employees.find(query, {"_id": 0}).to_list(500)
        
        # Get leave requests for the next week
        next_week = datetime.now(timezone.utc) + timedelta(days=7)
        leaves = await self.db.leave_requests.find({
            "status": "approved",
            "start_date": {"$lte": next_week.isoformat()},
            "end_date": {"$gte": datetime.now(timezone.utc).isoformat()}
        }, {"_id": 0}).to_list(500)
        
        leave_map = {l["employee_id"]: l for l in leaves}
        
        result = []
        for emp in employees:
            emp_data = {
                "id": emp["id"],
                "name": emp.get("name", "Unknown"),
                "branch_id": emp.get("branch_id"),
                "job_title": emp.get("job_title", "Staff"),
                "skills": emp.get("skills", []),
                "on_leave": emp["id"] in leave_map,
                "leave_dates": leave_map.get(emp["id"], {}),
                "preferences": emp.get("shift_preferences", {}),
                "max_hours_per_week": emp.get("max_hours_per_week", 48),
                "min_hours_per_week": emp.get("min_hours_per_week", 20),
            }
            result.append(emp_data)
        
        return result
    
    async def generate_schedule(
        self,
        branch_id: Optional[str] = None,
        start_date: Optional[str] = None,
        days: int = 7,
        shift_duration: int = 8,
        min_staff_per_shift: int = 2,
        max_staff_per_shift: int = 5
    ) -> Dict[str, Any]:
        """Generate optimized weekly schedule"""
        
        # Get peak hours data
        peak_hours = await self.get_peak_hours_data()
        
        # Get available employees
        employees = await self.get_employees_availability(branch_id)
        available_employees = [e for e in employees if not e["on_leave"]]
        
        if not available_employees:
            return {
                "success": False,
                "error": "No available employees found",
                "schedule": []
            }
        
        # Parse start date
        if start_date:
            schedule_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        else:
            # Start from next Monday
            today = datetime.now(timezone.utc)
            days_until_monday = (7 - today.weekday()) % 7
            if days_until_monday == 0:
                days_until_monday = 7
            schedule_start = today + timedelta(days=days_until_monday)
            schedule_start = schedule_start.replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Define shift types based on peak hours
        shifts = self._define_shifts(peak_hours, shift_duration)
        
        # Generate schedule
        schedule = []
        employee_hours = {e["id"]: 0 for e in available_employees}
        
        for day_offset in range(days):
            day_date = schedule_start + timedelta(days=day_offset)
            day_name = day_date.strftime("%A")
            day_str = day_date.strftime("%Y-%m-%d")
            
            day_schedule = {
                "date": day_str,
                "day": day_name,
                "shifts": []
            }
            
            for shift in shifts:
                # Determine staff needed based on peak hour score
                avg_peak_score = sum(peak_hours.get(h, 0) for h in range(shift["start"], shift["end"])) / (shift["end"] - shift["start"])
                
                # Scale staff between min and max based on peak score
                staff_needed = min_staff_per_shift + int((max_staff_per_shift - min_staff_per_shift) * avg_peak_score)
                
                # Assign employees
                assigned = []
                
                # Sort employees by hours worked (least first for fairness)
                sorted_employees = sorted(available_employees, key=lambda e: employee_hours[e["id"]])
                
                for emp in sorted_employees:
                    if len(assigned) >= staff_needed:
                        break
                    
                    # Check if employee can work this shift
                    if employee_hours[emp["id"]] + shift_duration > emp.get("max_hours_per_week", 48):
                        continue
                    
                    # Check preferences (if any)
                    prefs = emp.get("preferences", {})
                    if prefs.get("preferred_shift") and prefs["preferred_shift"] != shift["name"]:
                        # 30% chance to assign anyway for coverage
                        if random.random() > 0.3:
                            continue
                    
                    assigned.append({
                        "employee_id": emp["id"],
                        "employee_name": emp["name"],
                        "job_title": emp.get("job_title", "Staff")
                    })
                    employee_hours[emp["id"]] += shift_duration
                
                day_schedule["shifts"].append({
                    "name": shift["name"],
                    "start_time": f"{shift['start']:02d}:00",
                    "end_time": f"{shift['end']:02d}:00",
                    "duration_hours": shift_duration,
                    "staff_needed": staff_needed,
                    "staff_assigned": len(assigned),
                    "peak_score": round(avg_peak_score, 2),
                    "employees": assigned
                })
            
            schedule.append(day_schedule)
        
        # Calculate summary stats
        total_shifts = sum(len(d["shifts"]) for d in schedule)
        total_staff_slots = sum(sum(s["staff_assigned"] for s in d["shifts"]) for d in schedule)
        understaffed_shifts = sum(1 for d in schedule for s in d["shifts"] if s["staff_assigned"] < s["staff_needed"])
        
        return {
            "success": True,
            "schedule": schedule,
            "summary": {
                "start_date": schedule_start.strftime("%Y-%m-%d"),
                "end_date": (schedule_start + timedelta(days=days-1)).strftime("%Y-%m-%d"),
                "total_days": days,
                "total_shifts": total_shifts,
                "total_staff_assignments": total_staff_slots,
                "understaffed_shifts": understaffed_shifts,
                "coverage_rate": round((1 - understaffed_shifts / total_shifts) * 100, 1) if total_shifts > 0 else 100
            },
            "employee_hours": [
                {"employee_id": eid, "hours": hours, "employee_name": next((e["name"] for e in available_employees if e["id"] == eid), "Unknown")}
                for eid, hours in employee_hours.items()
            ],
            "peak_hours_analysis": {
                "busiest_hours": sorted(peak_hours.items(), key=lambda x: x[1], reverse=True)[:5],
                "slowest_hours": sorted(peak_hours.items(), key=lambda x: x[1])[:5]
            }
        }
    
    def _define_shifts(self, peak_hours: Dict[int, float], shift_duration: int) -> List[Dict]:
        """Define shift types based on business hours and peaks"""
        
        # Find business hours (hours with any activity)
        active_hours = [h for h, score in peak_hours.items() if score > 0.05]
        
        if not active_hours:
            # Default shifts if no data
            return [
                {"name": "Morning", "start": 8, "end": 16},
                {"name": "Evening", "start": 16, "end": 24}
            ]
        
        start_hour = min(active_hours)
        end_hour = max(active_hours) + 1
        
        # Create shifts based on duration
        shifts = []
        current = start_hour
        shift_names = ["Morning", "Afternoon", "Evening", "Night"]
        
        i = 0
        while current < end_hour:
            shift_end = min(current + shift_duration, end_hour)
            shifts.append({
                "name": shift_names[i % len(shift_names)],
                "start": current,
                "end": shift_end
            })
            current = shift_end
            i += 1
        
        return shifts
    
    async def save_schedule(self, schedule_data: Dict, created_by: str) -> str:
        """Save generated schedule to database"""
        schedule_id = f"schedule_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        doc = {
            "id": schedule_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": created_by,
            "status": "draft",
            **schedule_data
        }
        
        await self.db.shift_schedules.insert_one(doc)
        return schedule_id
    
    async def get_schedule(self, schedule_id: str) -> Optional[Dict]:
        """Get a saved schedule"""
        return await self.db.shift_schedules.find_one({"id": schedule_id}, {"_id": 0})
    
    async def publish_schedule(self, schedule_id: str, published_by: str) -> bool:
        """Publish a schedule (make it active)"""
        result = await self.db.shift_schedules.update_one(
            {"id": schedule_id},
            {
                "$set": {
                    "status": "published",
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "published_by": published_by
                }
            }
        )
        return result.modified_count > 0
