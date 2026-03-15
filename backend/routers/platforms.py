"""
Online Delivery Platforms Router
Manage sales from HungerStation, Jahez, ToYou, Keta, Ninja, etc.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from database import db, get_current_user, require_permission, get_tenant_filter, stamp_tenant
from models import User
import uuid

router = APIRouter(tags=["Online Platforms"])


# =====================================================
# DELIVERY PLATFORMS CRUD
# =====================================================

@router.get("/platforms")
async def get_platforms(current_user: User = Depends(get_current_user)):
    """Get all delivery platforms"""
    platforms = await db.delivery_platforms.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100)
    
    # Calculate pending amounts for each platform
    for platform in platforms:
        # Get total sales for this platform
        sales = await db.sales.find({
            "platform_id": platform["id"]
        }, {"_id": 0, "final_amount": 1, "amount": 1}).to_list(10000)
        
        total_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
        
        # Get total payments received from this platform
        payments = await db.platform_payments.find({
            "platform_id": platform["id"]
        }, {"_id": 0, "amount_received": 1}).to_list(1000)
        
        total_received = sum(p.get("amount_received", 0) for p in payments)
        total_commission = sum(p.get("commission_paid", 0) for p in payments)
        
        platform["total_sales"] = total_sales
        platform["total_received"] = total_received
        platform["total_commission"] = total_commission
        platform["pending_amount"] = total_sales - total_received - total_commission
    
    return platforms


@router.post("/platforms")
async def create_platform(body: dict, current_user: User = Depends(get_current_user)):
    """Create a new delivery platform"""
    require_permission(current_user, "sales", "write")
    
    platform = {
        "id": str(uuid.uuid4()),
        "name": body.get("name"),
        "name_ar": body.get("name_ar", ""),
        "logo_url": body.get("logo_url", ""),
        "commission_rate": body.get("commission_rate", 0),  # Default commission %
        "processing_fee": body.get("processing_fee", 0),  # Fixed fee per order
        "contact_email": body.get("contact_email", ""),
        "contact_phone": body.get("contact_phone", ""),
        "payment_terms": body.get("payment_terms", "weekly"),  # weekly, biweekly, monthly
        "notes": body.get("notes", ""),
        "is_active": body.get("is_active", True),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    
    stamp_tenant(platform, current_user)
    await db.delivery_platforms.insert_one(platform)
    # Remove MongoDB _id before returning
    platform.pop("_id", None)
    return {"message": "Platform created", "id": platform["id"], "platform": platform}


@router.put("/platforms/{platform_id}")
async def update_platform(platform_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update a delivery platform"""
    require_permission(current_user, "sales", "write")
    
    update_data = {
        "name": body.get("name"),
        "name_ar": body.get("name_ar", ""),
        "logo_url": body.get("logo_url", ""),
        "commission_rate": body.get("commission_rate", 0),
        "processing_fee": body.get("processing_fee", 0),
        "contact_email": body.get("contact_email", ""),
        "contact_phone": body.get("contact_phone", ""),
        "payment_terms": body.get("payment_terms", "weekly"),
        "notes": body.get("notes", ""),
        "is_active": body.get("is_active", True),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id
    }
    
    result = await db.delivery_platforms.update_one({"id": platform_id, **get_tenant_filter(current_user)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Platform not found")
    
    return {"message": "Platform updated"}


@router.delete("/platforms/{platform_id}")
async def delete_platform(platform_id: str, current_user: User = Depends(get_current_user)):
    """Delete a delivery platform"""
    require_permission(current_user, "sales", "write")
    
    # Check if platform has sales
    sales_count = await db.sales.count_documents({"platform_id": platform_id})
    if sales_count > 0:
        # Soft delete - mark as inactive
        await db.delivery_platforms.update_one(
            {"id": platform_id}, 
            {"$set": {"is_active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Platform deactivated (has existing sales)"}
    
    await db.delivery_platforms.delete_one({"id": platform_id, **get_tenant_filter(current_user)})
    return {"message": "Platform deleted"}


# =====================================================
# PLATFORM SALES
# =====================================================

@router.get("/platforms/{platform_id}/sales")
async def get_platform_sales(
    platform_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,  # pending, partial, settled
    current_user: User = Depends(get_current_user)
):
    """Get all sales for a specific platform"""
    query = {"platform_id": platform_id}
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if status:
        query["platform_status"] = status
    
    sales = await db.sales.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    
    # Calculate totals
    total_amount = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
    pending_count = len([s for s in sales if s.get("platform_status") != "settled"])
    
    return {
        "sales": sales,
        "total_amount": total_amount,
        "total_count": len(sales),
        "pending_count": pending_count
    }


# =====================================================
# PLATFORM PAYMENTS (Settlement from platforms)
# =====================================================

@router.get("/platform-payments/calculate")
async def calculate_platform_payment(
    platform_id: str,
    period_start: str,
    period_end: str,
    current_user: User = Depends(get_current_user)
):
    """Calculate expected payment based on sales in period - auto-calculates commission and branch breakdown"""
    require_permission(current_user, "sales", "read")
    
    # Get platform
    platform = await db.delivery_platforms.find_one({"id": platform_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    
    commission_rate = platform.get("commission_rate", 0)
    
    # Get sales for this platform and period
    sales = await db.sales.find({
        "platform_id": platform_id,
        "date": {"$gte": period_start, "$lte": period_end},
        "platform_status": {"$ne": "settled"}  # Only unsettled sales
    }, {"_id": 0, "branch_id": 1, "final_amount": 1, "amount": 1, "date": 1}).to_list(10000)
    
    if not sales:
        return {
            "platform_id": platform_id,
            "platform_name": platform.get("name"),
            "commission_rate": commission_rate,
            "period_start": period_start,
            "period_end": period_end,
            "total_sales": 0,
            "calculated_commission": 0,
            "expected_amount": 0,
            "sales_count": 0,
            "branch_breakdown": [],
            "message": "No unsettled sales found for this period"
        }
    
    # Calculate totals by branch
    branch_sales = {}
    for sale in sales:
        bid = sale.get("branch_id") or "unknown"
        amt = sale.get("final_amount", sale.get("amount", 0))
        branch_sales[bid] = branch_sales.get(bid, 0) + amt
    
    total_sales = sum(branch_sales.values())
    calculated_commission = round(total_sales * (commission_rate / 100), 2)
    expected_amount = round(total_sales - calculated_commission, 2)
    
    # Build branch breakdown
    branch_breakdown = []
    for branch_id, branch_total in branch_sales.items():
        branch = await db.branches.find_one({"id": branch_id, **get_tenant_filter(current_user)}, {"_id": 0, "name": 1})
        branch_name = branch.get("name") if branch else "Unknown Branch"
        share_percent = (branch_total / total_sales) * 100 if total_sales > 0 else 0
        branch_commission = round((branch_total / total_sales) * calculated_commission, 2) if total_sales > 0 else 0
        branch_expected = round(branch_total - branch_commission, 2)
        
        branch_breakdown.append({
            "branch_id": branch_id,
            "branch_name": branch_name,
            "sales_amount": branch_total,
            "share_percent": round(share_percent, 2),
            "commission_amount": branch_commission,
            "expected_amount": branch_expected
        })
    
    # Sort by sales amount descending
    branch_breakdown.sort(key=lambda x: x["sales_amount"], reverse=True)
    
    return {
        "platform_id": platform_id,
        "platform_name": platform.get("name"),
        "commission_rate": commission_rate,
        "period_start": period_start,
        "period_end": period_end,
        "total_sales": total_sales,
        "calculated_commission": calculated_commission,
        "expected_amount": expected_amount,
        "sales_count": len(sales),
        "branch_breakdown": branch_breakdown
    }


@router.get("/platform-payments")
async def get_platform_payments(
    platform_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all payments received from platforms"""
    query = {}
    if platform_id:
        query["platform_id"] = platform_id
    if start_date:
        query["payment_date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("payment_date", {})["$lte"] = end_date
    
    payments = await db.platform_payments.find(query, {"_id": 0}).sort("payment_date", -1).to_list(500)
    
    # Enrich with platform names
    platforms = {p["id"]: p["name"] for p in await db.delivery_platforms.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)}
    for payment in payments:
        payment["platform_name"] = platforms.get(payment.get("platform_id"), "Unknown")
    
    return payments


@router.post("/platform-payments")
async def record_platform_payment(body: dict, current_user: User = Depends(get_current_user)):
    """Record a payment received from a delivery platform with automatic branch distribution"""
    require_permission(current_user, "sales", "write")
    
    platform_id = body.get("platform_id")
    if not platform_id:
        raise HTTPException(status_code=400, detail="platform_id is required")
    
    # Verify platform exists
    platform = await db.delivery_platforms.find_one({"id": platform_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    
    period_start = body.get("period_start")
    period_end = body.get("period_end")
    total_sales = float(body.get("total_sales", 0))
    amount_received = float(body.get("amount_received", 0))
    
    # Auto-calculate commission if not provided
    commission_rate = platform.get("commission_rate", 0)
    commission_paid = body.get("commission_paid")
    if commission_paid is None or commission_paid == '':
        # Calculate commission from total sales
        commission_paid = round(total_sales * (commission_rate / 100), 2)
    else:
        commission_paid = float(commission_paid)
    
    # Calculate branch distribution if period dates provided
    branch_breakdown = []
    if period_start and period_end:
        # Get sales grouped by branch for this platform and period
        sales = await db.sales.find({
            "platform_id": platform_id,
            "date": {"$gte": period_start, "$lte": period_end}
        }, {"_id": 0, "branch_id": 1, "final_amount": 1, "amount": 1}).to_list(10000)
        
        # Group by branch
        branch_sales = {}
        for sale in sales:
            bid = sale.get("branch_id") or "unknown"
            amt = sale.get("final_amount", sale.get("amount", 0))
            branch_sales[bid] = branch_sales.get(bid, 0) + amt
        
        # Calculate each branch's share
        total_from_db = sum(branch_sales.values())
        if total_from_db > 0:
            for branch_id, branch_total in branch_sales.items():
                share_percent = (branch_total / total_from_db) * 100
                branch_received = round((branch_total / total_from_db) * amount_received, 2)
                branch_commission = round((branch_total / total_from_db) * commission_paid, 2)
                
                # Get branch name
                branch = await db.branches.find_one({"id": branch_id, **get_tenant_filter(current_user)}, {"_id": 0, "name": 1})
                branch_name = branch.get("name") if branch else "Unknown Branch"
                
                branch_breakdown.append({
                    "branch_id": branch_id,
                    "branch_name": branch_name,
                    "sales_amount": branch_total,
                    "share_percent": round(share_percent, 2),
                    "commission_amount": branch_commission,
                    "amount_received": branch_received
                })
    
    payment = {
        "id": str(uuid.uuid4()),
        "platform_id": platform_id,
        "platform_name": platform.get("name"),
        "commission_rate": commission_rate,
        "payment_date": body.get("payment_date", datetime.now(timezone.utc).isoformat()[:10]),
        "period_start": period_start,
        "period_end": period_end,
        "total_sales": total_sales,
        "commission_paid": commission_paid,
        "amount_received": amount_received,
        "branch_breakdown": branch_breakdown,
        "payment_method": body.get("payment_method", "bank_transfer"),
        "reference_number": body.get("reference_number", ""),
        "notes": body.get("notes", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    
    stamp_tenant(payment, current_user)
    await db.platform_payments.insert_one(payment)
    payment.pop('_id', None)
    
    # Update related sales as settled (if period dates provided)
    if body.get("period_start") and body.get("period_end"):
        await db.sales.update_many(
            {
                "platform_id": platform_id,
                "date": {"$gte": body["period_start"], "$lte": body["period_end"]}
            },
            {"$set": {"platform_status": "settled", "settlement_id": payment["id"]}}
        )
    
    # Remove MongoDB _id before returning
    payment.pop("_id", None)
    return {"message": "Payment recorded", "id": payment["id"], "payment": payment}


@router.put("/platform-payments/{payment_id}")
async def update_platform_payment(payment_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update a platform payment record"""
    require_permission(current_user, "sales", "write")
    
    update_data = {
        "payment_date": body.get("payment_date"),
        "period_start": body.get("period_start"),
        "period_end": body.get("period_end"),
        "total_sales": body.get("total_sales", 0),
        "commission_paid": body.get("commission_paid", 0),
        "amount_received": body.get("amount_received", 0),
        "payment_method": body.get("payment_method"),
        "reference_number": body.get("reference_number", ""),
        "notes": body.get("notes", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": current_user.id
    }
    
    result = await db.platform_payments.update_one({"id": payment_id, **get_tenant_filter(current_user)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return {"message": "Payment updated"}


@router.delete("/platform-payments/{payment_id}")
async def delete_platform_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    """Delete a platform payment record"""
    require_permission(current_user, "sales", "write")
    
    # Unsettle related sales
    await db.sales.update_many(
        {"settlement_id": payment_id},
        {"$set": {"platform_status": "pending"}, "$unset": {"settlement_id": ""}}
    )
    
    await db.platform_payments.delete_one({"id": payment_id, **get_tenant_filter(current_user)})
    return {"message": "Payment deleted"}


# =====================================================
# PLATFORM SUMMARY & ANALYTICS
# =====================================================

@router.get("/platforms/summary")
async def get_platforms_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get summary of all platform sales and pending amounts"""
    platforms = await db.delivery_platforms.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    summary = []
    total_sales = 0
    total_received = 0
    total_commission = 0
    total_pending = 0
    
    for platform in platforms:
        # Sales query
        sales_query = {"platform_id": platform["id"], "sale_type": {"$in": ["online", "online_platform"]}}
        if start_date:
            sales_query["date"] = {"$gte": start_date}
        if end_date:
            sales_query.setdefault("date", {})["$lte"] = end_date
        
        sales = await db.sales.find(sales_query, {"_id": 0, "final_amount": 1, "amount": 1}).to_list(10000)
        platform_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
        
        # Payments query
        payments_query = {"platform_id": platform["id"]}
        if start_date:
            payments_query["payment_date"] = {"$gte": start_date}
        if end_date:
            payments_query.setdefault("payment_date", {})["$lte"] = end_date
        
        payments = await db.platform_payments.find(payments_query, {"_id": 0}).to_list(1000)
        platform_received = sum(p.get("amount_received", 0) for p in payments)
        platform_commission = sum(p.get("commission_paid", 0) for p in payments)
        
        pending = platform_sales - platform_received - platform_commission
        
        summary.append({
            "platform_id": platform["id"],
            "platform_name": platform["name"],
            "commission_rate": platform.get("commission_rate", 0),
            "total_sales": platform_sales,
            "total_received": platform_received,
            "total_commission": platform_commission,
            "pending_amount": pending,
            "sales_count": len(sales),
            "payments_count": len(payments)
        })
        
        total_sales += platform_sales
        total_received += platform_received
        total_commission += platform_commission
        total_pending += pending
    
    return {
        "platforms": summary,
        "totals": {
            "total_sales": total_sales,
            "total_received": total_received,
            "total_commission": total_commission,
            "total_pending": total_pending
        }
    }


@router.get("/platforms/{platform_id}/reconciliation")
async def get_platform_reconciliation(
    platform_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get detailed reconciliation for a platform"""
    platform = await db.delivery_platforms.find_one({"id": platform_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    
    # Get all sales grouped by month
    sales = await db.sales.find({
        "platform_id": platform_id
    }, {"_id": 0}).sort("date", -1).to_list(5000)
    
    # Get all payments
    payments = await db.platform_payments.find({
        "platform_id": platform_id
    }, {"_id": 0}).sort("payment_date", -1).to_list(500)
    
    # Group sales by status
    pending_sales = [s for s in sales if s.get("platform_status") != "settled"]
    settled_sales = [s for s in sales if s.get("platform_status") == "settled"]
    
    return {
        "platform": platform,
        "summary": {
            "total_sales": sum(s.get("final_amount", s.get("amount", 0)) for s in sales),
            "pending_sales_amount": sum(s.get("final_amount", s.get("amount", 0)) for s in pending_sales),
            "settled_sales_amount": sum(s.get("final_amount", s.get("amount", 0)) for s in settled_sales),
            "total_received": sum(p.get("amount_received", 0) for p in payments),
            "total_commission": sum(p.get("commission_paid", 0) for p in payments),
            "pending_sales_count": len(pending_sales),
            "settled_sales_count": len(settled_sales)
        },
        "recent_sales": pending_sales[:20],
        "recent_payments": payments[:10]
    }


# =====================================================
# SEED DEFAULT PLATFORMS
# =====================================================

@router.post("/platforms/seed-defaults")
async def seed_default_platforms(current_user: User = Depends(get_current_user)):
    """Seed default delivery platforms (HungerStation, Jahez, ToYou, etc.)"""
    require_permission(current_user, "sales", "write")
    
    default_platforms = [
        {"name": "HungerStation", "name_ar": "هنقرستيشن", "commission_rate": 20, "payment_terms": "weekly"},
        {"name": "Hunger", "name_ar": "هنقر", "commission_rate": 18, "payment_terms": "weekly"},
        {"name": "Jahez", "name_ar": "جاهز", "commission_rate": 20, "payment_terms": "weekly"},
        {"name": "ToYou", "name_ar": "تو يو", "commission_rate": 18, "payment_terms": "biweekly"},
        {"name": "Keta", "name_ar": "كيتا", "commission_rate": 15, "payment_terms": "weekly"},
        {"name": "Ninja", "name_ar": "نينجا", "commission_rate": 15, "payment_terms": "weekly"},
        {"name": "Careem Food", "name_ar": "كريم فود", "commission_rate": 22, "payment_terms": "weekly"},
        {"name": "Talabat", "name_ar": "طلبات", "commission_rate": 20, "payment_terms": "weekly"},
        {"name": "Marsool", "name_ar": "مرسول", "commission_rate": 15, "payment_terms": "weekly"},
        {"name": "Other", "name_ar": "أخرى", "commission_rate": 0, "payment_terms": "monthly"},
    ]
    
    created = 0
    for p in default_platforms:
        # Check if already exists
        existing = await db.delivery_platforms.find_one({"name": p["name"]})
        if not existing:
            platform = {
                "id": str(uuid.uuid4()),
                **p,
                "logo_url": "",
                "contact_email": "",
                "contact_phone": "",
                "notes": "",
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": current_user.id
            }
            stamp_tenant(platform, current_user)
            await db.delivery_platforms.insert_one(platform)
            created += 1
    
    return {"message": f"Created {created} platforms", "total": len(default_platforms)}



@router.get("/platforms/branch-summary")
async def get_branch_platform_summary(
    branch_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get platform sales summary by branch - shows each branch's pending amounts"""
    require_permission(current_user, "sales", "read")
    
    # Get all branches
    branches = await db.branches.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    
    if branch_id:
        branches = [b for b in branches if b["id"] == branch_id]
    
    # Get all platforms
    platforms = await db.delivery_platforms.find({"is_active": True}, {"_id": 0, "id": 1, "name": 1, "commission_rate": 1}).to_list(100)
    
    result = []
    
    for branch in branches:
        branch_data = {
            "branch_id": branch["id"],
            "branch_name": branch["name"],
            "platforms": [],
            "totals": {"total_sales": 0, "total_received": 0, "total_commission": 0, "total_pending": 0}
        }
        
        for platform in platforms:
            # Get sales for this branch and platform
            sales_query = {
                "branch_id": branch["id"],
                "platform_id": platform["id"]
            }
            if start_date:
                sales_query["date"] = {"$gte": start_date}
            if end_date:
                sales_query.setdefault("date", {})["$lte"] = end_date
            
            sales = await db.sales.find(sales_query, {"_id": 0, "final_amount": 1, "amount": 1}).to_list(5000)
            branch_platform_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
            
            if branch_platform_sales == 0:
                continue  # Skip platforms with no sales for this branch
            
            # Get payments that include this branch
            payments = await db.platform_payments.find({
                "platform_id": platform["id"],
                "branch_breakdown.branch_id": branch["id"]
            }, {"_id": 0, "branch_breakdown": 1}).to_list(500)
            
            branch_received = 0
            branch_commission = 0
            for payment in payments:
                for bb in payment.get("branch_breakdown", []):
                    if bb.get("branch_id") == branch["id"]:
                        branch_received += bb.get("amount_received", 0)
                        branch_commission += bb.get("commission_amount", 0)
            
            pending = branch_platform_sales - branch_received - branch_commission
            
            branch_data["platforms"].append({
                "platform_id": platform["id"],
                "platform_name": platform["name"],
                "commission_rate": platform.get("commission_rate", 0),
                "sales": branch_platform_sales,
                "received": branch_received,
                "commission": branch_commission,
                "pending": pending,
                "sales_count": len(sales)
            })
            
            branch_data["totals"]["total_sales"] += branch_platform_sales
            branch_data["totals"]["total_received"] += branch_received
            branch_data["totals"]["total_commission"] += branch_commission
            branch_data["totals"]["total_pending"] += pending
        
        if branch_data["platforms"]:  # Only include branches with platform sales
            result.append(branch_data)
    
    return result
