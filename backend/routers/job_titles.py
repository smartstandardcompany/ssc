from fastapi import APIRouter, Depends

from database import db, get_current_user, get_tenant_filter, stamp_tenant
from models import User, JobTitle

router = APIRouter()

DEFAULT_JOB_TITLES = [
    {"title": "Chef", "department": "Kitchen", "min_salary": 2000, "max_salary": 5000, "permissions": ["kitchen", "stock"]},
    {"title": "Sous Chef", "department": "Kitchen", "min_salary": 1800, "max_salary": 4000, "permissions": ["kitchen", "stock"]},
    {"title": "Line Cook", "department": "Kitchen", "min_salary": 1500, "max_salary": 3000, "permissions": ["kitchen"]},
    {"title": "Cashier", "department": "Front", "min_salary": 1500, "max_salary": 3000, "permissions": ["sales", "invoices", "customers"]},
    {"title": "Waiter", "department": "Front", "min_salary": 1200, "max_salary": 2500, "permissions": ["sales"]},
    {"title": "Manager", "department": "Management", "min_salary": 4000, "max_salary": 8000, "permissions": ["dashboard", "sales", "invoices", "branches", "customers", "suppliers", "supplier_payments", "expenses", "employees", "stock", "kitchen", "shifts", "reports", "credit_report", "supplier_report", "documents", "cash_transfers"]},
    {"title": "Supervisor", "department": "Management", "min_salary": 3000, "max_salary": 6000, "permissions": ["dashboard", "sales", "invoices", "customers", "expenses", "stock", "kitchen", "shifts", "reports"]},
    {"title": "Driver", "department": "Operations", "min_salary": 1500, "max_salary": 3000, "permissions": []},
    {"title": "Cleaner", "department": "Operations", "min_salary": 1200, "max_salary": 2000, "permissions": []},
    {"title": "Accountant", "department": "Finance", "min_salary": 3000, "max_salary": 6000, "permissions": ["dashboard", "sales", "invoices", "expenses", "suppliers", "supplier_payments", "reports", "credit_report", "supplier_report", "cash_transfers"]},
    {"title": "Delivery", "department": "Operations", "min_salary": 1500, "max_salary": 3000, "permissions": ["sales"]},
    {"title": "Security", "department": "Operations", "min_salary": 1500, "max_salary": 2500, "permissions": []},
    {"title": "Kitchen Helper", "department": "Kitchen", "min_salary": 1200, "max_salary": 2000, "permissions": ["kitchen"]},
    {"title": "Receptionist", "department": "Front", "min_salary": 1500, "max_salary": 3000, "permissions": ["sales", "customers"]},
    {"title": "Barista", "department": "Front", "min_salary": 1500, "max_salary": 3000, "permissions": ["sales", "kitchen"]},
]

@router.get("/job-titles")
async def get_job_titles(current_user: User = Depends(get_current_user)):
    titles = await db.job_titles.find(get_tenant_filter(current_user), {"_id": 0}).to_list(200)
    if not titles:
        for jt in DEFAULT_JOB_TITLES:
            title_obj = JobTitle(**jt)
            td = title_obj.model_dump()
            td["created_at"] = td["created_at"].isoformat()
            stamp_tenant(td, current_user)
            await db.job_titles.insert_one(td)
        titles = await db.job_titles.find(get_tenant_filter(current_user), {"_id": 0}).to_list(200)
    return titles

@router.post("/job-titles")
async def create_job_title(body: dict, current_user: User = Depends(get_current_user)):
    jt = JobTitle(
        title=body["title"], department=body.get("department", ""),
        min_salary=float(body.get("min_salary", 0)), max_salary=float(body.get("max_salary", 0)),
        description=body.get("description", ""),
        permissions=body.get("permissions", [])
    )
    td = jt.model_dump()
    td["created_at"] = td["created_at"].isoformat()
    stamp_tenant(td, current_user)
    await db.job_titles.insert_one(td)
    return {k: v for k, v in td.items() if k != '_id'}

@router.put("/job-titles/{title_id}")
async def update_job_title(title_id: str, body: dict, current_user: User = Depends(get_current_user)):
    update_data = {}
    for field in ["title", "department", "min_salary", "max_salary", "description", "active", "permissions"]:
        if field in body:
            update_data[field] = body[field]
    if "min_salary" in update_data:
        update_data["min_salary"] = float(update_data["min_salary"])
    if "max_salary" in update_data:
        update_data["max_salary"] = float(update_data["max_salary"])
    await db.job_titles.update_one({"id": title_id, **get_tenant_filter(current_user)}, {"$set": update_data})
    updated = await db.job_titles.find_one({"id": title_id, **get_tenant_filter(current_user)}, {"_id": 0})
    # Sync permissions to all linked employees/users when permissions change
    if "permissions" in update_data:
        employees = await db.employees.find({"job_title_id": title_id}, {"_id": 0}).to_list(1000)
        for emp in employees:
            if emp.get("user_id"):
                user_doc = await db.users.find_one({"id": emp["user_id"], **get_tenant_filter(current_user)}, {"_id": 0})
                if user_doc:
                    base = {"self_service"} if user_doc.get("role") == "employee" else set()
                    merged = list(base | set(update_data["permissions"]))
                    await db.users.update_one({"id": emp["user_id"], **get_tenant_filter(current_user)}, {"$set": {"permissions": merged}})
    return updated

@router.delete("/job-titles/{title_id}")
async def delete_job_title(title_id: str, current_user: User = Depends(get_current_user)):
    await db.job_titles.delete_one({"id": title_id, **get_tenant_filter(current_user)})
    return {"message": "Job title deleted"}
