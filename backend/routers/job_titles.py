from fastapi import APIRouter, Depends

from database import db, get_current_user
from models import User, JobTitle

router = APIRouter()

DEFAULT_JOB_TITLES = [
    {"title": "Chef", "department": "Kitchen", "min_salary": 2000, "max_salary": 5000},
    {"title": "Sous Chef", "department": "Kitchen", "min_salary": 1800, "max_salary": 4000},
    {"title": "Line Cook", "department": "Kitchen", "min_salary": 1500, "max_salary": 3000},
    {"title": "Cashier", "department": "Front", "min_salary": 1500, "max_salary": 3000},
    {"title": "Waiter", "department": "Front", "min_salary": 1200, "max_salary": 2500},
    {"title": "Manager", "department": "Management", "min_salary": 4000, "max_salary": 8000},
    {"title": "Supervisor", "department": "Management", "min_salary": 3000, "max_salary": 6000},
    {"title": "Driver", "department": "Operations", "min_salary": 1500, "max_salary": 3000},
    {"title": "Cleaner", "department": "Operations", "min_salary": 1200, "max_salary": 2000},
    {"title": "Accountant", "department": "Finance", "min_salary": 3000, "max_salary": 6000},
    {"title": "Delivery", "department": "Operations", "min_salary": 1500, "max_salary": 3000},
    {"title": "Security", "department": "Operations", "min_salary": 1500, "max_salary": 2500},
    {"title": "Kitchen Helper", "department": "Kitchen", "min_salary": 1200, "max_salary": 2000},
    {"title": "Receptionist", "department": "Front", "min_salary": 1500, "max_salary": 3000},
    {"title": "Barista", "department": "Front", "min_salary": 1500, "max_salary": 3000},
]

@router.get("/job-titles")
async def get_job_titles(current_user: User = Depends(get_current_user)):
    titles = await db.job_titles.find({}, {"_id": 0}).to_list(200)
    if not titles:
        for jt in DEFAULT_JOB_TITLES:
            title_obj = JobTitle(**jt)
            td = title_obj.model_dump()
            td["created_at"] = td["created_at"].isoformat()
            await db.job_titles.insert_one(td)
        titles = await db.job_titles.find({}, {"_id": 0}).to_list(200)
    return titles

@router.post("/job-titles")
async def create_job_title(body: dict, current_user: User = Depends(get_current_user)):
    jt = JobTitle(
        title=body["title"], department=body.get("department", ""),
        min_salary=float(body.get("min_salary", 0)), max_salary=float(body.get("max_salary", 0)),
        description=body.get("description", "")
    )
    td = jt.model_dump()
    td["created_at"] = td["created_at"].isoformat()
    await db.job_titles.insert_one(td)
    return {k: v for k, v in td.items() if k != '_id'}

@router.put("/job-titles/{title_id}")
async def update_job_title(title_id: str, body: dict, current_user: User = Depends(get_current_user)):
    update_data = {}
    for field in ["title", "department", "min_salary", "max_salary", "description", "active"]:
        if field in body:
            update_data[field] = body[field]
    if "min_salary" in update_data:
        update_data["min_salary"] = float(update_data["min_salary"])
    if "max_salary" in update_data:
        update_data["max_salary"] = float(update_data["max_salary"])
    await db.job_titles.update_one({"id": title_id}, {"$set": update_data})
    updated = await db.job_titles.find_one({"id": title_id}, {"_id": 0})
    return updated

@router.delete("/job-titles/{title_id}")
async def delete_job_title(title_id: str, current_user: User = Depends(get_current_user)):
    await db.job_titles.delete_one({"id": title_id})
    return {"message": "Job title deleted"}
