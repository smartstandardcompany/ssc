# SSC Track - Multi-Tenant ERP & Accounting Platform

## Product Overview
SSC Track is a comprehensive, multi-tenant ERP/accounting SaaS platform purpose-built for Middle East businesses. It supports POS, sales, expenses, HR, inventory, accounting, and analytics — all isolated per company (tenant).

## Core Architecture
- **Frontend:** React + Shadcn/UI + TailwindCSS + Recharts
- **Backend:** FastAPI (Python) + MongoDB (Motor async driver)
- **Multi-Tenancy:** Every collection filtered by `tenant_id`. Enforced via `get_tenant_filter(user)` for reads and `stamp_tenant(doc, user)` for writes.
- **Auth:** JWT tokens with tenant_id embedded in user records
- **Payments:** Stripe via emergentintegrations library

## User Roles
- **Super Admin (`is_super_admin: true`):** Platform-wide access, analytics, tenant management
- **Admin:** Company-level admin, manages users/roles/subscription within their tenant
- **Manager/Cashier/Viewer/Employee:** Defined by RBAC role templates

## Credentials
- Super Admin: `ss@ssc.com` / `Aa147258369Ssc@`
- Operator: `test@ssc.com` / `testtest`

---

## Completed Features

### P0: Multi-Tenancy (DONE)
- All 50+ backend routers with tenant isolation
- Registration page (3-step wizard), Super Admin Dashboard
- Data isolation verified across tenants

### P0.5: Onboarding Wizard (DONE)
- 3-step setup: Create Branch → Add Employee → Configure VAT
- Auto-redirect for new tenants, skippable

### P1: Subscription Management (DONE)
- Subscription page with plan display + usage stats
- Plan comparison (Starter SAR 199 / Business SAR 499 / Enterprise SAR 999)
- Stripe checkout integration for plan upgrades
- Payment history tracking
- Downgrade protection (validates usage fits limits)

### P2: Advanced RBAC (DONE)
- 4 system role templates: Manager, Cashier, Viewer, Employee
- Custom role template CRUD (create/edit/delete/duplicate)
- Module-level permissions (write/read/none) for 25 modules
- Quick-set buttons (All Write / All Read / All None)
- System templates protected from deletion
- Role Management page at `/role-management`

### P3: Stripe Integration (DONE)
- Stripe checkout session creation via emergentintegrations
- Webhook endpoint for payment events
- Payment status polling on redirect
- Transaction history stored in DB
- Auto plan upgrade on successful payment

### Tenant Analytics Dashboard (DONE)
- MRR with ARR calculation ($3,188 MRR / $38,256 ARR)
- Tenant Growth bar chart (6-month trend)
- Revenue by Plan donut chart
- Plan Distribution breakdown
- Subscription Status distribution
- Top Tenants leaderboard
- Total revenue and payment count
- Super admin access only

### Bug Fix: Employee→User Auto-Creation (DONE)
- Employee creation with email auto-creates user with branch_id and tenant scoping

### Full Accounting Module (DONE)
- Financial Dashboard, Chart of Accounts, Journal Entries, P&L, Balance Sheet, Bills, Tax/Currency

### ERP Core (DONE)
- Sales/POS, Expenses, HR, Inventory, Multi-branch, Customer/Supplier, Invoicing, Documents, Shifts, Loans, Partners, Activity Logs, Data Export

---

### P5: White-Label Branding (DONE - Feb 2026)
- Platform identity customization (app name, tagline, logo upload)
- Color scheme: primary, accent, sidebar, login background
- Live preview of sidebar header
- "Hide Powered By" toggle
- Frontend at `/white-label`, Backend at `GET/PUT /api/branding`, `POST /api/branding/upload-logo`

### P5: Scheduled Reports (DONE - Feb 2026)
- CRUD for report schedules (daily/weekly/monthly)
- Report types: Daily Summary, Sales Report, P&L
- Manual "Run Now" with report history
- Frontend at `/scheduled-reports`, Backend CRUD at `/api/scheduled-reports`

### P5: API Rate Limiting (DONE - Feb 2026)
- Per-tenant rate limiting middleware on all `/api/` endpoints
- Plan-based limits: Starter=100/min, Business=500/min, Enterprise=unlimited
- `X-RateLimit-Limit/Remaining/Reset` headers on responses
- 429 response when limit exceeded

### P5: Usage Alerts (DONE - Feb 2026)
- Real-time plan usage monitoring (users, branches)
- Visual progress bars with plan comparison table
- Alert banners at 80% (warning) and 100% (critical)
- Super-admin bulk alert check for all tenants
- Frontend at `/usage-alerts`, Backend at `GET /api/usage-alerts`

---

### Bug Fix: Tenant Data Isolation in Suppliers & Platforms (DONE - Mar 2026)
- Added `tenant_id` filter to supplier credit aggregation pipelines (expenses + payments)
- Added `tenant_id` filter to platform sales/payment sub-queries
- Added `tenant_id` filter to `GET /api/supplier-payments` query
- Fixed double-credit-update bug: `POST /supplier-payments` with credit mode no longer updates stored balance (only `POST /expenses` does)
- Fixed `DELETE /supplier-payments` reversal logic to only reverse cash/bank modes
- Ran `PUT /api/suppliers/recalculate-all-balances` to correct existing data

---

## Backlog

### P4: SMTP Email Delivery
- Blocked on user's Microsoft 365 configuration (Security Defaults must be disabled in Azure AD)

### Future
- Tenant data export/migration tools
- Audit log for role template changes
