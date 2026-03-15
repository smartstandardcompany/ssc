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

## Backlog

### P4: SMTP Email Delivery
- Blocked on user's Microsoft 365 configuration

### Future
- White-label/branding per tenant
- Scheduled PDF report delivery
- API rate limiting per tenant
- Tenant data export/migration tools
- Audit log for role template changes
