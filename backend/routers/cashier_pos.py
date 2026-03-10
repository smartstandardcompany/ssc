"""
Restaurant POS System - Cashier Interface
Foodics-style POS with menu items, modifiers, and multiple payment options
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import random
import string
import os
import shutil

from database import db, get_current_user, hash_password, verify_password
from models import (User, MenuItem, MenuItemCreate, POSOrder, POSOrderCreate, 
                    MenuCategory, Customer)

router = APIRouter()

# =====================================================
# CASHIER AUTHENTICATION (PIN-based login)
# =====================================================

@router.post("/cashier/login")
async def cashier_login(body: dict):
    """Login endpoint for cashier POS - supports PIN or email/password"""
    pin = body.get("pin")
    email = body.get("email")
    password = body.get("password")
    
    user = None
    employee = None
    
    # PIN-based login (preferred for cashiers)
    if pin:
        # Find employee/user by PIN (check both status="active" and active=True for compatibility)
        employee = await db.employees.find_one({
            "cashier_pin": pin, 
            "$or": [{"status": "active"}, {"active": True}]
        }, {"_id": 0})
        if employee:
            if employee.get("user_id"):
                user = await db.users.find_one({"id": employee["user_id"]}, {"_id": 0})
            else:
                # Create a virtual user object for employee without user account
                user = {
                    "id": employee["id"],
                    "name": employee["name"],
                    "email": employee.get("email", ""),
                    "role": "cashier",
                    "branch_id": employee.get("branch_id"),
                    "permissions": ["cashier", "pos", "sales"]
                }
        else:
            # Also check users collection for admin PIN
            user = await db.users.find_one({"cashier_pin": pin}, {"_id": 0})
            if not user:
                raise HTTPException(status_code=401, detail="Invalid PIN")
    
    # Email/password login (fallback)
    elif email and password:
        user = await db.users.find_one({"email": email}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        if not verify_password(password, user.get("password", "")):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Get employee details if linked
        if user.get("id"):
            employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    else:
        raise HTTPException(status_code=400, detail="PIN or email/password required")
    
    # Check if user has cashier access
    allowed_roles = ["admin", "cashier", "manager"]
    allowed_permissions = ["cashier", "pos", "sales"]
    
    has_role = user.get("role") in allowed_roles
    has_permission = any(p in user.get("permissions", []) for p in allowed_permissions)
    
    if not has_role and not has_permission:
        raise HTTPException(status_code=403, detail="You don't have cashier access")
    
    # Get branch info
    branch = None
    branch_id = user.get("branch_id") or (employee.get("branch_id") if employee else None)
    if branch_id:
        branch = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    
    from database import create_access_token
    token = create_access_token({"sub": user["id"]})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user.get("email", ""),
            "name": user["name"],
            "role": user.get("role"),
            "pos_role": employee.get("pos_role", "both") if employee else "both",
            "branch_id": branch_id,
            "branch_name": branch["name"] if branch else None,
            "employee_id": employee["id"] if employee else None
        }
    }


# =====================================================
# CASHIER PIN MANAGEMENT
# =====================================================

def generate_pin(length=4):
    """Generate a random numeric PIN"""
    return ''.join(random.choices(string.digits, k=length))

@router.post("/cashier/generate-pin/{employee_id}")
async def generate_cashier_pin(employee_id: str, current_user: User = Depends(get_current_user)):
    """Generate a new cashier PIN for an employee"""
    employee = await db.employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Generate unique PIN
    while True:
        new_pin = generate_pin(4)
        existing = await db.employees.find_one({"cashier_pin": new_pin})
        if not existing:
            break
    
    await db.employees.update_one({"id": employee_id}, {"$set": {"cashier_pin": new_pin}})
    return {"employee_id": employee_id, "name": employee["name"], "pin": new_pin}

@router.get("/cashier/pins")
async def get_cashier_pins(current_user: User = Depends(get_current_user)):
    """Get all cashier PINs (admin only)"""
    employees = await db.employees.find(
        {"cashier_pin": {"$exists": True, "$ne": None}, "status": "active"},
        {"_id": 0, "id": 1, "name": 1, "cashier_pin": 1, "branch_id": 1}
    ).to_list(500)
    
    # Get branch names
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    
    for emp in employees:
        emp["branch_name"] = branch_map.get(emp.get("branch_id"), "-")
    
    return employees

@router.delete("/cashier/pin/{employee_id}")
async def revoke_cashier_pin(employee_id: str, current_user: User = Depends(get_current_user)):
    """Revoke a cashier's PIN"""
    result = await db.employees.update_one({"id": employee_id}, {"$unset": {"cashier_pin": ""}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found or no PIN to revoke")
    return {"message": "PIN revoked successfully"}


# =====================================================
# CUSTOMER ORDER STATUS (Public endpoint)
# =====================================================

@router.get("/order-status/active")
async def get_active_orders_for_display(branch_id: Optional[str] = None):
    """Get active orders for customer-facing display (no auth required)"""
    query = {"status": {"$in": ["preparing", "ready"]}}
    if branch_id:
        query["branch_id"] = branch_id
    
    # Only get orders from today
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query["created_at"] = {"$gte": f"{today}T00:00:00"}
    
    orders = await db.pos_orders.find(query, {
        "_id": 0,
        "id": 1,
        "order_number": 1,
        "status": 1,
        "order_type": 1,
        "customer_name": 1,
        "table_number": 1,
        "table_id": 1,
        "created_at": 1
    }).sort("order_number", 1).to_list(100)
    
    # Separate by status
    preparing = [o for o in orders if o["status"] == "preparing"]
    ready = [o for o in orders if o["status"] == "ready"]
    
    return {
        "preparing": preparing,
        "ready": ready,
        "total_preparing": len(preparing),
        "total_ready": len(ready)
    }


# =====================================================
# MENU CATEGORIES
# =====================================================

@router.get("/cashier/categories")
async def get_menu_categories(current_user: User = Depends(get_current_user)):
    """Get all menu categories"""
    categories = await db.menu_categories.find({"is_active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)
    if not categories:
        # Return default categories if none exist
        return [
            {"id": "all", "name": "All Items", "name_ar": "جميع الأصناف", "icon": "Grid", "color": "#F97316", "display_order": 0},
            {"id": "popular", "name": "Popular", "name_ar": "الأكثر طلباً", "icon": "Star", "color": "#EAB308", "display_order": 1},
            {"id": "main", "name": "Main Dishes", "name_ar": "الأطباق الرئيسية", "icon": "UtensilsCrossed", "color": "#22C55E", "display_order": 2},
            {"id": "appetizer", "name": "Appetizers", "name_ar": "المقبلات", "icon": "Salad", "color": "#3B82F6", "display_order": 3},
            {"id": "beverage", "name": "Beverages", "name_ar": "المشروبات", "icon": "Coffee", "color": "#8B5CF6", "display_order": 4},
            {"id": "dessert", "name": "Desserts", "name_ar": "الحلويات", "icon": "Cake", "color": "#EC4899", "display_order": 5},
            {"id": "sides", "name": "Sides", "name_ar": "الإضافات", "icon": "Pizza", "color": "#14B8A6", "display_order": 6},
        ]
    return categories

@router.post("/cashier/categories")
async def create_menu_category(body: dict, current_user: User = Depends(get_current_user)):
    """Create a new menu category"""
    category = MenuCategory(
        name=body["name"],
        name_ar=body.get("name_ar"),
        icon=body.get("icon"),
        color=body.get("color"),
        display_order=body.get("display_order", 0)
    )
    cat_dict = category.model_dump()
    cat_dict["created_at"] = cat_dict["created_at"].isoformat()
    await db.menu_categories.insert_one(cat_dict)
    return {k: v for k, v in cat_dict.items() if k != '_id'}


# =====================================================
# MENU ITEMS
# =====================================================

@router.get("/cashier/menu")
async def get_menu_items(
    category: Optional[str] = None,
    branch_id: Optional[str] = None,
    platform_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get menu items for POS display"""
    query = {"is_available": True}
    
    if category and category not in ["all", "popular"]:
        query["category"] = category
    
    if category == "popular":
        query["tags"] = "popular"
    
    if branch_id:
        # Show items available for this branch (empty branch_ids means all branches)
        query["$or"] = [
            {"branch_ids": {"$size": 0}},
            {"branch_ids": {"$exists": False}},
            {"branch_ids": branch_id},
            # Legacy support
            {"branch_id": None},
            {"branch_id": branch_id}
        ]
    
    if platform_id:
        query["platform_ids"] = platform_id
    
    if search:
        search_filter = [
            {"name": {"$regex": search, "$options": "i"}},
            {"name_ar": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
        if "$or" in query:
            query = {"$and": [query, {"$or": search_filter}]}
        else:
            query["$or"] = search_filter
    
    items = await db.menu_items.find(query, {"_id": 0}).sort("display_order", 1).to_list(500)
    return items

@router.get("/cashier/menu/{item_id}")
async def get_menu_item(item_id: str, current_user: User = Depends(get_current_user)):
    """Get a single menu item with full details"""
    item = await db.menu_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("/cashier/menu")
async def create_menu_item(data: MenuItemCreate, current_user: User = Depends(get_current_user)):
    """Create a new menu item"""
    item = MenuItem(**data.model_dump())
    item_dict = item.model_dump()
    item_dict["created_at"] = item_dict["created_at"].isoformat()
    await db.menu_items.insert_one(item_dict)
    return {k: v for k, v in item_dict.items() if k != '_id'}

# IMPORTANT: Bulk endpoints must be defined BEFORE parameterized routes to avoid route conflicts
@router.put("/cashier/menu/bulk-branch-assign")
async def bulk_assign_branches(body: dict, current_user: User = Depends(get_current_user)):
    """Bulk assign items to branches. body: {item_ids: [], branch_ids: []}"""
    item_ids = body.get("item_ids", [])
    branch_ids = body.get("branch_ids", [])
    result = await db.menu_items.update_many({"id": {"$in": item_ids}}, {"$set": {"branch_ids": branch_ids}})
    return {"success": True, "modified": result.modified_count}

@router.put("/cashier/menu/bulk-platform-assign")
async def bulk_assign_platforms(body: dict, current_user: User = Depends(get_current_user)):
    """Bulk assign items to platforms. body: {item_ids: [], platform_ids: []}"""
    item_ids = body.get("item_ids", [])
    platform_ids = body.get("platform_ids", [])
    result = await db.menu_items.update_many({"id": {"$in": item_ids}}, {"$set": {"platform_ids": platform_ids}})
    return {"success": True, "modified": result.modified_count}

@router.put("/cashier/menu/{item_id}")
async def update_menu_item(item_id: str, data: MenuItemCreate, current_user: User = Depends(get_current_user)):
    """Update a menu item"""
    existing = await db.menu_items.find_one({"id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = data.model_dump()
    await db.menu_items.update_one({"id": item_id}, {"$set": update_data})
    return await db.menu_items.find_one({"id": item_id}, {"_id": 0})

@router.delete("/cashier/menu/{item_id}")
async def delete_menu_item(item_id: str, current_user: User = Depends(get_current_user)):
    """Delete (deactivate) a menu item"""
    result = await db.menu_items.update_one({"id": item_id}, {"$set": {"is_available": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}


@router.put("/cashier/menu/{item_id}/branches")
async def update_menu_item_branches(item_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update which branches a menu item is available at"""
    branch_ids = body.get("branch_ids", [])
    result = await db.menu_items.update_one({"id": item_id}, {"$set": {"branch_ids": branch_ids}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True, "branch_ids": branch_ids}

@router.put("/cashier/menu/{item_id}/platforms")
async def update_menu_item_platforms(item_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update which platforms a menu item is listed on"""
    platform_ids = body.get("platform_ids", [])
    platform_prices = body.get("platform_prices", {})
    result = await db.menu_items.update_one({"id": item_id}, {"$set": {"platform_ids": platform_ids, "platform_prices": platform_prices}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True, "platform_ids": platform_ids}

@router.get("/cashier/menu/export/{platform_id}")
async def export_menu_for_platform(platform_id: str, current_user: User = Depends(get_current_user)):
    """Export menu items for a specific platform"""
    platform = await db.delivery_platforms.find_one({"id": platform_id}, {"_id": 0})
    if not platform:
        raise HTTPException(status_code=404, detail="Platform not found")
    
    items = await db.menu_items.find({"is_available": True, "platform_ids": platform_id}, {"_id": 0}).sort("category", 1).to_list(500)
    
    export_items = []
    for item in items:
        platform_price = item.get("platform_prices", {}).get(platform_id, item["price"])
        export_items.append({
            "name": item["name"],
            "name_ar": item.get("name_ar", ""),
            "description": item.get("description", ""),
            "category": item.get("category", "main"),
            "price": platform_price,
            "original_price": item["price"],
            "preparation_time": item.get("preparation_time", 10),
            "image_url": item.get("image_url", ""),
            "tags": item.get("tags", []),
            "modifiers": item.get("modifiers", [])
        })
    
    return {
        "platform": platform["name"],
        "platform_ar": platform.get("name_ar", ""),
        "total_items": len(export_items),
        "items": export_items
    }

@router.get("/cashier/menu-all")
async def get_all_menu_items(current_user: User = Depends(get_current_user)):
    """Get ALL menu items including unavailable ones - for admin menu management"""
    items = await db.menu_items.find({}, {"_id": 0}).sort("display_order", 1).to_list(500)
    return items



# =====================================================
# POS ORDERS
# =====================================================

async def get_next_order_number(branch_id: str) -> int:
    """Get the next order number for today"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_start = datetime.fromisoformat(f"{today}T00:00:00+00:00")
    
    last_order = await db.pos_orders.find_one(
        {"branch_id": branch_id, "created_at": {"$gte": today_start.isoformat()}},
        {"_id": 0, "order_number": 1},
        sort=[("order_number", -1)]
    )
    return (last_order.get("order_number", 0) if last_order else 0) + 1

@router.post("/cashier/orders")
async def create_pos_order(data: POSOrderCreate, current_user: User = Depends(get_current_user)):
    """Create a new POS order"""
    # Calculate totals
    subtotal = 0
    processed_items = []
    
    for item in data.items:
        item_data = await db.menu_items.find_one({"id": item["item_id"]}, {"_id": 0})
        if not item_data:
            raise HTTPException(status_code=404, detail=f"Item {item['item_id']} not found")
        
        unit_price = item_data["price"]
        
        # Add modifier prices
        modifier_total = 0
        for mod in item.get("modifiers", []):
            modifier_total += mod.get("price", 0)
        
        item_total = (unit_price + modifier_total) * item["quantity"]
        subtotal += item_total
        
        processed_items.append({
            "item_id": item["item_id"],
            "name": item_data["name"],
            "name_ar": item_data.get("name_ar"),
            "quantity": item["quantity"],
            "unit_price": unit_price,
            "modifiers": item.get("modifiers", []),
            "modifier_total": modifier_total,
            "subtotal": round(item_total, 2)
        })
    
    # Apply discount
    if data.discount_type == "percent":
        discount_amount = subtotal * (data.discount / 100)
    else:
        discount_amount = data.discount
    
    # Calculate tax (15% VAT)
    tax_rate = 0.15
    taxable_amount = subtotal - discount_amount
    tax = taxable_amount * tax_rate
    total = taxable_amount + tax
    
    # Get customer name if provided
    customer_name = None
    if data.customer_id:
        customer = await db.customers.find_one({"id": data.customer_id}, {"_id": 0})
        if customer:
            customer_name = customer["name"]
    
    # Create order
    order_number = await get_next_order_number(data.branch_id)
    
    order = POSOrder(
        order_number=order_number,
        branch_id=data.branch_id,
        cashier_id=current_user.id,
        cashier_name=current_user.name,
        customer_id=data.customer_id,
        customer_name=customer_name,
        items=processed_items,
        subtotal=round(subtotal, 2),
        discount=round(discount_amount, 2),
        discount_type=data.discount_type,
        tax=round(tax, 2),
        tax_rate=tax_rate,
        total=round(total, 2),
        payment_method=data.payment_method,
        payment_details=data.payment_details or [],
        status="completed" if data.payment_method != "credit" else "pending",
        order_type=data.order_type,
        table_number=data.table_number,
        notes=data.notes,
        kitchen_notes=data.kitchen_notes
    )
    
    order_dict = order.model_dump()
    for f in ["created_at", "kitchen_sent_at", "completed_at"]:
        if order_dict.get(f):
            order_dict[f] = order_dict[f].isoformat()
    
    await db.pos_orders.insert_one(order_dict)
    
    # If payment includes credit, update customer credit
    if data.payment_method == "credit" and data.customer_id:
        await db.customers.update_one(
            {"id": data.customer_id},
            {"$inc": {"credit_balance": total}}
        )
    
    # Create a sale record for reporting
    sale_dict = {
        "id": str(uuid.uuid4()),
        "sale_type": "pos",
        "branch_id": data.branch_id,
        "customer_id": data.customer_id,
        "amount": subtotal,
        "discount": discount_amount,
        "final_amount": total,
        "payment_details": data.payment_details or [{"mode": data.payment_method, "amount": total}],
        "credit_amount": total if data.payment_method == "credit" else 0,
        "date": datetime.now(timezone.utc).isoformat(),
        "notes": f"POS Order #{order_number}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
        "pos_order_id": order.id
    }
    await db.sales.insert_one(sale_dict)
    
    return {k: v for k, v in order_dict.items() if k != '_id'}

@router.get("/cashier/orders")
async def get_pos_orders(
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get POS orders for the cashier view"""
    query = {}
    
    if branch_id:
        query["branch_id"] = branch_id
    
    if status:
        query["status"] = status
    
    if date:
        query["created_at"] = {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59"}
    else:
        # Default to today's orders
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        query["created_at"] = {"$gte": f"{today}T00:00:00"}
    
    orders = await db.pos_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@router.get("/cashier/orders/{order_id}")
async def get_pos_order(order_id: str, current_user: User = Depends(get_current_user)):
    """Get a single POS order"""
    order = await db.pos_orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.put("/cashier/orders/{order_id}/status")
async def update_order_status(order_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update order status"""
    order = await db.pos_orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    new_status = body.get("status")
    update = {"status": new_status}
    
    if new_status == "completed":
        update["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.pos_orders.update_one({"id": order_id}, {"$set": update})
    return await db.pos_orders.find_one({"id": order_id}, {"_id": 0})

@router.post("/cashier/orders/{order_id}/send-kitchen")
async def send_to_kitchen(order_id: str, current_user: User = Depends(get_current_user)):
    """Send order to kitchen display"""
    order = await db.pos_orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    await db.pos_orders.update_one(
        {"id": order_id},
        {"$set": {
            "sent_to_kitchen": True,
            "kitchen_sent_at": datetime.now(timezone.utc).isoformat(),
            "status": "preparing"
        }}
    )
    
    # Create kitchen order notification
    notification = {
        "id": str(uuid.uuid4()),
        "type": "kitchen_order",
        "title": f"New Order #{order.get('order_number')}",
        "message": f"{len(order.get('items', []))} items - {order.get('order_type', 'dine_in')}",
        "order_id": order_id,
        "branch_id": order.get("branch_id"),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Order sent to kitchen", "order_id": order_id}


@router.put("/cashier/orders/{order_id}")
async def edit_pos_order(order_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Edit an existing POS order - update items, payment, discount, notes"""
    order = await db.pos_orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    update = {}
    # Recalculate if items changed
    if "items" in body:
        subtotal = 0
        processed_items = []
        for item in body["items"]:
            item_data = await db.menu_items.find_one({"id": item["item_id"]}, {"_id": 0})
            if not item_data:
                continue
            unit_price = item_data["price"]
            modifier_total = sum(m.get("price", 0) for m in item.get("modifiers", []))
            item_total = (unit_price + modifier_total) * item["quantity"]
            subtotal += item_total
            processed_items.append({
                "item_id": item["item_id"], "name": item_data["name"],
                "name_ar": item_data.get("name_ar"), "quantity": item["quantity"],
                "unit_price": unit_price, "modifiers": item.get("modifiers", []),
                "modifier_total": modifier_total, "subtotal": round(item_total, 2)
            })
        discount = body.get("discount", order.get("discount", 0))
        discount_type = body.get("discount_type", order.get("discount_type", "amount"))
        if discount_type == "percent":
            discount_amount = subtotal * (discount / 100)
        else:
            discount_amount = discount
        taxable = subtotal - discount_amount
        tax = taxable * 0.15
        total = taxable + tax
        update.update({
            "items": processed_items, "subtotal": round(subtotal, 2),
            "discount": round(discount_amount, 2), "discount_type": discount_type,
            "tax": round(tax, 2), "total": round(total, 2)
        })
        # Also update the linked sale record
        await db.sales.update_one(
            {"pos_order_id": order_id},
            {"$set": {"amount": round(subtotal, 2), "discount": round(discount_amount, 2), "final_amount": round(total, 2)}}
        )
    if "payment_method" in body:
        update["payment_method"] = body["payment_method"]
        update["payment_details"] = body.get("payment_details", [{"mode": body["payment_method"], "amount": update.get("total", order.get("total", 0))}])
    if "notes" in body:
        update["notes"] = body["notes"]
    if "order_type" in body:
        update["order_type"] = body["order_type"]
    if "table_number" in body:
        update["table_number"] = body["table_number"]
    if "customer_id" in body:
        update["customer_id"] = body["customer_id"]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    update["updated_by"] = current_user.id

    await db.pos_orders.update_one({"id": order_id}, {"$set": update})
    updated = await db.pos_orders.find_one({"id": order_id}, {"_id": 0})
    return updated

@router.delete("/cashier/orders/{order_id}")
async def delete_pos_order(order_id: str, current_user: User = Depends(get_current_user)):
    """Void/delete a POS order and its linked sale"""
    order = await db.pos_orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # If payment was credit, reverse the customer credit
    if order.get("payment_method") == "credit" and order.get("customer_id"):
        await db.customers.update_one(
            {"id": order["customer_id"]},
            {"$inc": {"credit_balance": -order.get("total", 0)}}
        )
    # Delete linked sale record
    await db.sales.delete_one({"pos_order_id": order_id})
    # Delete the order
    await db.pos_orders.delete_one({"id": order_id})
    return {"message": f"Order #{order.get('order_number')} voided successfully"}


# =====================================================
# POS SHIFT MANAGEMENT
# =====================================================

@router.post("/cashier/shift/start")
async def start_cashier_shift(body: dict, current_user: User = Depends(get_current_user)):
    """Start a cashier shift with opening cash"""
    branch_id = body.get("branch_id")
    opening_cash = float(body.get("opening_cash", 0))
    
    # Check for existing open shift
    existing = await db.cashier_shifts.find_one({
        "cashier_id": current_user.id,
        "status": "open"
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have an open shift")
    
    shift = {
        "id": str(uuid.uuid4()),
        "cashier_id": current_user.id,
        "cashier_name": current_user.name,
        "branch_id": branch_id,
        "opening_cash": opening_cash,
        "closing_cash": None,
        "expected_cash": opening_cash,
        "cash_difference": None,
        "total_sales": 0,
        "total_orders": 0,
        "payment_breakdown": {"cash": 0, "card": 0, "online": 0, "credit": 0},
        "status": "open",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "notes": body.get("notes")
    }
    await db.cashier_shifts.insert_one(shift)
    return {k: v for k, v in shift.items() if k != '_id'}

@router.get("/cashier/shift/current")
async def get_current_shift(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get current open shift for the cashier"""
    query = {"cashier_id": current_user.id, "status": "open"}
    if branch_id:
        query["branch_id"] = branch_id
    
    shift = await db.cashier_shifts.find_one(query, {"_id": 0})
    if not shift:
        return None
    
    # Calculate current totals from orders
    orders = await db.pos_orders.find({
        "cashier_id": current_user.id,
        "created_at": {"$gte": shift["started_at"]},
        "status": {"$ne": "cancelled"}
    }, {"_id": 0}).to_list(1000)
    
    total_sales = sum(o.get("total", 0) for o in orders)
    payment_breakdown = {"cash": 0, "card": 0, "online": 0, "credit": 0}
    
    for order in orders:
        method = order.get("payment_method", "cash")
        if method in payment_breakdown:
            payment_breakdown[method] += order.get("total", 0)
    
    shift["total_sales"] = round(total_sales, 2)
    shift["total_orders"] = len(orders)
    shift["payment_breakdown"] = {k: round(v, 2) for k, v in payment_breakdown.items()}
    shift["expected_cash"] = round(shift["opening_cash"] + payment_breakdown["cash"], 2)
    
    return shift

@router.post("/cashier/shift/end")
async def end_cashier_shift(body: dict, current_user: User = Depends(get_current_user)):
    """End cashier shift with closing cash count"""
    shift = await db.cashier_shifts.find_one({
        "cashier_id": current_user.id,
        "status": "open"
    })
    if not shift:
        raise HTTPException(status_code=404, detail="No open shift found")
    
    closing_cash = float(body.get("closing_cash", 0))
    
    # Calculate expected cash
    orders = await db.pos_orders.find({
        "cashier_id": current_user.id,
        "created_at": {"$gte": shift["started_at"]},
        "status": {"$ne": "cancelled"}
    }, {"_id": 0}).to_list(1000)
    
    total_sales = sum(o.get("total", 0) for o in orders)
    cash_sales = sum(o.get("total", 0) for o in orders if o.get("payment_method") == "cash")
    expected_cash = shift["opening_cash"] + cash_sales
    cash_difference = closing_cash - expected_cash
    
    payment_breakdown = {"cash": 0, "card": 0, "online": 0, "credit": 0}
    for order in orders:
        method = order.get("payment_method", "cash")
        if method in payment_breakdown:
            payment_breakdown[method] += order.get("total", 0)
    
    update = {
        "closing_cash": closing_cash,
        "expected_cash": round(expected_cash, 2),
        "cash_difference": round(cash_difference, 2),
        "total_sales": round(total_sales, 2),
        "total_orders": len(orders),
        "payment_breakdown": {k: round(v, 2) for k, v in payment_breakdown.items()},
        "status": "closed",
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "notes": body.get("notes")
    }
    
    await db.cashier_shifts.update_one({"id": shift["id"]}, {"$set": update})
    
    result = {**shift, **update}
    return {k: v for k, v in result.items() if k != '_id'}


# =====================================================
# CUSTOMERS (Quick access for POS)
# =====================================================

@router.get("/cashier/customers")
async def get_customers_for_pos(
    search: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get customers for credit payment selection"""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    if branch_id:
        query["$or"] = query.get("$or", [])
        query["$or"].extend([{"branch_id": branch_id}, {"branch_id": None}])
    
    customers = await db.customers.find(query, {"_id": 0}).limit(50).to_list(50)
    return customers

@router.post("/cashier/customers/quick")
async def quick_create_customer(body: dict, current_user: User = Depends(get_current_user)):
    """Quick create customer from POS"""
    customer = Customer(
        name=body["name"],
        phone=body.get("phone"),
        branch_id=body.get("branch_id")
    )
    cust_dict = customer.model_dump()
    cust_dict["created_at"] = cust_dict["created_at"].isoformat()
    cust_dict["credit_balance"] = 0
    await db.customers.insert_one(cust_dict)
    return {k: v for k, v in cust_dict.items() if k != '_id'}


# =====================================================
# POS STATISTICS
# =====================================================

@router.get("/cashier/stats")
async def get_pos_stats(branch_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get POS statistics for dashboard"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    query = {"created_at": {"$gte": f"{today}T00:00:00"}}
    if branch_id:
        query["branch_id"] = branch_id
    
    orders = await db.pos_orders.find(query, {"_id": 0}).to_list(1000)
    
    completed = [o for o in orders if o.get("status") != "cancelled"]
    
    total_sales = sum(o.get("total", 0) for o in completed)
    total_orders = len(completed)
    avg_order = total_sales / total_orders if total_orders > 0 else 0
    
    # Payment breakdown
    payment_breakdown = {"cash": 0, "card": 0, "online": 0, "credit": 0}
    for order in completed:
        method = order.get("payment_method", "cash")
        if method in payment_breakdown:
            payment_breakdown[method] += order.get("total", 0)
    
    # Top selling items
    item_sales = {}
    for order in completed:
        for item in order.get("items", []):
            item_id = item.get("item_id")
            if item_id not in item_sales:
                item_sales[item_id] = {"name": item.get("name"), "quantity": 0, "total": 0}
            item_sales[item_id]["quantity"] += item.get("quantity", 1)
            item_sales[item_id]["total"] += item.get("subtotal", 0)
    
    top_items = sorted(item_sales.values(), key=lambda x: x["quantity"], reverse=True)[:5]
    
    return {
        "today": {
            "total_sales": round(total_sales, 2),
            "total_orders": total_orders,
            "avg_order_value": round(avg_order, 2),
            "payment_breakdown": {k: round(v, 2) for k, v in payment_breakdown.items()}
        },
        "top_items": top_items,
        "pending_orders": len([o for o in orders if o.get("status") in ["pending", "preparing"]])
    }


# =====================================================
# MENU ITEM IMAGE UPLOAD
# =====================================================

UPLOAD_DIR = "/app/uploads/menu"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/cashier/menu/{item_id}/image")
async def upload_menu_item_image(
    item_id: str, 
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload an image for a menu item"""
    # Verify item exists
    item = await db.menu_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: JPEG, PNG, WebP, GIF")
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{item_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Delete old image if exists
    if item.get("image_url"):
        old_filename = item["image_url"].split("/")[-1]
        old_path = os.path.join(UPLOAD_DIR, old_filename)
        if os.path.exists(old_path):
            os.remove(old_path)
    
    # Save file
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Update database with relative URL
    image_url = f"/uploads/menu/{filename}"
    await db.menu_items.update_one({"id": item_id}, {"$set": {"image_url": image_url}})
    
    return {"message": "Image uploaded successfully", "image_url": image_url}

@router.delete("/cashier/menu/{item_id}/image")
async def delete_menu_item_image(item_id: str, current_user: User = Depends(get_current_user)):
    """Delete menu item image"""
    item = await db.menu_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.get("image_url"):
        filename = item["image_url"].split("/")[-1]
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    
    await db.menu_items.update_one({"id": item_id}, {"$set": {"image_url": None}})
    return {"message": "Image deleted successfully"}


# =====================================================
# SEED SAMPLE MENU DATA
# =====================================================

# =====================================================
# DAILY SHIFT REPORTS
# =====================================================

@router.get("/cashier/shift-report")
async def get_daily_shift_report(
    date: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get daily shift report with all cashier shifts for a given date"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Query for shifts that started on the given date
    query = {
        "started_at": {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59"}
    }
    if branch_id:
        query["branch_id"] = branch_id
    
    shifts = await db.cashier_shifts.find(query, {"_id": 0}).to_list(500)
    
    # Get branch names
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    
    # Aggregate data
    total_opening_cash = 0
    total_closing_cash = 0
    total_expected_cash = 0
    total_sales = 0
    total_orders = 0
    total_cash_difference = 0
    payment_totals = {"cash": 0, "card": 0, "online": 0, "credit": 0}
    
    shift_details = []
    for shift in shifts:
        shift["branch_name"] = branch_map.get(shift.get("branch_id"), "Unknown")
        total_opening_cash += shift.get("opening_cash", 0)
        total_closing_cash += shift.get("closing_cash", 0) or 0
        total_expected_cash += shift.get("expected_cash", 0) or 0
        total_sales += shift.get("total_sales", 0)
        total_orders += shift.get("total_orders", 0)
        total_cash_difference += shift.get("cash_difference", 0) or 0
        
        breakdown = shift.get("payment_breakdown", {})
        for method in payment_totals:
            payment_totals[method] += breakdown.get(method, 0)
        
        # Calculate shift duration
        if shift.get("started_at") and shift.get("ended_at"):
            start = datetime.fromisoformat(shift["started_at"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(shift["ended_at"].replace("Z", "+00:00"))
            duration_hours = (end - start).total_seconds() / 3600
            shift["duration_hours"] = round(duration_hours, 2)
        else:
            shift["duration_hours"] = None
        
        shift_details.append(shift)
    
    # Get top selling items for the day
    orders_query = {"created_at": {"$gte": f"{date}T00:00:00", "$lt": f"{date}T23:59:59"}}
    if branch_id:
        orders_query["branch_id"] = branch_id
    
    orders = await db.pos_orders.find(orders_query, {"_id": 0}).to_list(1000)
    item_sales = {}
    for order in orders:
        for item in order.get("items", []):
            item_id = item.get("item_id")
            if item_id not in item_sales:
                item_sales[item_id] = {"name": item.get("name"), "quantity": 0, "revenue": 0}
            item_sales[item_id]["quantity"] += item.get("quantity", 1)
            item_sales[item_id]["revenue"] += item.get("subtotal", 0)
    
    top_items = sorted(item_sales.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    
    # Calculate by branch
    branch_summary = {}
    for shift in shifts:
        bid = shift.get("branch_id")
        bname = branch_map.get(bid, "Unknown")
        if bname not in branch_summary:
            branch_summary[bname] = {"shifts": 0, "sales": 0, "orders": 0, "cash_difference": 0}
        branch_summary[bname]["shifts"] += 1
        branch_summary[bname]["sales"] += shift.get("total_sales", 0)
        branch_summary[bname]["orders"] += shift.get("total_orders", 0)
        branch_summary[bname]["cash_difference"] += shift.get("cash_difference", 0) or 0
    
    return {
        "date": date,
        "summary": {
            "total_shifts": len(shifts),
            "open_shifts": len([s for s in shifts if s.get("status") == "open"]),
            "closed_shifts": len([s for s in shifts if s.get("status") == "closed"]),
            "total_opening_cash": round(total_opening_cash, 2),
            "total_closing_cash": round(total_closing_cash, 2),
            "total_expected_cash": round(total_expected_cash, 2),
            "total_cash_difference": round(total_cash_difference, 2),
            "total_sales": round(total_sales, 2),
            "total_orders": total_orders,
            "payment_breakdown": {k: round(v, 2) for k, v in payment_totals.items()}
        },
        "branch_summary": branch_summary,
        "shifts": shift_details,
        "top_items": top_items
    }


@router.get("/cashier/shift-report/range")
async def get_shift_report_range(
    start_date: str,
    end_date: str,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get shift report for a date range"""
    query = {
        "started_at": {"$gte": f"{start_date}T00:00:00", "$lt": f"{end_date}T23:59:59"}
    }
    if branch_id:
        query["branch_id"] = branch_id
    
    shifts = await db.cashier_shifts.find(query, {"_id": 0}).to_list(5000)
    
    # Group by date
    daily_data = {}
    for shift in shifts:
        date = shift.get("started_at", "")[:10]
        if date not in daily_data:
            daily_data[date] = {"shifts": 0, "sales": 0, "orders": 0, "cash_difference": 0}
        daily_data[date]["shifts"] += 1
        daily_data[date]["sales"] += shift.get("total_sales", 0)
        daily_data[date]["orders"] += shift.get("total_orders", 0)
        daily_data[date]["cash_difference"] += shift.get("cash_difference", 0) or 0
    
    # Calculate totals
    total_sales = sum(d["sales"] for d in daily_data.values())
    total_orders = sum(d["orders"] for d in daily_data.values())
    total_shifts = sum(d["shifts"] for d in daily_data.values())
    total_cash_diff = sum(d["cash_difference"] for d in daily_data.values())
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "summary": {
            "total_days": len(daily_data),
            "total_shifts": total_shifts,
            "total_sales": round(total_sales, 2),
            "total_orders": total_orders,
            "total_cash_difference": round(total_cash_diff, 2),
            "avg_sales_per_day": round(total_sales / max(len(daily_data), 1), 2)
        },
        "daily_breakdown": [{"date": k, **v} for k, v in sorted(daily_data.items())]
    }


@router.post("/cashier/seed-menu")
async def seed_menu_data(current_user: User = Depends(get_current_user)):
    """Seed sample menu items for testing"""
    
    # Check if menu already has items
    existing = await db.menu_items.count_documents({})
    if existing > 0:
        return {"message": f"Menu already has {existing} items", "seeded": False}
    
    # Sample menu items
    sample_items = [
        # Main Dishes
        {"name": "Chicken Shawarma", "name_ar": "شاورما دجاج", "category": "main", "price": 25, "cost_price": 12, "preparation_time": 10, "tags": ["popular"], "modifiers": [
            {"name": "Size", "required": True, "multiple": False, "options": [{"name": "Regular", "price": 0}, {"name": "Large", "price": 8}]},
            {"name": "Extras", "required": False, "multiple": True, "options": [{"name": "Extra Garlic", "price": 2}, {"name": "Cheese", "price": 4}, {"name": "Pickles", "price": 1}]}
        ]},
        {"name": "Beef Shawarma", "name_ar": "شاورما لحم", "category": "main", "price": 30, "cost_price": 16, "preparation_time": 10, "tags": ["popular"], "modifiers": [
            {"name": "Size", "required": True, "multiple": False, "options": [{"name": "Regular", "price": 0}, {"name": "Large", "price": 10}]},
        ]},
        {"name": "Mixed Grill", "name_ar": "مشويات مشكلة", "category": "main", "price": 65, "cost_price": 35, "preparation_time": 25, "tags": [], "modifiers": [
            {"name": "Spice Level", "required": False, "multiple": False, "options": [{"name": "Mild", "price": 0}, {"name": "Medium", "price": 0}, {"name": "Hot", "price": 0}]}
        ]},
        {"name": "Grilled Chicken", "name_ar": "دجاج مشوي", "category": "main", "price": 45, "cost_price": 22, "preparation_time": 20, "tags": [], "modifiers": []},
        {"name": "Lamb Kebab", "name_ar": "كباب لحم", "category": "main", "price": 55, "cost_price": 30, "preparation_time": 20, "tags": ["popular"], "modifiers": []},
        {"name": "Fish & Chips", "name_ar": "سمك وبطاطس", "category": "main", "price": 48, "cost_price": 25, "preparation_time": 15, "tags": [], "modifiers": []},
        {"name": "Chicken Biryani", "name_ar": "برياني دجاج", "category": "main", "price": 38, "cost_price": 18, "preparation_time": 20, "tags": ["popular"], "modifiers": [
            {"name": "Portion", "required": True, "multiple": False, "options": [{"name": "Single", "price": 0}, {"name": "Family", "price": 40}]}
        ]},
        
        # Appetizers
        {"name": "Hummus", "name_ar": "حمص", "category": "appetizer", "price": 15, "cost_price": 5, "preparation_time": 5, "tags": ["popular"], "modifiers": []},
        {"name": "Falafel", "name_ar": "فلافل", "category": "appetizer", "price": 18, "cost_price": 6, "preparation_time": 8, "tags": [], "modifiers": []},
        {"name": "Fattoush Salad", "name_ar": "سلطة فتوش", "category": "appetizer", "price": 16, "cost_price": 5, "preparation_time": 5, "tags": [], "modifiers": []},
        {"name": "Mutabbal", "name_ar": "متبل", "category": "appetizer", "price": 14, "cost_price": 4, "preparation_time": 5, "tags": [], "modifiers": []},
        {"name": "French Fries", "name_ar": "بطاطس مقلية", "category": "appetizer", "price": 12, "cost_price": 4, "preparation_time": 8, "tags": ["popular"], "modifiers": [
            {"name": "Size", "required": False, "multiple": False, "options": [{"name": "Regular", "price": 0}, {"name": "Large", "price": 5}]}
        ]},
        
        # Beverages
        {"name": "Fresh Orange Juice", "name_ar": "عصير برتقال", "category": "beverage", "price": 12, "cost_price": 4, "preparation_time": 3, "tags": [], "modifiers": []},
        {"name": "Lemon Mint", "name_ar": "ليمون بالنعناع", "category": "beverage", "price": 10, "cost_price": 3, "preparation_time": 3, "tags": ["popular"], "modifiers": []},
        {"name": "Arabic Coffee", "name_ar": "قهوة عربية", "category": "beverage", "price": 8, "cost_price": 2, "preparation_time": 5, "tags": [], "modifiers": []},
        {"name": "Turkish Coffee", "name_ar": "قهوة تركية", "category": "beverage", "price": 10, "cost_price": 3, "preparation_time": 5, "tags": [], "modifiers": [
            {"name": "Sugar", "required": False, "multiple": False, "options": [{"name": "No Sugar", "price": 0}, {"name": "Medium", "price": 0}, {"name": "Sweet", "price": 0}]}
        ]},
        {"name": "Soft Drink", "name_ar": "مشروب غازي", "category": "beverage", "price": 6, "cost_price": 2, "preparation_time": 1, "tags": [], "modifiers": []},
        {"name": "Water", "name_ar": "ماء", "category": "beverage", "price": 4, "cost_price": 1, "preparation_time": 1, "tags": [], "modifiers": []},
        
        # Desserts
        {"name": "Kunafa", "name_ar": "كنافة", "category": "dessert", "price": 20, "cost_price": 8, "preparation_time": 5, "tags": ["popular"], "modifiers": []},
        {"name": "Baklava", "name_ar": "بقلاوة", "category": "dessert", "price": 15, "cost_price": 6, "preparation_time": 2, "tags": [], "modifiers": []},
        {"name": "Um Ali", "name_ar": "أم علي", "category": "dessert", "price": 18, "cost_price": 7, "preparation_time": 10, "tags": [], "modifiers": []},
        {"name": "Ice Cream", "name_ar": "آيس كريم", "category": "dessert", "price": 12, "cost_price": 4, "preparation_time": 2, "tags": [], "modifiers": [
            {"name": "Flavor", "required": True, "multiple": False, "options": [{"name": "Vanilla", "price": 0}, {"name": "Chocolate", "price": 0}, {"name": "Strawberry", "price": 0}, {"name": "Pistachio", "price": 3}]}
        ]},
        
        # Sides
        {"name": "Rice", "name_ar": "أرز", "category": "sides", "price": 8, "cost_price": 2, "preparation_time": 5, "tags": [], "modifiers": []},
        {"name": "Bread Basket", "name_ar": "سلة خبز", "category": "sides", "price": 6, "cost_price": 2, "preparation_time": 2, "tags": [], "modifiers": []},
        {"name": "Garlic Sauce", "name_ar": "ثومية", "category": "sides", "price": 4, "cost_price": 1, "preparation_time": 1, "tags": [], "modifiers": []},
        {"name": "Tahini", "name_ar": "طحينة", "category": "sides", "price": 4, "cost_price": 1, "preparation_time": 1, "tags": [], "modifiers": []},
    ]
    
    # Insert all items
    for i, item_data in enumerate(sample_items):
        item = MenuItem(
            name=item_data["name"],
            name_ar=item_data.get("name_ar"),
            category=item_data.get("category", "main"),
            price=item_data["price"],
            cost_price=item_data.get("cost_price", 0),
            preparation_time=item_data.get("preparation_time", 10),
            tags=item_data.get("tags", []),
            modifiers=item_data.get("modifiers", []),
            display_order=i
        )
        item_dict = item.model_dump()
        item_dict["created_at"] = item_dict["created_at"].isoformat()
        await db.menu_items.insert_one(item_dict)
    
    return {"message": f"Seeded {len(sample_items)} menu items", "seeded": True}
