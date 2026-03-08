# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 12 (Mar 8, 2026) - Bank Account Management, Branch Dues Drill-Down

### Bank Account Management (DONE)
- New Bank Accounts page with full CRUD (Add, Edit, Delete)
- Card-based UI showing: display name, bank name, account number, IBAN, assigned branch, default badge
- "Set as default" functionality — only one account can be default at a time
- Accessible from sidebar under Reports section and from Reports hub
- Backend: `/api/bank-accounts` CRUD endpoints

### Bank Account Selection in Sales (DONE)
- When recording a sale with bank payment mode, a "Select Bank Account" dropdown appears
- Shows all registered bank accounts with names and account numbers
- `bank_account_id` stored with each sale record for tracking which account received payment

### Dashboard Branch Dues Drill-Down (DONE)
- "View Details" button added to Branch-to-Branch Dues card on Dashboard
- Clicking any due amount or the button opens a detail dialog
- Dialog shows all cross-branch transactions: Date, Type (expense/supplier_payment/salary/transfer), From Branch, To Branch, Amount, Description
- Backend: `/api/reports/branch-dues-detail` endpoint aggregates cross-branch entries from expenses, supplier payments, salaries, and transfers

## Session 11 (Mar 8, 2026) - Date Quick Filter, Summary Bars, UI Polish, Tours
### Date Range Quick-Filter Bar (DONE)
### Grand Total Summary Bars (DONE)
### Tour Buttons & UI Polish (DONE)

## Session 10 (Mar 8, 2026) - Sales & Expenses Daily Grouping, Pagination Fix
### Sales Daily Grouped View (DONE)
### Expenses Daily Grouped Expandable View (DONE)
### Pagination Fix (DONE)

## Session 9 (Mar 8, 2026) - Cross-Branch Payments, Reports Hub, Data Alerts, Invoice Upload
### Cross-Branch Supplier Payments (DONE)
### Reports Hub/Launcher Page (DONE)
### Missing Data Entry Notifications (DONE)
### Optional Invoice Upload for Expenses (DONE)

## Sessions 1-8 - Core ERP, POS, Kitchen, Employee Management, Reports, Dashboard (ALL DONE)

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Further UI/UX polishing
