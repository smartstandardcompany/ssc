from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user, require_permission
from models import User

router = APIRouter()


@router.get("/platform-reconciliation/summary")
async def get_platform_reconciliation(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Calculate platform sales vs received amounts, showing platform cuts per branch."""
    platforms = await db.platforms.find({}, {"_id": 0}).to_list(50)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}

    # Build date filter for sales
    sale_filter = {"sale_type": "online_delivery"}
    if start_date or end_date:
        date_f = {}
        if start_date:
            date_f["$gte"] = start_date + "T00:00:00"
        if end_date:
            date_f["$lte"] = end_date + "T23:59:59"
        if date_f:
            sale_filter["date"] = date_f

    # Get all online sales
    sales = await db.sales.find(sale_filter, {"_id": 0}).to_list(100000)

    # Get all reconciliation records (received amounts)
    recon_filter = {}
    if start_date or end_date:
        date_f = {}
        if start_date:
            date_f["$gte"] = start_date
        if end_date:
            date_f["$lte"] = end_date
        if date_f:
            recon_filter["date"] = date_f
    recon_records = await db.platform_reconciliations.find(recon_filter, {"_id": 0}).to_list(10000)

    # Build summary per platform
    platform_map = {p["id"]: p for p in platforms}
    platform_summary = {}

    for sale in sales:
        pid = sale.get("platform_id")
        bid = sale.get("branch_id")
        amount = sale.get("final_amount") or sale.get("amount", 0)
        if not pid:
            continue
        if pid not in platform_summary:
            pname = platform_map.get(pid, {}).get("name", "Unknown Platform")
            platform_summary[pid] = {
                "platform_id": pid,
                "platform_name": pname,
                "total_sales": 0,
                "total_received": 0,
                "platform_cut": 0,
                "cut_percentage": 0,
                "sales_count": 0,
                "by_branch": {},
            }
        ps = platform_summary[pid]
        ps["total_sales"] += amount
        ps["sales_count"] += 1
        bname = branch_map.get(bid, "Unknown")
        if bname not in ps["by_branch"]:
            ps["by_branch"][bname] = {"sales": 0, "received": 0, "cut": 0, "count": 0}
        ps["by_branch"][bname]["sales"] += amount
        ps["by_branch"][bname]["count"] += 1

    # Apply received amounts from reconciliation records
    for rec in recon_records:
        pid = rec.get("platform_id")
        if pid and pid in platform_summary:
            platform_summary[pid]["total_received"] += rec.get("amount", 0)
            # If branch-specific
            bname = rec.get("branch_name")
            if bname and bname in platform_summary[pid]["by_branch"]:
                platform_summary[pid]["by_branch"][bname]["received"] += rec.get("amount", 0)

    # Calculate cuts
    for pid, ps in platform_summary.items():
        ps["platform_cut"] = round(ps["total_sales"] - ps["total_received"], 2)
        if ps["total_sales"] > 0:
            ps["cut_percentage"] = round((ps["platform_cut"] / ps["total_sales"]) * 100, 2)
        for bname, bd in ps["by_branch"].items():
            bd["cut"] = round(bd["sales"] - bd["received"], 2)
            bd["sales"] = round(bd["sales"], 2)
            bd["received"] = round(bd["received"], 2)
        ps["total_sales"] = round(ps["total_sales"], 2)
        ps["total_received"] = round(ps["total_received"], 2)

    return {
        "platforms": list(platform_summary.values()),
        "total_online_sales": round(sum(p["total_sales"] for p in platform_summary.values()), 2),
        "total_received": round(sum(p["total_received"] for p in platform_summary.values()), 2),
        "total_platform_cut": round(sum(p["platform_cut"] for p in platform_summary.values()), 2),
    }


@router.post("/platform-reconciliation/receive")
async def record_platform_payment(data: dict, current_user: User = Depends(get_current_user)):
    """Record a received payment from a platform."""
    require_permission(current_user, "sales", "write")
    record = {
        "id": str(uuid.uuid4()),
        "platform_id": data["platform_id"],
        "amount": float(data["amount"]),
        "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "branch_name": data.get("branch_name"),
        "notes": data.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
    }
    await db.platform_reconciliations.insert_one(record)
    record.pop("_id", None)
    return record


@router.get("/platform-reconciliation/history")
async def get_reconciliation_history(current_user: User = Depends(get_current_user)):
    """Get all recorded platform payments."""
    records = await db.platform_reconciliations.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return records


@router.delete("/platform-reconciliation/{record_id}")
async def delete_reconciliation(record_id: str, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "sales", "write")
    result = await db.platform_reconciliations.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Deleted"}
