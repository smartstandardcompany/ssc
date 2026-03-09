# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 20 (Mar 9, 2026)

### Data Integrity Checker (DONE)
- New page at `/data-integrity` accessible from sidebar (admin only)
- Scans all sales for: missing final_amount, payment mismatches, unusual payment modes
- Summary cards: Total Issues, High/Medium/Low severity
- Expandable issue groups with detailed tables
- Individual fix buttons and bulk "Fix All" with confirmation dialog
- "Fix All Missing Final Amount": sets final_amount = amount - discount
- "Fix All Unusual Modes": changes 'card' → 'bank', removes 'discount' entries
- Backend: `/api/data-integrity/scan`, `/api/data-integrity/fix`, `/api/data-integrity/fix-all`

### Export Center (DONE)
- New page at `/export-center`, 8 report types, date presets, branch filtering, PDF/Excel

### Dashboard Enhancement (DONE)
- Total Sales card: Cash/Bank/Online breakdown as sub-text
- Total Expenses card: Top 3 expense categories as sub-text

### Daily Summary Bug Fix - Double Counting (DONE - CRITICAL)
- Fixed double-counting bug (line 761-762 both added to daily sales)
- Fixed null final_amount handling, payment mode mapping (card→bank, discount→ignored)

### UI/UX Polishing (DONE)
- Page entrance animations, card stagger, skeleton loading, enhanced hover/scrollbar

## Previous Sessions
- Duplicate Detection & Prevention, Duplicate Report
- Monthly Reconciliation Report, Platform Fee Calculator
- Anomaly Detector, Guided Tours, Daily Summary branch fix

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked by SMTP)
