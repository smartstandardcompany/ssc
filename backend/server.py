from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

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
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_type: str  # "branch" or "online"
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    amount: float
    payment_mode: str  # "cash", "bank", "credit"
    payment_status: str = "pending"  # "pending" or "received"
    received_mode: Optional[str] = None  # "cash" or "bank" when credit is received
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SaleCreate(BaseModel):
    sale_type: str
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    amount: float
    payment_mode: str
    payment_status: Optional[str] = "pending"
    received_mode: Optional[str] = None
    date: datetime
    notes: Optional[str] = None

class SaleUpdate(BaseModel):
    payment_status: Optional[str] = None
    received_mode: Optional[str] = None
    notes: Optional[str] = None

class SupplierPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_name: str
    amount: float
    payment_mode: str  # "cash", "bank", "credit"
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SupplierPaymentCreate(BaseModel):
    supplier_name: str
    amount: float
    payment_mode: str
    date: datetime
    notes: Optional[str] = None

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str  # "salary", "rent", "maintenance", "vat", "insurance", "other"
    description: str
    amount: float
    payment_mode: str  # "cash" or "bank"
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: float
    payment_mode: str
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
    
    user = User(email=user_data.email, name=user_data.name)
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
    sales = await db.sales.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    for sale in sales:
        if isinstance(sale.get('date'), str):
            sale['date'] = datetime.fromisoformat(sale['date'])
        if isinstance(sale.get('created_at'), str):
            sale['created_at'] = datetime.fromisoformat(sale['created_at'])
    return sales

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: User = Depends(get_current_user)):
    sale = Sale(**sale_data.model_dump(), created_by=current_user.id)
    sale_dict = sale.model_dump()
    sale_dict["date"] = sale_dict["date"].isoformat()
    sale_dict["created_at"] = sale_dict["created_at"].isoformat()
    await db.sales.insert_one(sale_dict)
    return sale

@api_router.put("/sales/{sale_id}", response_model=Sale)
async def update_sale(sale_id: str, sale_update: SaleUpdate, current_user: User = Depends(get_current_user)):
    result = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    update_data = {k: v for k, v in sale_update.model_dump().items() if v is not None}
    await db.sales.update_one({"id": sale_id}, {"$set": update_data})
    
    updated = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if isinstance(updated.get('date'), str):
        updated['date'] = datetime.fromisoformat(updated['date'])
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Sale(**updated)

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
    payment = SupplierPayment(**payment_data.model_dump(), created_by=current_user.id)
    payment_dict = payment.model_dump()
    payment_dict["date"] = payment_dict["date"].isoformat()
    payment_dict["created_at"] = payment_dict["created_at"].isoformat()
    await db.supplier_payments.insert_one(payment_dict)
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
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    supplier_payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(10000)
    
    total_sales = sum(sale["amount"] for sale in sales if sale["payment_status"] == "received" or sale["payment_mode"] != "credit")
    total_expenses = sum(expense["amount"] for expense in expenses)
    total_supplier_payments = sum(payment["amount"] for payment in supplier_payments)
    pending_credits = sum(sale["amount"] for sale in sales if sale["payment_mode"] == "credit" and sale["payment_status"] == "pending")
    
    cash_sales = sum(sale["amount"] for sale in sales if sale["payment_mode"] == "cash" or (sale["payment_mode"] == "credit" and sale["received_mode"] == "cash"))
    bank_sales = sum(sale["amount"] for sale in sales if sale["payment_mode"] == "bank" or (sale["payment_mode"] == "credit" and sale["received_mode"] == "bank"))
    credit_sales = sum(sale["amount"] for sale in sales if sale["payment_mode"] == "credit" and sale["payment_status"] == "pending")
    
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