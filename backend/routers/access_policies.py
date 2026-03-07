from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from database import db, get_current_user, require_permission
from models import User

router = APIRouter()

DEFAULT_POLICIES = {
    "delete_policy": {
        "sales": "admin_only",
        "expenses": "admin_only",
        "supplier_payments": "admin_only",
        "stock": "admin_manager",
        "customers": "admin_manager",
        "invoices": "admin_only",
        "employees": "admin_only",
    },
    "delete_time_limit_hours": 24,
    "delete_time_limit_enabled": True,
    "visibility": {
        "operator_hide_financials": True,
        "operator_hide_profit": True,
        "operator_hide_analytics": False,
        "operator_hide_reports": False,
        "operator_hide_supplier_credit": True,
        "operator_hide_employee_salary": True,
    },
}


@router.get("/access-policies")
async def get_access_policies(current_user: User = Depends(get_current_user)):
    """Get current access policies."""
    policies = await db.access_policies.find_one({}, {"_id": 0})
    if not policies:
        policies = DEFAULT_POLICIES.copy()
    return policies


@router.put("/access-policies")
async def update_access_policies(body: dict, current_user: User = Depends(get_current_user)):
    """Update access policies (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    body["updated_by"] = current_user.email
    await db.access_policies.update_one({}, {"$set": body}, upsert=True)
    return await get_access_policies(current_user)


async def check_delete_permission(user, module: str, record_date: str = None):
    """Check if user has permission to delete a record based on policies."""
    if user.role == "admin":
        return True
    
    policies = await db.access_policies.find_one({}, {"_id": 0})
    if not policies:
        policies = DEFAULT_POLICIES
    
    delete_policy = policies.get("delete_policy", {})
    module_policy = delete_policy.get(module, "admin_manager")
    
    # Check role-based policy
    if module_policy == "admin_only":
        raise HTTPException(status_code=403, detail=f"Only admins can delete {module} records")
    elif module_policy == "admin_manager" and user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail=f"Only admins and managers can delete {module} records")
    elif module_policy == "no_delete":
        raise HTTPException(status_code=403, detail=f"Deletion of {module} records is disabled")
    
    # Check time limit
    if policies.get("delete_time_limit_enabled") and record_date:
        try:
            limit_hours = int(policies.get("delete_time_limit_hours", 24))
            if isinstance(record_date, str):
                record_dt = datetime.fromisoformat(record_date.replace('Z', '+00:00'))
            else:
                record_dt = record_date
            
            cutoff = datetime.now(timezone.utc) - timedelta(hours=limit_hours)
            if record_dt.replace(tzinfo=timezone.utc) < cutoff:
                raise HTTPException(
                    status_code=403,
                    detail=f"Cannot delete records older than {limit_hours} hours. Contact admin."
                )
        except (ValueError, TypeError):
            pass
    
    return True


async def get_visibility_settings(user):
    """Get visibility settings for the current user."""
    if user.role == "admin" or user.role == "manager":
        return {"hide_financials": False, "hide_profit": False, "hide_analytics": False, "hide_reports": False, "hide_supplier_credit": False, "hide_employee_salary": user.role != "admin"}
    
    policies = await db.access_policies.find_one({}, {"_id": 0})
    if not policies:
        policies = DEFAULT_POLICIES
    
    vis = policies.get("visibility", {})
    return {
        "hide_financials": vis.get("operator_hide_financials", True),
        "hide_profit": vis.get("operator_hide_profit", True),
        "hide_analytics": vis.get("operator_hide_analytics", False),
        "hide_reports": vis.get("operator_hide_reports", False),
        "hide_supplier_credit": vis.get("operator_hide_supplier_credit", True),
        "hide_employee_salary": vis.get("operator_hide_employee_salary", True),
    }


@router.get("/access-policies/my-visibility")
async def get_my_visibility(current_user: User = Depends(get_current_user)):
    """Get visibility settings for the current user."""
    return await get_visibility_settings(current_user)
