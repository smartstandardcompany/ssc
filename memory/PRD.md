# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 20 (Mar 9, 2026)

### Export Center (DONE)
- New dedicated page at `/export-center` accessible from sidebar
- 8 report types: Sales, Expenses, Supplier Payments, Profit & Loss, Daily Summary, Customers, Employees, Inventory
- Date presets: Today, Yesterday, This Week, This Month, Last Month, Last 30 Days, This Year, All Time, Custom Range
- Branch filtering, PDF/Excel export, export history tracking
- Backend: `/api/export-center/report-types`, `/api/export-center/history`, `/api/export-center/generate`

### Dashboard Enhancement (DONE)
- Total Sales card: Shows Cash, Bank, Online breakdown as small text
- Total Expenses card: Shows top 3 expense categories (e.g., partner_salary, salary, Supplier Purchase) as small text
- Uses existing backend data (cash_sales, bank_sales, online_sales, expense_by_category)

### Daily Summary Bug Fix - Double Counting (DONE - CRITICAL)
- **Root cause**: Line 761-762 in dashboard.py had TWO lines adding to `daily[d]["sales"]`: old line using `s.get("final_amount")` AND new line using `get_sale_total(s)`, effectively doubling all sales
- **Additional fixes**: 
  - Null `final_amount` handling: 8 sales had `final_amount: None`, causing incorrect fallback
  - Payment mode mapping: `card` mode now maps to `bank`, `discount` mode now ignored
  - Single-day endpoint also fixed with same helpers
- **Verification**: Mar 5 correctly shows SAR 1,000 (was SAR 2,000), total matches SAR 64,662

### UI/UX Polishing (DONE)
- Page entrance animations via DashboardLayout key={location.pathname}
- Card staggered entrance animations, skeleton loading states
- Enhanced table hover, scrollbar, focus rings, dark mode

## Previous Sessions Summary
- Duplicate Detection & Prevention (Sales, Expenses, Supplier Payments)
- Duplicate Report Page, Monthly Reconciliation Report
- Daily Summary Bug Fix (branch filtering - session 19)
- Smart Anomaly Detector, Guided Tours, Platform Fee Calculator

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked by SMTP)
