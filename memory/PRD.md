# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 6 (Mar 7, 2026) - Access Control & Delete Restrictions

### Delete Restrictions (DONE)
- Per-module configurable delete policies: Admin only, Admin & Manager, Anyone, Disabled
- 7 modules: Sales, Expenses, Supplier Payments, Stock, Customers, Invoices, Employees
- Time-based delete limit (default 24h) - prevents deleting records older than threshold
- Admins always bypass restrictions

### Role-Based Visibility (DONE)
- Operators can't see: Total Expenses, Supplier Payments, Net Profit on Dashboard
- POS shows "Today's Sales/Expenses/Net" for operators, "Total" for admin/managers
- 6 configurable visibility toggles: hide financials, profit, analytics, reports, supplier credit, employee salary
- Settings > Access Control tab for admin configuration

### Reporting Customization (DONE)
- Advanced Analytics dashboard with 5 KPI cards + 5 analysis tabs
- Comparative supplier ranking with expense/payment breakdown
- Revenue trend, cash flow waterfall, branch radar, expense category breakdown

## Previous Sessions
- Session 5: Supplier ledger/report branch fixes, Advanced Analytics page, 3 new module tours
- Session 4: Smart archive recommendations, Auto-archive scheduling, Module tours (POS/Kitchen/Portal)
- Session 3: Scheduled PDF reports, Data management, Module tours, Mobile responsive
- Session 2: Employee offboarding, AI analytics, Pagination, PWA, SMTP fix

## Pending Issues
- SMTP Email: Auth error 5.7.139 from Microsoft 365 (external issue)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Custom report builder (save report templates)
- P3: Comparative period analysis (this month vs last month)
