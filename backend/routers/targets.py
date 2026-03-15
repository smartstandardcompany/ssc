from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from database import db, get_current_user, get_tenant_filter, stamp_tenant
from models import User

router = APIRouter()


@router.get("/targets")
async def get_targets(current_user: User = Depends(get_current_user)):
    targets = await db.sales_targets.find(get_tenant_filter(current_user), {"_id": 0}).sort("month", -1).to_list(500)
    return targets


@router.post("/targets")
async def create_target(body: dict, current_user: User = Depends(get_current_user)):
    branch_id = body.get("branch_id")
    month = body.get("month")  # "2026-02"
    target_amount = body.get("target_amount", 0)
    if not branch_id or not month or not target_amount:
        raise HTTPException(status_code=400, detail="branch_id, month, and target_amount required")
    existing = await db.sales_targets.find_one({"branch_id": branch_id, "month": month}, {"_id": 0})
    if existing:
        await db.sales_targets.update_one(
            {"branch_id": branch_id, "month": month},
            {"$set": {"target_amount": float(target_amount), "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        existing["target_amount"] = float(target_amount)
        return existing
    target = {
        "id": str(uuid.uuid4()),
        "branch_id": branch_id,
        "month": month,
        "target_amount": float(target_amount),
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    stamp_tenant(target, current_user)
    await db.sales_targets.insert_one(target)
    return {k: v for k, v in target.items() if k != "_id"}


@router.get("/targets/progress")
async def get_target_progress(month: str = None, current_user: User = Depends(get_current_user)):
    """Get target vs actual for all branches for a given month."""
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    targets = await db.sales_targets.find({"month": month}, {"_id": 0}).to_list(100)
    branches = await db.branches.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100)
    start = f"{month}-01"
    end = f"{month}-31"
    sales = await db.sales.find({"date": {"$gte": start, "$lte": end + "T23:59:59"}}, {"_id": 0}).to_list(10000)

    result = []
    for b in branches:
        branch_sales = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales if s.get("branch_id") == b["id"])
        target = next((t for t in targets if t["branch_id"] == b["id"]), None)
        target_amt = target["target_amount"] if target else 0
        pct = round(branch_sales / target_amt * 100, 1) if target_amt > 0 else 0
        result.append({
            "branch_id": b["id"],
            "branch_name": b["name"],
            "target": target_amt,
            "actual": round(branch_sales, 2),
            "percentage": pct,
            "remaining": round(max(0, target_amt - branch_sales), 2),
        })
    # Sort by percentage descending
    result.sort(key=lambda x: -x["percentage"])
    # Overall
    total_target = sum(r["target"] for r in result)
    total_actual = sum(r["actual"] for r in result)
    overall_pct = round(total_actual / total_target * 100, 1) if total_target > 0 else 0
    return {
        "month": month,
        "overall": {"target": total_target, "actual": round(total_actual, 2), "percentage": overall_pct},
        "branches": result,
    }


@router.delete("/targets/{target_id}")
async def delete_target(target_id: str, current_user: User = Depends(get_current_user)):
    result = await db.sales_targets.delete_one({"id": target_id, **get_tenant_filter(current_user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Target not found")
    return {"message": "Target deleted"}
