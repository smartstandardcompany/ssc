from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import uuid
from datetime import datetime, timezone

from database import client, db

from routers import (
    auth,
    anomaly_detection,
    bank_statements,
    branches,
    cashier_pos,
    cctv,
    customers,
    dashboard,
    documents,
    employees,
    expenses,
    exports,
    invoices,
    job_titles,
    loans,
    partners,
    performance_report,
    predictions,
    push_notifications,
    reports,
    report_views,
    sales,
    scheduler,
    settings,
    shifts,
    stock,
    suppliers,
    tables,
    task_reminders,
    transfers,
    whatsapp,
    targets,
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
    anomaly_detection,
    auth,
    bank_statements,
    branches,
    cashier_pos,
    cctv,
    customers,
    dashboard,
    documents,
    employees,
    expenses,
    exports,
    invoices,
    job_titles,
    loans,
    partners,
    performance_report,
    predictions,
    push_notifications,
    reports,
    report_views,
    sales,
    scheduler,
    settings,
    shifts,
    stock,
    suppliers,
    tables,
    task_reminders,
    transfers,
    whatsapp,
    targets,
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


async def seed_database():
    """Seed database with default admin user and essential data"""
    try:
        # Check if any users exist
        user_count = await db.users.count_documents({})
        
        if user_count == 0:
            logger.info("No users found. Creating default admin user...")
            
            # Hash password
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            hashed_password = pwd_context.hash("Aa147258369Ssc@")
            
            # Create default admin user
            admin_user = {
                "id": str(uuid.uuid4()),
                "email": "ss@ssc.com",
                "hashed_password": hashed_password,
                "name": "Admin",
                "role": "admin",
                "is_active": True,
                "permissions": {
                    "sales": True, "expenses": True, "suppliers": True,
                    "customers": True, "employees": True, "reports": True,
                    "settings": True, "invoices": True, "stock": True,
                    "partners": True, "documents": True, "branches": True,
                    "transfers": True, "credit_report": True, "supplier_report": True,
                    "schedule": True, "leave": True, "fines": True, "loans": True
                },
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.users.insert_one(admin_user)
            logger.info("✅ Default admin user created: ss@ssc.com")
            
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
