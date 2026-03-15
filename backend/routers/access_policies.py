from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from database import db, get_current_user, require_permission, get_tenant_filter, stamp_tenant
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
    policies = await db.access_policies.find_one(get_tenant_filter(current_user), {"_id": 0})
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

async def check_delete_permission(user, module: str, record_date: str = None, record_summary: str = None):
    """Check if user has permission to delete a record based on policies."""
    # Always log the attempt
    log_entry = {
        "user_email": user.email,
        "user_role": user.role,
        "module": module,
        "record_date": str(record_date)[:10] if record_date else None,
        "record_summary": record_summary or "",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "allowed": False,
        "reason": "",
    }
    
    if user.role == "admin":
        log_entry["allowed"] = True
        log_entry["reason"] = "Admin bypass"

        await db.delete_audit_log.insert_one(log_entry)
        return True
    
    policies = await db.access_policies.find_one({}, {"_id": 0})
    if not policies:
        policies = DEFAULT_POLICIES
    
    delete_policy = policies.get("delete_policy", {})
    module_policy = delete_policy.get(module, "admin_manager")
    
    # Check role-based policy
    if module_policy == "admin_only":
        log_entry["reason"] = f"Policy: admin_only, user role: {user.role}"

        await db.delete_audit_log.insert_one(log_entry)
        raise HTTPException(status_code=403, detail=f"Only admins can delete {module} records")
    elif module_policy == "admin_manager" and user.role not in ("admin", "manager"):
        log_entry["reason"] = f"Policy: admin_manager, user role: {user.role}"

        await db.delete_audit_log.insert_one(log_entry)
        raise HTTPException(status_code=403, detail=f"Only admins and managers can delete {module} records")
    elif module_policy == "no_delete":
        log_entry["reason"] = "Policy: no_delete (disabled for all)"

        await db.delete_audit_log.insert_one(log_entry)
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
                log_entry["reason"] = f"Time limit exceeded: {limit_hours}h"

                await db.delete_audit_log.insert_one(log_entry)
                raise HTTPException(
                    status_code=403,
                    detail=f"Cannot delete records older than {limit_hours} hours. Contact admin."
                )
        except (ValueError, TypeError):
            pass
    
    log_entry["allowed"] = True
    log_entry["reason"] = f"Policy: {module_policy}, role: {user.role}"

    await db.delete_audit_log.insert_one(log_entry)
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

@router.get("/access-policies/delete-audit-log")
async def get_delete_audit_log(page: int = 1, limit: int = 50, current_user: User = Depends(get_current_user)):
    """Get deletion audit trail (admin only)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    skip = (page - 1) * limit
    total = await db.delete_audit_log.count_documents(get_tenant_filter(current_user))
    logs = await db.delete_audit_log.find(get_tenant_filter(current_user), {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"data": logs, "total": total, "page": page, "pages": (total + limit - 1) // limit}
