from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid

from database import db, hash_password, create_access_token, get_current_user, get_tenant_filter

router = APIRouter()

INDUSTRIES = [
    "restaurant", "cafe", "bakery", "catering", "food_truck",
    "retail", "grocery", "pharmacy", "electronics",
    "salon", "gym", "clinic", "hotel",
    "general", "other"
]

PLANS = {
    "starter": {"name": "Starter", "price": 199, "currency": "SAR", "max_branches": 1, "max_users": 5, "modules": ["pos", "sales", "expenses", "inventory"]},
    "business": {"name": "Business", "price": 499, "currency": "SAR", "max_branches": 5, "max_users": 20, "modules": ["pos", "sales", "expenses", "inventory", "accounting", "analytics", "hr"]},
    "enterprise": {"name": "Enterprise", "price": 0, "currency": "SAR", "max_branches": -1, "max_users": -1, "modules": ["all"]},
}


@router.post("/tenants/register")
async def register_tenant(body: dict):
    """Public endpoint - create a new tenant with admin user."""
    required = ["company_name", "admin_name", "admin_email", "password", "country"]
    for field in required:
        if not body.get(field):
            raise HTTPException(status_code=400, detail=f"{field} is required")

    # Check email uniqueness
    existing = await db.users.find_one({"email": body["admin_email"]})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    tenant_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Create tenant
    tenant = {
        "id": tenant_id,
        "company_name": body["company_name"],
        "company_name_ar": body.get("company_name_ar", ""),
        "industry": body.get("industry", "general"),
        "country": body["country"],
        "city": body.get("city", ""),
        "address": body.get("address", ""),
        "phone": body.get("phone", ""),
        "email": body["admin_email"],
        "website": body.get("website", ""),
        "tax_number": body.get("tax_number", ""),
        "commercial_reg": body.get("commercial_reg", ""),
        "currency": body.get("currency", "SAR"),
        "timezone": body.get("timezone", "Asia/Riyadh"),
        "logo_url": "",
        "plan": body.get("plan", "starter"),
        "plan_details": PLANS.get(body.get("plan", "starter"), PLANS["starter"]),
        "subscription_status": "trial",
        "trial_ends_at": None,  # Will be set later with Stripe
        "is_active": True,
        "onboarding_completed": False,
        "created_at": now,
        "updated_at": now,
        "admin_count": 1,
        "user_count": 1,
        "branch_count": 0,
    }
    await db.tenants.insert_one(tenant)

    # Create admin user for this tenant
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": body["admin_email"],
        "password": hash_password(body["password"]),
        "name": body["admin_name"],
        "role": "admin",
        "tenant_id": tenant_id,
        "is_super_admin": False,
        "is_active": True,
        "branch_id": None,
        "permissions": [
            "sales", "expenses", "suppliers", "customers", "employees",
            "reports", "settings", "invoices", "stock", "partners",
            "documents", "branches", "transfers", "credit_report",
            "supplier_report", "schedule", "leave", "fines", "loans",
            "users", "kitchen", "shifts", "accounting"
        ],
        "created_at": now,
    }
    await db.users.insert_one(admin_user)

    # Generate token
    access_token = create_access_token(data={"sub": admin_user["id"]})

    # Clean for response
    tenant.pop("_id", None)
    admin_user.pop("_id", None)
    admin_user.pop("password", None)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "tenant": tenant,
        "user": {
            "id": admin_user["id"],
            "email": admin_user["email"],
            "name": admin_user["name"],
            "role": "admin",
            "tenant_id": tenant_id,
        }
    }


@router.put("/tenants/onboarding")
async def complete_onboarding(body: dict, current_user=Depends(get_current_user)):
    """Update tenant profile during onboarding."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated")

    updates = {}
    for field in ["company_name", "company_name_ar", "industry", "country", "city",
                   "address", "phone", "website", "tax_number", "commercial_reg",
                   "currency", "timezone", "logo_url"]:
        if field in body:
            updates[field] = body[field]

    if body.get("onboarding_completed"):
        updates["onboarding_completed"] = True

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.tenants.update_one({"id": tenant_id}, {"$set": updates})

    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    return tenant


@router.get("/tenants/current")
async def get_current_tenant(current_user=Depends(get_current_user)):
    """Get current user's tenant info."""
    tenant_id = current_user.tenant_id
    if not tenant_id:
        return {"tenant": None, "is_super_admin": current_user.is_super_admin}
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    return {"tenant": tenant, "is_super_admin": current_user.is_super_admin}


# ── Super Admin Endpoints ──────────────────────────────────────

@router.get("/admin/tenants")
async def list_all_tenants(current_user=Depends(get_current_user)):
    """Super admin only - list all tenants."""
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    tenants = await db.tenants.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # Add user counts
    for t in tenants:
        t["user_count"] = await db.users.count_documents({"tenant_id": t["id"]})
        t["branch_count"] = await db.branches.count_documents({"tenant_id": t["id"]})
    return tenants


@router.get("/admin/tenants/{tenant_id}")
async def get_tenant_detail(tenant_id: str, current_user=Depends(get_current_user)):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant["users"] = await db.users.find({"tenant_id": tenant_id}, {"_id": 0, "password": 0}).to_list(100)
    tenant["branches"] = await db.branches.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    # Usage stats
    tenant["stats"] = {
        "sales_count": await db.sales.count_documents({"tenant_id": tenant_id}),
        "expenses_count": await db.expenses.count_documents({"tenant_id": tenant_id}),
        "employees_count": await db.employees.count_documents({"tenant_id": tenant_id}),
    }
    return tenant


@router.put("/admin/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, body: dict, current_user=Depends(get_current_user)):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    updates = {}
    for field in ["is_active", "plan", "subscription_status", "company_name"]:
        if field in body:
            updates[field] = body[field]
    if "plan" in updates:
        updates["plan_details"] = PLANS.get(updates["plan"], PLANS["starter"])
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.tenants.update_one({"id": tenant_id}, {"$set": updates})
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    return tenant


@router.delete("/admin/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, current_user=Depends(get_current_user)):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")
    # Delete all tenant data
    for collection_name in ["users", "branches", "sales", "expenses", "suppliers",
                             "employees", "inventory", "customers", "bills",
                             "journal_entries", "chart_of_accounts", "tax_rates",
                             "accounting_settings", "categories"]:
        await db[collection_name].delete_many({"tenant_id": tenant_id})
    await db.tenants.delete_one({"id": tenant_id})
    return {"success": True}


@router.get("/admin/dashboard")
async def admin_dashboard(current_user=Depends(get_current_user)):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")

    total_tenants = await db.tenants.count_documents({})
    active_tenants = await db.tenants.count_documents({"is_active": True})
    total_users = await db.users.count_documents({})
    total_branches = await db.branches.count_documents({})

    # Recent tenants
    recent = await db.tenants.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)

    # Plan distribution
    plan_pipeline = [{"$group": {"_id": "$plan", "count": {"$sum": 1}}}]
    plan_dist = await db.tenants.aggregate(plan_pipeline).to_list(10)

    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "total_users": total_users,
        "total_branches": total_branches,
        "recent_tenants": recent,
        "plan_distribution": {r["_id"]: r["count"] for r in plan_dist},
    }
