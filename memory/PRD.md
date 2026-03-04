# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for tracking sales, expenses, supplier payments, and more.

## Tech Stack
- **Frontend:** React + Tailwind CSS + Shadcn/UI + Zustand
- **Backend:** FastAPI (Python) + MongoDB (Motor) + Aggregation Pipelines + APScheduler
- **Auth:** JWT-based
- **Integrations:** OpenAI GPT-4o, Twilio, aiosmtplib, Statsmodels

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234

## Implemented Phases Summary

### Phase 1-16: Core ERP + Advanced Features (ALL DONE)
Financial, HR, stock, POS, assets, CCTV, cash flow, reporting, admin, loyalty, security, barcodes, timestamps, logging, search, daily summary, AI forecasting, sales alerts.

### Phase 17-19: Supplier Enhancements, State Management, Performance (DONE)
Supplier ledger/export/bank accounts, POS UI, Zustand, pagination, MongoDB indexes, aggregation pipelines, bug fixes.

### Phase 20: Backlog Features (DONE)
Supplier aging report, branch filter propagation, trend comparison, CCTV monitoring schedules/motion alerts, WhatsApp chatbot improvements.

### Phase 21: Automated Supplier Payment Reminders (DONE - Mar 2026)
- **Backend:** New router `supplier_reminders.py` with config CRUD, test endpoint, and reminder check logic
- **Scheduler:** Daily job via APScheduler CronTrigger (default 9:00 AM) to auto-check supplier aging
- **Aging Logic:** FIFO-based invoice aging with configurable thresholds (30/60/90/120 days default, plus 150/180 selectable)
- **Severity Levels:** Low (<30d), Medium (30-59d), High (60-89d), Critical (90d+)
- **Notifications:** Email (HTML table with all overdue invoices) and WhatsApp (formatted text summary) with configurable recipient lists
- **History:** Full audit trail of all sent reminders with supplier summaries and channel results
- **Frontend:** New `/supplier-reminders` page with configuration and history
- Test Results: Backend 100% (7/7), Frontend 100%

### Phase 22: Zustand State Management Refactor (DONE - Mar 2026)
**Objective:** Migrate from direct localStorage access and prop drilling to centralized Zustand stores

**Stores Created:**
- **authStore** (`/frontend/src/stores/authStore.js`): User authentication, login/logout, permissions, token management with persist middleware
- **branchStore** (`/frontend/src/stores/branchStore.js`): Branch fetching and caching, getBranchName helper
- **uiStore** (`/frontend/src/stores/uiStore.js`): Dark mode toggle, sidebar state with persist middleware and onRehydrateStorage

**Pages Updated:**
- `DashboardLayout.jsx` - Uses all three stores for user, branches, dark mode
- `LoginPage.jsx` - Uses authStore.login() method
- `DashboardPage.jsx` - Uses authStore (user), branchStore (fetchBranches)
- `POSPage.jsx` - Uses branchStore (branches), authStore (user)
- `SuppliersPage.jsx` - Uses branchStore (branches, fetchBranches)
- `ExpensesPage.jsx` - Uses branchStore, authStore
- `SalesPage.jsx` - Uses branchStore

**Benefits:**
- Reduced redundant API calls (branches fetched once, cached globally)
- Eliminated prop drilling for user data
- Centralized dark mode state
- Cleaner component code with less local state
- Test Results: Frontend 100% (7/7 features verified)

## Key Pages & Routes
- `/supplier-aging` - Supplier Aging Report
- `/supplier-reminders` - Payment Reminder Settings
- `/trend-comparison` - Weekly/Monthly Trend Comparison
- `/supplier-payments` - Supplier Payments with Add Bill
- Plus 30+ existing pages

## Remaining Backlog
- Continue Zustand migration to remaining pages (CustomersPage, EmployeesPage, etc.)
- AI-powered stock reordering suggestions
- Enhanced P&L reporting with detailed breakdowns
- Performance optimization (virtualized lists for large tables)
- Customer-facing portal for order history & statements
