# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 5 (Mar 5, 2026) - Bug Fixes + Features

### Bug Fixes
- **Supplier Ledger Branch Info (FIXED):** Ledger entries now include branch_id and branch_name. Each entry shows which branch the transaction originated from.
- **Supplier Report Branch Filter (FIXED):** Branch filter now uses server-side filtering via branch_id query param. Report shows Branch column with per-branch expense/payment breakdown badges.

### Advanced Analytics Dashboard (DONE)
- New `/advanced-analytics` page with 5 KPI cards (Revenue, Expenses, Net Profit, Customers, Avg Order)
- 5 analysis tabs: Revenue (area chart), Cash Flow (bar chart), Customers (supplier ranking), Branches (radar chart), Expenses (pie chart + category list)
- Branch filter integration
- Data from existing report endpoints (kpi-gauges, revenue-trends, supplier-balance, cashflow-waterfall, branch-radar, sales-funnel, expense-treemap)

### Additional Sub-Module Tours (DONE)
- 3 new module tours: Suppliers (4 steps), Advanced Analytics (4 steps), Data Management (4 steps)
- Total: 11 module-specific guided tours across the application

## Previous Sessions Summary
- Session 4: Module tours (POS/Kitchen/CustomerPortal), Smart archive recommendations, Auto-archive scheduling
- Session 3: Scheduled PDF reports, Data management page, 5 module tours, Mobile responsive
- Session 2: Employee offboarding, AI analytics, Pagination, PWA, SMTP fix

## Pending Issues
- SMTP Email: Auth error 5.7.139 from Microsoft 365

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Additional reporting customization
