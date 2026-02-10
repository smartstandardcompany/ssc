from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
import pandas as pd
from io import BytesIO
from twilio.rest import Client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "operator"  # "admin", "manager", "operator"
    branch_id: Optional[str] = None  # For branch-specific access
    permissions: List[str] = []  # ["sales", "expenses", "reports", "branches", "customers", "suppliers", "users"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[str] = "operator"
    branch_id: Optional[str] = None
    permissions: Optional[List[str]] = []

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    branch_id: Optional[str] = None
    permissions: Optional[List[str]] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Branch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BranchCreate(BaseModel):
    name: str
    location: Optional[str] = None

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    branch_id: Optional[str] = None  # None means available to all branches
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerCreate(BaseModel):
    name: str
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_type: str  # "branch" or "online"
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    amount: float
    payment_details: Optional[List[dict]] = []  # [{"mode": "cash", "amount": 100}, {"mode": "bank", "amount": 50}]
    credit_amount: float = 0  # Amount still pending for credit sales
    credit_received: float = 0  # Amount received against credit
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    
    # Legacy fields for backward compatibility
    payment_mode: Optional[str] = None
    payment_status: Optional[str] = None
    received_mode: Optional[str] = None

class SaleCreate(BaseModel):
    sale_type: str
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    amount: float
    payment_details: List[dict]
    date: datetime
    notes: Optional[str] = None

class SalePayment(BaseModel):
    payment_mode: str  # "cash" or "bank"
    amount: float

class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    credit_limit: Optional[float] = 0
    current_credit: Optional[float] = 0  # Amount owed to supplier
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupplierCreate(BaseModel):
    name: str
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    credit_limit: Optional[float] = 0

class SupplierPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    supplier_name: str
    amount: float
    payment_mode: str  # "cash", "bank", "credit"
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SupplierPaymentCreate(BaseModel):
    supplier_id: str
    amount: float
    payment_mode: str
    date: datetime
    notes: Optional[str] = None

class SupplierCreditPayment(BaseModel):
    payment_mode: str  # "cash" or "bank"
    amount: float

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str  # "salary", "rent", "maintenance", "vat", "insurance", "supplier", "other"
    description: str
    amount: float
    payment_mode: str  # "cash" or "bank"
    supplier_id: Optional[str] = None  # For supplier-related expenses
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: float
    payment_mode: str
    supplier_id: Optional[str] = None
    date: datetime
    notes: Optional[str] = None

class DashboardStats(BaseModel):
    total_sales: float
    total_expenses: float
    total_supplier_payments: float
    net_profit: float
    pending_credits: float
    cash_sales: float
    bank_sales: float
    credit_sales: float

class WhatsAppSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    phone_number: str
    enabled: bool = True
    notification_time: str = "09:00"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WhatsAppSettingsCreate(BaseModel):
    phone_number: str
    enabled: bool = True
    notification_time: str = "09:00"

class ExportRequest(BaseModel):
    format: str  # "pdf" or "excel"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    branch_id: Optional[str] = None

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)

# Health Check
@api_router.get("/")
async def root():
    return {"message": "DataEntry Hub API"}

# Auth Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # First user becomes admin
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else user_data.role or "operator"
    
    # Set default permissions based on role
    if role == "admin":
        permissions = ["sales", "expenses", "reports", "branches", "customers", "suppliers", "users"]
    elif role == "manager":
        permissions = ["sales", "expenses", "reports", "branches", "customers", "suppliers"]
    else:
        permissions = ["sales", "expenses"]
    
    user = User(
        email=user_data.email, 
        name=user_data.name,
        role=role,
        branch_id=user_data.branch_id,
        permissions=user_data.permissions or permissions
    )
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    
    await db.users.insert_one(user_dict)
    
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user_doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user = User(**{k: v for k, v in user_doc.items() if k != "password"})
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# User Management Routes (Admin only)
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Set permissions based on role
    if user_data.role == "admin":
        permissions = ["sales", "expenses", "reports", "branches", "customers", "suppliers", "users"]
    elif user_data.role == "manager":
        permissions = ["sales", "expenses", "reports", "branches", "customers", "suppliers"]
    else:
        permissions = ["sales", "expenses"]
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role or "operator",
        branch_id=user_data.branch_id,
        permissions=user_data.permissions or permissions
    )
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    
    await db.users.insert_one(user_dict)
    return user

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return User(**updated)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# Branch Routes
@api_router.get("/branches", response_model=List[Branch])
async def get_branches(current_user: User = Depends(get_current_user)):
    branches = await db.branches.find({}, {"_id": 0}).to_list(1000)
    for branch in branches:
        if isinstance(branch.get('created_at'), str):
            branch['created_at'] = datetime.fromisoformat(branch['created_at'])
    return branches

