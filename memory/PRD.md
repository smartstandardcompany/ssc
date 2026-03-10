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
- Fixed missing days bug: pre-populate complete calendar range before overlaying data (Mar 9, Session 21)
- Verified: all dates appear continuously, sales match /api/sales endpoint, net cash/bank correct

### UI/UX Polishing (DONE)
- Page animations, skeleton loading, enhanced hover/scrollbar

## Pending Issues
- SMTP Email: Blocked on user's Microsoft 365 Security Defaults

## Session 21 (Mar 10, 2026)

### Quick Entry Date Bug Fix (DONE - CRITICAL)
- Fixed timezone conversion bug: getDateISO() was using .toISOString() (UTC shift)
- Now preserves selected date as-is (e.g., `2026-03-09T23:45:00` stays on Mar 9)
- Also hardened multi-entry forms to keep failed entries instead of clearing all

### Menu Dynamic Categories (DONE)
- Categories no longer hardcoded (was: 5 built-in only)
- Added "Manage Categories" dialog: add custom categories, delete them
- Uses /api/categories?category_type=menu backend endpoint
- Default 5 categories remain as built-in, custom ones are deletable

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked by SMTP)
