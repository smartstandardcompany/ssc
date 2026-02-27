"""
Restaurant POS System - Cashier Interface
Foodics-style POS with menu items, modifiers, and multiple payment options
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from database import db, get_current_user, hash_password, verify_password
from models import (User, MenuItem, MenuItemCreate, POSOrder, POSOrderCreate, 
                    MenuCategory, Customer)

router = APIRouter()

# =====================================================
# CASHIER AUTHENTICATION (Separate from main auth)
# =====================================================

@router.post("/cashier/login")
async def cashier_login(body: dict):
    """Login endpoint for cashier POS - requires cashier or admin role"""
    email = body.get("email")
    password = body.get("password")
    pin = body.get("pin")  # Optional PIN-based login
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user has cashier access
    allowed_roles = ["admin", "cashier", "manager"]
    allowed_permissions = ["cashier", "pos", "sales"]
    
    has_role = user.get("role") in allowed_roles
    has_permission = any(p in user.get("permissions", []) for p in allowed_permissions)
    
    if not has_role and not has_permission:
        raise HTTPException(status_code=403, detail="You don't have cashier access")
    
    # Get employee details if linked
    employee = None
    if user.get("id"):
        employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    
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
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role"),
            "branch_id": branch_id,
            "branch_name": branch["name"] if branch else None,
            "employee_id": employee["id"] if employee else None
        }
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
        query["$or"] = [{"branch_id": None}, {"branch_id": branch_id}]
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"name_ar": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
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