@api_router.post("/branches", response_model=Branch)
async def create_branch(branch_data: BranchCreate, current_user: User = Depends(get_current_user)):
    branch = Branch(**branch_data.model_dump())
    branch_dict = branch.model_dump()
    branch_dict["created_at"] = branch_dict["created_at"].isoformat()
    await db.branches.insert_one(branch_dict)
    return branch

@api_router.put("/branches/{branch_id}", response_model=Branch)
async def update_branch(branch_id: str, branch_data: BranchCreate, current_user: User = Depends(get_current_user)):
    result = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    await db.branches.update_one({"id": branch_id}, {"$set": branch_data.model_dump()})
    updated = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Branch(**updated)

@api_router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, current_user: User = Depends(get_current_user)):
    result = await db.branches.delete_one({"id": branch_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted successfully"}

# Supplier Routes
@api_router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(current_user: User = Depends(get_current_user)):
    # If user has branch_id, filter suppliers by branch
    query = {}
    if current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id
    
    suppliers = await db.suppliers.find(query, {"_id": 0}).to_list(1000)
    for supplier in suppliers:
        if isinstance(supplier.get('created_at'), str):
            supplier['created_at'] = datetime.fromisoformat(supplier['created_at'])
    return suppliers

@api_router.post("/suppliers", response_model=Supplier)
async def create_supplier(supplier_data: SupplierCreate, current_user: User = Depends(get_current_user)):
    supplier = Supplier(**supplier_data.model_dump())
    supplier_dict = supplier.model_dump()
    supplier_dict["created_at"] = supplier_dict["created_at"].isoformat()
    await db.suppliers.insert_one(supplier_dict)
    return supplier

@api_router.put("/suppliers/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: str, supplier_data: SupplierCreate, current_user: User = Depends(get_current_user)):
    result = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    await db.suppliers.update_one({"id": supplier_id}, {"$set": supplier_data.model_dump()})
    updated = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Supplier(**updated)

@api_router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, current_user: User = Depends(get_current_user)):
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted successfully"}

@api_router.post("/suppliers/{supplier_id}/pay-credit")
async def pay_supplier_credit(supplier_id: str, payment: SupplierCreditPayment, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    if payment.amount > supplier["current_credit"]:
        raise HTTPException(status_code=400, detail="Payment amount exceeds current credit")
    
    # Update supplier credit
    new_credit = supplier["current_credit"] - payment.amount
    await db.suppliers.update_one({"id": supplier_id}, {"$set": {"current_credit": new_credit}})
    
    # Record payment
    payment_record = SupplierPayment(
        supplier_id=supplier_id,
        supplier_name=supplier["name"],
        amount=payment.amount,
        payment_mode=payment.payment_mode,
        date=datetime.now(timezone.utc),
        notes=f"Credit payment - Remaining: ${new_credit:.2f}",
        created_by=current_user.id
    )
    payment_dict = payment_record.model_dump()
    payment_dict["date"] = payment_dict["date"].isoformat()
    payment_dict["created_at"] = payment_dict["created_at"].isoformat()
    await db.supplier_payments.insert_one(payment_dict)
    
    return {"message": "Credit payment recorded", "remaining_credit": new_credit}

# Customer Routes
@api_router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: User = Depends(get_current_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    for customer in customers:
        if isinstance(customer.get('created_at'), str):
            customer['created_at'] = datetime.fromisoformat(customer['created_at'])
    return customers

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    customer = Customer(**customer_data.model_dump())
    customer_dict = customer.model_dump()
    customer_dict["created_at"] = customer_dict["created_at"].isoformat()
    await db.customers.insert_one(customer_dict)
    return customer

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_data: CustomerCreate, current_user: User = Depends(get_current_user)):
    result = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await db.customers.update_one({"id": customer_id}, {"$set": customer_data.model_dump()})
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Customer(**updated)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: User = Depends(get_current_user)):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}

# Sales Routes
@api_router.get("/sales", response_model=List[Sale])
async def get_sales(current_user: User = Depends(get_current_user)):
    query = {}
    # Filter by branch for non-admin users
    if current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id
    
    sales = await db.sales.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    
    # Migrate old sales to new format
    for sale in sales:
        if isinstance(sale.get('date'), str):
            sale['date'] = datetime.fromisoformat(sale['date'])
        if isinstance(sale.get('created_at'), str):
            sale['created_at'] = datetime.fromisoformat(sale['created_at'])
        
        # Convert old format to new format
        if 'payment_details' not in sale or sale['payment_details'] is None:
            payment_mode = sale.get('payment_mode', 'cash')
            payment_status = sale.get('payment_status', 'received')
            amount = sale.get('amount', 0)
            
            if payment_mode == 'credit':
                if payment_status == 'pending':
                    sale['payment_details'] = []
                    sale['credit_amount'] = amount
                    sale['credit_received'] = 0
                else:
                    received_mode = sale.get('received_mode', 'cash')
                    sale['payment_details'] = [{"mode": received_mode, "amount": amount}]
                    sale['credit_amount'] = 0
                    sale['credit_received'] = 0
            else:
                sale['payment_details'] = [{"mode": payment_mode, "amount": amount}]
                sale['credit_amount'] = 0
                sale['credit_received'] = 0
            
            # Update the database with new format
            await db.sales.update_one(
                {"id": sale['id']},
                {"$set": {
                    "payment_details": sale['payment_details'],
                    "credit_amount": sale['credit_amount'],
                    "credit_received": sale['credit_received']
                }}
            )
    
    return sales

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: User = Depends(get_current_user)):
    # Calculate credit amount
    total_paid = sum(p["amount"] for p in sale_data.payment_details if p["mode"] in ["cash", "bank"])
    credit_amount = sale_data.amount - total_paid
    
    sale = Sale(
        **sale_data.model_dump(),
        credit_amount=credit_amount,
        credit_received=0,
        created_by=current_user.id
    )
    sale_dict = sale.model_dump()
    sale_dict["date"] = sale_dict["date"].isoformat()
    sale_dict["created_at"] = sale_dict["created_at"].isoformat()
    await db.sales.insert_one(sale_dict)
    return sale

