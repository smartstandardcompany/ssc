# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 8 (Mar 7, 2026) - Dashboard Branch Filter, Daily Summary Range, Tours, Polishing

### Dashboard Branch Filter Enhancement (DONE)
- Branch filter now applies to ALL dashboard stats: supplier_dues, due_fines, today-vs-yesterday
- Previously only sales, expenses, supplier_payments were filtered
- Frontend passes branch_ids to today-vs-yesterday API

### Daily Summary Date Range Mode (DONE)
- New `/api/dashboard/daily-summary-range` endpoint with start_date, end_date, branch_id
- Returns totals with full cash/bank breakdown for sales, expenses, supplier payments
- Returns expense_by_category and daily array with day-by-day data
- Frontend: Toggle between "Single Day" and "Date Range" modes
- Range mode: "Summary" view (totals + expense categories + cash/bank table)
- Range mode: "Day by Day" view (table with date, sales, cash, bank, expenses, net)
- Quick range presets: 7d, 30d, 90d

### Guided Tours for Remaining Modules (DONE)
- Added tours for: /daily-summary, /expenses, /customers, /invoices, /report-builder, /audit-trail
- 7 new tours (4 steps each) with step-by-step modal overlay
- Reset all tours via Settings page button

### UI/UX Polishing (DONE)
- Fixed KeyError bug in daily-summary endpoint (customers/suppliers without 'id' field)
- Quick Access buttons now link to correct paths
- Consistent card styling with cash/bank breakdown

## Session 7 (Mar 7, 2026) - Audit Trail, Report Builder, Comparative Analysis

### Quick Access Buttons (DONE)
- 6 quick-access buttons in sidebar: Cashier, Waiter, Kitchen, Orders, Tables, Customers

### Deletion Audit Trail (DONE)
- All delete operations log to delete_audit_log via check_delete_permission()
- Integrated into: sales, expenses, customers, suppliers, supplier_payments, invoices, employees, fines
- Admin-only /audit-trail page with search, filter, pagination

### Custom Report Builder (DONE)
- Full CRUD for report templates at /report-builder
- 8 data sources, configurable columns/sorting/grouping, run & CSV export

### Comparative Period Analysis (DONE)
- "Comparison" tab in Advanced Analytics with Day/Week/Month/Year selectors
- Metric comparison cards + bar chart visualization

## Session 6 - Access Control & Delete Restrictions (DONE)
## Session 5 - Supplier Fixes, Advanced Analytics (DONE)
## Sessions 1-4 - Core ERP, POS, Kitchen, Employee Management (DONE)

## Pending Issues
- SMTP Email: Auth error 5.7.139 from Microsoft 365 (external issue - user needs to disable Security Defaults)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Further UI/UX polishing
