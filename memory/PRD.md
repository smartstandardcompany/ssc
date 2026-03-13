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
  - All tests passed (iteration_140)
- **Accounting Module (P1) — Expanded:**
  - **Balance Sheet** - Assets (Cash, Bank, AR, Inventory) vs Liabilities (AP, Supplier Credits, VAT Payable) vs Equity (Retained Earnings) with date/branch filters and accounting equation display
  - **Journal Entries** - Full double-entry bookkeeping: create balanced debit/credit entries, account selector from Chart of Accounts, balance validation, entry types (manual, adjustment, closing, opening)
  - **Financial Dashboard** - Separate from ops dashboard. 5 metric cards (Cash Inflow/Outflow, Net Cash Flow, AR, AP), Revenue vs Expenses area chart (6 months), Net Profit trend bar chart, Expense breakdown pie chart, Payment method chart, Monthly summary table
  - Sidebar "Accounting" section now has 6 items: Financial Dashboard, Chart of Accounts, Journal Entries, Profit & Loss, Balance Sheet, Tax & Currency
  - All tests passed (iteration_141): 17/17 backend, all frontend pages verified
- **Commercial Landing Page** - Public route `/landing` with hero, features, modular architecture showcase, 3-tier pricing (Starter/Business/Enterprise), stats, CTA, and footer. Links to sign-in/register. Fully separate from app.
- **Bug Fixes (3):**
  - Daily Summary → Expenses card now correctly redirects with date filter applied
  - Expenses page now shows supplier name column in expanded detail rows
  - All exports (XL/PDF) now include date range filtering and dates in filenames
- **Bug Fixes (3 more):**
  - Daily Summary → Expenses now passes branch filter in URL so expenses show for specific branch
  - Export endpoint filters data by date range; verified smaller file sizes for date-filtered exports
  - Supplier Report page now has 'Custom Range' option with start/end date pickers

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
- P1: Multi-tenancy for commercial version (data isolation per tenant)
- P1: Self-service registration & onboarding flow
- P2: Subscription billing (Stripe integration)
- P2: Admin super panel to manage all tenants
- P2: White-label/branding per tenant
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked on SMTP)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
