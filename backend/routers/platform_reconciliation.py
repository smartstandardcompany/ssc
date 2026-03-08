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
    platforms = await db.delivery_platforms.find({}, {"_id": 0}).to_list(50)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}

    # Build date filter for sales - match online/online_platform types or any sale with platform_id
    sale_filter = {"$or": [
        {"sale_type": {"$in": ["online_delivery", "online", "online_platform"]}},
        {"platform_id": {"$exists": True, "$ne": None}}
    ]}
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
            pdata = platform_map.get(pid, {})
            pname = pdata.get("name", "Unknown Platform")
            comm_rate = pdata.get("commission_rate", 0) or 0
            proc_fee = pdata.get("processing_fee", 0) or 0
            platform_summary[pid] = {
                "platform_id": pid,
                "platform_name": pname,
                "commission_rate": comm_rate,
                "processing_fee": proc_fee,
                "total_sales": 0,
                "total_received": 0,
                "platform_cut": 0,
                "expected_fee": 0,
                "expected_received": 0,
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
            bname = rec.get("branch_name")
            if bname and bname in platform_summary[pid]["by_branch"]:
                platform_summary[pid]["by_branch"][bname]["received"] += rec.get("amount", 0)

    # Calculate cuts + expected fees
    for pid, ps in platform_summary.items():
        comm_rate = ps["commission_rate"]
        proc_fee = ps["processing_fee"]
        # Expected fee = (commission_rate% of sales) + (processing_fee * order_count)
        expected_commission = ps["total_sales"] * (comm_rate / 100) if comm_rate > 0 else 0
        expected_processing = proc_fee * ps["sales_count"] if proc_fee > 0 else 0
        ps["expected_fee"] = round(expected_commission + expected_processing, 2)
        ps["expected_received"] = round(ps["total_sales"] - ps["expected_fee"], 2)

        ps["platform_cut"] = round(ps["total_sales"] - ps["total_received"], 2)
        if ps["total_sales"] > 0:
            ps["cut_percentage"] = round((ps["platform_cut"] / ps["total_sales"]) * 100, 2)
        for bname, bd in ps["by_branch"].items():
            bd["cut"] = round(bd["sales"] - bd["received"], 2)
            bd["expected_fee"] = round(bd["sales"] * (comm_rate / 100) + proc_fee * bd["count"], 2) if comm_rate > 0 or proc_fee > 0 else 0
            bd["sales"] = round(bd["sales"], 2)
            bd["received"] = round(bd["received"], 2)
        ps["total_sales"] = round(ps["total_sales"], 2)
        ps["total_received"] = round(ps["total_received"], 2)

    total_expected_fee = round(sum(p["expected_fee"] for p in platform_summary.values()), 2)

    return {
        "platforms": list(platform_summary.values()),
        "total_online_sales": round(sum(p["total_sales"] for p in platform_summary.values()), 2),
        "total_received": round(sum(p["total_received"] for p in platform_summary.values()), 2),
        "total_platform_cut": round(sum(p["platform_cut"] for p in platform_summary.values()), 2),
        "total_expected_fee": total_expected_fee,
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


@router.get("/platform-reconciliation/monthly-report")
async def get_monthly_reconciliation_report(
    months: int = 6,
    current_user: User = Depends(get_current_user)
):
    """Generate a monthly reconciliation report for the last N months."""
    from datetime import timedelta
    from calendar import monthrange

    platforms = await db.delivery_platforms.find({"is_active": True}, {"_id": 0}).to_list(50)
    platform_map = {p["id"]: p for p in platforms}

    now = datetime.now(timezone.utc)
    monthly_data = []

    for i in range(months):
        # Calculate month boundaries
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        _, last_day = monthrange(year, month)
        start = f"{year}-{month:02d}-01"
        end = f"{year}-{month:02d}-{last_day:02d}"
        month_label = f"{year}-{month:02d}"

        # Get sales for this month
        sale_filter = {
            "$or": [
                {"sale_type": {"$in": ["online_delivery", "online", "online_platform"]}},
                {"platform_id": {"$exists": True, "$ne": None}}
            ],
            "date": {"$gte": start + "T00:00:00", "$lte": end + "T23:59:59"}
        }
        sales = await db.sales.find(sale_filter, {"_id": 0, "platform_id": 1, "final_amount": 1, "amount": 1}).to_list(100000)

        # Get reconciliation records for this month
        recon_records = await db.platform_reconciliations.find(
            {"date": {"$gte": start, "$lte": end}}, {"_id": 0}
        ).to_list(10000)

        # Build per-platform summary for this month
        platform_months = {}
        for sale in sales:
            pid = sale.get("platform_id")
            if not pid:
                continue
            amount = sale.get("final_amount") or sale.get("amount", 0)
            if pid not in platform_months:
                pdata = platform_map.get(pid, {})
                platform_months[pid] = {
                    "platform_id": pid,
                    "platform_name": pdata.get("name", "Unknown"),
                    "commission_rate": pdata.get("commission_rate", 0) or 0,
                    "processing_fee": pdata.get("processing_fee", 0) or 0,
                    "total_sales": 0,
                    "total_received": 0,
                    "sales_count": 0,
                }
            platform_months[pid]["total_sales"] += amount
            platform_months[pid]["sales_count"] += 1

        for rec in recon_records:
            pid = rec.get("platform_id")
            if pid and pid in platform_months:
                platform_months[pid]["total_received"] += rec.get("amount", 0)

        # Calculate fees for each platform this month
        month_platforms = []
        for pid, pm in platform_months.items():
            comm = pm["commission_rate"]
            proc = pm["processing_fee"]
            expected_fee = round(pm["total_sales"] * (comm / 100) + proc * pm["sales_count"], 2)
            actual_cut = round(pm["total_sales"] - pm["total_received"], 2)
            month_platforms.append({
                **pm,
                "total_sales": round(pm["total_sales"], 2),
                "total_received": round(pm["total_received"], 2),
                "expected_fee": expected_fee,
                "expected_received": round(pm["total_sales"] - expected_fee, 2),
                "actual_cut": actual_cut,
                "variance": round(actual_cut - expected_fee, 2),
            })

        total_sales = round(sum(p["total_sales"] for p in month_platforms), 2)
        total_received = round(sum(p["total_received"] for p in month_platforms), 2)
        total_expected = round(sum(p["expected_fee"] for p in month_platforms), 2)
        total_actual_cut = round(total_sales - total_received, 2)

        monthly_data.append({
            "month": month_label,
            "month_name": datetime(year, month, 1).strftime("%B %Y"),
            "platforms": sorted(month_platforms, key=lambda x: x["total_sales"], reverse=True),
            "total_sales": total_sales,
            "total_received": total_received,
            "total_expected_fee": total_expected,
            "total_actual_cut": total_actual_cut,
            "total_variance": round(total_actual_cut - total_expected, 2),
            "order_count": sum(p["sales_count"] for p in month_platforms),
        })

    return {"months": monthly_data, "platforms": [{
        "id": p["id"], "name": p["name"],
        "commission_rate": p.get("commission_rate", 0),
        "processing_fee": p.get("processing_fee", 0),
    } for p in platforms]}
