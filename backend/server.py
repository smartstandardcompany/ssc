from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import os
import logging

from database import client

from routers import (
    auth,
    bank_statements,
    branches,
    cashier_pos,
    customers,
    dashboard,
    documents,
    employees,
    expenses,
    exports,
    invoices,
    job_titles,
    partners,
    reports,
    sales,
    scheduler,
    settings,
    shifts,
    stock,
    suppliers,
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
    auth,
    bank_statements,
    branches,
    customers,
    dashboard,
    documents,
    employees,
    expenses,
    exports,
    invoices,
    job_titles,
    partners,
    reports,
    sales,
    scheduler,
    settings,
    shifts,
    stock,
    suppliers,
    transfers,
    whatsapp,
    targets,
]:
    app.include_router(module.router, prefix="/api")


@app.get("/api/")
async def root():
    return {"message": "SSC Track API"}


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
