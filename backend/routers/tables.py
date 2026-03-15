"""
Table Management Router
Handles restaurant table configuration, status, and assignments
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db, get_current_user, get_tenant_filter, stamp_tenant
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
    sections = await db.table_sections.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100)
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
    stamp_tenant(section_dict, current_user)
    await db.table_sections.insert_one(section_dict)
    section_dict.pop("_id", None)  # Remove MongoDB ObjectId
    return section_dict


@router.delete("/tables/sections/{section_id}")
async def delete_section(section_id: str, current_user: User = Depends(get_current_user)):
    """Delete a section"""
    result = await db.table_sections.delete_one({"id": section_id, **get_tenant_filter(current_user)})
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
            order = await db.pos_orders.find_one({"id": table["current_order_id"], **get_tenant_filter(current_user)}, {"_id": 0})
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
    stamp_tenant(table_dict, current_user)
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
    
    result = await db.tables.update_one({"id": table_id, **get_tenant_filter(current_user)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Table not found")
    
    return await db.tables.find_one({"id": table_id, **get_tenant_filter(current_user)}, {"_id": 0})


@router.delete("/tables/{table_id}")
async def delete_table(table_id: str, current_user: User = Depends(get_current_user)):
    """Delete a table"""
    result = await db.tables.delete_one({"id": table_id, **get_tenant_filter(current_user)})
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
    table = await db.tables.find_one({"id": table_id, **get_tenant_filter(current_user)})
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
    
    await db.tables.update_one({"id": table_id, **get_tenant_filter(current_user)}, {"$set": update_data})
    
    return await db.tables.find_one({"id": table_id, **get_tenant_filter(current_user)}, {"_id": 0})


@router.post("/tables/{table_id}/assign-waiter")
async def assign_waiter_to_table(
    table_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Assign a waiter to a table"""
    waiter_id = body.get("waiter_id")
    
    table = await db.tables.find_one({"id": table_id, **get_tenant_filter(current_user)})
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
    stamp_tenant(waiter, current_user)
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
            order = await db.pos_orders.find_one({"id": table["current_order_id"], **get_tenant_filter(current_user)}, {"_id": 0})
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
    table = await db.tables.find_one({"id": table_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if table.get("status") == "occupied" and table.get("current_order_id"):
        # Return existing order
        existing_order = await db.pos_orders.find_one({"id": table["current_order_id"], **get_tenant_filter(current_user)}, {"_id": 0})
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
    stamp_tenant(order, current_user)
    await db.pos_orders.insert_one(order)
    order.pop("_id", None)  # Remove MongoDB ObjectId
    
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
    
    updated_table = await db.tables.find_one({"id": table_id, **get_tenant_filter(current_user)}, {"_id": 0})
    
    return {"message": "Order started", "order": order, "table": updated_table}


@router.post("/tables/{table_id}/add-items")
async def add_items_to_table_order(
    table_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Add items to table's current order"""
    table = await db.tables.find_one({"id": table_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if not table.get("current_order_id"):
        raise HTTPException(status_code=400, detail="Table has no active order")
    
    order = await db.pos_orders.find_one({"id": table["current_order_id"], **get_tenant_filter(current_user)}, {"_id": 0})
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
        stamp_tenant(kitchen_item, current_user)
        await db.kitchen_queue.insert_one(kitchen_item)
    
    updated_order = await db.pos_orders.find_one({"id": order["id"], **get_tenant_filter(current_user)}, {"_id": 0})
    return {"message": "Items added", "order": updated_order}


@router.post("/tables/{table_id}/close-order")
async def close_table_order(
    table_id: str,
    body: dict,
    current_user: User = Depends(get_current_user)
):
    """Close/pay the table's order"""
    table = await db.tables.find_one({"id": table_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    if not table.get("current_order_id"):
        raise HTTPException(status_code=400, detail="Table has no active order")
    
    order = await db.pos_orders.find_one({"id": table["current_order_id"], **get_tenant_filter(current_user)}, {"_id": 0})
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
    stamp_tenant(sale, current_user)
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
    total = await db.tables.count_documents(get_tenant_filter(current_user))
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


# =====================================================
# TABLE RESERVATIONS
# =====================================================

class ReservationCreate(BaseModel):
    table_id: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    party_size: int = 2
    date: str  # YYYY-MM-DD
    time_slot: str  # HH:MM (24h format)
    duration_minutes: int = 90
    special_requests: Optional[str] = None
    occasion: Optional[str] = None  # birthday, anniversary, business, etc.
    branch_id: Optional[str] = None


class ReservationUpdate(BaseModel):
    table_id: Optional[str] = None  # Allow changing table
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    party_size: Optional[int] = None
    date: Optional[str] = None
    time_slot: Optional[str] = None
    duration_minutes: Optional[int] = None
    special_requests: Optional[str] = None
    occasion: Optional[str] = None
    status: Optional[str] = None  # pending, confirmed, seated, completed, cancelled, no_show


@router.get("/reservations")
async def get_reservations(
    date: Optional[str] = None,
    status: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all reservations with optional filters"""
    query = {}
    if date:
        query["date"] = date
    if status:
        query["status"] = status
    if branch_id:
        query["branch_id"] = branch_id
    
    reservations = await db.reservations.find(query, {"_id": 0}).sort([("date", 1), ("time_slot", 1)]).to_list(500)
    
    # Enrich with table info
    tables = {t["id"]: t for t in await db.tables.find(get_tenant_filter(current_user), {"_id": 0}).to_list(500)}
    for res in reservations:
        table = tables.get(res.get("table_id"))
        if table:
            res["table_number"] = table.get("table_number")
            res["section"] = table.get("section")
    
    return reservations


@router.get("/reservations/today")
async def get_todays_reservations(current_user: User = Depends(get_current_user)):
    """Get all reservations for today"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await get_reservations(date=today, current_user=current_user)


@router.get("/reservations/upcoming")
async def get_upcoming_reservations(days: int = 7, current_user: User = Depends(get_current_user)):
    """Get reservations for next N days"""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    dates = [(now + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    
    reservations = await db.reservations.find({
        "date": {"$in": dates},
        "status": {"$nin": ["cancelled", "no_show"]}
    }, {"_id": 0}).sort([("date", 1), ("time_slot", 1)]).to_list(500)
    
    tables = {t["id"]: t for t in await db.tables.find(get_tenant_filter(current_user), {"_id": 0}).to_list(500)}
    for res in reservations:
        table = tables.get(res.get("table_id"))
        if table:
            res["table_number"] = table.get("table_number")
            res["section"] = table.get("section")
    
    return reservations


@router.post("/reservations")
async def create_reservation(data: ReservationCreate, current_user: User = Depends(get_current_user)):
    """Create a new table reservation"""
    # Validate table exists
    table = await db.tables.find_one({"id": data.table_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    # Check table capacity
    if data.party_size > table.get("capacity", 4):
        raise HTTPException(status_code=400, detail=f"Party size exceeds table capacity ({table.get('capacity', 4)})")
    
    # Check for conflicting reservations
    existing = await db.reservations.find_one({
        "table_id": data.table_id,
        "date": data.date,
        "time_slot": data.time_slot,
        "status": {"$nin": ["cancelled", "no_show", "completed"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Table already reserved for this time slot")
    
    reservation = {
        "id": str(uuid.uuid4()),
        "table_id": data.table_id,
        "customer_name": data.customer_name,
        "customer_phone": data.customer_phone,
        "customer_email": data.customer_email,
        "party_size": data.party_size,
        "date": data.date,
        "time_slot": data.time_slot,
        "duration_minutes": data.duration_minutes,
        "special_requests": data.special_requests,
        "occasion": data.occasion,
        "branch_id": data.branch_id or table.get("branch_id"),
        "status": "confirmed",
        "confirmation_code": f"RES{datetime.now().strftime('%y%m%d')}{str(uuid.uuid4())[:4].upper()}",
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    stamp_tenant(reservation, current_user)
    await db.reservations.insert_one(reservation)
    
    # Send confirmation (placeholder for SMS/WhatsApp)
    # TODO: Integrate with Twilio for SMS confirmation
    
    return {k: v for k, v in reservation.items() if k != "_id"}


@router.put("/reservations/{reservation_id}")
async def update_reservation(reservation_id: str, data: ReservationUpdate, current_user: User = Depends(get_current_user)):
    """Update a reservation"""
    reservation = await db.reservations.find_one({"id": reservation_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # If changing table, validate new table
    if data.table_id:
        table = await db.tables.find_one({"id": data.table_id, **get_tenant_filter(current_user)}, {"_id": 0})
        if not table:
            raise HTTPException(status_code=404, detail="Table not found")
        if (data.party_size or reservation.get("party_size", 2)) > table.get("capacity", 4):
            raise HTTPException(status_code=400, detail="Party size exceeds table capacity")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.reservations.update_one({"id": reservation_id, **get_tenant_filter(current_user)}, {"$set": update_data})
    
    updated = await db.reservations.find_one({"id": reservation_id, **get_tenant_filter(current_user)}, {"_id": 0})
    return updated


@router.delete("/reservations/{reservation_id}")
async def delete_reservation(reservation_id: str, current_user: User = Depends(get_current_user)):
    """Cancel/delete a reservation"""
    result = await db.reservations.delete_one({"id": reservation_id, **get_tenant_filter(current_user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return {"message": "Reservation deleted"}


@router.post("/reservations/{reservation_id}/status")
async def update_reservation_status(reservation_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update reservation status (confirm, seat, complete, cancel, no_show)"""
    reservation = await db.reservations.find_one({"id": reservation_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    new_status = body.get("status")
    valid_statuses = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    update = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # If seating, update table status
    if new_status == "seated":
        await db.tables.update_one(
            {"id": reservation["table_id"]},
            {"$set": {
                "status": "occupied",
                "current_reservation_id": reservation_id,
                "customer_count": reservation.get("party_size", 2)
            }}
        )
    
    # If completed or cancelled, free up the table
    if new_status in ["completed", "cancelled", "no_show"]:
        await db.tables.update_one(
            {"id": reservation["table_id"], "current_reservation_id": reservation_id},
            {"$set": {
                "status": "available",
                "current_reservation_id": None,
                "customer_count": 0
            }}
        )
    
    await db.reservations.update_one({"id": reservation_id, **get_tenant_filter(current_user)}, {"$set": update})
    return {"message": f"Reservation status updated to {new_status}"}


@router.get("/reservations/available-slots")
async def get_available_slots(
    date: str,
    party_size: int = 2,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get available time slots for a given date and party size"""
    # Get all tables that can accommodate the party
    query = {"capacity": {"$gte": party_size}, "is_active": True}
    if branch_id:
        query["branch_id"] = branch_id
    tables = await db.tables.find(query, {"_id": 0}).to_list(100)
    
    if not tables:
        return {"date": date, "available_slots": [], "message": "No tables available for this party size"}
    
    # Define time slots (restaurant hours: 11:00 - 23:00, 90 min slots)
    all_slots = [
        "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
        "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
        "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
        "20:00", "20:30", "21:00", "21:30"
    ]
    
    # Get existing reservations for the date
    existing = await db.reservations.find({
        "date": date,
        "status": {"$nin": ["cancelled", "no_show"]}
    }, {"_id": 0}).to_list(500)
    
    # Map reservations by table and time
    reserved_slots = {}
    for res in existing:
        tid = res["table_id"]
        if tid not in reserved_slots:
            reserved_slots[tid] = set()
        reserved_slots[tid].add(res["time_slot"])
    
    # Find available slots
    available = []
    for slot in all_slots:
        available_tables = []
        for table in tables:
            tid = table["id"]
            if tid not in reserved_slots or slot not in reserved_slots[tid]:
                available_tables.append({
                    "table_id": tid,
                    "table_number": table.get("table_number"),
                    "section": table.get("section"),
                    "capacity": table.get("capacity")
                })
        if available_tables:
            available.append({
                "time_slot": slot,
                "available_tables": available_tables[:5]  # Limit to 5 options
            })
    
    return {
        "date": date,
        "party_size": party_size,
        "available_slots": available
    }


@router.get("/reservations/stats")
async def get_reservation_stats(current_user: User = Depends(get_current_user)):
    """Get reservation statistics"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # Today's stats
    today_reservations = await db.reservations.find({"date": today}, {"_id": 0}).to_list(500)
    total_today = len(today_reservations)
    confirmed_today = sum(1 for r in today_reservations if r.get("status") == "confirmed")
    seated_today = sum(1 for r in today_reservations if r.get("status") == "seated")
    completed_today = sum(1 for r in today_reservations if r.get("status") == "completed")
    cancelled_today = sum(1 for r in today_reservations if r.get("status") == "cancelled")
    no_show_today = sum(1 for r in today_reservations if r.get("status") == "no_show")
    
    # Weekly stats
    weekly = await db.reservations.find({"date": {"$gte": week_ago}}, {"_id": 0}).to_list(2000)
    total_weekly = len(weekly)
    no_show_weekly = sum(1 for r in weekly if r.get("status") == "no_show")
    no_show_rate = round((no_show_weekly / total_weekly * 100) if total_weekly > 0 else 0, 1)
    
    # Popular times
    time_counts = {}
    for r in weekly:
        t = r.get("time_slot", "")
        time_counts[t] = time_counts.get(t, 0) + 1
    popular_times = sorted(time_counts.items(), key=lambda x: -x[1])[:5]
    
    return {
        "today": {
            "total": total_today,
            "confirmed": confirmed_today,
            "seated": seated_today,
            "completed": completed_today,
            "cancelled": cancelled_today,
            "no_show": no_show_today
        },
        "weekly": {
            "total": total_weekly,
            "no_show_count": no_show_weekly,
            "no_show_rate": no_show_rate
        },
        "popular_times": [{"time": t, "count": c} for t, c in popular_times]
    }
