# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 13 (Mar 8, 2026) - Auto Bank Account Tracking

### Simplified Bank Account Tracking (DONE)
- REMOVED manual bank account dropdown from Sales form (too tedious)
- Bank accounts are assigned to branches once (in Bank Accounts page)
- System auto-calculates how much each bank received/paid based on branch assignment
- Logic: Branch A's bank sales → Branch A's assigned bank account. Unassigned branches → default account

### Dashboard Bank Account Summary Widget (DONE)
- New "Bank Account Summary" widget on Dashboard
- Shows each bank account with: Received (green), Paid Out (red), Net Balance
- "All Banks Total" bar with aggregated In/Out/Net
- "Manage Accounts" button links to Bank Accounts page
- Backend auto-calculation endpoint: GET /api/bank-accounts/summary

### Branch Dues Drill-Down (DONE)
- "View Details" button on Branch-to-Branch Dues section
- Clickable due amounts open a detail dialog
- Shows every cross-branch transaction: Date, Type, From/To Branch, Amount, Description

## Previous Sessions Summary
- Session 12: Bank Account Management (CRUD), Bank Account in Sales (now removed), Dues Drill-Down
- Session 11: Date Quick Filter, Summary Bars, UI Polish, Tours
- Session 10: Sales & Expenses Daily Grouping, Pagination Fix
- Session 9: Cross-Branch Payments, Reports Hub, Data Alerts, Invoice Upload
- Sessions 1-8: Core ERP, POS, Kitchen, Dashboard, Reports, Access Control (ALL DONE)

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Platform reconciliation (HungerStation bulk payments vs branch orders)
- P3: Further UI/UX polishing
