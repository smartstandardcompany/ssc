from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import hashlib
import secrets
import os

router = APIRouter(prefix="/customer-portal", tags=["customer-portal"])

# Get database from server
def get_db():
    from server import db
    return db

# Models
class CustomerLoginRequest(BaseModel):
    email: str
    password: str

class CustomerRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None

class CustomerPasswordResetRequest(BaseModel):
    email: str

class CustomerPasswordUpdate(BaseModel):
    token: str
    new_password: str

def hash_password(password: str) -> str:
    """Simple password hashing"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_customer_token(customer_id: str) -> str:
    """Create a simple token for customer authentication"""
    return f"cust_{customer_id}_{secrets.token_hex(16)}"

def verify_customer_token(token: str):
    """Verify customer token and return customer_id"""
    if not token or not token.startswith("cust_"):
        return None
    parts = token.split("_")
    if len(parts) >= 2:
        return parts[1]
    return None

# Customer Authentication
@router.post("/login")
async def customer_login(request: CustomerLoginRequest):
    """Customer login endpoint"""
    db = get_db()
    
    # Find customer by email
    customer = await db.customers.find_one({"email": request.email.lower()})
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check if customer has portal access enabled
    if not customer.get("portal_enabled", False):
        # Auto-enable for first login if password matches
        pass
    
    # Verify password
    stored_password = customer.get("portal_password")
    if not stored_password:
        raise HTTPException(status_code=401, detail="Portal access not enabled. Please contact support.")
    
    if hash_password(request.password) != stored_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create token
    token = create_customer_token(str(customer["_id"]))
    
    # Store token in customer record
    await db.customers.update_one(
        {"_id": customer["_id"]},
        {"$set": {"portal_token": token, "last_portal_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "token": token,
        "customer": {
            "id": str(customer["_id"]),
            "name": customer.get("name"),
            "email": customer.get("email"),
            "phone": customer.get("phone"),
        }
    }

@router.post("/register")
async def customer_register(request: CustomerRegisterRequest):
    """Customer self-registration for portal access"""
    db = get_db()
    
    # Check if customer exists
    existing = await db.customers.find_one({"email": request.email.lower()})
    
    if existing:
        # Customer exists - enable portal access
        if existing.get("portal_enabled"):
            raise HTTPException(status_code=400, detail="Account already exists. Please login.")
        
        # Enable portal access for existing customer
        await db.customers.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "portal_enabled": True,
                "portal_password": hash_password(request.password),
                "portal_registered_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        customer_id = str(existing["_id"])
    else:
        # Create new customer - generate unique id
        new_id = str(ObjectId())
        new_customer = {
            "id": new_id,  # Legacy field for compatibility
            "name": request.name,
            "email": request.email.lower(),
            "phone": request.phone,
            "portal_enabled": True,
            "portal_password": hash_password(request.password),
            "portal_registered_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "credit_balance": 0,
        }
        result = await db.customers.insert_one(new_customer)
        customer_id = str(result.inserted_id)
    
    # Create token
    token = create_customer_token(customer_id)
    await db.customers.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": {"portal_token": token}}
    )
    
    return {
        "message": "Registration successful",
        "token": token,
        "customer": {
            "id": customer_id,
            "name": request.name,
            "email": request.email,
        }
    }

@router.get("/profile")
async def get_customer_profile(token: str):
    """Get customer profile"""
    db = get_db()
    
    customer_id = verify_customer_token(token)
    if not customer_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer or customer.get("portal_token") != token:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return {
        "id": str(customer["_id"]),
        "name": customer.get("name"),
        "email": customer.get("email"),
        "phone": customer.get("phone"),
        "credit_balance": customer.get("credit_balance", 0),
        "member_since": customer.get("created_at"),
        "loyalty_points": customer.get("loyalty_points", 0),
        "loyalty_tier": customer.get("loyalty_tier", "Bronze"),
    }

@router.get("/orders")
async def get_customer_orders(token: str, page: int = 1, limit: int = 20):
    """Get customer order history"""
    db = get_db()
    
    customer_id = verify_customer_token(token)
    if not customer_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer or customer.get("portal_token") != token:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Get sales for this customer
    skip = (page - 1) * limit
    
    pipeline = [
        {"$match": {"customer_id": customer_id}},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$lookup": {
            "from": "branches",
            "let": {"branch_id": "$branch_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": [{"$toString": "$_id"}, "$$branch_id"]}}}
            ],
            "as": "branch"
        }},
        {"$addFields": {
            "branch_name": {"$ifNull": [{"$arrayElemAt": ["$branch.name", 0]}, "Unknown"]}
        }},
        {"$project": {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "date": "$created_at",
            "total": "$amount",
            "payment_mode": 1,
            "description": 1,
            "branch_name": 1,
            "items": 1,
        }}
    ]
    
    orders = await db.sales.aggregate(pipeline).to_list(None)
    
    # Get total count
    total = await db.sales.count_documents({"customer_id": customer_id})
    
    return {
        "orders": orders,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@router.get("/statements")
async def get_customer_statements(token: str, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get customer account statement"""
    db = get_db()
    
    customer_id = verify_customer_token(token)
    if not customer_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer or customer.get("portal_token") != token:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Build date filter
    date_filter = {}
    if start_date:
        date_filter["$gte"] = start_date
    if end_date:
        date_filter["$lte"] = end_date
    
    match_stage = {"customer_id": customer_id}
    if date_filter:
        match_stage["created_at"] = date_filter
    
    # Get all transactions (sales with credit)
    pipeline = [
        {"$match": match_stage},
        {"$sort": {"created_at": 1}},
        {"$project": {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "date": "$created_at",
            "description": {"$ifNull": ["$description", "Sale"]},
            "debit": {"$cond": [{"$eq": ["$payment_mode", "credit"]}, "$amount", 0]},
            "credit": {"$cond": [{"$ne": ["$payment_mode", "credit"]}, "$amount", 0]},
            "payment_mode": 1,
        }}
    ]
    
    transactions = await db.sales.aggregate(pipeline).to_list(None)
    
    # Calculate running balance
    running_balance = 0
    for t in transactions:
        running_balance += t.get("debit", 0) - t.get("credit", 0)
        t["balance"] = running_balance
    
    # Get payments received
    payments_pipeline = [
        {"$match": {"customer_id": customer_id, "type": "payment_received"}},
        {"$sort": {"created_at": 1}},
        {"$project": {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "date": "$created_at",
            "description": "Payment Received",
            "debit": {"$literal": 0},
            "credit": "$amount",
            "payment_mode": 1,
        }}
    ]
    
    # Try to get payments (may not exist)
    try:
        payments = await db.customer_payments.aggregate(payments_pipeline).to_list(None)
        transactions.extend(payments)
        transactions.sort(key=lambda x: x.get("date", ""))
    except Exception:
        pass
    
    return {
        "customer_name": customer.get("name"),
        "current_balance": customer.get("credit_balance", 0),
        "transactions": transactions,
        "period": {
            "start": start_date,
            "end": end_date
        }
    }

