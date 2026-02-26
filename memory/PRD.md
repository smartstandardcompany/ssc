# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track" with restaurant stock management, invoice OCR, bank reconciliation, and HR with job titles.

## Architecture
- **Backend:** FastAPI + MongoDB (Motor async) + JWT Auth + Pydantic
  - **Entry point:** `server.py` (79 lines) — imports 19 modular routers
  - **Routers:** `/app/backend/routers/` — auth, bank_statements, branches, customers, dashboard, documents, employees, expenses, exports, invoices, job_titles, partners, reports, sales, settings, shifts, stock, suppliers, whatsapp
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

### Stock Management
- Item Master with cost/sale prices, units, min_stock_level
- Stock In/Out per branch, Invoice OCR (GPT-4o via mobile camera)
- Real-time balance, low stock alerts, stock reports

### Kitchen / Chef Interface
- Card-based UI for daily item usage recording
- Branch-specific stock, +/- quantity controls, bulk submission

### HR Management with Job Titles & Permissions (P1 - DONE)
- 15 pre-defined job titles + custom titles with department & salary range
- **Job Title Permissions:** Each job title maps to a set of page permissions (dashboard, sales, invoices, expenses, etc.)
- **Permission sync:** On login, employee's job title permissions are merged into user permissions. On link-user, job title permissions are applied automatically.
- **Permission propagation:** When a job title's permissions are updated, all linked employee users are synced.
- Salary structure: Min/max salary per title, auto-fill on assignment
- Employee CRUD, salary payments, loan tracking, leave management
- Employee self-service portal, payslip PDFs, shift scheduling

### Shift Scheduling
- Shift CRUD, shift assignments, bulk assignment
- Attendance tracking with late detection, overtime calculation
- Attendance summary reports

### WhatsApp Notifications
- Flexible phone number, Daily Sales, Expense, Low Stock, Branch reports

### Bank Reconciliation & Dedicated Reconciliation Page (P2 - DONE)
- Side-by-side: Bank POS deposits vs SSC Track bank sales
- Bank statement upload/analysis (Alinma & Albilad PDF/XLS parser)
- **Dedicated Reconciliation Page** at `/reconciliation`:
  - Statement selector, summary cards (Bank POS Total, App Sales Total, Difference, Matched, Discrepancies)
  - Table with status indicators (Matched, Mismatch, Bank Only, App Only)
  - Manual flag/notes feature per row (Verified OK, Needs Investigation, Resolved, Ignored)
  - Status filter and search by branch/date

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
- [x] P0: Backend Refactoring — server.py → 79-line entry point + 19 modular routers (Feb 26, 2026)
- [x] P1: Link Job Titles to Permissions — permissions field on job titles, sync to users (Feb 26, 2026)
- [x] P2: Dedicated Reconciliation Page — /reconciliation with flags & filtering (Feb 26, 2026)

## Upcoming Tasks
- **P3:** Automated WhatsApp Notification Triggers (scheduled daily reports)
- **P4:** Advanced Stock/Inventory Reporting (consumption, wastage, profitability)
- **P3 (Issue):** Fix bcrypt warning on startup (recurring)
