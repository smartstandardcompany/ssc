# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track" with restaurant stock management.

## Architecture
- **Backend:** FastAPI + MongoDB (Motor async) + JWT Auth + Pydantic
- **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts
- **AI:** GPT-4o via Emergent LLM Key (invoice OCR)
- **Deployment:** Docker + Nginx + Railway (PWA enabled)

## Credentials
- Admin: SSC@SSC.com / Aa147258369SsC@
- Employee: ahmed@test.com / emp@123

## All Implemented Features

### Financial Management
- Sales: split payments, discounts, branch/online, credit tracking
- Expenses: categories/sub-categories, Expense For Branch (cross-branch dues)
- Supplier payments with credit limit enforcement
- Customer credit management, Invoicing with item master
- Currency: SAR (Saudi Riyal)

### Stock Management (NEW - Feb 26, 2026)
- **Item Master:** Items with name, cost_price, sale_price, unit (kg/piece/liter/box/etc), category, min_stock_level
- **Stock In:** Manual entry or bulk import from scanned invoices, per-branch tracking
- **Invoice OCR:** Scan supplier invoices via mobile camera — AI extracts items, qty, prices automatically (GPT-4o)
- **Stock Balance:** Real-time per-branch stock levels, low stock alerts
- **Stock Reports:** Total stock value, consumed value, low stock items

### Kitchen / Chef Interface (NEW - Feb 26, 2026)
- Simplified UI for chefs to record daily item usage
- Branch-specific: each branch shows only its own stock
- Card-based item selection with +/- quantity controls
- Bulk usage submission — stock automatically reduced
- Recent usage history displayed

### HR Management
- Employee CRUD, salary payments, loan tracking, leave management
- Employee self-service portal, payslip PDFs

### Asset & Liability Tracking
- Documents with expiry alerts, Fines & Penalties, Company Loans, Partners

### Cash Flow Management
- Branch-to-branch transfers, company balance, inter-branch dues with payback

### Bank Statement Analysis
- PDF/XLS parser for Alinma & Albilad banks, POS reconciliation

### Reporting & Analytics
- Dashboard with KPIs, period comparison, PDF/Excel export

### Administration
- Role-based access with granular permissions (including stock, kitchen)
- Email/WhatsApp settings, data import, database backup

## Completed Tasks (This Session - Feb 26, 2026)
- [x] Expense For Branch feature (P0) — tested 100%
- [x] Fixed bcrypt warning (upgraded to 4.2.1)
- [x] Stock Management module — items, stock in/out, balance, invoice OCR
- [x] Kitchen page — chef interface for recording usage
- [x] Fixed SAR currency in InvoicesPage item buttons
- [x] Navigation updated with Stock and Kitchen sidebar items
- [x] Admin permissions updated to include stock, kitchen
- [x] All tests passed: iteration 9 (Expense), iteration 10 (Stock + Kitchen)

## Upcoming Tasks
- **P0:** WhatsApp Notification Triggers — UI buttons to trigger reports
- **P1:** Enhanced Bank Reconciliation UI — side-by-side view
- **P2:** Refactor server.py (>5000 lines) into routers/models/services
- **P2:** Break down large frontend components

## Key API Endpoints (New)
- `POST /api/stock/entries` — Add stock entry
- `POST /api/stock/entries/bulk` — Bulk stock import (from scan)
- `POST /api/stock/usage` — Record single usage
- `POST /api/stock/usage/bulk` — Record bulk usage (kitchen)
- `GET /api/stock/balance?branch_id=` — Current stock per branch
- `GET /api/stock/report` — Stock report with values
- `POST /api/stock/scan-invoice` — Invoice OCR (GPT-4o vision)

## DB Collections (New)
- `stock_entries` — Stock-in records
- `stock_usage` — Kitchen/chef usage records
- Items collection extended with: cost_price, unit, min_stock_level
