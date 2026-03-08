# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 9 (Mar 8, 2026) - Cross-Branch Payments, Reports Hub, Data Alerts, Invoice Upload

### Cross-Branch Supplier Payments (DONE)
- Added "Paid By (Branch)" and "Expense For (Branch)" fields to Expenses and Supplier Payments
- When Branch A pays for Branch B's expense, both branches are tracked
- Updated table views to show both columns

### Reports Hub/Launcher Page (DONE)
- Converted 1460-line tab-based Reports page into clean hub with categorized cards
- 4 sections: Financial Reports (7), Analytics & Insights (6), Operations (3), Tools (1)
- Each card links to individual report page with icon, description, and badges

### Missing Data Entry Notifications (DONE)
- Dashboard shows "Data Entry Alerts" widget when branches have no sales/expenses for yesterday/today
- Backend endpoint checks all branches and returns alerts
- Each alert has an "Enter" button linking to the relevant page

### Optional Invoice Upload for Expenses (DONE)
- Added optional invoice/bill file upload to Expenses form
- Backend endpoint accepts images/PDFs and stores in /uploads/bills/
- Bill URL stored in expense record's bill_image_url field

## Session 8 (Mar 7, 2026) - Dashboard Branch Filter, Daily Summary Range, Tours, Polishing
### Dashboard Branch Filter Enhancement (DONE)
### Daily Summary Date Range Mode (DONE)
### Profit Trend Chart (DONE)
### PIN Management UI (DONE)
### Interactive Reports (clickable cells) (DONE)

## Session 7 - Audit Trail, Report Builder, Comparative Analysis (DONE)
## Session 6 - Access Control & Delete Restrictions (DONE)
## Sessions 1-5 - Core ERP, POS, Kitchen, Employee Management (DONE)

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Further UI/UX polishing
- P3: Guided tours for sub-modules (low priority)
