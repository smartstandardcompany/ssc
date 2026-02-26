# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track" with restaurant stock management, invoice OCR, bank reconciliation, HR with job titles, and AI-powered scheduling.

## Architecture
- **Backend:** FastAPI + MongoDB (Motor async) + JWT Auth + Pydantic + APScheduler
  - **Entry point:** `server.py` — imports 20 modular routers
  - **Routers:** auth, bank_statements, branches, customers, dashboard, documents, employees, expenses, exports, invoices, job_titles, partners, reports, sales, scheduler, settings, shifts, stock, suppliers, whatsapp
  - **Shared:** `database.py`, `models.py`
- **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts
- **AI:** GPT-4o via Emergent LLM Key (invoice OCR + shift recommendations)
- **Messaging:** Twilio WhatsApp integration
- **Deployment:** Docker + Nginx + Railway (PWA enabled)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## All Implemented Features

### Mobile-Optimized POS / Quick Entry (NEW)
- Dedicated `/pos` page with touch-friendly UI
- Sale/Expense toggle, branch selector
- Quick amount buttons (10, 25, 50, 100, 250, 500, 1000, 2500)
- Payment modes: Cash, Bank, Online, Credit (with customer select)
- Today stats summary (Sales, Expenses, Net)
- Instant confirmation after recording

### Employee Resignation / Exit Management (NEW)
- Employee status tracking: Active, Resigned, On Notice, Terminated, Left
- Resignation flow: date, notice period, reason
- Final settlement calculation: pending salary + leave encashment - loan balance
- Complete exit: deactivates employee record and user account
- Status badges in employee table

### AI-Powered Shift Scheduling (NEW)
- GPT-4o analyzes attendance history, reliability, overtime
- Generates optimal 7-day schedule per branch
- Considers employee reliability, late patterns, workload distribution
- One-click apply all AI recommendations to schedule
- Purple gradient AI Schedule button with loading state

### Financial Management
- Sales, Expenses (with cross-branch tracking), Supplier Payments
- Customer credit, Invoicing with item master, Currency: SAR

### Stock Management & Advanced Reporting
- Item Master, Stock In/Out, Invoice OCR (GPT-4o)
- Consumption Analysis, Profitability Report, Wastage Tracking

### HR Management with Job Titles & Permissions
- 15 default job titles + custom, permission sync on login
- Employee CRUD, salary, loans, leaves, self-service portal

### Automated Scheduler
- APScheduler: Daily Sales, Low Stock, Expense Summary
- Configurable time, WA/Email channels, manual trigger

### Bank Reconciliation
- Dedicated page with side-by-side comparison, manual flagging

### Other
- Shift Scheduling, Kitchen Interface, WhatsApp Notifications
- Asset/Liability Tracking, Cash Flow, Dashboard, Reports
- Role-based access, Settings, Data Import/Export, PWA

## Completed Tasks (All)
- [x] All financial management features
- [x] Stock Management + Kitchen pages
- [x] Invoice OCR with GPT-4o
- [x] WhatsApp Notification Triggers
- [x] Bank Reconciliation UI
- [x] Job Titles + Permissions
- [x] Shift scheduling
- [x] Deployment guide + PWA
- [x] P0: Backend Refactoring (Feb 26, 2026)
- [x] P1: Job Titles to Permissions (Feb 26, 2026)
- [x] P2: Dedicated Reconciliation Page (Feb 26, 2026)
- [x] P3: Automated Scheduler (Feb 26, 2026)
- [x] P4: Stock Reports (Feb 26, 2026)
- [x] bcrypt warning fix (Feb 26, 2026)
- [x] Mobile POS / Quick Entry (Feb 26, 2026)
- [x] Employee Resignation/Exit Management (Feb 26, 2026)
- [x] AI Shift Scheduling (Feb 26, 2026)

## Upcoming / Future Tasks
- None from original backlog - all completed
