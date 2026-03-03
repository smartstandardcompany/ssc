# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for tracking sales, expenses, supplier payments, and more.

## Core Requirements
- **Financial Management:** Sales (Bank/Cash/Online/Credit), Expenses, Supplier Payments, Customer Credit, ZATCA Invoicing, P&L, Online Platform Sales
- **HR Management:** Employee database, salary, leave, loans, Self-Service Portal
- **Staff/Stock/Restaurant:** POS, KDS, Tables, Inventory, Scheduling
- **Assets & Liabilities:** Loans, fines, document expiry alerts
- **CCTV Security:** Hikvision integration, AI features
- **Cash Flow:** Branch transfers, bank reconciliation
- **Reporting:** Dashboards, AI forecasting, anomaly detection
- **Admin:** Role-based access, branding, dark mode, i18n, PWA

## Tech Stack
- **Frontend:** React + Tailwind CSS + Shadcn/UI + Zustand
- **Backend:** FastAPI (Python) + MongoDB (Motor) + MongoDB Aggregation Pipelines
- **Auth:** JWT-based
- **Integrations:** OpenAI GPT-4o, Twilio, aiosmtplib, APScheduler

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234

## What's Been Implemented (All Phases Complete)

### Phase 1-16: Core ERP + Advanced Features (ALL DONE)
All financial modules, HR, stock, restaurant POS, assets, CCTV, cash flow, reporting, admin tools, loyalty program, security, branch filtering, barcodes, timestamps, activity logging, advanced search, daily summary, AI forecasting, sales alerts.

### Phase 17: Supplier Module Enhancements & POS UI/UX (DONE)
- Supplier total purchases, ledger with running balance, PDF/Excel export
- Multiple bank accounts (up to 3), POS expense form clarity, online sales fix

### Phase 18: Statement Sharing, Zustand, Pagination, Mobile (DONE)
- Supplier statement sharing via Email/WhatsApp
- Zustand stores (auth, branch, UI), API pagination, MongoDB indexes, responsive fixes

### Phase 19: Critical Bug Fixes & Performance (DONE - Mar 2026)
- **Performance Fix:** Replaced N+1 queries with MongoDB aggregation pipelines in dashboard/stats and supplier list. Dashboard stats no longer loads 30K+ records into memory - uses `$group` aggregation for expenses, supplier payments, category breakdowns, branch alerts, and supplier dues. Supplier list uses aggregation for total_purchases. All endpoints respond under 500ms.
- **User Branch Fix:** Removed mandatory branch requirement for non-admin users. Managers/Operators can now have "All Branches (Full Access)" - branch_id is optional. Updated label and helper text for clarity.
- **Supplier Payments Revamp:** SupplierPaymentsPage completely rewritten with two forms:
  - **Add Bill:** Creates expense record with supplier_id. Supports credit (adds to balance), cash, or bank modes. Includes branch selector and category.
  - **Pay Credit:** Records supplier_payment AND creates corresponding expense entry, ensuring all supplier transactions appear in expense reports.
  - Both forms auto-populate supplier's branch, show current credit/limit/total purchases.
- **Dashboard 500 Fix:** Fixed NameError caused by referencing removed `expenses`/`supplier_payments` variables after aggregation refactor.
- Test Results: Backend 100% (15/15), Frontend 100%

## Architecture
```
/app/
├── backend/
│   ├── routers/ (auth, sales, expenses, suppliers, dashboard, etc.)
│   ├── models.py, database.py, server.py
│   └── tests/
├── frontend/
│   └── src/
│       ├── stores/ (authStore, branchStore, uiStore - Zustand)
│       ├── components/ (DashboardLayout, AdvancedSearch, ExportButtons, etc.)
│       └── pages/ (SalesPage, ExpensesPage, SuppliersPage, POSPage, etc.)
```

## Prioritized Backlog
- Propagate branch filter to remaining minor routers
- Advanced analytics refinements
- CCTV AI features expansion
- WhatsApp chatbot improvements
- Weekly/Monthly trend comparison reports
