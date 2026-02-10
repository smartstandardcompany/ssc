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
    amount: float  # Original amount before discount
    discount: float = 0  # Discount amount
    final_amount: float = 0  # Amount after discount
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
    discount: Optional[float] = 0
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
    category: Optional[str] = None  # Category of supplier (e.g., "Raw Materials", "Services", etc.)
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    credit_limit: Optional[float] = 0
    current_credit: Optional[float] = 0  # Amount owed to supplier
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SupplierCreate(BaseModel):
    name: str
    category: Optional[str] = None
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
    branch_id: Optional[str] = None  # Which branch cash/bank is used
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SupplierPaymentCreate(BaseModel):
    supplier_id: str
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    date: datetime
    notes: Optional[str] = None

class SupplierCreditPayment(BaseModel):
    payment_mode: str  # "cash" or "bank"
    amount: float
    branch_id: Optional[str] = None

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str
    description: str
    amount: float
    payment_mode: str  # "cash" or "bank"
    branch_id: Optional[str] = None  # Which branch cash/bank is used
    supplier_id: Optional[str] = None
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
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

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # "supplier" or "expense"
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    type: str
    description: Optional[str] = None

# Employee / Payroll Models
class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    branch_id: Optional[str] = None
    user_id: Optional[str] = None  # Linked user account for portal access
    salary: float = 0
    pay_frequency: str = "monthly"
    join_date: Optional[datetime] = None
    document_expiry: Optional[datetime] = None
    loan_balance: float = 0
    annual_leave_entitled: int = 30
    sick_leave_entitled: int = 15
    notes: Optional[str] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeCreate(BaseModel):
    name: str
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    branch_id: Optional[str] = None
    salary: float = 0
    pay_frequency: Optional[str] = "monthly"
    join_date: Optional[datetime] = None
    document_expiry: Optional[datetime] = None
    annual_leave_entitled: Optional[int] = 30
    sick_leave_entitled: Optional[int] = 15
    notes: Optional[str] = None

# Document Expiry Tracking
class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    document_type: str  # "license", "insurance", "permit", "contract", "employee_id", "other"
    document_number: Optional[str] = None
    related_to: Optional[str] = None  # employee name, supplier name, branch name
    issue_date: Optional[datetime] = None
    expiry_date: datetime
    alert_days: int = 30  # days before expiry to alert
    notes: Optional[str] = None
    status: str = "active"  # "active", "expired", "renewed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentCreate(BaseModel):
    name: str
    document_type: str
    document_number: Optional[str] = None
    related_to: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: datetime
    alert_days: Optional[int] = 30
    notes: Optional[str] = None

# Salary Payment Tracking
class SalaryPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    payment_type: str = "salary"
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    period: str
    date: datetime
    notes: Optional[str] = None
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SalaryPaymentCreate(BaseModel):
    employee_id: str
    payment_type: Optional[str] = "salary"
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    period: str
    date: datetime
    notes: Optional[str] = None

