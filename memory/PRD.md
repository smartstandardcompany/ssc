# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track" with restaurant stock management, invoice OCR, bank reconciliation, HR, AI scheduling, ZATCA-compliant invoicing, and real-time POS analytics.

## Architecture
- **Backend:** FastAPI + MongoDB (Motor async) + JWT Auth + Pydantic + APScheduler
  - **Entry point:** `server.py` — imports 20 modular routers
  - **Routers:** auth, bank_statements, branches, customers, dashboard, documents, employees, expenses, exports, invoices, job_titles, partners, reports, sales, scheduler, settings, shifts, stock, suppliers, whatsapp
- **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts + qrcode.react
- **AI:** GPT-4o via Emergent LLM Key (invoice OCR + shift recommendations)
- **Messaging:** Twilio WhatsApp
- **Deployment:** Docker + Nginx + Railway (PWA)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## All Implemented Features

### Real-Time POS Analytics (NEW - Feb 26, 2026)
- Dedicated `/pos-analytics` page with auto-refresh every 12s
- 5 KPI cards: Total Sales, Expenses, Net, Transactions, Avg Ticket
- Branch Leaderboard (ranked by revenue)
- Hourly Sales Breakdown chart (Recharts)
- Top Cashiers ranking
- Payment Mode pie chart (Cash/Bank/Online/Credit)
- Live Sales Feed with real-time ticker

### ZATCA-Compliant Invoicing (NEW - Feb 26, 2026)
- VAT (15%) calculation on invoices (configurable in Settings)
- ZATCA Phase 1 (Fatoorah) QR code with TLV encoding (5 tags)
- Bilingual Arabic + English invoice layout
- Print dialog: Tax Invoice / فاتورة ضريبية
- Fields: Invoice number, date, buyer/seller, items, subtotal, discount, VAT, total
- QR code embedded in print preview (qrcode.react)
- Company VAT number from Settings

### Mobile POS / Quick Entry
- `/pos` page with touch-friendly UI
- Sale/Expense toggle, quick amounts, 4 payment modes

### Employee Resignation / Exit Management
- Status tracking: Active, Resigned, On Notice, Terminated, Left
- Settlement calculator, complete exit with account deactivation

### AI-Powered Shift Scheduling
- GPT-4o analyzes 30-day attendance history
- Generates optimal 7-day schedule, one-click apply

### Financial Management
- Sales, Expenses, Supplier Payments, Customer credit, Invoicing

### Stock Management & Reporting
- Item Master, Stock In/Out, Invoice OCR, Consumption/Profitability/Wastage reports

### HR with Job Titles & Permissions
- 15 default titles, permission sync on login, self-service portal

### Automated Scheduler
- APScheduler: Daily Sales, Low Stock, Expense Summary

### Bank Reconciliation
- Dedicated page with side-by-side comparison, manual flagging

### Other
- Shifts, Kitchen, WhatsApp, Assets, Cash Flow, Dashboard, Reports, RBAC, PWA

## Completed Tasks (All)
- [x] All original financial/HR/stock features
- [x] P0: Backend Refactoring (Feb 26, 2026)
- [x] P1: Job Titles to Permissions (Feb 26, 2026)
- [x] P2: Dedicated Reconciliation Page (Feb 26, 2026)
- [x] P3: Automated Scheduler (Feb 26, 2026)
- [x] P4: Stock Reports (Feb 26, 2026)
- [x] Mobile POS / Quick Entry (Feb 26, 2026)
- [x] Employee Resignation/Exit (Feb 26, 2026)
- [x] AI Shift Scheduling (Feb 26, 2026)
- [x] Real-Time POS Analytics (Feb 26, 2026)
- [x] ZATCA-Compliant Invoicing (Feb 26, 2026)
- [x] bcrypt warning fix (Feb 26, 2026)

## Upcoming Tasks
- None pending from requirements - all completed
