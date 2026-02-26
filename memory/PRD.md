# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track" with restaurant stock management, invoice OCR, and bank reconciliation.

## Architecture
- **Backend:** FastAPI + MongoDB (Motor async) + JWT Auth + Pydantic
- **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts
- **AI:** GPT-4o via Emergent LLM Key (invoice OCR)
- **Messaging:** Twilio WhatsApp integration
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

### Stock Management
- Item Master: items with cost_price, sale_price, unit, category, min_stock_level
- Stock In: manual entry or bulk import from scanned invoices, per-branch tracking
- Invoice OCR: scan supplier invoices via mobile camera — AI extracts items/qty/prices (GPT-4o)
- Stock Balance: real-time per-branch levels, low stock alerts
- Stock Reports: total stock value, consumed value

### Kitchen / Chef Interface
- Simplified card-based UI for chefs to record daily item usage
- Branch-specific stock, +/- quantity controls, bulk submission
- Stock auto-deducts on usage, recent usage history

### WhatsApp Notifications (P0 - DONE)
- Flexible phone number — enter recipient number each time
- Report types: Daily Sales Summary, Expense Summary, Low Stock Alert, Branch Report
- WhatsApp buttons on Dashboard, Expenses, Stock pages
- Reusable WhatsAppSendDialog component
- Requires Twilio config in Settings → WhatsApp

### Bank Reconciliation (P1 - DONE)
- New "Reconciliation" tab in Bank Statement analysis
- Side-by-side: Bank POS deposits vs SSC Track bank sales
- 1-day offset: today's sale appears as tomorrow's bank deposit
- Summary cards: Bank POS Total, App Sales Total, Difference, Matched, Discrepancies
- Status: Matched / Bank Only / App Only / Mismatch
- CSV export for reconciliation data

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
- Role-based access with granular permissions
- Email/WhatsApp settings, data import, database backup

## Completed Tasks (This Session - Feb 26, 2026)
- [x] Expense For Branch feature (P0) — tested 100% (iteration 9)
- [x] Fixed bcrypt warning (upgraded to 4.2.1)
- [x] Stock Management module — tested 100% (iteration 10)
- [x] Kitchen/Chef page — tested 100% (iteration 10)
- [x] Invoice OCR with GPT-4o
- [x] WhatsApp Notification Triggers (P0) — tested 100% (iteration 11)
- [x] Bank Reconciliation UI (P1) — tested 100% (iteration 11)
- [x] Fixed SAR currency in InvoicesPage

## Upcoming Tasks
- **P2:** Refactor server.py (>5400 lines) into separate routers/models/services
- **P2:** Break down large frontend components

## Key API Endpoints
- `POST /api/whatsapp/send-to` — Send report to flexible phone number
- `GET /api/bank-statements/{id}/reconciliation` — POS reconciliation with 1-day offset
- `POST /api/stock/entries`, `POST /api/stock/entries/bulk` — Stock in
- `POST /api/stock/usage/bulk` — Kitchen usage
- `GET /api/stock/balance?branch_id=` — Current stock per branch
- `POST /api/stock/scan-invoice` — Invoice OCR (GPT-4o)

## DB Collections
- `stock_entries`, `stock_usage` — Stock tracking
- `whatsapp_config` — Twilio WhatsApp settings
- Items extended: cost_price, unit, min_stock_level