# Leave Management
class Leave(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    leave_type: str
    start_date: datetime
    end_date: datetime
    days: int
    reason: Optional[str] = None
    status: str = "pending"  # "pending", "approved", "rejected"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeaveCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: datetime
    end_date: datetime
    days: int
    reason: Optional[str] = None
    status: Optional[str] = "pending"

# Notification Model
class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Target user
    title: str
    message: str
    type: str  # "leave_approved", "leave_rejected", "salary_paid", "document_expiry"
    read: bool = False
    related_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

# Category Management Routes
@api_router.get("/categories")
async def get_categories(category_type: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if category_type:
        query["type"] = category_type
    
    categories = await db.categories.find(query, {"_id": 0}).to_list(1000)
    for category in categories:
        if isinstance(category.get('created_at'), str):
            category['created_at'] = datetime.fromisoformat(category['created_at'])
    return categories

@api_router.post("/categories", response_model=Category)
async def create_category(category_data: CategoryCreate, current_user: User = Depends(get_current_user)):
    # Check if category already exists
    existing = await db.categories.find_one({"name": category_data.name, "type": category_data.type}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    category = Category(**category_data.model_dump())
    category_dict = category.model_dump()
    category_dict["created_at"] = category_dict["created_at"].isoformat()
    await db.categories.insert_one(category_dict)
    return category

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}

# User Management Routes (Admin only) - Continued
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
        branch_id=payment.branch_id,
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
    query = {}
    # Show customers that belong to user's branch or all branches (branch_id = None)
    if current_user.branch_id and current_user.role != "admin":
        query["$or"] = [{"branch_id": current_user.branch_id}, {"branch_id": None}]
    
    customers = await db.customers.find(query, {"_id": 0}).to_list(1000)
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
        
        # Add discount and final_amount if missing
        if 'discount' not in sale:
            sale['discount'] = 0
        if 'final_amount' not in sale:
            sale['final_amount'] = sale.get('amount', 0) - sale.get('discount', 0)
        
        # Convert old format to new format
        if 'payment_details' not in sale or sale['payment_details'] is None:
            payment_mode = sale.get('payment_mode', 'cash')
            payment_status = sale.get('payment_status', 'received')
            amount = sale.get('amount', 0)
            
            if payment_mode == 'credit':
                if payment_status == 'pending':
                    sale['payment_details'] = []
                    sale['credit_amount'] = sale['final_amount']
                    sale['credit_received'] = 0
                else:
                    received_mode = sale.get('received_mode', 'cash')
                    sale['payment_details'] = [{"mode": received_mode, "amount": sale['final_amount']}]
                    sale['credit_amount'] = 0
                    sale['credit_received'] = 0
            else:
                sale['payment_details'] = [{"mode": payment_mode, "amount": sale['final_amount']}]
                sale['credit_amount'] = 0
                sale['credit_received'] = 0
            
            # Update the database with new format
            await db.sales.update_one(
                {"id": sale['id']},
                {"$set": {
                    "payment_details": sale['payment_details'],
                    "credit_amount": sale['credit_amount'],
                    "credit_received": sale['credit_received'],
                    "discount": sale['discount'],
                    "final_amount": sale['final_amount']
                }}
            )
    
    return sales

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: User = Depends(get_current_user)):
    # Calculate final amount after discount
    discount = sale_data.discount or 0
    final_amount = sale_data.amount - discount
    
    # Calculate credit amount
    total_paid = sum(p["amount"] for p in sale_data.payment_details if p["mode"] in ["cash", "bank"])
    credit_amount = final_amount - total_paid
    
    # Exclude discount from model_dump to avoid duplicate kwarg
    sale_data_dict = sale_data.model_dump()
    sale_data_dict.pop('discount', None)  # Remove discount since we're setting it explicitly
    
    sale = Sale(
        **sale_data_dict,
        discount=discount,
        final_amount=final_amount,
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
    payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).sort("date", -1).to_list(1000)
    for payment in payments:
        if isinstance(payment.get('date'), str):
            payment['date'] = datetime.fromisoformat(payment['date'])
        if isinstance(payment.get('created_at'), str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    return payments

@api_router.post("/supplier-payments", response_model=SupplierPayment)
async def create_supplier_payment(payment_data: SupplierPaymentCreate, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": payment_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Validate credit limit BEFORE inserting payment
    if payment_data.payment_mode == "credit":
        credit_limit = supplier.get("credit_limit", 0)
        current_credit = supplier.get("current_credit", 0)
        new_credit = current_credit + payment_data.amount
        # Only enforce limit if credit_limit > 0 (0 means no limit set)
        if credit_limit > 0 and new_credit > credit_limit:
            available = credit_limit - current_credit
            raise HTTPException(status_code=400, detail=f"Payment exceeds credit limit. Available: ${available:.2f}")
    
    payment = SupplierPayment(
        **payment_data.model_dump(),
        supplier_name=supplier["name"],
        created_by=current_user.id
    )
    payment_dict = payment.model_dump()
    payment_dict["date"] = payment_dict["date"].isoformat()
    payment_dict["created_at"] = payment_dict["created_at"].isoformat()
    await db.supplier_payments.insert_one(payment_dict)
    
    # Update supplier's current credit after successful insert
    if payment_data.payment_mode == "credit":
        new_credit = supplier.get("current_credit", 0) + payment_data.amount
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
    # Validate credit limit BEFORE inserting expense
    if expense_data.supplier_id and expense_data.payment_mode == "credit":
        supplier = await db.suppliers.find_one({"id": expense_data.supplier_id}, {"_id": 0})
        if supplier:
            credit_limit = supplier.get("credit_limit", 0)
            current_credit = supplier.get("current_credit", 0)
            new_credit = current_credit + expense_data.amount
            if credit_limit > 0 and new_credit > credit_limit:
                available = credit_limit - current_credit
                raise HTTPException(status_code=400, detail=f"Expense exceeds supplier credit limit. Available: ${available:.2f}")
    
    expense = Expense(**expense_data.model_dump(), created_by=current_user.id)
    expense_dict = expense.model_dump()
    expense_dict["date"] = expense_dict["date"].isoformat()
    expense_dict["created_at"] = expense_dict["created_at"].isoformat()
    await db.expenses.insert_one(expense_dict)
    
    # Update supplier credit after successful insert
    if expense_data.supplier_id and expense_data.payment_mode == "credit":
        supplier = await db.suppliers.find_one({"id": expense_data.supplier_id}, {"_id": 0})
        if supplier:
            new_credit = supplier.get("current_credit", 0) + expense_data.amount
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
                "branch": branch_name,
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

# Supplier Reports
@api_router.get("/reports/suppliers")
async def get_supplier_report(current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    
    supplier_report = []
    
    for supplier in suppliers:
        # Calculate total payments to this supplier
        payments = [p for p in supplier_payments if p.get("supplier_id") == supplier["id"]]
        total_paid = sum(p["amount"] for p in payments if p.get("payment_mode") != "credit")
        
        # Calculate supplier expenses
        supplier_expenses = [e for e in expenses if e.get("supplier_id") == supplier["id"]]
        total_expenses = sum(e["amount"] for e in supplier_expenses)
        
        supplier_report.append({
            "id": supplier["id"],
            "name": supplier["name"],
            "category": supplier.get("category", "-"),
            "total_expenses": total_expenses,
            "total_paid": total_paid,
            "current_credit": supplier.get("current_credit", 0),
            "credit_limit": supplier.get("credit_limit", 0),
            "transaction_count": len(payments) + len(supplier_expenses)
        })
    
    return supplier_report

# Category-wise Supplier Report
@api_router.get("/reports/supplier-categories")
async def get_supplier_category_report(current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    
    category_report = {}
    
    for supplier in suppliers:
        category = supplier.get("category", "Uncategorized")
        
        if category not in category_report:
            category_report[category] = {
                "category": category,
                "supplier_count": 0,
                "total_expenses": 0,
                "total_paid": 0,
                "total_credit": 0
            }
        
        category_report[category]["supplier_count"] += 1
        
        # Calculate expenses for this supplier
        supplier_expenses = [e for e in expenses if e.get("supplier_id") == supplier["id"]]
        category_report[category]["total_expenses"] += sum(e["amount"] for e in supplier_expenses)
        
        # Calculate payments for this supplier
        payments = [p for p in supplier_payments if p.get("supplier_id") == supplier["id"]]
        category_report[category]["total_paid"] += sum(p["amount"] for p in payments if p.get("payment_mode") != "credit")
        
        # Add current credit
        category_report[category]["total_credit"] += supplier.get("current_credit", 0)
    
    return list(category_report.values())

# Branch-wise Cash/Bank Report
@api_router.get("/reports/branch-cashbank")
async def get_branch_cashbank_report(current_user: User = Depends(get_current_user)):
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    
    branch_data = []
    for branch in branches:
        bid = branch["id"]
        # Sales cash/bank by branch
        branch_sales = [s for s in sales if s.get("branch_id") == bid]
        sales_cash = sum(p["amount"] for s in branch_sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
        sales_bank = sum(p["amount"] for s in branch_sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
        sales_credit = sum(s.get("credit_amount", 0) - s.get("credit_received", 0) for s in branch_sales)
        
        # Expenses by branch
        branch_expenses = [e for e in expenses if e.get("branch_id") == bid]
        exp_cash = sum(e["amount"] for e in branch_expenses if e.get("payment_mode") == "cash")
        exp_bank = sum(e["amount"] for e in branch_expenses if e.get("payment_mode") == "bank")
        
        # Supplier payments by branch
        branch_sp = [p for p in supplier_payments if p.get("branch_id") == bid]
        sp_cash = sum(p["amount"] for p in branch_sp if p.get("payment_mode") == "cash")
        sp_bank = sum(p["amount"] for p in branch_sp if p.get("payment_mode") == "bank")
        
        branch_data.append({
            "branch_id": bid,
            "branch_name": branch["name"],
            "sales_cash": sales_cash,
            "sales_bank": sales_bank,
            "sales_credit": sales_credit,
            "sales_total": sales_cash + sales_bank + sales_credit,
            "expenses_cash": exp_cash,
            "expenses_bank": exp_bank,
            "expenses_total": exp_cash + exp_bank,
            "supplier_cash": sp_cash,
            "supplier_bank": sp_bank,
            "supplier_total": sp_cash + sp_bank,
        })
    
    return branch_data

# Supplier Balance Report with date filtering
@api_router.get("/reports/supplier-balance")
async def get_supplier_balance_report(
    period: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    
    date_query = {}
    if period == "today":
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        date_query = {"date": {"$gte": today.isoformat()}}
    elif period == "month":
        month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        date_query = {"date": {"$gte": month_start.isoformat()}}
    elif period == "year":
        year_start = datetime.now(timezone.utc).replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        date_query = {"date": {"$gte": year_start.isoformat()}}
    elif start_date and end_date:
        date_query = {"date": {"$gte": start_date, "$lte": end_date}}
    
    sp_query = {"supplier_id": {"$exists": True, "$ne": None}}
    if date_query:
        sp_query.update(date_query)
    
    supplier_payments = await db.supplier_payments.find(sp_query, {"_id": 0}).to_list(10000)
    
    exp_query = {}
    if date_query:
        exp_query.update(date_query)
    expenses = await db.expenses.find(exp_query, {"_id": 0}).to_list(10000)
    
    result = []
    for supplier in suppliers:
        sid = supplier["id"]
        payments = [p for p in supplier_payments if p.get("supplier_id") == sid]
        cash_paid = sum(p["amount"] for p in payments if p.get("payment_mode") == "cash")
        bank_paid = sum(p["amount"] for p in payments if p.get("payment_mode") == "bank")
        credit_added = sum(p["amount"] for p in payments if p.get("payment_mode") == "credit")
        
        sup_expenses = [e for e in expenses if e.get("supplier_id") == sid]
        total_expenses = sum(e["amount"] for e in sup_expenses)
        
        result.append({
            "id": sid,
            "name": supplier["name"],
            "category": supplier.get("category", "-"),
            "cash_paid": cash_paid,
            "bank_paid": bank_paid,
            "credit_added": credit_added,
            "total_paid": cash_paid + bank_paid,
            "total_expenses": total_expenses,
            "current_credit": supplier.get("current_credit", 0),
            "credit_limit": supplier.get("credit_limit", 0),
            "transaction_count": len(payments) + len(sup_expenses)
        })
    
    return result

# Generic Data Export
@api_router.post("/export/data")
async def export_data(request: dict, current_user: User = Depends(get_current_user)):
    data_type = request.get("type", "sales")
    fmt = request.get("format", "excel")
    
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    
    buffer = BytesIO()
    
    if data_type == "sales":
        sales = await db.sales.find({}, {"_id": 0}).sort("date", -1).to_list(10000)
        customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
        cust_map = {c["id"]: c["name"] for c in customers}
        rows = []
        for s in sales:
            modes = ", ".join(f'{p["mode"]}:${p["amount"]:.2f}' for p in s.get("payment_details", []))
            rows.append([
                datetime.fromisoformat(s["date"]).strftime("%Y-%m-%d") if isinstance(s["date"], str) else s["date"].strftime("%Y-%m-%d"),
                s["sale_type"].capitalize(),
                branch_map.get(s.get("branch_id"), "-"),
                cust_map.get(s.get("customer_id"), "-"),
                s["amount"],
                s.get("discount", 0),
                s.get("final_amount", s["amount"] - s.get("discount", 0)),
                modes,
                s.get("credit_amount", 0) - s.get("credit_received", 0)
            ])
        headers = ["Date", "Type", "Branch", "Customer", "Amount", "Discount", "Final", "Payments", "Credit Remaining"]
        title = "Sales Report"
    elif data_type == "expenses":
        expenses = await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(10000)
        suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
        sup_map = {s["id"]: s["name"] for s in suppliers}
        rows = []
        for e in expenses:
            rows.append([
                datetime.fromisoformat(e["date"]).strftime("%Y-%m-%d") if isinstance(e["date"], str) else e["date"].strftime("%Y-%m-%d"),
                e["category"].capitalize(),
                e["description"],
                sup_map.get(e.get("supplier_id"), "-"),
                branch_map.get(e.get("branch_id"), "-"),
                e["amount"],
                e["payment_mode"].capitalize()
            ])
        headers = ["Date", "Category", "Description", "Supplier", "Branch", "Amount", "Payment Mode"]
        title = "Expenses Report"
    elif data_type == "supplier-payments":
        payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).sort("date", -1).to_list(10000)
        rows = []
        for p in payments:
            rows.append([
                datetime.fromisoformat(p["date"]).strftime("%Y-%m-%d") if isinstance(p["date"], str) else p["date"].strftime("%Y-%m-%d"),
                p["supplier_name"],
                branch_map.get(p.get("branch_id"), "-"),
                p["amount"],
                p["payment_mode"].capitalize(),
                p.get("notes", "")
            ])
        headers = ["Date", "Supplier", "Branch", "Amount", "Payment Mode", "Notes"]
        title = "Supplier Payments Report"
    elif data_type == "customers":
        customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
        rows = [[c["name"], branch_map.get(c.get("branch_id"), "All Branches"), c.get("phone", "-"), c.get("email", "-")] for c in customers]
        headers = ["Name", "Branch", "Phone", "Email"]
        title = "Customers Report"
    elif data_type == "suppliers":
        suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
        rows = [[s["name"], s.get("category", "-"), branch_map.get(s.get("branch_id"), "All"), s.get("phone", "-"), s.get("current_credit", 0), s.get("credit_limit", 0)] for s in suppliers]
        headers = ["Name", "Category", "Branch", "Phone", "Current Credit", "Credit Limit"]
        title = "Suppliers Report"
    elif data_type == "employees":
        employees = await db.employees.find({}, {"_id": 0}).to_list(1000)
        rows = []
        for emp in employees:
            rows.append([
                emp["name"],
                emp.get("position", "-"),
                emp.get("document_id", "-"),
                branch_map.get(emp.get("branch_id"), "-"),
                emp.get("salary", 0),
                emp.get("pay_frequency", "monthly"),
                datetime.fromisoformat(emp["document_expiry"]).strftime("%Y-%m-%d") if emp.get("document_expiry") else "-"
            ])
        headers = ["Name", "Position", "Document ID", "Branch", "Salary", "Pay Frequency", "Doc Expiry"]
        title = "Employees Report"
    else:
        raise HTTPException(status_code=400, detail="Invalid data type")
    
    if fmt == "excel":
        wb = Workbook()
        ws = wb.active
        ws.title = title
        ws.append(headers)
        for col in ws[1]:
            col.font = Font(bold=True)
            col.fill = PatternFill(start_color="7C3AED", end_color="7C3AED", fill_type="solid")
            col.font = Font(bold=True, color="FFFFFF")
        for row in rows:
            ws.append(row)
        for col_cells in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col_cells)
            ws.column_dimensions[col_cells[0].column_letter].width = min(max_len + 4, 30)
        wb.save(buffer)
        buffer.seek(0)
        return StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                 headers={"Content-Disposition": f"attachment; filename={data_type}_report.xlsx"})
    else:
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('T', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#7C3AED'), alignment=1)
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 0.2*inch))
        
        table_data = [headers] + [[str(c) for c in row] for row in rows[:50]]
        col_count = len(headers)
        col_width = 7.5 * inch / col_count
        t = Table(table_data, colWidths=[col_width] * col_count)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7C3AED')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F3FF')])
        ]))
        elements.append(t)
        doc.build(elements)
        buffer.seek(0)
        return StreamingResponse(buffer, media_type="application/pdf",
                                 headers={"Content-Disposition": f"attachment; filename={data_type}_report.pdf"})

