# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 17 (Mar 8, 2026) - Net Cash/Bank, Duplicate Prevention, Guided Tours

### Daily Summary Net Cash/Bank Columns (DONE)
- Added "Net Cash" and "Net Bank" columns to the Day by Day table in Range mode
- Net Cash = Sales Cash - Expense Cash per day
- Net Bank = Sales Bank - Expense Bank per day
- Negative values displayed in red, positive in teal/indigo
- TOTAL row includes net_cash and net_bank sums
- Backend calculates net_cash/net_bank per daily row

### Automatic Duplicate Prevention (DONE)
- New backend endpoint: GET /api/sales/check-duplicate?branch_id=X&amount=Y&date=Z
- Before saving, frontend calls check-duplicate to detect same branch + amount on same date
- If duplicate found, shows AlertDialog: "X sale(s) with same branch and amount already exist"
- User can "Cancel & Review" or "Yes, Save Anyway"
- Works in combination with existing visual duplicate detection on day rows

### Guided Tours for All Sub-Modules (DONE)
- Added tours for 14+ remaining modules: Platform Reconciliation, Monthly Recon Report, Bank Accounts, Branches, CCTV, Documents, Fines, Partners, Company Loans, Schedule, Transfers, Bank Statements, Credit Report, Supplier Report, Category Report, Reconciliation
- Total: 32 module tours now configured
- Each tour has 3-4 contextual steps explaining the module's purpose and key actions

## Session 16 - Duplicate Detection, Monthly Reconciliation Report, Fee Calculator
## Session 15 - PIN Fix, Platform Fee Calculator  
## Sessions 1-14 - Core ERP, POS, Kitchen, Dashboard, Reports, Access Control, Bank Accounts, Platform Reconciliation

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: General UI/UX polishing for data readability
- P2: Email automation (blocked on SMTP)
