from fastapi import APIRouter, HTTPException, Depends, Request
from database import db, get_current_user, get_tenant_filter, stamp_tenant
from models import User
from datetime import datetime, timezone
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# ── Role Templates ─────────────────────────────────────────────

DEFAULT_TEMPLATES = [
    {
        "name": "Manager",
        "description": "Full access except admin settings",
        "permissions": {
            "dashboard": "write", "sales": "write", "invoices": "write",
            "branches": "write", "customers": "write", "suppliers": "write",
            "supplier_payments": "write", "expenses": "write", "cash_transfers": "write",
            "employees": "write", "documents": "write", "leave": "write",
            "loans": "write", "shifts": "write", "stock": "write", "kitchen": "write",
            "pos": "write", "reports": "write", "credit_report": "write",
            "supplier_report": "write", "analytics": "write",
            "settings": "read", "users": "read", "partners": "read", "fines": "write",
        },
        "is_system": True,
    },
    {
        "name": "Cashier",
        "description": "POS and sales access only",
        "permissions": {
            "dashboard": "none", "sales": "write", "invoices": "none",
            "branches": "none", "customers": "write", "suppliers": "none",
            "supplier_payments": "none", "expenses": "none", "cash_transfers": "none",
            "employees": "none", "documents": "none", "leave": "none",
            "loans": "none", "shifts": "read", "stock": "read", "kitchen": "none",
            "pos": "write", "reports": "none", "credit_report": "none",
            "supplier_report": "none", "analytics": "none",
            "settings": "none", "users": "none", "partners": "none", "fines": "none",
        },
        "is_system": True,
    },
    {
        "name": "Viewer",
        "description": "Read-only access to all modules",
        "permissions": {
            "dashboard": "read", "sales": "read", "invoices": "read",
            "branches": "read", "customers": "read", "suppliers": "read",
            "supplier_payments": "read", "expenses": "read", "cash_transfers": "read",
            "employees": "read", "documents": "read", "leave": "read",
            "loans": "read", "shifts": "read", "stock": "read", "kitchen": "read",
            "pos": "read", "reports": "read", "credit_report": "read",
            "supplier_report": "read", "analytics": "read",
            "settings": "read", "users": "read", "partners": "read", "fines": "read",
        },
        "is_system": True,
    },
    {
        "name": "Employee",
        "description": "Self-service portal access only",
        "permissions": {
            "dashboard": "none", "sales": "none", "invoices": "none",
            "branches": "none", "customers": "none", "suppliers": "none",
            "supplier_payments": "none", "expenses": "none", "cash_transfers": "none",
            "employees": "none", "documents": "none", "leave": "none",
            "loans": "none", "shifts": "read", "stock": "none", "kitchen": "none",
            "pos": "none", "reports": "none", "credit_report": "none",
            "supplier_report": "none", "analytics": "none",
            "settings": "none", "users": "none", "partners": "none", "fines": "none",
        },
        "is_system": True,
    },
]


