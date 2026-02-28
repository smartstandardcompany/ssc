"""
Table Management Router
Handles restaurant table configuration, status, and assignments
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db, get_current_user
from models import User

router = APIRouter()


# =====================================================
# MODELS
# =====================================================

class TableCreate(BaseModel):
    table_number: str
    section: str = "main"
    capacity: int = 4
    shape: str = "square"  # square, round, rectangle
    position_x: int = 0
    position_y: int = 0
    is_active: bool = True


class TableUpdate(BaseModel):
    table_number: Optional[str] = None
    section: Optional[str] = None
    capacity: Optional[int] = None
    shape: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    is_active: Optional[bool] = None


class TableStatusUpdate(BaseModel):
    status: str  # available, occupied, reserved, cleaning
    order_id: Optional[str] = None
    waiter_id: Optional[str] = None
    customer_count: Optional[int] = None
    notes: Optional[str] = None


class SectionCreate(BaseModel):
    name: str
    color: str = "#f97316"
    floor: int = 1


# =====================================================
# TABLE SECTIONS
# =====================================================

@router.get("/tables/sections")
async def get_sections(current_user: User = Depends(get_current_user)):
    """Get all table sections/areas"""
    sections = await db.table_sections.find({}, {"_id": 0}).to_list(100)
    if not sections:
        # Create default sections
        defaults = [
            {"id": str(uuid.uuid4()), "name": "Main Hall", "color": "#f97316", "floor": 1, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "Outdoor", "color": "#22c55e", "floor": 1, "created_at": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "name": "VIP Room", "color": "#a855f7", "floor": 1, "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.table_sections.insert_many(defaults)
        return defaults
    return sections


@router.post("/tables/sections")
async def create_section(section: SectionCreate, current_user: User = Depends(get_current_user)):
    """Create a new table section"""
    section_dict = {
        "id": str(uuid.uuid4()),
        **section.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.table_sections.insert_one(section_dict)
    section_dict.pop("_id", None)  # Remove MongoDB ObjectId
    return section_dict


@router.delete("/tables/sections/{section_id}")
async def delete_section(section_id: str, current_user: User = Depends(get_current_user)):
    """Delete a section"""
    result = await db.table_sections.delete_one({"id": section_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    return {"message": "Section deleted"}


# =====================================================
# TABLE MANAGEMENT
# =====================================================

@router.get("/tables")
async def get_tables(
    section: Optional[str] = None,
    status: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all tables with optional filters"""
    query = {}
    if section:
        query["section"] = section
    if status:
        query["status"] = status
    if branch_id:
        query["branch_id"] = branch_id
    
    tables = await db.tables.find(query, {"_id": 0}).to_list(200)
    
    # Get current orders for occupied tables
    for table in tables:
        if table.get("status") == "occupied" and table.get("current_order_id"):
            order = await db.pos_orders.find_one({"id": table["current_order_id"]}, {"_id": 0})
            if order:
                table["current_order"] = {
                    "id": order["id"],
                    "total": order.get("total", 0),
                    "items_count": len(order.get("items", [])),
                    "created_at": order.get("created_at"),
                    "status": order.get("status")
                }
    
    return tables


