# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track" with restaurant stock management, invoice OCR, bank reconciliation, and HR with job titles.

## Architecture
- **Backend:** FastAPI + MongoDB (Motor async) + JWT Auth + Pydantic + APScheduler
  - **Entry point:** `server.py` (82 lines) — imports 20 modular routers
  - **Routers:** `/app/backend/routers/` — auth, bank_statements, branches, customers, dashboard, documents, employees, expenses, exports, invoices, job_titles, partners, reports, sales, scheduler, settings, shifts, stock, suppliers, whatsapp
  - **Shared:** `database.py` (DB connection, auth helpers), `models.py` (Pydantic models)
- **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts
- **AI:** GPT-4o via Emergent LLM Key (invoice OCR)
- **Messaging:** Twilio WhatsApp integration
- **Deployment:** Docker + Nginx + Railway (PWA enabled)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## All Implemented Features

### Financial Management
- Sales, Expenses (with cross-branch tracking), Supplier Payments
- Customer credit, Invoicing with item master, Currency: SAR

### Stock Management & Advanced Reporting (P4 - DONE)
- Item Master with cost/sale prices, units, min_stock_level
- Stock In/Out per branch, Invoice OCR (GPT-4o via mobile camera)
- Real-time balance, low stock alerts
- **Consumption Analysis:** Usage per item over time, daily averages, daily trend chart
- **Profitability Report:** Cost vs sale price, margin %, P&L per item
- **Wastage Tracking:** Items marked as waste/expired/damaged with cost impact

### Kitchen / Chef Interface
- Card-based UI for daily item usage recording
- Branch-specific stock, +/- quantity controls, bulk submission

### HR Management with Job Titles & Permissions (P1 - DONE)
- 15 pre-defined job titles + custom titles with department & salary range
- Job Title Permissions: Each job title maps to page permissions
- Permission sync on login, link-user, and job title update
- Employee CRUD, salary payments, loan tracking, leave management
- Employee self-service portal, payslip PDFs, shift scheduling

### Shift Scheduling
- Shift CRUD, shift assignments, bulk assignment
- Attendance tracking with late detection, overtime calculation

### WhatsApp Notifications & Automated Scheduler (P3 - DONE)
- Flexible phone number, Daily Sales, Expense, Low Stock, Branch reports
- **Automated Scheduler:** APScheduler-based with 3 configurable jobs:
  - Daily Sales Summary (default 9:00 PM)
  - Low Stock Alert (default 8:00 AM)
  - Expense Summary (default 9:30 PM)
- Each job: enable/disable, configurable time, WA/Email channel selection
- Manual trigger/test button, execution logs

### Bank Reconciliation & Dedicated Reconciliation Page (P2 - DONE)
- Side-by-side: Bank POS deposits vs SSC Track bank sales
- Bank statement upload/analysis (Alinma & Albilad PDF/XLS parser)
- Dedicated Reconciliation Page with manual flag/notes per row

### Deployment & PWA
- Railway, VPS, Render deployment guides with GoDaddy DNS setup
- PWA install guide for Android and iPhone

### Other Modules
- Asset & Liability Tracking (Documents, Fines, Company Loans, Partners)
- Cash Flow (Branch transfers, company balance, inter-branch dues)
- Dashboard with KPIs, Reports, PDF/Excel export
- Role-based access, Email/WhatsApp settings, Data import, Backup

## Completed Tasks
- [x] All financial management features
- [x] Stock Management + Kitchen pages
- [x] Invoice OCR with GPT-4o
- [x] WhatsApp Notification Triggers
- [x] Bank Reconciliation UI
- [x] Job Titles (15 default + custom)
- [x] Enhanced deployment guide (GoDaddy + PWA)
- [x] Shift scheduling system
- [x] P0: Backend Refactoring (Feb 26, 2026)
- [x] P1: Link Job Titles to Permissions (Feb 26, 2026)
- [x] P2: Dedicated Reconciliation Page (Feb 26, 2026)
- [x] P3: Automated WhatsApp Notification Scheduler (Feb 26, 2026)
- [x] P4: Advanced Stock/Inventory Reporting (Feb 26, 2026)
- [x] Fix: bcrypt warning on startup resolved (Feb 26, 2026)

## Upcoming Tasks
- No pending tasks from the original backlog. All P0-P4 completed.