# Employee Routes
@api_router.get("/employees")
async def get_employees(current_user: User = Depends(get_current_user)):
    employees = await db.employees.find({}, {"_id": 0}).to_list(1000)
    for emp in employees:
        for f in ['created_at', 'join_date', 'document_expiry']:
            if isinstance(emp.get(f), str):
                emp[f] = datetime.fromisoformat(emp[f])
    return employees

@api_router.post("/employees")
async def create_employee(data: EmployeeCreate, current_user: User = Depends(get_current_user)):
    emp = Employee(**data.model_dump())
    emp_dict = emp.model_dump()
    for f in ['created_at', 'join_date', 'document_expiry']:
        if emp_dict.get(f):
            emp_dict[f] = emp_dict[f].isoformat()
    await db.employees.insert_one(emp_dict)
    return {k: v for k, v in emp_dict.items() if k != '_id'}

@api_router.put("/employees/{emp_id}")
async def update_employee(emp_id: str, data: EmployeeCreate, current_user: User = Depends(get_current_user)):
    result = await db.employees.find_one({"id": emp_id})
    if not result:
        raise HTTPException(status_code=404, detail="Employee not found")
    update = data.model_dump()
    for f in ['join_date', 'document_expiry']:
        if update.get(f):
            update[f] = update[f].isoformat()
    await db.employees.update_one({"id": emp_id}, {"$set": update})
    updated = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    return updated

