# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track" with restaurant stock management, invoice OCR, bank reconciliation, and HR with job titles.

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
- Sales, Expenses (with cross-branch tracking), Supplier Payments
- Customer credit, Invoicing with item master, Currency: SAR

### Stock Management
- Item Master with cost/sale prices, units, min_stock_level
- Stock In/Out per branch, Invoice OCR (GPT-4o via mobile camera)
- Real-time balance, low stock alerts, stock reports

### Kitchen / Chef Interface
- Card-based UI for daily item usage recording
- Branch-specific stock, +/- quantity controls, bulk submission

### HR Management with Job Titles
- **15 pre-defined job titles:** Chef, Sous Chef, Line Cook, Cashier, Waiter, Manager, Supervisor, Driver, Cleaner, Accountant, Delivery, Security, Kitchen Helper, Receptionist, Barista
- **Custom titles:** Add any title with department & salary range
- **Salary structure:** Min/max salary per title, auto-fill on assignment
- **Job Title Manager:** Full CRUD in Employees page
- Employee CRUD, salary payments, loan tracking, leave management
- Employee self-service portal, payslip PDFs (with job title)

### WhatsApp Notifications
- Flexible phone number — enter recipient each time
- Reports: Daily Sales, Expense Summary, Low Stock Alert, Branch Report
- Buttons on Dashboard, Expenses, Stock pages

### Bank Reconciliation
- Side-by-side: Bank POS deposits vs SSC Track bank sales
- 1-day offset (today's sale = tomorrow's bank deposit)
- Summary cards, CSV export, color-coded status

### Deployment & PWA
- Enhanced Settings → Deploy tab with:
  - Railway (Recommended), VPS, Render deployment options
  - GoDaddy DNS setup (CNAME for Railway, A record for VPS)
  - Environment variables reference
  - PWA install guide for Android (Chrome) and iPhone (Safari)

### Other Modules
- Asset & Liability Tracking (Documents, Fines, Company Loans, Partners)
- Cash Flow (Branch transfers, company balance, inter-branch dues)
- Bank Statement Analysis (Alinma & Albilad PDF/XLS parser)
- Dashboard with KPIs, Reports, PDF/Excel export
- Role-based access, Email/WhatsApp settings, Data import, Backup

## Completed Tasks (This Session - Feb 26, 2026)
- [x] Expense For Branch feature — tested (iteration 9)
- [x] Fixed bcrypt warning (4.2.1)
- [x] Stock Management + Kitchen pages — tested (iteration 10)
- [x] Invoice OCR with GPT-4o
- [x] WhatsApp Notification Triggers — tested (iteration 11)
- [x] Bank Reconciliation UI — tested (iteration 11)
- [x] Job Titles (15 default + custom) — tested (iteration 12)
- [x] Enhanced deployment guide (GoDaddy + PWA) — tested (iteration 12)
- [x] Fixed SAR currency in InvoicesPage

## Upcoming Tasks
- **P2:** Refactor server.py (>5700 lines) into separate routers/models/services
- **P2:** Break down large frontend components
- Item-level P&L report (purchased cost vs sold revenue per item)

## Key API Endpoints
- `GET/POST/PUT/DELETE /api/job-titles` — Job title CRUD
- `POST /api/whatsapp/send-to` — Send report to flexible phone
- `GET /api/bank-statements/{id}/reconciliation` — POS reconciliation
- `POST /api/stock/entries`, `POST /api/stock/entries/bulk` — Stock in
- `POST /api/stock/usage/bulk` — Kitchen usage
- `GET /api/stock/balance`, `GET /api/stock/report` — Stock data
- `POST /api/stock/scan-invoice` — Invoice OCR (GPT-4o)
