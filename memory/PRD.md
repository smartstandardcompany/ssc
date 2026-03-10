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

### Supplier Credit Balance Fix (DONE - CRITICAL)
- POST /supplier-payments now correctly reduces supplier credit for cash/bank payments
- Previously only credit-mode payments adjusted the balance, cash/bank were ignored
- Also fixed: Bill submission (credit bills) now creates BOTH an expense AND a supplier payment to properly increment credit
- Fixed on both SuppliersPage and SupplierPaymentsPage
- Also fixed undefined 'amount' variable in delete_supplier_payment

### Expense Delete Error Handling (DONE)
- Delete buttons now have proper try/catch with toast.error messages
- Previously errors were silently swallowed, making it seem like delete didn't work

### Expense Filter Auto-Apply (DONE)
- AdvancedSearch dropdown filters now apply immediately on selection
- Previously required clicking "Apply Filters" button after every dropdown change
- Also fixed: filter matching is now case-insensitive with startsWith (e.g., "Salary" matches "salary", "Supplier" matches "Supplier Purchase")

### Salary Expense Date Fix (DONE)
- Partner salary now accepts a 'date' field so expense lands in the salary month, not payment date
- Added "Expense Date" date picker to the partner salary payment dialog
- Fixed UTC date conversion bug (.toISOString()) across ALL pages: Expenses, Sales, Cash Transfers, Supplier Payments, Partner Transactions, Employee Salary

### Delete Time Limit Fix (DONE)
- Disabled the 24-hour delete time limit policy that was blocking expense deletion
- Admin already had bypass, but policy was affecting other users
- Updated delete_policy for expenses/sales to 'admin_manager' so managers can also delete

### Created By Name Display (DONE)
- Expenses and Sales API now return 'created_by_name' field (resolved from user IDs)
- Visible in expanded entry rows on both Expenses and Sales pages
- Shows who entered each data entry for easy tracking

### Restaurant POS Order History (DONE)
- Added "Orders" button in POS header that opens "Today's Orders" dialog
- View order details: items, quantities, prices, subtotal, tax, total, payment method, status, time
- Edit orders: loads order back into cart, modify items/payment/notes, save changes
- Void/Delete orders: removes order and linked sale record
- Backend: PUT /cashier/orders/{id} (edit) and DELETE /cashier/orders/{id} (void)

### Menu Item Sizes, Add-ons & Branch Pricing (DONE)
- Size variants: Add different sizes (Small/Large) with unique prices per size
- Add-on options: Extra Cheese, Jalapeno, etc. with individual prices
- Branch-specific pricing: Different base price per branch
- Sizes/Add-ons stored as modifiers, branch_prices as {branch_id: price}
- Cashier POS shows modifier selection dialog when adding items with options
- 5-tab form: Details | Sizes | Add-ons | Branches | Platforms

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked by SMTP)