@router.get("/invoices")
async def get_customer_invoices(token: str, page: int = 1, limit: int = 20):
    """Get customer invoices"""
    db = get_db()
    
    customer_id = verify_customer_token(token)
    if not customer_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer or customer.get("portal_token") != token:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    skip = (page - 1) * limit
    
    pipeline = [
        {"$match": {"customer_id": customer_id}},
        {"$sort": {"created_at": -1}},
        {"$skip": skip},
        {"$limit": limit},
        {"$project": {
            "_id": 0,
            "id": {"$toString": "$_id"},
            "invoice_number": 1,
            "date": "$created_at",
            "total": "$total_amount",
            "vat": "$vat_amount",
            "status": 1,
            "items": 1,
            "qr_code": 1,
        }}
    ]
    
    invoices = await db.invoices.aggregate(pipeline).to_list(None)
    total = await db.invoices.count_documents({"customer_id": customer_id})
    
    return {
        "invoices": invoices,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }

@router.get("/loyalty")
async def get_customer_loyalty(token: str):
    """Get customer loyalty program details"""
    db = get_db()
    
    customer_id = verify_customer_token(token)
    if not customer_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    if not customer or customer.get("portal_token") != token:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Get loyalty config
    config = await db.settings.find_one({"type": "loyalty"})
    tiers = config.get("tiers", []) if config else []
    
    current_points = customer.get("loyalty_points", 0)
    current_tier = customer.get("loyalty_tier", "Bronze")
    
    # Find next tier
    next_tier = None
    points_to_next = 0
    for i, tier in enumerate(tiers):
        if tier["name"] == current_tier and i + 1 < len(tiers):
            next_tier = tiers[i + 1]
            points_to_next = next_tier["min_points"] - current_points
            break
    
    # Get recent loyalty transactions
    loyalty_history = await db.loyalty_transactions.find(
        {"customer_id": customer_id}
    ).sort("created_at", -1).limit(10).to_list(None)
    
    history = []
    for lh in loyalty_history:
        history.append({
            "id": str(lh["_id"]),
            "date": lh.get("created_at"),
            "type": lh.get("type", "earn"),
            "points": lh.get("points", 0),
            "description": lh.get("description", ""),
        })
    
    return {
        "current_points": current_points,
        "current_tier": current_tier,
        "next_tier": next_tier["name"] if next_tier else None,
        "points_to_next_tier": max(0, points_to_next),
        "tier_benefits": next((t.get("benefits", []) for t in tiers if t["name"] == current_tier), []),
        "history": history,
    }

@router.post("/logout")
async def customer_logout(token: str):
    """Customer logout - invalidate token"""
    db = get_db()
    
    customer_id = verify_customer_token(token)
    if customer_id:
        await db.customers.update_one(
            {"_id": ObjectId(customer_id)},
            {"$unset": {"portal_token": ""}}
        )
    
    return {"message": "Logged out successfully"}
