# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 20 (Mar 9, 2026)

### POS Machine Settings - Edit Branch & Label (DONE)
- Existing POS machines now have inline edit capability
- Click label or branch badge to enter edit mode
- Editable label input, branch dropdown, save/cancel buttons
- Pencil icon appears on hover for discoverability
- Uses existing POST /api/pos-machines (upsert) backend

### Data Integrity Checker (DONE)
- New page at `/data-integrity`, admin only
- Scans sales for: missing final_amount, payment mismatches, unusual modes
- Individual fix and bulk "Fix All" with confirmation dialog

### Export Center (DONE)
- 8 report types, date presets, branch filtering, PDF/Excel, export history

### Dashboard Enhancement (DONE)
- Sales card: Cash/Bank/Online breakdown; Expenses card: Top 3 categories

### Daily Summary Bug Fix (DONE - CRITICAL)
- Fixed double-counting bug, null final_amount, payment mode mapping

### UI/UX Polishing (DONE)
- Page animations, skeleton loading, enhanced hover/scrollbar

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked by SMTP)
