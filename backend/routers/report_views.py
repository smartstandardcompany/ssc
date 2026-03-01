from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user
from models import User

router = APIRouter()


class ReportViewCreate(BaseModel):
    name: str
    report_type: str  # 'sales', 'expenses', 'employees', 'customers', etc.
    filters: dict = {}  # date_range, branch, category, etc.
    columns: list = []  # visible columns
    sort_by: Optional[str] = None
    sort_order: Optional[str] = "desc"


class ReportViewUpdate(BaseModel):
    name: Optional[str] = None
    filters: Optional[dict] = None
    columns: Optional[list] = None
    sort_by: Optional[str] = None
    sort_order: Optional[str] = None


@router.get("/report-views")
async def list_report_views(report_type: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"user_id": current_user.id}
    if report_type:
        query["report_type"] = report_type
    views = await db.report_views.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return views


@router.post("/report-views")
async def create_report_view(view: ReportViewCreate, current_user: User = Depends(get_current_user)):
    view_dict = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "name": view.name,
        "report_type": view.report_type,
        "filters": view.filters,
        "columns": view.columns,
        "sort_by": view.sort_by,
        "sort_order": view.sort_order,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.report_views.insert_one(view_dict)
    del view_dict["_id"]
    return view_dict


@router.put("/report-views/{view_id}")
async def update_report_view(view_id: str, update: ReportViewUpdate, current_user: User = Depends(get_current_user)):
    existing = await db.report_views.find_one({"id": view_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="View not found")

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in ["name", "filters", "columns", "sort_by", "sort_order"]:
        val = getattr(update, field)
        if val is not None:
            updates[field] = val

    await db.report_views.update_one({"id": view_id}, {"$set": updates})
    return {"message": "Updated"}


@router.delete("/report-views/{view_id}")
async def delete_report_view(view_id: str, current_user: User = Depends(get_current_user)):
    result = await db.report_views.delete_one({"id": view_id, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="View not found")
    return {"message": "Deleted"}


@router.get("/report-views/data/{report_type}")
async def get_report_data(
    report_type: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branch_id: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get filtered report data for any report type."""
    query = {}
    date_field = "date"

    if start_date and end_date:
        query[date_field] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query[date_field] = {"$gte": start_date}
    elif end_date:
        query[date_field] = {"$lte": end_date}

    if branch_id:
        query["branch_id"] = branch_id

    collection_map = {
        "sales": "sales",
        "expenses": "expenses",
        "supplier_payments": "supplier_payments",
        "employees": "employees",
        "customers": "customers",
        "stock": "items",
        "leaves": "leaves",
        "loans": "loans"
    }

    col_name = collection_map.get(report_type)
    if not col_name:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")

    collection = db[col_name]

    # Special handling for non-date collections
    if report_type in ("employees", "customers", "stock"):
        if "date" in query:
            del query["date"]
        if category and report_type == "expenses":
            query["category"] = category
        if category and report_type == "stock":
            query["category"] = category

    if category and report_type == "expenses":
        query["category"] = category

    docs = await collection.find(query, {"_id": 0}).to_list(10000)

    # Calculate summary stats
    summary = {"total_records": len(docs)}
    if report_type == "sales":
        summary["total_amount"] = round(sum(d.get("amount", 0) for d in docs), 2)
        summary["total_discount"] = round(sum(d.get("discount", 0) for d in docs), 2)
        summary["total_net"] = round(sum(d.get("final_amount", d.get("amount", 0) - d.get("discount", 0)) for d in docs), 2)
    elif report_type == "expenses":
        summary["total_amount"] = round(sum(d.get("amount", 0) for d in docs), 2)
        cats = {}
        for d in docs:
            c = d.get("category", "other")
            cats[c] = cats.get(c, 0) + d.get("amount", 0)
        summary["by_category"] = {k: round(v, 2) for k, v in sorted(cats.items(), key=lambda x: -x[1])}

    return {"data": docs, "summary": summary, "filters_applied": {"start_date": start_date, "end_date": end_date, "branch_id": branch_id, "category": category}}
