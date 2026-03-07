from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from database import db, get_current_user
from models import User
import uuid

router = APIRouter()


@router.get("/report-templates")
async def get_report_templates(current_user: User = Depends(get_current_user)):
    """Get all saved report templates."""
    templates = await db.report_templates.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return templates


@router.post("/report-templates")
async def create_report_template(body: dict, current_user: User = Depends(get_current_user)):
    """Create a new report template."""
    template = {
        "id": str(uuid.uuid4()),
        "name": body["name"],
        "description": body.get("description", ""),
        "data_source": body["data_source"],
        "columns": body.get("columns", []),
        "filters": body.get("filters", {}),
        "group_by": body.get("group_by"),
        "sort_by": body.get("sort_by"),
        "sort_order": body.get("sort_order", "desc"),
        "chart_type": body.get("chart_type"),
        "created_by": current_user.email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.report_templates.insert_one(template)
    template.pop("_id", None)
    return template


@router.put("/report-templates/{template_id}")
async def update_report_template(template_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update a report template."""
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    body.pop("id", None)
    body.pop("_id", None)
    result = await db.report_templates.update_one({"id": template_id}, {"$set": body})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    template = await db.report_templates.find_one({"id": template_id}, {"_id": 0})
    return template


@router.delete("/report-templates/{template_id}")
async def delete_report_template(template_id: str, current_user: User = Depends(get_current_user)):
    """Delete a report template."""
    result = await db.report_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}


@router.post("/report-templates/{template_id}/run")
async def run_report_template(template_id: str, body: dict = {}, current_user: User = Depends(get_current_user)):
    """Execute a report template and return results."""
    template = await db.report_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    source = template["data_source"]
    filters = {**template.get("filters", {}), **body.get("filters", {})}
    columns = template.get("columns", [])
    group_by = template.get("group_by")
    sort_by = template.get("sort_by")
    sort_order = 1 if template.get("sort_order") == "asc" else -1

    # Map data sources to collections
    source_map = {
        "sales": "sales",
        "expenses": "expenses",
        "supplier_payments": "supplier_payments",
        "customers": "customers",
        "employees": "employees",
        "invoices": "invoices",
        "stock": "stock_items",
        "activity_logs": "activity_logs",
    }

    collection_name = source_map.get(source)
    if not collection_name:
        raise HTTPException(status_code=400, detail=f"Invalid data source: {source}")

    collection = db[collection_name]

    # Build query from filters
    query = {}
    if filters.get("start_date"):
        date_field = "date" if source in ("sales", "expenses", "supplier_payments") else "created_at"
        query[date_field] = {"$gte": filters["start_date"]}
        if filters.get("end_date"):
            query[date_field]["$lte"] = filters["end_date"] + "T23:59:59"
    if filters.get("branch_id"):
        query["branch_id"] = filters["branch_id"]
    if filters.get("category"):
        query["category"] = filters["category"]
    if filters.get("payment_mode"):
        query["payment_mode"] = filters["payment_mode"]

    # Fetch data
    projection = {"_id": 0}
    sort_field = sort_by or "date"
    records = await collection.find(query, projection).sort(sort_field, sort_order).to_list(5000)

    # Filter columns if specified
    if columns:
        records = [{k: r.get(k) for k in columns if k in r} for r in records]

    # Compute summary
    summary = {"total_records": len(records)}
    if source in ("sales", "expenses", "supplier_payments"):
        amounts = [r.get("amount", 0) for r in records if isinstance(r.get("amount"), (int, float))]
        summary["total_amount"] = sum(amounts)
        summary["avg_amount"] = sum(amounts) / len(amounts) if amounts else 0
        summary["min_amount"] = min(amounts) if amounts else 0
        summary["max_amount"] = max(amounts) if amounts else 0

    return {
        "template": template,
        "data": records[:500],
        "summary": summary,
        "total": len(records),
        "truncated": len(records) > 500,
    }


@router.get("/reports/comparative")
async def get_comparative_analysis(
    period: str = "month",
    current_user: User = Depends(get_current_user)
):
    """Get comparative period analysis (this period vs last period)."""
    now = datetime.now(timezone.utc)

    if period == "week":
        current_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = current_start - timedelta(weeks=1)
        prev_end = current_start - timedelta(seconds=1)
        label_current = "This Week"
        label_prev = "Last Week"
    elif period == "month":
        current_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = current_start - timedelta(seconds=1)
        prev_start = prev_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        label_current = "This Month"
        label_prev = "Last Month"
    elif period == "year":
        current_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_end = current_start - timedelta(seconds=1)
        prev_start = prev_end.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        label_current = "This Year"
        label_prev = "Last Year"
    else:
        current_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = current_start - timedelta(days=1)
        prev_end = current_start - timedelta(seconds=1)
        label_current = "Today"
        label_prev = "Yesterday"

    cs = current_start.isoformat()
    ps = prev_start.isoformat()
    pe = prev_end.isoformat()
    ns = now.isoformat()

    # Current period
    curr_sales = await db.sales.find({"date": {"$gte": cs, "$lte": ns}}, {"_id": 0, "amount": 1}).to_list(50000)
    curr_expenses = await db.expenses.find({"date": {"$gte": cs, "$lte": ns}}, {"_id": 0, "amount": 1}).to_list(50000)
    curr_sp = await db.supplier_payments.find({"date": {"$gte": cs, "$lte": ns}}, {"_id": 0, "amount": 1}).to_list(50000)

    # Previous period
    prev_sales = await db.sales.find({"date": {"$gte": ps, "$lte": pe}}, {"_id": 0, "amount": 1}).to_list(50000)
    prev_expenses = await db.expenses.find({"date": {"$gte": ps, "$lte": pe}}, {"_id": 0, "amount": 1}).to_list(50000)
    prev_sp = await db.supplier_payments.find({"date": {"$gte": ps, "$lte": pe}}, {"_id": 0, "amount": 1}).to_list(50000)

    def total(records):
        return sum(r.get("amount", 0) for r in records)

    def change_pct(curr, prev):
        if prev == 0:
            return 100.0 if curr > 0 else 0
        return ((curr - prev) / prev) * 100

    cs_total = total(curr_sales)
    ps_total = total(prev_sales)
    ce_total = total(curr_expenses)
    pe_total = total(prev_expenses)
    csp_total = total(curr_sp)
    psp_total = total(prev_sp)

    metrics = [
        {
            "label": "Sales",
            "current": cs_total,
            "previous": ps_total,
            "change_pct": round(change_pct(cs_total, ps_total), 1),
            "current_count": len(curr_sales),
            "previous_count": len(prev_sales),
        },
        {
            "label": "Expenses",
            "current": ce_total,
            "previous": pe_total,
            "change_pct": round(change_pct(ce_total, pe_total), 1),
            "current_count": len(curr_expenses),
            "previous_count": len(prev_expenses),
        },
        {
            "label": "Supplier Payments",
            "current": csp_total,
            "previous": psp_total,
            "change_pct": round(change_pct(csp_total, psp_total), 1),
            "current_count": len(curr_sp),
            "previous_count": len(prev_sp),
        },
        {
            "label": "Net Profit",
            "current": cs_total - ce_total,
            "previous": ps_total - pe_total,
            "change_pct": round(change_pct(cs_total - ce_total, ps_total - pe_total), 1),
        },
        {
            "label": "Avg Sale",
            "current": cs_total / len(curr_sales) if curr_sales else 0,
            "previous": ps_total / len(prev_sales) if prev_sales else 0,
            "change_pct": round(change_pct(
                cs_total / len(curr_sales) if curr_sales else 0,
                ps_total / len(prev_sales) if prev_sales else 0,
            ), 1),
        },
    ]

    return {
        "current_label": label_current,
        "previous_label": label_prev,
        "period": period,
        "metrics": metrics,
    }