@api_router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, current_user: User = Depends(get_current_user)):
    result = await db.employees.delete_one({"id": emp_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted"}

# Salary Payment Routes
@api_router.get("/salary-payments")
async def get_salary_payments(current_user: User = Depends(get_current_user)):
    payments = await db.salary_payments.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    for p in payments:
        for f in ['date', 'created_at']:
            if isinstance(p.get(f), str):
                p[f] = datetime.fromisoformat(p[f])
    return payments

@api_router.post("/salary-payments")
async def create_salary_payment(data: SalaryPaymentCreate, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    payment = SalaryPayment(**data.model_dump(), employee_name=emp["name"], created_by=current_user.id)
    p_dict = payment.model_dump()
    p_dict["date"] = p_dict["date"].isoformat()
    p_dict["created_at"] = p_dict["created_at"].isoformat()
    await db.salary_payments.insert_one(p_dict)
    
    # Update loan balance: advance increases, loan_repayment decreases
    loan_balance = emp.get("loan_balance", 0)
    if data.payment_type == "advance":
        loan_balance += data.amount
        await db.employees.update_one({"id": data.employee_id}, {"$set": {"loan_balance": loan_balance}})
    elif data.payment_type == "loan_repayment":
        loan_balance = max(0, loan_balance - data.amount)
        await db.employees.update_one({"id": data.employee_id}, {"$set": {"loan_balance": loan_balance}})
    
    # If payment type is tickets or id_card, also create an expense record
    if data.payment_type in ("tickets", "id_card"):
        cat = "Tickets" if data.payment_type == "tickets" else "ID Card"
        expense = Expense(
            category=cat.lower().replace(" ", "_"),
            description=f"{cat} payment for {emp['name']} - {data.period}",
            amount=data.amount,
            payment_mode=data.payment_mode,
            branch_id=data.branch_id,
            date=data.date,
            notes=data.notes or f"Employee: {emp['name']}",
            created_by=current_user.id
        )
        e_dict = expense.model_dump()
        e_dict["date"] = e_dict["date"].isoformat()
        e_dict["created_at"] = e_dict["created_at"].isoformat()
        await db.expenses.insert_one(e_dict)
    
    return {k: v for k, v in p_dict.items() if k != '_id'}

# Employee payment summary
@api_router.get("/employees/{emp_id}/summary")
async def get_employee_summary(emp_id: str, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    payments = await db.salary_payments.find({"employee_id": emp_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    leaves = await db.leaves.find({"employee_id": emp_id}, {"_id": 0}).to_list(1000)
    
    # Group payments by period
    monthly = {}
    total_advance = 0
    total_repaid = 0
    for p in payments:
        period = p.get("period", "Unknown")
        if period not in monthly:
            monthly[period] = {"salary_paid": 0, "advance": 0, "overtime": 0, "tickets": 0, "id_card": 0, "loan_repayment": 0, "total": 0, "payments": []}
        pt = p.get("payment_type", "salary")
        amount = p.get("amount", 0)
        if pt in monthly[period]:
            monthly[period][pt] += amount
        else:
            monthly[period]["salary_paid"] += amount
        monthly[period]["total"] += amount
        if pt == "advance":
            total_advance += amount
        if pt == "loan_repayment":
            total_repaid += amount
        monthly[period]["payments"].append({
            "id": p["id"], "payment_type": pt, "amount": amount,
            "payment_mode": p.get("payment_mode", "cash"), "date": p["date"], "notes": p.get("notes", "")
        })
    
    salary = emp.get("salary", 0)
    summary = []
    for period, data in monthly.items():
        balance = salary - data["salary_paid"]
        summary.append({
            "period": period, "monthly_salary": salary,
            "salary_paid": data["salary_paid"], "advance": data["advance"],
            "overtime": data["overtime"], "tickets": data["tickets"],
            "id_card": data["id_card"], "loan_repayment": data["loan_repayment"],
            "total_paid": data["total"], "balance": balance,
            "payments": data["payments"]
        })
    
    # Leave summary
    annual_used = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "annual")
    sick_used = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "sick")
    unpaid_used = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "unpaid")
    
    return {
        "employee": {
            "id": emp["id"], "name": emp["name"], "salary": salary,
            "position": emp.get("position", ""),
            "loan_balance": emp.get("loan_balance", 0),
            "annual_leave_entitled": emp.get("annual_leave_entitled", 30),
            "sick_leave_entitled": emp.get("sick_leave_entitled", 15),
        },
        "monthly_summary": summary,
        "total_all_time": sum(p.get("amount", 0) for p in payments),
        "loan": {"total_advance": total_advance, "total_repaid": total_repaid, "balance": emp.get("loan_balance", 0)},
        "leave": {
            "annual_used": annual_used, "annual_remaining": emp.get("annual_leave_entitled", 30) - annual_used,
            "sick_used": sick_used, "sick_remaining": emp.get("sick_leave_entitled", 15) - sick_used,
            "unpaid_used": unpaid_used
        }
    }

@api_router.delete("/salary-payments/{payment_id}")
async def delete_salary_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    result = await db.salary_payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Salary payment deleted"}

# Leave Routes
@api_router.get("/leaves")
async def get_leaves(employee_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if employee_id:
        query["employee_id"] = employee_id
    leaves = await db.leaves.find(query, {"_id": 0}).sort("start_date", -1).to_list(1000)
    for l in leaves:
        for f in ['start_date', 'end_date', 'created_at']:
            if isinstance(l.get(f), str):
                l[f] = datetime.fromisoformat(l[f])
    return leaves

@api_router.post("/leaves")
async def create_leave(data: LeaveCreate, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    leave = Leave(**data.model_dump(), employee_name=emp["name"])
    l_dict = leave.model_dump()
    l_dict["start_date"] = l_dict["start_date"].isoformat()
    l_dict["end_date"] = l_dict["end_date"].isoformat()
    l_dict["created_at"] = l_dict["created_at"].isoformat()
    await db.leaves.insert_one(l_dict)
    return {k: v for k, v in l_dict.items() if k != '_id'}

@api_router.delete("/leaves/{leave_id}")
async def delete_leave(leave_id: str, current_user: User = Depends(get_current_user)):
    result = await db.leaves.delete_one({"id": leave_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leave not found")
    return {"message": "Leave deleted"}

# Document Routes
@api_router.get("/documents")
async def get_documents(current_user: User = Depends(get_current_user)):
    docs = await db.documents.find({}, {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    for d in docs:
        for f in ['created_at', 'issue_date', 'expiry_date']:
            if isinstance(d.get(f), str):
                d[f] = datetime.fromisoformat(d[f])
        if d.get('expiry_date'):
            exp = d['expiry_date'] if isinstance(d['expiry_date'], datetime) else datetime.fromisoformat(str(d['expiry_date']))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            days_left = (exp - now).days
            d['days_until_expiry'] = days_left
            if days_left < 0:
                d['status'] = 'expired'
            elif days_left <= d.get('alert_days', 30):
                d['status'] = 'expiring_soon'
            else:
                d['status'] = 'active'
    return docs

@api_router.post("/documents")
async def create_document(data: DocumentCreate, current_user: User = Depends(get_current_user)):
    doc = Document(**data.model_dump())
    doc_dict = doc.model_dump()
    for f in ['created_at', 'issue_date', 'expiry_date']:
        if doc_dict.get(f):
            doc_dict[f] = doc_dict[f].isoformat()
    await db.documents.insert_one(doc_dict)
    return {k: v for k, v in doc_dict.items() if k != '_id'}

@api_router.put("/documents/{doc_id}")
async def update_document(doc_id: str, data: DocumentCreate, current_user: User = Depends(get_current_user)):
    result = await db.documents.find_one({"id": doc_id})
    if not result:
        raise HTTPException(status_code=404, detail="Document not found")
    update = data.model_dump()
    for f in ['issue_date', 'expiry_date']:
        if update.get(f):
            update[f] = update[f].isoformat()
    await db.documents.update_one({"id": doc_id}, {"$set": update})
    updated = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    return updated

@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, current_user: User = Depends(get_current_user)):
    result = await db.documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted"}

# Document Expiry Alerts
@api_router.get("/documents/alerts/upcoming")
async def get_expiry_alerts(current_user: User = Depends(get_current_user)):
    docs = await db.documents.find({}, {"_id": 0}).to_list(1000)
    employees = await db.employees.find({}, {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    alerts = []
    
    for d in docs:
        exp = d.get('expiry_date')
        if not exp:
            continue
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        days_left = (exp - now).days
        alert_days = d.get('alert_days', 30)
        if days_left <= alert_days:
            alerts.append({
                "type": "document",
                "name": d["name"],
                "related_to": d.get("related_to", "-"),
                "expiry_date": exp.isoformat(),
                "days_left": days_left,
                "status": "expired" if days_left < 0 else "expiring_soon",
                "id": d["id"]
            })
    
    for emp in employees:
        exp = emp.get('document_expiry')
        if not exp:
            continue
        if isinstance(exp, str):
            exp = datetime.fromisoformat(exp)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        days_left = (exp - now).days
        if days_left <= 30:
            alerts.append({
                "type": "employee_document",
                "name": f"{emp['name']} - ID Document",
                "related_to": emp["name"],
                "expiry_date": exp.isoformat(),
                "days_left": days_left,
                "status": "expired" if days_left < 0 else "expiring_soon",
                "id": emp["id"]
            })
    
    alerts.sort(key=lambda x: x["days_left"])
    return alerts

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
    
    total_sales = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
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
    
    elements.append(Paragraph("Sales Transactions", styles['Heading2']))
    elements.append(Spacer(1, 0.1*inch))
    
    sales_data = [["Date", "Type", "Amount", "Payment"]]
    for sale in sales[:20]:
        date_str = datetime.fromisoformat(sale["date"]).strftime("%Y-%m-%d")
        modes = ", ".join(p["mode"].capitalize() for p in sale.get("payment_details", []))
        if not modes:
            modes = sale.get("payment_mode", "N/A").capitalize()
        sales_data.append([
            date_str,
            sale["sale_type"].capitalize(),
            f"${sale['amount']:.2f}",
            modes
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
    
    ws_summary['A1'] = "DataEntry Hub - Sales Report"
    ws_summary['A1'].font = Font(size=16, bold=True, color="7C3AED")
    
    total_sales = sum(s.get("final_amount", s["amount"] - s.get("discount", 0)) for s in sales)
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
        modes = ", ".join(p["mode"].capitalize() for p in sale.get("payment_details", []))
        if not modes:
            modes = sale.get("payment_mode", "N/A").capitalize()
        has_credit = sale.get("credit_amount", 0) > 0
        remaining = sale.get("credit_amount", 0) - sale.get("credit_received", 0)
        status = "Paid" if remaining <= 0 else ("Partial" if sale.get("credit_received", 0) > 0 else "Pending") if has_credit else "Received"
        
        ws_sales.append([
            date_str,
            sale["sale_type"].capitalize(),
            ref,
            sale["amount"],
            modes,
            status
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