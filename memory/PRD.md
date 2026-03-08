# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 19 (Mar 8, 2026) - Expense & Supplier Duplicate Detection

### Expense Duplicate Detection (DONE)
- Backend: GET /api/expenses/check-duplicate (branch_id, amount, date, category)
- Visual: Day rows with duplicates (same branch + amount) highlighted orange with "Duplicate" badge
- Visual: Individual duplicate entries marked with "Possible duplicate" badge + orange left border
- Prevention: Warning dialog before saving when duplicate detected, with "Cancel & Review" / "Yes, Save Anyway"

### Supplier Payment Duplicate Detection (DONE)
- Backend: GET /api/supplier-payments/check-duplicate (supplier_id, amount, date)
- Visual: Rows with same supplier + same amount on same day highlighted orange with "Duplicate" badge
- Prevention: Warning dialog before saving payments or bills when duplicate detected

### Daily Summary Bug Fix (Session 18 - DONE)
- Cross-branch expenses now included when filtering by branch (expense_for_branch_id)
- Timezone-safe date filtering ($lt next_day instead of $lte T23:59:59)

### Smart Anomaly Detector Dashboard Widget (Session 18 - DONE)
- Dashboard widget showing latest scan status with "View Details" link

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: General UI/UX polishing for data readability
- P2: Email automation (blocked on SMTP)
