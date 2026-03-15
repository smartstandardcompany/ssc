"""
Central Add-on Library
Manages global add-ons that can be linked to menu items
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db, get_current_user, get_tenant_filter, stamp_tenant
from models import User

router = APIRouter()


@router.get("/addons")
async def get_addons(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if category:
        query["category"] = category
    addons = await db.addons.find(query, {"_id": 0}).sort("category", 1).to_list(500)
    return addons


@router.post("/addons")
async def create_addon(body: dict, current_user: User = Depends(get_current_user)):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager only")

    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    addon = {
        "id": str(uuid.uuid4()),
        "name": name,
        "name_ar": body.get("name_ar", "").strip(),
        "price": float(body.get("price", 0)),
        "category": body.get("category", "extras").strip(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    stamp_tenant(addon, current_user)
    await db.addons.insert_one(addon)
    return {k: v for k, v in addon.items() if k != "_id"}


@router.put("/addons/{addon_id}")
async def update_addon(addon_id: str, body: dict, current_user: User = Depends(get_current_user)):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager only")

    existing = await db.addons.find_one({"id": addon_id, **get_tenant_filter(current_user)})
    if not existing:
        raise HTTPException(status_code=404, detail="Add-on not found")

    update = {}
    if "name" in body:
        update["name"] = body["name"].strip()
    if "name_ar" in body:
        update["name_ar"] = body["name_ar"].strip()
    if "price" in body:
        update["price"] = float(body["price"])
    if "category" in body:
        update["category"] = body["category"].strip()
    if "is_active" in body:
        update["is_active"] = bool(body["is_active"])

    if update:
        await db.addons.update_one({"id": addon_id, **get_tenant_filter(current_user)}, {"$set": update})
    return await db.addons.find_one({"id": addon_id, **get_tenant_filter(current_user)}, {"_id": 0})


@router.delete("/addons/{addon_id}")
async def delete_addon(addon_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Admin or manager only")

    result = await db.addons.delete_one({"id": addon_id, **get_tenant_filter(current_user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Add-on not found")
    return {"message": "Add-on deleted"}


@router.get("/addons/categories")
async def get_addon_categories(current_user: User = Depends(get_current_user)):
    """Get distinct add-on categories"""
    categories = await db.addons.distinct("category")
    return sorted(categories)
