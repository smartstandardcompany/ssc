# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for a restaurant business (Smart Standard Company).

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + shadcn/ui + recharts
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: JWT-based authentication with role-based access control
- **AI**: OpenAI GPT-4o via Emergent LLM Key
- **Notifications**: Twilio (WhatsApp), in-app
- **Email**: aiosmtplib (BLOCKED)

## What's Implemented

### Session 2026-03-12
- **UI Overhaul Verification & Completion** - Verified and confirmed Foodics-inspired UI across 5 pages (Employees, My Portal, Sales, Expenses, Suppliers). Full frontend regression test passed (iteration_139).
- **Accounting Module (P0)** - Complete accounting features added:
  - **Chart of Accounts** - 23 default accounts seeded (Assets, Liabilities, Equity, Revenue, Expenses) with full CRUD, search, type filtering, collapsible groups
  - **Bills Management** - Supplier bills with line items, VAT calculation, due dates, payment terms, partial/full payment tracking, multi-currency
  - **Profit & Loss Report** - Real-time P&L with Revenue, Cost of Sales, Gross Profit, Operating Expenses, Net Profit. Quick range filters + branch filter
  - **Tax & Currency Settings** - VAT rates (15% Saudi default, 5% UAE/Bahrain, Zero Rated, Exempt), 11 Middle East + global currencies
  - **New Sidebar Section** - "Accounting" nav group with 3 pages. Bills added under Finance
  - Backend: `/api/accounting/*` endpoints (accounts, tax-rates, bills, profit-loss, currencies, summary)
  - All tests passed (iteration_140): 23/23 backend, all 4 frontend pages verified

### Session 2026-03-11
- **Foodics-Inspired Sidebar** - Light gray bg, collapsible nav groups, clean active states
- **Expenses Filter Bug Fix** - Server-side filtering by branch_id, category, payment_mode
- **Expenses Branch Summary** - Monthly branch-wise expense breakdown card
- **Pagination Improvement** - Numbered page buttons on Sales & Expenses
- **Dashboard Compare Toggle** - Day/Week/Month selector with 6 comparison cards
- **Menu Item Scheduling** - Day/time availability with Hide/Disable POS behavior
- **POS Schedule Awareness** - Items hidden or greyed out based on schedule
- **Cashier POS UI Overhaul** - Foodics-style: borderless cards, pill tabs, clean header
- **Menu Items Page UI Overhaul** - Foodics-style: white filter card, borderless item cards
- **POS Dynamic Categories** - Auto-includes custom categories from DB + menu_items.distinct()
- **SizesEditor Redesign** - Branch-specific pricing: checkboxes per branch with custom SAR price inputs under each size
- **Printer Management** - Full CRUD for printers (receipt/kitchen/label) with IP, port, paper width, default/auto-print settings, test connection
- **Full UI Overhaul** - Applied Foodics-inspired design to Employees, My Portal, Sales, Expenses, Suppliers pages

### Previous Sessions
- Full CRUD for all modules (Sales, Expenses, Inventory, Suppliers, etc.)
- Role-based access control, multi-branch support
- Advanced Menu Management V2 (add-on library, modifier groups)
- Menu/Peak Hours Analytics, AI Staffing, Staff Performance, AI Duty Planner
- Multi-Channel Notifications + Preferences

## Key API Endpoints
- `/api/accounting/accounts` - Chart of Accounts CRUD
- `/api/accounting/bills` - Bills CRUD with payment tracking
- `/api/accounting/bills/{id}/payment` - Record bill payments
- `/api/accounting/profit-loss` - P&L report with date/branch filters
- `/api/accounting/tax-rates` - Tax/VAT rates CRUD
- `/api/accounting/currencies` - Currency settings
- `/api/accounting/summary` - AR/AP overview
- `/api/dashboard/period-compare?period=day|week|month`
- `/api/expenses?branch_id=&category=&payment_mode=`
- `/api/cashier/categories` - Auto-includes custom categories
- `/api/cashier/printers` - Full CRUD for printer management
- `/api/analytics/menu`, `/api/analytics/addons`, `/api/analytics/peak-hours`

## 3rd Party Integrations
- **OpenAI GPT-4o**: Via Emergent LLM Key
- **Twilio**: WhatsApp notifications
- **aiosmtplib**: SMTP (BLOCKED)

## Known Issues
- SMTP Email: BLOCKED - user needs to disable Security Defaults in M365/Azure AD

## Backlog
- P1: Balance Sheet report
- P1: Accounts Receivable / Payable detailed reports
- P1: Journal Entries (manual debit/credit)
- P2: Bank Reconciliation
- P2: Email automation (blocked on SMTP)
- P2: Multi-tenancy for commercial version
- P3: Scheduled PDF report delivery (blocked on SMTP)
- P3: Landing page / marketing site for commercial launch

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
