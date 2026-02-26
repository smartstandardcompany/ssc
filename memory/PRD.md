# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track" with restaurant stock management, invoice OCR, bank reconciliation, HR, AI scheduling, ZATCA invoicing, real-time POS analytics, and multi-branch inventory transfers.

## Architecture
- **Backend:** FastAPI + MongoDB (Motor async) + JWT Auth + Pydantic + APScheduler
  - **Entry point:** `server.py` — imports 21 modular routers
  - **Routers:** auth, bank_statements, branches, customers, dashboard, documents, employees, expenses, exports, invoices, job_titles, partners, reports, sales, scheduler, settings, shifts, stock, suppliers, transfers, whatsapp
- **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts + qrcode.react
- **AI:** GPT-4o via Emergent LLM Key (invoice OCR + shift recommendations)
- **Messaging:** Twilio WhatsApp
- **Deployment:** Docker + Nginx + Railway (PWA)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## All Implemented Features

### Multi-Branch Inventory Transfer (NEW - Feb 26, 2026)
- Request/Approve/Reject/Complete workflow
- Source/destination branch selection with item picker
- Auto stock adjustment on completion (stock-out from source, stock-in at destination)
- WhatsApp notification on new transfer request
- Status tracking: Pending → Approved → Completed / Rejected
- Dedicated `/transfers` page with tabs (Pending, Approved, History)
- Summary cards, TransferCard UI with approve/reject/complete actions

### Real-Time POS Analytics
- `/pos-analytics` with 5 KPIs, branch leaderboard, hourly chart, live feed

### ZATCA-Compliant Invoicing
- VAT (15%), Phase 1 QR code (TLV encoding), bilingual Arabic+English print

### Mobile POS / Quick Entry
- `/pos` with touch-friendly sale/expense recording

### Employee Resignation / Exit Management
- Status tracking, settlement calculator, account deactivation

### AI-Powered Shift Scheduling
- GPT-4o attendance analysis, optimal schedule generation

### Financial Management
- Sales, Expenses, Supplier Payments, Customer credit, Invoicing

### Stock Management & Reporting
- Item Master, Stock In/Out, OCR, Consumption/Profitability/Wastage reports

### HR with Job Titles & Permissions
- 15 default titles, permission sync, self-service portal

### Automated Scheduler
- Daily Sales, Low Stock, Expense Summary (APScheduler)

### Bank Reconciliation
- Dedicated page with manual flagging

### Other
- Shifts, Kitchen, WhatsApp, Assets, Cash Flow, Dashboard, Reports, RBAC, PWA

## Completed Tasks (All)
- [x] All original features
- [x] P0-P4: Refactoring, Permissions, Reconciliation, Scheduler, Stock Reports
- [x] Mobile POS, Employee Exit, AI Scheduling
- [x] Real-Time POS Analytics, ZATCA Invoicing
- [x] Multi-Branch Inventory Transfer (Feb 26, 2026)

## Upcoming Tasks
- None pending - all completed
