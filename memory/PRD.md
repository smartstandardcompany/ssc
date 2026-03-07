# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 7 (Mar 7, 2026) - Audit Trail, Report Builder, Comparative Analysis

### Quick Access Buttons (DONE)
- 6 quick-access buttons in sidebar: Cashier, Waiter, Kitchen, Orders, Tables, Customers
- Open respective portals in new browser tabs
- Color-coded with appropriate icons

### Deletion Audit Trail (DONE)
- All delete operations now log to `delete_audit_log` collection via `check_delete_permission()`
- Logs include: user_email, user_role, module, record_date, record_summary, timestamp, allowed, reason
- Integrated into delete endpoints for: sales, expenses, customers, suppliers, supplier_payments, invoices, employees, fines
- Admin-only Audit Trail page at `/audit-trail` with search, filter by module/status, pagination
- Stats cards showing Total Attempts, Allowed, Denied counts

### Custom Report Builder (DONE)
- Full CRUD for report templates: create, edit, delete, run
- 8 data sources: sales, expenses, supplier_payments, customers, employees, invoices, stock, activity_logs
- Configurable: column selection, sort, group_by, chart_type, date filters
- Run reports with summary stats (total_records, total_amount, avg/min/max)
- CSV export for report results
- Frontend page at `/report-builder` under Reports navigation

### Comparative Period Analysis (DONE)
- API endpoint: GET /api/reports/comparative?period=day|week|month|year
- Compares 5 metrics: Sales, Expenses, Supplier Payments, Net Profit, Avg Sale
- Shows current vs previous period values with percentage change
- UI: New "Comparison" tab in Advanced Analytics page
- Period selector buttons (Day/Week/Month/Year)
- Metric comparison cards + bar chart visualization

## Session 6 (Mar 7, 2026) - Access Control & Delete Restrictions

### Delete Restrictions (DONE)
- Per-module configurable delete policies: Admin only, Admin & Manager, Anyone, Disabled
- 7 modules: Sales, Expenses, Supplier Payments, Stock, Customers, Invoices, Employees
- Time-based delete limit (default 24h) - prevents deleting records older than threshold
- Admins always bypass restrictions

### Role-Based Visibility (DONE)
- Operators can't see: Total Expenses, Supplier Payments, Net Profit on Dashboard
- POS shows "Today's Sales/Expenses/Net" for operators, "Total" for admin/managers
- 6 configurable visibility toggles
- Settings > Access Control tab for admin configuration

## Previous Sessions
- Session 5: Supplier ledger/report branch fixes, Advanced Analytics page, 3 new module tours
- Session 4: Smart archive recommendations, Auto-archive scheduling, Module tours (POS/Kitchen/Portal)
- Session 3: Scheduled PDF reports, Data management, Module tours, Mobile responsive
- Session 2: Employee offboarding, AI analytics, Pagination, PWA, SMTP fix

## Pending Issues
- SMTP Email: Auth error 5.7.139 from Microsoft 365 (external issue - user needs to disable Security Defaults)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Guided tours for remaining sub-modules (POS, Kitchen, Customer Portal)
- P3: Further UI/UX polishing across the application
