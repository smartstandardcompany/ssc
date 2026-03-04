# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for tracking sales, expenses, supplier payments, and more.

## Tech Stack
- **Frontend:** React + Tailwind CSS + Shadcn/UI + Zustand + Recharts
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
Supplier ledger/export/bank accounts, POS UI, Zustand initial setup, pagination, MongoDB indexes, aggregation pipelines, bug fixes.

### Phase 20: Backlog Features (DONE)
Supplier aging report, branch filter propagation, trend comparison, CCTV monitoring schedules/motion alerts, WhatsApp chatbot improvements.

### Phase 21: Automated Supplier Payment Reminders (DONE - Mar 2026)
Backend scheduler, aging logic, email/WhatsApp notifications, configuration page with history.

### Phase 22: Zustand State Management Refactor (DONE - Mar 2026)
Created authStore, branchStore, uiStore. Updated DashboardLayout, LoginPage, DashboardPage, POSPage, SuppliersPage, ExpensesPage, SalesPage, CustomersPage.

### Phase 23: P0/P1 Features (DONE - Mar 2026)

**1. AI-Powered Stock Reorder Page (`/stock-reorder`)**
- Summary cards: Critical items, Reorder Soon, Total Items, At Risk
- 3 tabs: Reorder Suggestions, Smart Alerts, Demand Forecast
- Table with: Item, Current Stock, Daily Usage, Days Left, Urgency, Suggested Qty, Reorder By
- Multi-select items and create bulk purchase order to supplier
- Uses existing backend endpoints: `/reports/stock-reorder`, `/stock/smart-alerts`, `/predictions/inventory-demand`

**2. Enhanced P&L Report Page (`/enhanced-pnl`)**
- Summary cards: Total Revenue, Total Expenses, Net Profit, Gross Margin
- Revenue by Channel breakdown (Cash, Bank, Online, Credit)
- Revenue Distribution pie chart
- 4 tabs:
  - By Branch: Bar chart + table with branch sales/expenses/profit/margin
  - Monthly Trend: Area chart with profit decomposition insights
  - By Supplier: Horizontal bar chart + table
  - By Item: Detailed item P&L with export buttons
- Period filter (This Month, Last 3 Months, Last 12 Months)
- Branch filter using Zustand branchStore

**3. Extended Zustand Migration**
- CustomersPage now uses useBranchStore
- All major pages (Dashboard, POS, Sales, Expenses, Suppliers, Customers) use centralized state

Test Results: Frontend 100% (all features verified)

## Key Pages & Routes
- `/stock-reorder` - AI Stock Reorder Suggestions (NEW)
- `/enhanced-pnl` - Enhanced P&L Report (NEW)
- `/supplier-aging` - Supplier Aging Report
- `/supplier-reminders` - Payment Reminder Settings
- `/trend-comparison` - Weekly/Monthly Trend Comparison
- Plus 30+ existing pages

## Remaining Backlog
- Performance optimization (virtualized lists for large tables)
- Customer-facing portal for order history & statements
- Continue Zustand migration to remaining pages (EmployeesPage, StockPage, etc.)
- Complete the customer portal feature
