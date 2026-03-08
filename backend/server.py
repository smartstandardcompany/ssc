from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import uuid
from datetime import datetime, timezone

from database import client, db

from routers import (
    access_policies,
    activity_logs,
    assets,
    auth,
    anomaly_detection,
    bank_accounts,
    bank_statements,
    barcode,
    branches,
    cashier_pos,
    cctv,
    customer_portal,
    customers,
    dashboard,
    data_management,
    documents,
    employees,
    expenses,
    exports,
    invoices,
    job_titles,
    loans,
    order_tracking,
    partners,
    pdf_exports,
    performance_report,
    platforms,
    platform_reconciliation,
    predictions,
    push_notifications,
    report_builder,
    reports,
    report_views,
    sales,
    sales_alerts,
    scheduler,
    settings,
    shifts,
    stock,
    suppliers,
    supplier_reminders,
    tables,
    task_reminders,
    transfers,
    whatsapp,
    targets,
    ai_insights,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers with /api prefix
for module in [
    access_policies,
    activity_logs,
    anomaly_detection,
    assets,
    auth,
    bank_accounts,
    bank_statements,
    barcode,
    branches,
    cashier_pos,
    cctv,
    customer_portal,
    customers,
    dashboard,
    data_management,
    documents,
    employees,
    expenses,
    exports,
    invoices,
    job_titles,
    loans,
    order_tracking,
    partners,
    pdf_exports,
    performance_report,
    platforms,
    platform_reconciliation,
    predictions,
    push_notifications,
    report_builder,
    reports,
    report_views,
    sales,
    sales_alerts,
    scheduler,
    settings,
    shifts,
    stock,
    suppliers,
    supplier_reminders,
    tables,
    task_reminders,
    transfers,
    whatsapp,
    targets,
    ai_insights,
]:
    app.include_router(module.router, prefix="/api")


@app.get("/api/")
async def root():
    return {"message": "SSC Track API"}

# Mount static files for uploads
os.makedirs("/app/uploads/menu", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    """Initialize database with default admin user if empty"""
    await seed_database()
    await create_indexes()


async def create_indexes():
    """Create MongoDB indexes for performance optimization"""
    try:
        # Sales - most queried collection
        await db.sales.create_index("id", unique=True)
        await db.sales.create_index("date")
        await db.sales.create_index("branch_id")
        await db.sales.create_index("sale_type")
        await db.sales.create_index([("date", -1), ("branch_id", 1)])
        await db.sales.create_index("customer_id")
        await db.sales.create_index("platform_id")
        
        # Expenses
        await db.expenses.create_index("id", unique=True)
        await db.expenses.create_index("date")
        await db.expenses.create_index("branch_id")
        await db.expenses.create_index("supplier_id")
        await db.expenses.create_index([("date", -1), ("branch_id", 1)])
        
        # Suppliers
        await db.suppliers.create_index("id", unique=True)
        await db.suppliers.create_index("branch_id")
        
        # Customers
        await db.customers.create_index("id", unique=True)
        await db.customers.create_index("branch_id")
        await db.customers.create_index("phone")
        
        # Supplier payments
        await db.supplier_payments.create_index("supplier_id")
        await db.supplier_payments.create_index("date")
        
        # Stock items
        await db.stock_items.create_index("id", unique=True)
        await db.stock_items.create_index("branch_id")
        await db.stock_items.create_index("barcode")
        await db.stock_items.create_index("name")
        
        # Users
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        
        # Activity logs
        await db.activity_logs.create_index([("created_at", -1)])
        await db.activity_logs.create_index("user_id")
        
        # Invoices
        await db.invoices.create_index("id", unique=True)
        await db.invoices.create_index("customer_id")
        await db.invoices.create_index([("date", -1)])
        
        # Notifications
        await db.notifications.create_index([("created_at", -1)])
        await db.notifications.create_index("user_id")
        
        logger.info("Database indexes created successfully")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")


async def seed_database():
    """Seed database with default admin user and essential data"""
    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        # Test DB connectivity first
        try:
            await db.command("ping")
            logger.info("MongoDB connection successful")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            return

        # Always ensure admin user exists
        admin_exists = await db.users.find_one({"email": "ss@ssc.com"}, {"_id": 0})
        if not admin_exists:
            logger.info("Admin user not found. Creating default admin user...")
            hashed_password = pwd_context.hash("Aa147258369Ssc@")
            admin_user = {
                "id": str(uuid.uuid4()),
                "email": "ss@ssc.com",
                "password": hashed_password,
                "name": "SSC Admin",
                "role": "admin",
                "is_active": True,
                "permissions": [
                    "sales", "expenses", "suppliers",
                    "customers", "employees", "reports",
                    "settings", "invoices", "stock",
                    "partners", "documents", "branches",
                    "transfers", "credit_report", "supplier_report",
                    "schedule", "leave", "fines", "loans",
                    "users", "kitchen", "shifts"
                ],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(admin_user)
            del admin_user["_id"]
            logger.info("Default admin user created successfully: ss@ssc.com")
        else:
            logger.info("Admin user already exists: ss@ssc.com")
            # Fix legacy: ensure password field exists (not hashed_password)
            if "hashed_password" in admin_exists and "password" not in admin_exists:
                await db.users.update_one(
                    {"email": "ss@ssc.com"},
                    {"$set": {"password": admin_exists["hashed_password"]}, "$unset": {"hashed_password": ""}}
                )
                logger.info("Fixed admin user password field name")
            # Ensure permissions is a list (not dict)
            if isinstance(admin_exists.get("permissions"), dict):
                perm_list = [k for k, v in admin_exists["permissions"].items() if v]
                await db.users.update_one(
                    {"email": "ss@ssc.com"},
                    {"$set": {"permissions": perm_list}}
                )
                logger.info("Fixed admin user permissions format")

        # Check if any users exist for branch seeding
        user_count = await db.users.count_documents({})
        if user_count <= 1:
            
            # Create default branch
            branch_count = await db.branches.count_documents({})
            if branch_count == 0:
                default_branch = {
                    "id": str(uuid.uuid4()),
                    "name": "Main Branch",
                    "code": "MAIN",
                    "address": "",
                    "phone": "",
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.branches.insert_one(default_branch)
                logger.info("✅ Default branch created: Main Branch")
            
            # Create default company settings
            company_count = await db.company_settings.count_documents({})
            if company_count == 0:
                default_company = {
                    "company_name": "Smart Standard Company",
                    "company_name_ar": "شركة المعيار الذكي",
                    "address_line1": "",
                    "city": "Riyadh",
                    "country": "Saudi Arabia",
                    "phone": "",
                    "email": "",
                    "cr_number": "",
                    "vat_number": "",
                    "vat_enabled": True,
                    "vat_rate": 15,
                    "currency": "SAR",
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.company_settings.insert_one(default_company)
                logger.info("✅ Default company settings created")
            
            # Create default cashier PIN
            pin_count = await db.cashier_pins.count_documents({})
            if pin_count == 0:
                default_pin = {
                    "id": str(uuid.uuid4()),
                    "pin": "1234",
                    "name": "Default Cashier",
                    "role": "cashier",
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.cashier_pins.insert_one(default_pin)
                logger.info("✅ Default cashier PIN created: 1234")
            
            logger.info("🚀 Database seeding completed!")
        else:
            logger.info(f"Database already has {user_count} users. Skipping seed.")
            
    except Exception as e:
        logger.error(f"Error seeding database: {str(e)}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
