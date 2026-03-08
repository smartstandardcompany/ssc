# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 14 (Mar 8, 2026) - Sales Delete Fix, Bank Accounts, Platform Reconciliation

### Sales Delete Button Fix (DONE)
- Sales date rows are now expandable (click to see individual entries)
- Each entry has DELETE (red trash) and RECEIVE (for credit sales) buttons
- Fixed the issue where admin couldn't delete sales after daily grouping change

### Sample Bank Accounts Added (DONE)
- Alinma Bank - Branch A (assigned to branch A)
- Bank Al Bilad - Branch B (assigned to branch B)
- Al Rajhi - Main remains as default for all other branches

### Platform Reconciliation (DONE)
- New page: /platform-reconciliation
- Tracks HungerStation, Keeta, and other online platform sales vs received payments
- Auto-calculates platform commission/cuts based on: Sales recorded - Amount received
- Shows per-branch breakdown when platform is expanded
- "Record Received Payment" dialog to log platform payouts
- Payment History tab with delete capability
- Date quick filter for period analysis
- Backend: CRUD endpoints for reconciliation records + summary calculation

## Previous Sessions Summary
- Session 13: Auto Bank Account Tracking (removed manual dropdown, auto-calculate from branch assignment)
- Session 12: Bank Account Management (CRUD), Dashboard Dues Drill-Down
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
- P3: Further UI/UX polishing
