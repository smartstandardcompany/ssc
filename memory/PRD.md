# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 16 (Mar 8, 2026) - Duplicate Detection, Monthly Reconciliation Report, Fee Calculator

### Duplicate Sale Entry Detection (DONE)
- Sales page now detects entries with same branch + same amount on the same day
- Day rows with duplicates get orange background + "Duplicate" warning badge
- Expanded duplicate entries get orange left border + "Possible duplicate" badge
- Tested against real data: correctly flagged duplicates on 6 different dates

### Monthly Reconciliation Summary Report (DONE)
- New page at /monthly-recon-report
- Backend endpoint: GET /api/platform-reconciliation/monthly-report?months=N
- Grand totals: Total Sales, Total Received, Expected Fees, Actual Cut, Variance
- Monthly expandable cards with per-platform breakdown (rate, orders, sales, fees, variance)
- "Overpaying" badge on months where actual cut exceeds expected
- Accessible from Reports hub (new card) and Platform Reconciliation page (button)

### PIN Regeneration Fix (DONE - verified)
- PIN regeneration works from the employee list view

### Automatic Platform Fee Calculator (DONE)
- Fixed reconciliation endpoint to use correct DB collection (delivery_platforms)
- Fixed sale type filter to match actual types (online, online_platform)
- Added processing_fee to platform CRUD
- Auto Fee Calculator in Record Payment dialog
- Fee Settings dialog per platform
- Expected fee vs actual cut variance indicators

## Previous Sessions Summary
- Session 15: PIN Fix, Platform Fee Calculator
- Session 14: Sales Delete Fix, Bank Accounts, Platform Reconciliation
- Session 13: Auto Bank Account Tracking
- Session 12: Bank Account Management, Dashboard Dues Drill-Down
- Session 11: Date Quick Filter, Summary Bars, UI Polish, Tours
- Session 10: Sales & Expenses Daily Grouping, Pagination Fix
- Session 9: Cross-Branch Payments, Reports Hub, Data Alerts
- Sessions 1-8: Core ERP, POS, Kitchen, Dashboard, Reports, Access Control

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: General UI/UX polishing for data readability
- P2: Email automation (blocked on SMTP)
- P3: Guided tours for remaining sub-modules
