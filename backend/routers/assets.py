"""
Assets & Liabilities Router
Manages company assets (equipment, vehicles, property) and provides unified view of liabilities
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from pathlib import Path
import uuid
import os

from database import db, get_current_user, ROOT_DIR, get_branch_filter_with_global, get_tenant_filter, stamp_tenant
from models import User

router = APIRouter()


# =====================================================
# MODELS
# =====================================================

class AssetCreate(BaseModel):
    name: str
    asset_type: str  # equipment, vehicle, property, furniture, electronics, other
    description: Optional[str] = ""
    purchase_date: Optional[str] = None
    purchase_price: float = 0
    current_value: float = 0
    depreciation_rate: float = 0  # Annual depreciation percentage
    serial_number: Optional[str] = ""
    location: Optional[str] = ""
    branch_id: Optional[str] = None
    status: str = "active"  # active, maintenance, disposed, sold
    warranty_expiry: Optional[str] = None
    notes: Optional[str] = ""


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    description: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_price: Optional[float] = None
    current_value: Optional[float] = None
    depreciation_rate: Optional[float] = None
    serial_number: Optional[str] = None
    location: Optional[str] = None
    branch_id: Optional[str] = None
    status: Optional[str] = None
    warranty_expiry: Optional[str] = None
    notes: Optional[str] = None


# =====================================================
# ASSET TYPES & STATS (must be before {asset_id} routes)
# =====================================================

@router.get("/assets/types")
async def get_asset_types(current_user: User = Depends(get_current_user)):
    """Get predefined asset types"""
    return [
        {"id": "equipment", "name": "Equipment", "name_ar": "معدات", "icon": "wrench"},
        {"id": "vehicle", "name": "Vehicle", "name_ar": "مركبة", "icon": "car"},
        {"id": "property", "name": "Property", "name_ar": "عقار", "icon": "building"},
        {"id": "furniture", "name": "Furniture", "name_ar": "أثاث", "icon": "sofa"},
        {"id": "electronics", "name": "Electronics", "name_ar": "إلكترونيات", "icon": "monitor"},
        {"id": "kitchen", "name": "Kitchen Equipment", "name_ar": "معدات مطبخ", "icon": "chef-hat"},
        {"id": "other", "name": "Other", "name_ar": "أخرى", "icon": "box"},
    ]


@router.get("/assets/stats")
async def get_asset_stats(current_user: User = Depends(get_current_user)):
    """Get asset statistics"""
    assets = await db.assets.find(get_tenant_filter(current_user), {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    
    total_purchase_value = sum(a.get("purchase_price", 0) for a in assets)
    total_current_value = 0
    total_depreciation = 0
    
    by_type = {}
    by_status = {"active": 0, "maintenance": 0, "disposed": 0, "sold": 0}
    warranty_expiring = 0
    
    for asset in assets:
        # Calculate depreciated value
        calc_value = asset.get("current_value", asset.get("purchase_price", 0))
        if asset.get("purchase_date") and asset.get("depreciation_rate", 0) > 0:
            try:
                purchase_date = datetime.fromisoformat(asset["purchase_date"].replace("Z", "+00:00"))
                if purchase_date.tzinfo is None:
                    purchase_date = purchase_date.replace(tzinfo=timezone.utc)
                years = (now - purchase_date).days / 365
                depreciation = asset.get("purchase_price", 0) * (asset.get("depreciation_rate", 0) / 100) * years
                calc_value = max(0, asset.get("purchase_price", 0) - depreciation)
                total_depreciation += min(depreciation, asset.get("purchase_price", 0))
            except:
                pass
        
        total_current_value += calc_value
        
        # By type
        atype = asset.get("asset_type", "other")
        by_type[atype] = by_type.get(atype, 0) + 1
        
        # By status
        status = asset.get("status", "active")
        if status in by_status:
            by_status[status] += 1
        
        # Warranty expiring
        if asset.get("warranty_expiry"):
            try:
                warranty_date = datetime.fromisoformat(asset["warranty_expiry"].replace("Z", "+00:00"))
                if warranty_date.tzinfo is None:
                    warranty_date = warranty_date.replace(tzinfo=timezone.utc)
                if 0 <= (warranty_date - now).days <= 30:
                    warranty_expiring += 1
            except:
                pass
    
    return {
        "total_assets": len(assets),
        "total_purchase_value": round(total_purchase_value, 2),
        "total_current_value": round(total_current_value, 2),
        "total_depreciation": round(total_depreciation, 2),
        "by_type": [{"type": k, "count": v} for k, v in sorted(by_type.items(), key=lambda x: -x[1])],
        "by_status": by_status,
        "warranty_expiring_soon": warranty_expiring
    }


@router.get("/assets/depreciation-report")
async def get_depreciation_report(current_user: User = Depends(get_current_user)):
    """Get detailed depreciation report for all assets"""
    assets = await db.assets.find(get_tenant_filter(current_user), {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    
    report = []
    for asset in assets:
        if asset.get("purchase_date") and asset.get("depreciation_rate", 0) > 0:
            try:
                purchase_date = datetime.fromisoformat(asset["purchase_date"].replace("Z", "+00:00"))
                if purchase_date.tzinfo is None:
                    purchase_date = purchase_date.replace(tzinfo=timezone.utc)
                
                years = (now - purchase_date).days / 365
                annual_depreciation = asset.get("purchase_price", 0) * (asset.get("depreciation_rate", 0) / 100)
                total_depreciation = min(annual_depreciation * years, asset.get("purchase_price", 0))
                book_value = max(0, asset.get("purchase_price", 0) - total_depreciation)
                
                report.append({
                    "id": asset["id"],
                    "name": asset["name"],
                    "asset_type": asset.get("asset_type", "other"),
                    "purchase_date": asset["purchase_date"],
                    "purchase_price": asset.get("purchase_price", 0),
                    "depreciation_rate": asset.get("depreciation_rate", 0),
                    "years_owned": round(years, 2),
                    "annual_depreciation": round(annual_depreciation, 2),
                    "total_depreciation": round(total_depreciation, 2),
                    "book_value": round(book_value, 2),
                    "status": asset.get("status", "active")
                })
            except:
                pass
    
    return {
        "assets": sorted(report, key=lambda x: -x["total_depreciation"]),
        "summary": {
            "total_assets": len(report),
            "total_purchase_value": round(sum(a["purchase_price"] for a in report), 2),
            "total_depreciation": round(sum(a["total_depreciation"] for a in report), 2),
            "total_book_value": round(sum(a["book_value"] for a in report), 2)
        }
    }


# =====================================================
# ASSET CRUD
# =====================================================

@router.get("/assets")
async def get_assets(
    asset_type: Optional[str] = None,
    status: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all company assets with optional filters"""
    query = get_branch_filter_with_global(current_user)
    if asset_type:
        query["asset_type"] = asset_type
    if status:
        query["status"] = status
    if branch_id:
        query["branch_id"] = branch_id
    
    assets = await db.assets.find(query, {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    
    for asset in assets:
        # Calculate current depreciated value
        if asset.get("purchase_date") and asset.get("depreciation_rate", 0) > 0:
            try:
                purchase_date = datetime.fromisoformat(asset["purchase_date"].replace("Z", "+00:00"))
                if purchase_date.tzinfo is None:
                    purchase_date = purchase_date.replace(tzinfo=timezone.utc)
                years = (now - purchase_date).days / 365
                depreciation = asset.get("purchase_price", 0) * (asset.get("depreciation_rate", 0) / 100) * years
                asset["calculated_value"] = max(0, asset.get("purchase_price", 0) - depreciation)
                asset["total_depreciation"] = min(depreciation, asset.get("purchase_price", 0))
            except:
                asset["calculated_value"] = asset.get("current_value", 0)
                asset["total_depreciation"] = 0
        else:
            asset["calculated_value"] = asset.get("current_value", asset.get("purchase_price", 0))
            asset["total_depreciation"] = 0
        
        # Check warranty status
        if asset.get("warranty_expiry"):
            try:
                warranty_date = datetime.fromisoformat(asset["warranty_expiry"].replace("Z", "+00:00"))
                if warranty_date.tzinfo is None:
                    warranty_date = warranty_date.replace(tzinfo=timezone.utc)
                days_left = (warranty_date - now).days
                asset["warranty_days_left"] = days_left
                asset["warranty_status"] = "expired" if days_left < 0 else ("expiring_soon" if days_left <= 30 else "active")
            except:
                asset["warranty_days_left"] = None
                asset["warranty_status"] = "unknown"
    
    return assets


@router.post("/assets")
async def create_asset(data: AssetCreate, current_user: User = Depends(get_current_user)):
    """Create a new company asset"""
    asset_dict = {
        "id": str(uuid.uuid4()),
        **data.model_dump(),
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Clean empty strings to None
    for key in ["branch_id", "serial_number", "location"]:
        if asset_dict.get(key) == "":
            asset_dict[key] = None
    
    stamp_tenant(asset_dict, current_user)
    await db.assets.insert_one(asset_dict)
    return {k: v for k, v in asset_dict.items() if k != "_id"}


@router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, data: AssetUpdate, current_user: User = Depends(get_current_user)):
    """Update an asset"""
    asset = await db.assets.find_one({"id": asset_id, **get_tenant_filter(current_user)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.assets.update_one({"id": asset_id, **get_tenant_filter(current_user)}, {"$set": update_data})
    return await db.assets.find_one({"id": asset_id, **get_tenant_filter(current_user)}, {"_id": 0})


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, current_user: User = Depends(get_current_user)):
    """Delete an asset"""
    asset = await db.assets.find_one({"id": asset_id, **get_tenant_filter(current_user)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Delete associated files
    if asset.get("file_path") and os.path.exists(asset["file_path"]):
        os.remove(asset["file_path"])
    
    await db.assets.delete_one({"id": asset_id, **get_tenant_filter(current_user)})
    return {"message": "Asset deleted"}


@router.post("/assets/{asset_id}/upload")
async def upload_asset_document(asset_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload document/photo for an asset"""
    asset = await db.assets.find_one({"id": asset_id, **get_tenant_filter(current_user)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    upload_dir = ROOT_DIR / "uploads" / "assets"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    ext = Path(file.filename).suffix
    file_path = upload_dir / f"{asset_id}{ext}"
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    await db.assets.update_one(
        {"id": asset_id}, 
        {"$set": {"file_path": str(file_path), "file_name": file.filename}}
    )
    return {"message": "File uploaded", "file_name": file.filename}


@router.get("/assets/{asset_id}/download")
async def download_asset_document(asset_id: str, current_user: User = Depends(get_current_user)):
    """Download asset document"""
    asset = await db.assets.find_one({"id": asset_id, **get_tenant_filter(current_user)})
    if not asset or not asset.get("file_path"):
        raise HTTPException(status_code=404, detail="No file attached")
    if not os.path.exists(asset["file_path"]):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(asset["file_path"], filename=asset.get("file_name", "document"))


# =====================================================
# UNIFIED LIABILITIES VIEW
# =====================================================

@router.get("/liabilities/summary")
async def get_liabilities_summary(current_user: User = Depends(get_current_user)):
    """Get unified summary of all company liabilities (loans, fines, outstanding dues)"""
    now = datetime.now(timezone.utc)
    
    # Get company loans
    loans = await db.company_loans.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100)
    loan_payments = await db.company_loan_payments.find(get_tenant_filter(current_user), {"_id": 0}).to_list(10000)
    
    total_loan_amount = 0
    total_loan_paid = 0
    active_loans = 0
    
    loan_details = []
    for loan in loans:
        paid = sum(p["amount"] for p in loan_payments if p.get("loan_id") == loan["id"])
        remaining = loan.get("total_amount", 0) - paid
        if remaining > 0:
            active_loans += 1
            total_loan_amount += loan.get("total_amount", 0)
            total_loan_paid += paid
            loan_details.append({
                "id": loan["id"],
                "type": "loan",
                "name": loan.get("lender", "Unknown"),
                "total": loan.get("total_amount", 0),
                "paid": paid,
                "remaining": remaining,
                "monthly_payment": loan.get("monthly_payment", 0),
                "status": "active"
            })
    
    # Get unpaid fines
    fines = await db.fines.find(get_tenant_filter(current_user), {"_id": 0}).to_list(1000)
    total_fines = 0
    total_fines_paid = 0
    unpaid_fines = 0
    
    fine_details = []
    for fine in fines:
        paid = fine.get("paid_amount", 0)
        remaining = fine.get("amount", 0) - paid
        if remaining > 0:
            unpaid_fines += 1
            total_fines += fine.get("amount", 0)
            total_fines_paid += paid
            fine_details.append({
                "id": fine["id"],
                "type": "fine",
                "name": f"{fine.get('fine_type', 'Fine')} - {fine.get('department', '')}",
                "total": fine.get("amount", 0),
                "paid": paid,
                "remaining": remaining,
                "due_date": fine.get("due_date"),
                "status": fine.get("payment_status", "unpaid")
            })
    
    # Get supplier dues
    suppliers = await db.suppliers.find(get_tenant_filter(current_user), {"_id": 0}).to_list(500)
    total_supplier_dues = sum(s.get("balance", 0) for s in suppliers if s.get("balance", 0) > 0)
    suppliers_with_dues = sum(1 for s in suppliers if s.get("balance", 0) > 0)
    
    # Get customer credit (money owed TO us - shown for reference)
    customers = await db.customers.find(get_tenant_filter(current_user), {"_id": 0}).to_list(5000)
    total_customer_credit = sum(c.get("balance", 0) for c in customers if c.get("balance", 0) > 0)
    
    # Get expiring documents
    documents = await db.documents.find(get_tenant_filter(current_user), {"_id": 0}).to_list(1000)
    expiring_docs = 0
    expired_docs = 0
    
    for doc in documents:
        if doc.get("expiry_date"):
            try:
                exp = datetime.fromisoformat(doc["expiry_date"].replace("Z", "+00:00"))
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                days_left = (exp - now).days
                if days_left < 0:
                    expired_docs += 1
                elif days_left <= 30:
                    expiring_docs += 1
            except:
                pass
    
    total_liabilities = (total_loan_amount - total_loan_paid) + (total_fines - total_fines_paid) + total_supplier_dues
    
    return {
        "total_liabilities": round(total_liabilities, 2),
        "loans": {
            "active_count": active_loans,
            "total_amount": round(total_loan_amount, 2),
            "total_paid": round(total_loan_paid, 2),
            "remaining": round(total_loan_amount - total_loan_paid, 2),
            "details": loan_details[:5]  # Top 5
        },
        "fines": {
            "unpaid_count": unpaid_fines,
            "total_amount": round(total_fines, 2),
            "total_paid": round(total_fines_paid, 2),
            "remaining": round(total_fines - total_fines_paid, 2),
            "details": fine_details[:5]
        },
        "suppliers": {
            "with_dues": suppliers_with_dues,
            "total_dues": round(total_supplier_dues, 2)
        },
        "documents": {
            "expired": expired_docs,
            "expiring_soon": expiring_docs
        },
        "receivables": {
            "total_customer_credit": round(total_customer_credit, 2)
        }
    }


# =====================================================
# ASSET MAINTENANCE LOG
# =====================================================

@router.post("/assets/{asset_id}/maintenance")
async def log_maintenance(asset_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Log maintenance activity for an asset"""
    asset = await db.assets.find_one({"id": asset_id, **get_tenant_filter(current_user)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    log_entry = {
        "id": str(uuid.uuid4()),
        "asset_id": asset_id,
        "date": body.get("date", datetime.now(timezone.utc).isoformat()),
        "type": body.get("type", "maintenance"),  # maintenance, repair, inspection
        "description": body.get("description", ""),
        "cost": float(body.get("cost", 0)),
        "performed_by": body.get("performed_by", ""),
        "notes": body.get("notes", ""),
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    stamp_tenant(log_entry, current_user)
    await db.asset_maintenance.insert_one(log_entry)
    
    # Update asset status if specified
    if body.get("update_status"):
        await db.assets.update_one({"id": asset_id, **get_tenant_filter(current_user)}, {"$set": {"status": body.get("update_status")}})
    
    return {k: v for k, v in log_entry.items() if k != "_id"}


@router.get("/assets/{asset_id}/maintenance")
async def get_maintenance_logs(asset_id: str, current_user: User = Depends(get_current_user)):
    """Get maintenance history for an asset"""
    logs = await db.asset_maintenance.find({"asset_id": asset_id}, {"_id": 0}).sort("date", -1).to_list(100)
    return logs
