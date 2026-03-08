# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 15 (Mar 8, 2026) - PIN Fix, Platform Fee Calculator

### PIN Regeneration Fix (DONE)
- Verified PIN regeneration works from the employee list (refresh icon next to PIN badge)
- Backend POST /cashier/generate-pin/{id} generates new PIN even if one exists
- Both desktop table and summary dialog have regenerate/revoke buttons

### Automatic Platform Fee Calculator (DONE)
- Backend: Fixed reconciliation endpoint to use `db.delivery_platforms` (was `db.platforms` - empty)
- Backend: Fixed sale filter to match actual types (`online`, `online_platform`) not just `online_delivery`
- Backend: Added `processing_fee` field to platform CRUD
- Backend: Reconciliation summary now returns `expected_fee`, `expected_received`, `commission_rate`, `processing_fee` per platform + `total_expected_fee`
- Frontend: 4 summary cards (Total Online Sales, Total Received, Expected Fees, Actual Platform Cut with variance)
- Frontend: Commission rate badges on platform cards
- Frontend: Expected Fee and Variance columns
- Frontend: Auto Fee Calculator in Record Payment dialog (auto-fill remaining amount)
- Frontend: Fee Settings dialog (gear icon) to edit commission_rate and processing_fee per platform

## Session 14 (Mar 8, 2026) - Sales Delete Fix, Bank Accounts, Platform Reconciliation

### Sales Delete Button Fix (DONE)
- Sales date rows are now expandable (click to see individual entries)
- Each entry has DELETE (red trash) and RECEIVE (for credit sales) buttons

### Sample Bank Accounts Added (DONE)
- Alinma Bank - Branch A, Bank Al Bilad - Branch B, Al Rajhi - Main (default)

### Platform Reconciliation (DONE)
- New page: /platform-reconciliation
- Tracks HungerStation, Keeta, and other online platform sales vs received payments
- Auto-calculates platform commission/cuts
- Payment History tab with delete capability

## Previous Sessions Summary
- Session 13: Auto Bank Account Tracking
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
- P2: General UI/UX polishing for data readability
- P2: Email automation (blocked on SMTP)
- P3: Guided tours for remaining sub-modules
