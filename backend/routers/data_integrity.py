from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from database import db, get_current_user
from models import User

router = APIRouter(prefix="/data-integrity", tags=["data-integrity"])

STANDARD_MODES = {"cash", "bank", "credit", "online", "online_platform"}
MODE_MAP = {"card": "bank", "discount": None}


def safe_final(s):
    fa = s.get("final_amount")
    if fa is not None:
        return fa
    return s.get("amount", 0) - s.get("discount", 0)


@router.get("/scan")
async def scan_integrity(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        return {"error": "Admin only"}

    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}

    issues = []

    for s in sales:
        sale_id = s.get("id", "unknown")
        date_str = str(s.get("date", ""))[:10]
        branch = branch_map.get(s.get("branch_id"), "Unknown")
        amount = s.get("amount", 0)

        # Issue 1: Missing/null final_amount
        if s.get("final_amount") is None:
            expected = amount - s.get("discount", 0)
            issues.append({
                "id": f"null_final_{sale_id}",
                "sale_id": sale_id,
                "type": "missing_final_amount",
                "severity": "high",
                "module": "sales",
                "date": date_str,
                "branch": branch,
                "description": f"Sale of SAR {amount:.2f} has no final_amount",
                "current_value": None,
                "suggested_fix": f"Set final_amount to SAR {expected:.2f} (amount - discount)",
                "fix_value": expected,
            })

        # Issue 2: Payment total mismatch
        pd = s.get("payment_details") or []
        pd_sum = sum(p.get("amount", 0) for p in pd)
        fa = safe_final(s)
        if pd_sum > 0 and abs(pd_sum - fa) > 0.01:
            issues.append({
                "id": f"pd_mismatch_{sale_id}",
                "sale_id": sale_id,
                "type": "payment_mismatch",
                "severity": "medium",
                "module": "sales",
                "date": date_str,
                "branch": branch,
                "description": f"Payment details total SAR {pd_sum:.2f} != final amount SAR {fa:.2f} (diff: SAR {abs(pd_sum - fa):.2f})",
                "current_value": pd_sum,
                "suggested_fix": f"Review payment details — total should equal SAR {fa:.2f}",
                "fix_value": None,
            })

        # Issue 3: Unusual payment modes
        for idx, p in enumerate(pd):
            mode = p.get("mode", "")
            if mode and mode not in STANDARD_MODES:
                mapped = MODE_MAP.get(mode)
                issues.append({
                    "id": f"mode_{sale_id}_{idx}",
                    "sale_id": sale_id,
                    "type": "unusual_mode",
                    "severity": "low",
                    "module": "sales",
                    "date": date_str,
                    "branch": branch,
                    "description": f"Payment mode '{mode}' (SAR {p.get('amount', 0):.2f}) is non-standard",
                    "current_value": mode,
                    "suggested_fix": f"Change to '{mapped}'" if mapped else f"Remove '{mode}' entry or reclassify",
                    "fix_value": mapped,
                })

    # Summary counts
    summary = {
        "total_issues": len(issues),
        "by_type": {},
        "by_severity": {"high": 0, "medium": 0, "low": 0},
        "total_sales_scanned": len(sales),
    }
    for i in issues:
        t = i["type"]
        summary["by_type"][t] = summary["by_type"].get(t, 0) + 1
        summary["by_severity"][i["severity"]] += 1

    return {"summary": summary, "issues": issues}


class FixRequest(BaseModel):
    issue_type: str
    sale_id: str
    fix_value: Optional[float] = None
    fix_mode: Optional[str] = None
    payment_index: Optional[int] = None


@router.post("/fix")
async def fix_issue(request: FixRequest, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        return {"error": "Admin only"}

    sale = await db.sales.find_one({"id": request.sale_id})
    if not sale:
        return {"error": "Sale not found", "success": False}

    if request.issue_type == "missing_final_amount":
        amount = sale.get("amount", 0)
        discount = sale.get("discount", 0)
        new_final = request.fix_value if request.fix_value is not None else (amount - discount)
        await db.sales.update_one({"id": request.sale_id}, {"$set": {"final_amount": new_final}})
        return {"success": True, "message": f"Set final_amount to {new_final:.2f}"}

    elif request.issue_type == "unusual_mode":
        if request.fix_mode and request.payment_index is not None:
            pd = sale.get("payment_details", [])
            if 0 <= request.payment_index < len(pd):
                pd[request.payment_index]["mode"] = request.fix_mode
                await db.sales.update_one({"id": request.sale_id}, {"$set": {"payment_details": pd}})
                return {"success": True, "message": f"Changed mode to '{request.fix_mode}'"}
        return {"error": "Invalid fix parameters", "success": False}

    return {"error": "Unsupported fix type", "success": False}


class BulkFixRequest(BaseModel):
    issue_type: str


@router.post("/fix-all")
async def fix_all(request: BulkFixRequest, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        return {"error": "Admin only"}

    fixed = 0

    if request.issue_type == "missing_final_amount":
        sales = await db.sales.find({"final_amount": None}, {"_id": 0, "id": 1, "amount": 1, "discount": 1}).to_list(10000)
        for s in sales:
            new_final = s.get("amount", 0) - s.get("discount", 0)
            await db.sales.update_one({"id": s["id"]}, {"$set": {"final_amount": new_final}})
            fixed += 1
        # Also fix sales where final_amount field doesn't exist
        missing = await db.sales.find({"final_amount": {"$exists": False}}, {"_id": 0, "id": 1, "amount": 1, "discount": 1}).to_list(10000)
        for s in missing:
            new_final = s.get("amount", 0) - s.get("discount", 0)
            await db.sales.update_one({"id": s["id"]}, {"$set": {"final_amount": new_final}})
            fixed += 1

    elif request.issue_type == "unusual_mode":
        sales = await db.sales.find({"payment_details.mode": {"$nin": list(STANDARD_MODES)}}).to_list(10000)
        for sale in sales:
            pd = sale.get("payment_details", [])
            changed = False
            new_pd = []
            for p in pd:
                mode = p.get("mode", "")
                if mode in MODE_MAP:
                    mapped = MODE_MAP[mode]
                    if mapped:
                        p["mode"] = mapped
                        new_pd.append(p)
                        changed = True
                    else:
                        changed = True  # skip discount entries
                else:
                    new_pd.append(p)
            if changed:
                await db.sales.update_one({"_id": sale["_id"]}, {"$set": {"payment_details": new_pd}})
                fixed += 1

    return {"success": True, "fixed_count": fixed, "message": f"Fixed {fixed} records"}