@api_router.post("/sales/{sale_id}/receive-credit")
async def receive_credit_payment(sale_id: str, payment: SalePayment, current_user: User = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    remaining_credit = sale["credit_amount"] - sale["credit_received"]
    if payment.amount > remaining_credit:
        raise HTTPException(status_code=400, detail=f"Payment amount exceeds remaining credit of ${remaining_credit:.2f}")
    
    # Update sale
    new_credit_received = sale["credit_received"] + payment.amount
    new_payment_details = sale["payment_details"] + [{"mode": payment.payment_mode, "amount": payment.amount}]
    
    await db.sales.update_one(
        {"id": sale_id},
        {"$set": {
            "credit_received": new_credit_received,
            "payment_details": new_payment_details
        }}
    )
    
    return {
        "message": "Credit payment received",
        "received": payment.amount,
        "remaining_credit": remaining_credit - payment.amount
    }

@api_router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str, current_user: User = Depends(get_current_user)):
    result = await db.sales.delete_one({"id": sale_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sale not found")
    return {"message": "Sale deleted successfully"}

# Supplier Payment Routes
@api_router.get("/supplier-payments", response_model=List[SupplierPayment])
async def get_supplier_payments(current_user: User = Depends(get_current_user)):
    payments = await db.supplier_payments.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    for payment in payments:
        if isinstance(payment.get('date'), str):
            payment['date'] = datetime.fromisoformat(payment['date'])
        if isinstance(payment.get('created_at'), str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    return payments

@api_router.post("/supplier-payments", response_model=SupplierPayment)
async def create_supplier_payment(payment_data: SupplierPaymentCreate, current_user: User = Depends(get_current_user)):
    # Get supplier details
    supplier = await db.suppliers.find_one({"id": payment_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    payment = SupplierPayment(
        **payment_data.model_dump(),
        supplier_name=supplier["name"],
        created_by=current_user.id
    )
    payment_dict = payment.model_dump()
    payment_dict["date"] = payment_dict["date"].isoformat()
    payment_dict["created_at"] = payment_dict["created_at"].isoformat()
    await db.supplier_payments.insert_one(payment_dict)
    
    # If payment mode is credit, update supplier's current credit
    if payment_data.payment_mode == "credit":
        new_credit = supplier.get("current_credit", 0) + payment_data.amount
        if new_credit > supplier.get("credit_limit", 0):
            raise HTTPException(status_code=400, detail=f"Payment exceeds credit limit. Available: ${supplier.get('credit_limit', 0) - supplier.get('current_credit', 0):.2f}")
        await db.suppliers.update_one({"id": payment_data.supplier_id}, {"$set": {"current_credit": new_credit}})
    
    return payment

@api_router.delete("/supplier-payments/{payment_id}")
async def delete_supplier_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    result = await db.supplier_payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment deleted successfully"}

# Expense Routes
@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(current_user: User = Depends(get_current_user)):
    expenses = await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    for expense in expenses:
        if isinstance(expense.get('date'), str):
            expense['date'] = datetime.fromisoformat(expense['date'])
        if isinstance(expense.get('created_at'), str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    return expenses

@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseCreate, current_user: User = Depends(get_current_user)):
    expense = Expense(**expense_data.model_dump(), created_by=current_user.id)
    expense_dict = expense.model_dump()
    expense_dict["date"] = expense_dict["date"].isoformat()
    expense_dict["created_at"] = expense_dict["created_at"].isoformat()
    await db.expenses.insert_one(expense_dict)
    
    # If expense is linked to supplier and payment mode is credit, update supplier credit
    if expense_data.supplier_id and expense_data.payment_mode == "credit":
        supplier = await db.suppliers.find_one({"id": expense_data.supplier_id}, {"_id": 0})
        if supplier:
            new_credit = supplier.get("current_credit", 0) + expense_data.amount
            if new_credit > supplier.get("credit_limit", 0):
                raise HTTPException(status_code=400, detail=f"Expense exceeds supplier credit limit")
            await db.suppliers.update_one({"id": expense_data.supplier_id}, {"$set": {"current_credit": new_credit}})
    
    return expense

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}

# Dashboard Stats
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id
    
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(10000)
    
    # Calculate total sales (amount minus remaining credit)
    total_sales = sum(sale["amount"] - (sale.get("credit_amount", 0) - sale.get("credit_received", 0)) for sale in sales)
    total_expenses = sum(expense["amount"] for expense in expenses)
    total_supplier_payments = sum(payment["amount"] for payment in supplier_payments if payment.get("payment_mode") != "credit")
    
    # Calculate pending credits
    pending_credits = sum(sale.get("credit_amount", 0) - sale.get("credit_received", 0) for sale in sales)
    
    # Calculate payment mode breakdown
    cash_sales = 0
    bank_sales = 0
    credit_sales = pending_credits
    
    for sale in sales:
        for payment in sale.get("payment_details", []):
            if payment["mode"] == "cash":
                cash_sales += payment["amount"]
            elif payment["mode"] == "bank":
                bank_sales += payment["amount"]
    
    net_profit = total_sales - total_expenses - total_supplier_payments
    
    return DashboardStats(
        total_sales=total_sales,
        total_expenses=total_expenses,
        total_supplier_payments=total_supplier_payments,
        net_profit=net_profit,
        pending_credits=pending_credits,
        cash_sales=cash_sales,
        bank_sales=bank_sales,
        credit_sales=credit_sales
    )

# Credit Sales Report
@api_router.get("/reports/credit-sales")
async def get_credit_sales_report(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id
    
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    
    credit_sales = []
    total_credit_given = 0
    total_credit_received = 0
    total_credit_remaining = 0
    
    for sale in sales:
        credit_amount = sale.get('credit_amount', 0)
        credit_received = sale.get('credit_received', 0)
        remaining = credit_amount - credit_received
        
        if credit_amount > 0:
            branch_name = next((b["name"] for b in branches if b["id"] == sale.get("branch_id")), "-")
            customer_name = next((c["name"] for c in customers if c["id"] == sale.get("customer_id")), "-")
            
            credit_sales.append({
                "id": sale["id"],
                "date": sale["date"],
                "sale_type": sale["sale_type"],
                "reference": branch_name if sale["sale_type"] == "branch" else customer_name,
                "total_amount": sale["amount"],
                "credit_given": credit_amount,
                "credit_received": credit_received,
                "remaining": remaining,
                "status": "paid" if remaining == 0 else "partial" if credit_received > 0 else "pending"
            })
            
            total_credit_given += credit_amount
            total_credit_received += credit_received
            total_credit_remaining += remaining
    
    return {
        "credit_sales": credit_sales,
        "summary": {
            "total_credit_given": total_credit_given,
            "total_credit_received": total_credit_received,
            "total_credit_remaining": total_credit_remaining
        }
    }

# WhatsApp Settings Routes
@api_router.get("/whatsapp/settings")
async def get_whatsapp_settings(current_user: User = Depends(get_current_user)):
    settings = await db.whatsapp_settings.find_one({"user_id": current_user.id}, {"_id": 0})
    return settings if settings else None

@api_router.post("/whatsapp/settings")
async def save_whatsapp_settings(settings_data: WhatsAppSettingsCreate, current_user: User = Depends(get_current_user)):
    existing = await db.whatsapp_settings.find_one({"user_id": current_user.id})
    
    settings = WhatsAppSettings(**settings_data.model_dump(), user_id=current_user.id)
    settings_dict = settings.model_dump()
    settings_dict["created_at"] = settings_dict["created_at"].isoformat()
    
    if existing:
        await db.whatsapp_settings.update_one({"user_id": current_user.id}, {"$set": settings_dict})
    else:
        await db.whatsapp_settings.insert_one(settings_dict)
    
    return {"message": "WhatsApp settings saved successfully"}

@api_router.post("/whatsapp/send-daily-report")
async def send_daily_whatsapp_report(current_user: User = Depends(get_current_user)):
    try:
        # Get WhatsApp settings
        settings = await db.whatsapp_settings.find_one({"user_id": current_user.id}, {"_id": 0})
        if not settings or not settings.get("enabled"):
            raise HTTPException(status_code=400, detail="WhatsApp notifications not configured")
        
        # Get today's data
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        sales = await db.sales.find({
            "date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}
        }, {"_id": 0}).to_list(1000)
        
        expenses = await db.expenses.find({
            "date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}
        }, {"_id": 0}).to_list(1000)
        
        branches = await db.branches.find({}, {"_id": 0}).to_list(100)
        
        # Calculate stats
        total_sales = sum(sale["amount"] for sale in sales)
        total_expenses = sum(expense["amount"] for expense in expenses)
        
        # Branch-wise breakdown
        branch_sales = {}
        for branch in branches:
            branch_total = sum(sale["amount"] for sale in sales if sale.get("branch_id") == branch["id"])
            if branch_total > 0:
                branch_sales[branch["name"]] = branch_total
        
        # Create message
        message = f"📊 *Daily Sales Report - {datetime.now().strftime('%d %b %Y')}*\\n\\n"
        message += f"💰 Total Sales: ${total_sales:.2f}\\n"
        message += f"💸 Total Expenses: ${total_expenses:.2f}\\n"
        message += f"📈 Net: ${(total_sales - total_expenses):.2f}\\n\\n"
        
        if branch_sales:
            message += "*Branch-wise Sales:*\\n"
            for branch_name, amount in branch_sales.items():
                message += f"• {branch_name}: ${amount:.2f}\\n"
        
        # Send via Twilio
        twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
        twilio_phone = os.environ.get("TWILIO_PHONE_NUMBER")
        
        if not all([twilio_sid, twilio_token, twilio_phone]):
            raise HTTPException(status_code=500, detail="Twilio credentials not configured")
        
        client = Client(twilio_sid, twilio_token)
        
        # Send WhatsApp message
        whatsapp_message = client.messages.create(
            from_=f'whatsapp:{twilio_phone}',
            body=message,
            to=f'whatsapp:{settings["phone_number"]}'
        )
        
        return {"message": "Daily report sent successfully", "sid": whatsapp_message.sid}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send WhatsApp message: {str(e)}")

# Export Routes
@api_router.post("/export/reports")
async def export_reports(export_request: ExportRequest, current_user: User = Depends(get_current_user)):
    try:
        # Fetch data
        sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
        supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(10000)
        branches = await db.branches.find({}, {"_id": 0}).to_list(100)
        customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
        
        # Filter by date range
        if export_request.start_date:
            start = datetime.fromisoformat(export_request.start_date)
            sales = [s for s in sales if datetime.fromisoformat(s["date"]) >= start]
            expenses = [e for e in expenses if datetime.fromisoformat(e["date"]) >= start]
            supplier_payments = [p for p in supplier_payments if datetime.fromisoformat(p["date"]) >= start]
        
        if export_request.end_date:
            end = datetime.fromisoformat(export_request.end_date)
            sales = [s for s in sales if datetime.fromisoformat(s["date"]) <= end]
            expenses = [e for e in expenses if datetime.fromisoformat(e["date"]) <= end]
            supplier_payments = [p for p in supplier_payments if datetime.fromisoformat(p["date"]) <= end]
        
        # Filter by branch
        if export_request.branch_id and export_request.branch_id != "all":
            sales = [s for s in sales if s.get("branch_id") == export_request.branch_id]
        
        if export_request.format == "pdf":
            return generate_pdf_report(sales, expenses, supplier_payments, branches, customers)
        elif export_request.format == "excel":
            return generate_excel_report(sales, expenses, supplier_payments, branches, customers)
        else:
            raise HTTPException(status_code=400, detail="Invalid export format")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

def generate_pdf_report(sales, expenses, supplier_payments, branches, customers):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#7C3AED'),
        spaceAfter=30,
        alignment=1
    )
    elements.append(Paragraph("DataEntry Hub - Sales Report", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Summary Stats
    total_sales = sum(s["amount"] for s in sales if s["payment_status"] == "received" or s["payment_mode"] != "credit")
    total_expenses = sum(e["amount"] for e in expenses)
    total_supplier = sum(p["amount"] for p in supplier_payments)
    net_profit = total_sales - total_expenses - total_supplier
    
    summary_data = [
        ["Metric", "Amount"],
        ["Total Sales", f"${total_sales:.2f}"],
        ["Total Expenses", f"${total_expenses:.2f}"],
        ["Supplier Payments", f"${total_supplier:.2f}"],
        ["Net Profit", f"${net_profit:.2f}"]
    ]
    
    summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Sales Table
    elements.append(Paragraph("Sales Transactions", styles['Heading2']))
    elements.append(Spacer(1, 0.1*inch))
    
    sales_data = [["Date", "Type", "Amount", "Payment"]]
    for sale in sales[:20]:  # Limit to 20 for PDF
        date_str = datetime.fromisoformat(sale["date"]).strftime("%Y-%m-%d")
        sales_data.append([
            date_str,
            sale["sale_type"].capitalize(),
            f"${sale['amount']:.2f}",
            sale["payment_mode"].capitalize()
        ])
    
    sales_table = Table(sales_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    sales_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(sales_table)
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=sales_report.pdf"}
    )

def generate_excel_report(sales, expenses, supplier_payments, branches, customers):
    buffer = BytesIO()
    wb = Workbook()
    
    # Summary Sheet
    ws_summary = wb.active
    ws_summary.title = "Summary"
    
    # Add headers
    ws_summary['A1'] = "DataEntry Hub - Sales Report"
    ws_summary['A1'].font = Font(size=16, bold=True, color="7C3AED")
    
    total_sales = sum(s["amount"] for s in sales if s["payment_status"] == "received" or s["payment_mode"] != "credit")
    total_expenses = sum(e["amount"] for e in expenses)
    total_supplier = sum(p["amount"] for p in supplier_payments)
    net_profit = total_sales - total_expenses - total_supplier
    
    ws_summary['A3'] = "Metric"
    ws_summary['B3'] = "Amount"
    ws_summary['A3'].font = Font(bold=True)
    ws_summary['B3'].font = Font(bold=True)
    
    summary_data = [
        ("Total Sales", total_sales),
        ("Total Expenses", total_expenses),
        ("Supplier Payments", total_supplier),
        ("Net Profit", net_profit)
    ]
    
    for idx, (metric, amount) in enumerate(summary_data, start=4):
        ws_summary[f'A{idx}'] = metric
        ws_summary[f'B{idx}'] = f"${amount:.2f}"
    
    # Sales Sheet
    ws_sales = wb.create_sheet("Sales")
    sales_headers = ["Date", "Type", "Branch/Customer", "Amount", "Payment Mode", "Status"]
    ws_sales.append(sales_headers)
    
    for col in ws_sales[1]:
        col.font = Font(bold=True)
        col.fill = PatternFill(start_color="7C3AED", end_color="7C3AED", fill_type="solid")
        col.font = Font(bold=True, color="FFFFFF")
    
    for sale in sales:
        date_str = datetime.fromisoformat(sale["date"]).strftime("%Y-%m-%d")
        branch_name = next((b["name"] for b in branches if b["id"] == sale.get("branch_id")), "-")
        customer_name = next((c["name"] for c in customers if c["id"] == sale.get("customer_id")), "-")
        ref = branch_name if sale["sale_type"] == "branch" else customer_name
        
        ws_sales.append([
            date_str,
            sale["sale_type"].capitalize(),
            ref,
            sale["amount"],
            sale["payment_mode"].capitalize(),
            sale["payment_status"].capitalize()
        ])
    
    # Expenses Sheet
    ws_expenses = wb.create_sheet("Expenses")
    expense_headers = ["Date", "Category", "Description", "Amount", "Payment Mode"]
    ws_expenses.append(expense_headers)
    
    for col in ws_expenses[1]:
        col.font = Font(bold=True)
        col.fill = PatternFill(start_color="F43F5E", end_color="F43F5E", fill_type="solid")
        col.font = Font(bold=True, color="FFFFFF")
    
    for expense in expenses:
        date_str = datetime.fromisoformat(expense["date"]).strftime("%Y-%m-%d")
        ws_expenses.append([
            date_str,
            expense["category"].capitalize(),
            expense["description"],
            expense["amount"],
            expense["payment_mode"].capitalize()
        ])
    
    # Supplier Payments Sheet
    ws_supplier = wb.create_sheet("Supplier Payments")
    supplier_headers = ["Date", "Supplier Name", "Amount", "Payment Mode", "Notes"]
    ws_supplier.append(supplier_headers)
    
    for col in ws_supplier[1]:
        col.font = Font(bold=True)
        col.fill = PatternFill(start_color="0EA5E9", end_color="0EA5E9", fill_type="solid")
        col.font = Font(bold=True, color="FFFFFF")
    
    for payment in supplier_payments:
        date_str = datetime.fromisoformat(payment["date"]).strftime("%Y-%m-%d")
        ws_supplier.append([
            date_str,
            payment["supplier_name"],
            payment["amount"],
            payment["payment_mode"].capitalize(),
            payment.get("notes", "")
        ])
    
    wb.save(buffer)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=sales_report.xlsx"}
    )

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()