@router.get("/role-templates")
async def get_role_templates(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    templates = await db.role_templates.find(tf, {"_id": 0}).sort("name", 1).to_list(100)
    if not templates:
        # Seed default templates
        for tmpl in DEFAULT_TEMPLATES:
            tmpl_doc = {
                "id": str(uuid.uuid4()),
                **tmpl,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            stamp_tenant(tmpl_doc, current_user)
            await db.role_templates.insert_one(tmpl_doc)
        templates = await db.role_templates.find(tf, {"_id": 0}).sort("name", 1).to_list(100)
    return templates


@router.post("/role-templates")
async def create_role_template(body: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if not body.get("name"):
        raise HTTPException(status_code=400, detail="Template name is required")
    tf = get_tenant_filter(current_user)
    existing = await db.role_templates.find_one({"name": body["name"], **tf})
    if existing:
        raise HTTPException(status_code=400, detail="Template with this name already exists")
    template = {
        "id": str(uuid.uuid4()),
        "name": body["name"],
        "description": body.get("description", ""),
        "permissions": body.get("permissions", {}),
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    stamp_tenant(template, current_user)
    await db.role_templates.insert_one(template)
    return {k: v for k, v in template.items() if k != "_id"}


@router.put("/role-templates/{template_id}")
async def update_role_template(template_id: str, body: dict, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    tmpl = await db.role_templates.find_one({"id": template_id, **tf})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    updates = {}
    for field in ["name", "description", "permissions"]:
        if field in body:
            updates[field] = body[field]
    if updates:
        await db.role_templates.update_one({"id": template_id, **tf}, {"$set": updates})
    updated = await db.role_templates.find_one({"id": template_id}, {"_id": 0})
    return updated


@router.delete("/role-templates/{template_id}")
async def delete_role_template(template_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    tmpl = await db.role_templates.find_one({"id": template_id, **tf})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    if tmpl.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system templates")
    await db.role_templates.delete_one({"id": template_id, **tf})
    return {"success": True}


# ── Stripe Payments ────────────────────────────────────────────

PLANS = {
    "starter": {"name": "Starter", "price": 199.0, "currency": "SAR", "max_branches": 1, "max_users": 5},
    "business": {"name": "Business", "price": 499.0, "currency": "SAR", "max_branches": 5, "max_users": 20},
    "enterprise": {"name": "Enterprise", "price": 999.0, "currency": "SAR", "max_branches": -1, "max_users": -1},
}


@router.post("/payments/checkout")
async def create_checkout(body: dict, request: Request, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    plan_key = body.get("plan")
    if plan_key not in PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {plan_key}")

    plan = PLANS[plan_key]
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

    origin_url = body.get("origin_url", str(request.base_url).rstrip("/"))
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"

    success_url = f"{origin_url}/subscription?session_id={{CHECKOUT_SESSION_ID}}&status=success"
    cancel_url = f"{origin_url}/subscription?status=cancelled"

    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    checkout_request = CheckoutSessionRequest(
        amount=plan["price"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "tenant_id": current_user.tenant_id or "",
            "plan": plan_key,
            "user_id": current_user.id,
            "email": current_user.email,
        },
    )

    session = await stripe_checkout.create_checkout_session(checkout_request)

    # Record the transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "tenant_id": current_user.tenant_id,
        "user_id": current_user.id,
        "email": current_user.email,
        "plan": plan_key,
        "amount": plan["price"],
        "currency": "usd",
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(transaction)

    return {"url": session.url, "session_id": session.session_id}


@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: User = Depends(get_current_user)):
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    host_url = "https://ssc-saas-build.preview.emergentagent.com"
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    status = await stripe_checkout.get_checkout_status(session_id)

    # Update transaction
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if txn and txn.get("payment_status") != "paid":
        update_data = {
            "payment_status": status.payment_status,
            "status": status.status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if status.payment_status == "paid":
            # Activate the subscription
            plan_key = txn.get("plan", "starter")
            tenant_id = txn.get("tenant_id")
            if tenant_id:
                plan_details = PLANS.get(plan_key, PLANS["starter"])
                await db.tenants.update_one({"id": tenant_id}, {"$set": {
                    "plan": plan_key,
                    "plan_details": plan_details,
                    "subscription_status": "active",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }})
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

        await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update_data})

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "metadata": status.metadata,
    }


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        return {"status": "error", "detail": "Stripe not configured"}

    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
    except Exception as e:
        return {"status": "error", "detail": str(e)}

    # Update transaction based on webhook
    if webhook_response and webhook_response.session_id:
        txn = await db.payment_transactions.find_one({"session_id": webhook_response.session_id}, {"_id": 0})
        if txn and txn.get("payment_status") != "paid":
            update_data = {
                "payment_status": webhook_response.payment_status,
                "status": webhook_response.event_type,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }

            if webhook_response.payment_status == "paid":
                plan_key = txn.get("plan", "starter")
                tenant_id = txn.get("tenant_id")
                if tenant_id:
                    plan_details = PLANS.get(plan_key, PLANS["starter"])
                    await db.tenants.update_one({"id": tenant_id}, {"$set": {
                        "plan": plan_key,
                        "plan_details": plan_details,
                        "subscription_status": "active",
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }})
                update_data["completed_at"] = datetime.now(timezone.utc).isoformat()

            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": update_data}
            )

    return {"status": "ok"}


@router.get("/payments/history")
async def get_payment_history(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    tf = get_tenant_filter(current_user)
    transactions = await db.payment_transactions.find(tf, {"_id": 0}).sort("created_at", -1).to_list(100)
    return transactions


# ── Tenant Analytics (Super Admin) ─────────────────────────────

@router.get("/admin/analytics")
async def get_admin_analytics(current_user: User = Depends(get_current_user)):
    if not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="Super admin access required")

    now = datetime.now(timezone.utc)

    # Total tenants and their statuses
    total_tenants = await db.tenants.count_documents({})
    active_tenants = await db.tenants.count_documents({"is_active": True})
    inactive_tenants = total_tenants - active_tenants

    # Plan distribution
    plan_pipeline = [{"$group": {"_id": "$plan", "count": {"$sum": 1}}}]
    plan_dist = await db.tenants.aggregate(plan_pipeline).to_list(10)
    plan_distribution = {r["_id"]: r["count"] for r in plan_dist}

    # MRR calculation
    mrr = 0.0
    for plan_key, count in plan_distribution.items():
        plan_price = PLANS.get(plan_key, {}).get("price", 0)
        mrr += plan_price * count

    # Monthly growth (last 6 months)
    monthly_growth = []
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        ms = f"{y}-{m:02d}-01"
        if m == 12:
            me = f"{y + 1}-01-01"
        else:
            me = f"{y}-{m + 1:02d}-01"
        new_tenants = await db.tenants.count_documents({"created_at": {"$gte": ms, "$lt": me}})
        # Calculate MRR for that month based on tenant count up to that point
        total_up_to = await db.tenants.count_documents({"created_at": {"$lt": me}})
        monthly_growth.append({
            "month": f"{y}-{m:02d}",
            "new_tenants": new_tenants,
            "total_tenants": total_up_to,
        })

    # Revenue by plan
    revenue_by_plan = []
    for plan_key, count in plan_distribution.items():
        price = PLANS.get(plan_key, {}).get("price", 0)
        revenue_by_plan.append({
            "plan": plan_key,
            "count": count,
            "price": price,
            "mrr": price * count,
        })

    # Subscription status distribution
    status_pipeline = [{"$group": {"_id": "$subscription_status", "count": {"$sum": 1}}}]
    status_dist = await db.tenants.aggregate(status_pipeline).to_list(10)
    status_distribution = {r["_id"]: r["count"] for r in status_dist}

    # Top tenants by user count
    all_tenants = await db.tenants.find({}, {"_id": 0, "id": 1, "company_name": 1, "plan": 1}).to_list(100)
    top_tenants = []
    for t in all_tenants[:10]:
        user_count = await db.users.count_documents({"tenant_id": t["id"]})
        branch_count = await db.branches.count_documents({"tenant_id": t["id"]})
        top_tenants.append({
            "company_name": t.get("company_name", "Unknown"),
            "plan": t.get("plan", "starter"),
            "users": user_count,
            "branches": branch_count,
        })
    top_tenants.sort(key=lambda x: x["users"], reverse=True)

    # Payment stats
    total_payments = await db.payment_transactions.count_documents({"payment_status": "paid"})
    total_revenue_pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    total_revenue_result = await db.payment_transactions.aggregate(total_revenue_pipeline).to_list(1)
    total_revenue = total_revenue_result[0]["total"] if total_revenue_result else 0

    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "inactive_tenants": inactive_tenants,
        "mrr": round(mrr, 2),
        "arr": round(mrr * 12, 2),
        "plan_distribution": plan_distribution,
        "revenue_by_plan": revenue_by_plan,
        "monthly_growth": monthly_growth,
        "status_distribution": status_distribution,
        "top_tenants": top_tenants[:5],
        "payment_stats": {
            "total_payments": total_payments,
            "total_revenue": round(total_revenue, 2),
        },
    }
