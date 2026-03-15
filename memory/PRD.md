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
- Full test suite: 15 backend + 12 frontend tests passed (iteration_144)

### Full Accounting Module (DONE)
- Financial Dashboard, Chart of Accounts, Journal Entries
- Profit & Loss, Balance Sheet reports
- Bills management with payment tracking
- Tax/VAT settings (Middle East compliant)
- Currency settings

### ERP Core (DONE)
- Sales & POS system
- Expense management with supplier payments
- Employee/HR management
- Inventory & stock management
- Multi-branch management
- Customer & supplier management
- Invoicing system
- Document management
- Shift scheduling
- Loan management
- Partner P&L reports
- Activity logs & audit trail
- Data management & export center

### UI (DONE)
- Foodics-inspired modern design
- Dark mode support
- Multi-language support (EN/AR)
- Keyboard shortcuts
- PWA support

---

## Backlog (Priority Order)

### P1: Subscription Management UI
- Build subscription plans page (Starter/Business/Enterprise)
- Tenant billing/plan management UI
- No Stripe integration yet

### P2: Advanced User Permissions (RBAC)
- Granular role-based access control within each tenant
- Custom permission sets per role

### P3: Stripe Integration
- Real payment processing for subscriptions
- Webhook handling for subscription lifecycle

### P4: SMTP Email Delivery
- Blocked on user's Microsoft 365 configuration
- User needs to disable "Security Defaults" in Azure AD

### Future
- White-label/branding per tenant
- Scheduled PDF report delivery
- API rate limiting per tenant
- Tenant data export/migration tools
