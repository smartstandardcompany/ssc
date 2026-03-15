# SSC Track - Multi-Tenant ERP & Accounting Platform

## Product Overview
SSC Track is a comprehensive, multi-tenant ERP/accounting SaaS platform purpose-built for Middle East businesses. It supports POS, sales, expenses, HR, inventory, accounting, and analytics — all isolated per company (tenant).

## Core Architecture
- **Frontend:** React + Shadcn/UI + TailwindCSS
- **Backend:** FastAPI (Python) + MongoDB (Motor async driver)
- **Multi-Tenancy:** Every collection filtered by `tenant_id`. Enforced via `get_tenant_filter(user)` for reads and `stamp_tenant(doc, user)` for writes in `database.py`.
- **Auth:** JWT tokens with tenant_id embedded in user records

## User Roles
- **Super Admin (`is_super_admin: true`):** Platform-wide access, manages all tenants
- **Admin:** Company-level admin with full access within their tenant
- **Operator/Manager/Employee:** Role-based permissions within a tenant

## Credentials
- Super Admin: `ss@ssc.com` / `Aa147258369Ssc@`
- Operator: `test@ssc.com` / `testtest`

---

## Completed Features

### P0: Multi-Tenancy (DONE - March 2026)
- All 50+ backend routers refactored for tenant isolation
- `get_branch_filter()` auto-includes tenant_id
- Registration page (3-step wizard): company name, admin details, country, industry, currency, plan
- Super Admin Dashboard at `/super-admin`: stats, tenant management, activate/deactivate
- Data isolation verified: new tenants see zero data from other tenants

### P0.5: Onboarding Wizard (DONE - March 2026)
- 3-step setup wizard at `/onboarding` for new tenants
- Step 1: Create first branch
- Step 2: Add first employee
- Step 3: Configure VAT/tax settings
- Auto-redirect on first login if `onboarding_completed=false`
- Skip/Back navigation, finish marks onboarding complete

### P1: Subscription Management UI (DONE - March 2026)
- Subscription page at `/subscription` with current plan display
- Usage stats: users, branches, employees vs plan limits
- Plan comparison (Starter SAR 199, Business SAR 499, Enterprise Custom)
- Plan switching with downgrade protection (validates usage fits new limits)
- "Contact Sales" for Enterprise plan
- Sidebar link visible for admin users only

### Bug Fix: Employee→User Auto-Creation (DONE - March 2026)
- Fixed: Employee creation with email now properly creates user with branch_id
- Fixed: Tenant-scoped email uniqueness check
- Default password: `emp@123` for auto-created employee users

### Full Accounting Module (DONE)
- Financial Dashboard, Chart of Accounts, Journal Entries
- Profit & Loss, Balance Sheet reports
- Bills management with payment tracking
- Tax/VAT settings (Middle East compliant)
- Currency settings

### ERP Core (DONE)
- Sales & POS system, Expense management, Employee/HR management
- Inventory & stock, Multi-branch, Customer/Supplier management
- Invoicing, Document management, Shift scheduling
- Loan management, Partner P&L, Activity logs, Data export

### UI (DONE)
- Foodics-inspired modern design, Dark mode, Multi-language (EN/AR)
- Keyboard shortcuts, PWA support

---

## Backlog (Priority Order)

### P2: Advanced User Permissions (RBAC)
- Granular role-based access control within each tenant
- Custom permission sets per role

### P3: Stripe Integration
- Real payment processing for subscriptions
- Webhook handling for subscription lifecycle

### P4: SMTP Email Delivery
- Blocked on user's Microsoft 365 configuration

### Future
- White-label/branding per tenant
- Scheduled PDF report delivery
- API rate limiting per tenant
- Tenant data export/migration tools