@router.post("/tables")
async def create_table(table: TableCreate, current_user: User = Depends(get_current_user)):
    """Create a new table"""
    # Check if table number already exists
    existing = await db.tables.find_one({"table_number": table.table_number})
    if existing:
        raise HTTPException(status_code=400, detail="Table number already exists")
    
    table_dict = {
        "id": str(uuid.uuid4()),
        **table.model_dump(),
        "status": "available",
        "current_order_id": None,
        "current_waiter_id": None,
        "customer_count": 0,
        "occupied_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tables.insert_one(table_dict)
    table_dict.pop("_id", None)  # Remove MongoDB ObjectId
    return table_dict


@router.put("/tables/{table_id}")
async def update_table(table_id: str, table: TableUpdate, current_user: User = Depends(get_current_user)):
    """Update table details"""
    update_data = {k: v for k, v in table.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.tables.update_one({"id": table_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    
    return await db.tables.find_one({"id": table_id}, {"_id": 0})


@router.delete("/tables/{table_id}")
async def delete_table(table_id: str, current_user: User = Depends(get_current_user)):
    """Delete a table"""
    result = await db.tables.delete_one({"id": table_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    return {"message": "Table deleted"}


@router.post("/tables/{table_id}/status")
async def update_table_status(
    table_id: str, 
    status_update: TableStatusUpdate, 
    current_user: User = Depends(get_current_user)
):
    """Update table status (available, occupied, reserved, cleaning)"""
    table = await db.tables.find_one({"id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    update_data = {
        "status": status_update.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status_update.status == "occupied":
        update_data["occupied_at"] = datetime.now(timezone.utc).isoformat()
        update_data["current_order_id"] = status_update.order_id
        update_data["current_waiter_id"] = status_update.waiter_id
        update_data["customer_count"] = status_update.customer_count or 0
    elif status_update.status == "available":
        update_data["current_order_id"] = None
        update_data["current_waiter_id"] = None
        update_data["customer_count"] = 0
        update_data["occupied_at"] = None
    
    if status_update.notes:
        update_data["notes"] = status_update.notes
    
    await db.tables.update_one({"id": table_id}, {"$set": update_data})
    
    return await db.tables.find_one({"id": table_id}, {"_id": 0})


@router.post("/tables/{table_id}/assign-waiter")
async def assign_waiter_to_table(
    table_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Assign a waiter to a table"""
    waiter_id = body.get("waiter_id")
    
    table = await db.tables.find_one({"id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    await db.tables.update_one(
        {"id": table_id}, 
        {"$set": {
            "current_waiter_id": waiter_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Waiter assigned", "table_id": table_id, "waiter_id": waiter_id}


# =====================================================
# WAITER MANAGEMENT
# =====================================================

@router.get("/waiters")
async def get_waiters(current_user: User = Depends(get_current_user)):
    """Get all waiters (cashier PINs with waiter role)"""
    waiters = await db.cashier_pins.find(
        {"role": {"$in": ["waiter", "cashier"]}}, 
        {"_id": 0}
    ).to_list(100)
    
    # Get assigned tables count for each waiter
    for waiter in waiters:
        tables_count = await db.tables.count_documents({
            "current_waiter_id": waiter["id"],
            "status": "occupied"
        })
        waiter["active_tables"] = tables_count
    
    return waiters


@router.post("/waiters")
async def create_waiter(body: dict, current_user: User = Depends(get_current_user)):
    """Create a new waiter with PIN"""
    pin = body.get("pin")
    name = body.get("name")
    
    if not pin or not name:
        raise HTTPException(status_code=400, detail="PIN and name required")
    
    # Check if PIN exists
    existing = await db.cashier_pins.find_one({"pin": pin})
    if existing:
        raise HTTPException(status_code=400, detail="PIN already exists")
    
    waiter = {
        "id": str(uuid.uuid4()),
        "pin": pin,
        "name": name,
        "role": "waiter",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.cashier_pins.insert_one(waiter)
    waiter.pop("_id", None)  # Remove MongoDB ObjectId
    return waiter


@router.post("/waiters/login")
async def waiter_login(body: dict):
    """Login waiter with PIN"""
    pin = body.get("pin")
    if not pin:
        raise HTTPException(status_code=400, detail="PIN required")
    
    waiter = await db.cashier_pins.find_one(
        {"pin": pin, "is_active": True},
        {"_id": 0}
    )
    
    if not waiter:
        raise HTTPException(status_code=401, detail="Invalid PIN")
    
    # Get waiter's assigned tables
    tables = await db.tables.find(
        {"current_waiter_id": waiter["id"], "status": "occupied"},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "success": True,
        "waiter": waiter,
        "assigned_tables": tables
    }


@router.get("/waiters/{waiter_id}/tables")
async def get_waiter_tables(waiter_id: str, current_user: User = Depends(get_current_user)):
    """Get all tables assigned to a waiter"""
    tables = await db.tables.find(
        {"current_waiter_id": waiter_id},
        {"_id": 0}
    ).to_list(50)
    
    # Get order details for each table
    for table in tables:
        if table.get("current_order_id"):
            order = await db.pos_orders.find_one({"id": table["current_order_id"]}, {"_id": 0})
            if order:
                table["current_order"] = order
    
    return tables


# =====================================================
# TABLE ORDERS
# =====================================================

@router.post("/tables/{table_id}/start-order")
async def start_table_order(
    table_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Start a new order for a table"""
    table = await db.tables.find_one({"id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table.get("status") == "occupied" and table.get("current_order_id"):
        # Return existing order
        existing_order = await db.pos_orders.find_one({"id": table["current_order_id"]}, {"_id": 0})
        if existing_order:
            return {"message": "Table already has an order", "order": existing_order, "table": table}
    
    waiter_id = body.get("waiter_id")
    customer_count = body.get("customer_count", 1)
    
    # Create new order
    order = {
        "id": str(uuid.uuid4()),
        "order_number": f"T{table['table_number']}-{datetime.now().strftime('%H%M%S')}",
        "table_id": table_id,
        "table_number": table.get("table_number"),
        "waiter_id": waiter_id,
        "customer_count": customer_count,
        "items": [],
        "subtotal": 0,
        "discount": 0,
        "tax": 0,
        "total": 0,
        "status": "open",
        "order_type": "dine_in",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.pos_orders.insert_one(order)
    
    # Update table status
    await db.tables.update_one(
        {"id": table_id},
        {"$set": {
            "status": "occupied",
            "current_order_id": order["id"],
            "current_waiter_id": waiter_id,
            "customer_count": customer_count,
            "occupied_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated_table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    
    return {"message": "Order started", "order": order, "table": updated_table}


@router.post("/tables/{table_id}/add-items")
async def add_items_to_table_order(
    table_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Add items to table's current order"""
    table = await db.tables.find_one({"id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if not table.get("current_order_id"):
        raise HTTPException(status_code=400, detail="Table has no active order")
    
    order = await db.pos_orders.find_one({"id": table["current_order_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    items = body.get("items", [])
    if not items:
        raise HTTPException(status_code=400, detail="No items provided")
    
    # Add items to order
    existing_items = order.get("items", [])
    for item in items:
        item["id"] = str(uuid.uuid4())
        item["status"] = "pending"
        item["added_at"] = datetime.now(timezone.utc).isoformat()
        existing_items.append(item)
    
    # Recalculate totals
    subtotal = sum(item.get("price", 0) * item.get("quantity", 1) for item in existing_items)
    tax = subtotal * 0.15  # 15% VAT
    total = subtotal + tax - order.get("discount", 0)
    
    await db.pos_orders.update_one(
        {"id": order["id"]},
        {"$set": {
            "items": existing_items,
            "subtotal": round(subtotal, 2),
            "tax": round(tax, 2),
            "total": round(total, 2),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send to kitchen
    for item in items:
        kitchen_item = {
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "order_number": order.get("order_number"),
            "table_number": table.get("table_number"),
            "item_id": item["id"],
            "item_name": item.get("name"),
            "quantity": item.get("quantity", 1),
            "modifiers": item.get("modifiers", []),
            "notes": item.get("notes", ""),
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.kitchen_queue.insert_one(kitchen_item)
    
    updated_order = await db.pos_orders.find_one({"id": order["id"]}, {"_id": 0})
    return {"message": "Items added", "order": updated_order}


@router.post("/tables/{table_id}/close-order")
async def close_table_order(
    table_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Close/pay the table's order"""
    table = await db.tables.find_one({"id": table_id})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if not table.get("current_order_id"):
        raise HTTPException(status_code=400, detail="Table has no active order")
    
    order = await db.pos_orders.find_one({"id": table["current_order_id"]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    payment_mode = body.get("payment_mode", "cash")
    amount_paid = body.get("amount_paid", order.get("total", 0))
    tip = body.get("tip", 0)
    
    # Update order as paid
    await db.pos_orders.update_one(
        {"id": order["id"]},
        {"$set": {
            "status": "paid",
            "payment_mode": payment_mode,
            "amount_paid": amount_paid,
            "tip": tip,
            "paid_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create sale record
    sale = {
        "id": str(uuid.uuid4()),
        "order_id": order["id"],
        "table_id": table_id,
        "table_number": table.get("table_number"),
        "amount": order.get("total", 0),
        "subtotal": order.get("subtotal", 0),
        "discount": order.get("discount", 0),
        "vat_amount": order.get("tax", 0),
        "total_with_vat": order.get("total", 0),
        "payment_mode": payment_mode,
        "payment_details": [{"mode": payment_mode, "amount": amount_paid}],
        "tip": tip,
        "items": order.get("items", []),
        "waiter_id": order.get("waiter_id"),
        "date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sales.insert_one(sale)
    
    # Free up the table
    await db.tables.update_one(
        {"id": table_id},
        {"$set": {
            "status": "cleaning",  # Set to cleaning first
            "current_order_id": None,
            "current_waiter_id": None,
            "customer_count": 0
        }}
    )
    
    return {
        "message": "Order closed",
        "order_id": order["id"],
        "sale_id": sale["id"],
        "total": order.get("total", 0),
        "payment_mode": payment_mode
    }


@router.post("/tables/{table_id}/mark-available")
async def mark_table_available(table_id: str, current_user: User = Depends(get_current_user)):
    """Mark table as available (after cleaning)"""
    result = await db.tables.update_one(
        {"id": table_id},
        {"$set": {
            "status": "available",
            "current_order_id": None,
            "current_waiter_id": None,
            "customer_count": 0,
            "occupied_at": None,
            "notes": None
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    
    return {"message": "Table marked as available"}


# =====================================================
# TABLE STATS
# =====================================================

@router.get("/tables/stats")
async def get_table_stats(current_user: User = Depends(get_current_user)):
    """Get table statistics"""
    total = await db.tables.count_documents({})
    available = await db.tables.count_documents({"status": "available"})
    occupied = await db.tables.count_documents({"status": "occupied"})
    reserved = await db.tables.count_documents({"status": "reserved"})
    cleaning = await db.tables.count_documents({"status": "cleaning"})
    
    # Get total capacity and current customers
    tables = await db.tables.find({}, {"capacity": 1, "customer_count": 1, "status": 1}).to_list(200)
    total_capacity = sum(t.get("capacity", 0) for t in tables)
    current_customers = sum(t.get("customer_count", 0) for t in tables if t.get("status") == "occupied")
    
    return {
        "total_tables": total,
        "available": available,
        "occupied": occupied,
        "reserved": reserved,
        "cleaning": cleaning,
        "total_capacity": total_capacity,
        "current_customers": current_customers,
        "occupancy_rate": round((occupied / total * 100) if total > 0 else 0, 1)
    }
