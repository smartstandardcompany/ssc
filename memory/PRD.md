# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 18 (Mar 8, 2026) - Anomaly Detector + Daily Summary Bug Fix

### Daily Summary Bug Fix (DONE)
- **Cross-branch expense filtering**: When filtering by branch, expenses with `expense_for_branch_id` matching the selected branch are now included (previously only `branch_id` was checked)
- **Timezone date handling**: Changed from `$lte "T23:59:59"` to `$lt next_day` to properly handle dates with `+00:00` timezone suffix
- **Both single-day and range endpoints fixed**

### Smart Anomaly Detector Dashboard Widget (DONE)
- Added dashboard widget showing latest anomaly scan status (critical/warning counts)
- "View Details" button links to the full /anomaly-detection page
- Color-coded: red for critical alerts, amber for warnings, green for all-clear
- Anomaly detection tour added to ModuleTour

### Previous Session Features (verified working)
- Net Cash/Bank columns in Day by Day view
- Duplicate sale prevention with warning dialog
- Guided tours for 32+ modules
- Monthly reconciliation report
- Platform fee calculator

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: General UI/UX polishing for data readability
- P2: Email automation (blocked on SMTP)
