# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for tracking sales, expenses, supplier payments, and more. The system has evolved to include financial management, HR, stock management, restaurant operations, asset tracking, CCTV security, and reporting modules.

## Core Requirements
- **Financial Management:** Sales (Bank/Cash/Online/Credit), Expenses, Supplier Payments, Customer Credit Management, ZATCA-compliant Invoicing, Item-level P&L, Online Platform Sales & Commission Management.
- **HR Management:** Employee database, salary payments, leave tracking, loan management, Employee Self-Service Portal.
- **Staff Management:** Manual and AI-driven Staff Shift Scheduling, Cashier shift management.
- **Stock Management:** Inventory tracking, stock-in/out, multi-branch transfers, real-time low-stock alerts, Smart alerts (velocity-based).
- **Restaurant Operations:** POS, Kitchen Display System (KDS), Customer-Facing Order Status Display, Table Management, Table Reservations.
- **Asset & Liability Tracking:** Unified module for company assets/liabilities (loans, fines), document management with expiry alerts.
- **CCTV Security Module:** Integration with Hikvision cameras, AI-powered features.
- **Cash Flow & Bank Reconciliation:** Branch-to-branch transfers, central balance, bank statement analysis.
- **Reporting & Analytics:** Customizable dashboards, advanced reporting, AI-driven predictive analytics.
- **Administration & UI/UX:** Role-based access, branding, data management, dark mode, multi-language support, PWA capabilities.
- **Customer Loyalty Program:** Points-based rewards system with tiers and redemption.

## Tech Stack
- **Frontend:** React + Tailwind CSS + Shadcn/UI + **Zustand** (state management)
- **Backend:** FastAPI (Python)
- **Database:** MongoDB (via Motor async driver) with **indexed collections**
- **Auth:** JWT-based
- **Integrations:** OpenAI GPT-4o (via Emergent LLM Key), Twilio (WhatsApp), aiosmtplib (email)

## User Roles
- **Admin (ss@ssc.com):** Full access. Protected from deletion/password changes.
- **Manager:** Access to most modules except admin-only ones.
- **Operator:** Limited access based on assigned permissions. Branch-restricted.
- **Employee:** Self-service portal only.
- **Cashier/Waiter:** POS-only access via PIN login.

## What's Been Implemented

### Phase 1-9: Core ERP Features (ALL DONE)
All financial modules, HR, stock, restaurant POS, assets, CCTV, cash flow, reporting, admin tools, loyalty program.

### Phase 10: Security & Access Control (DONE)
Protected admin account, role-based sidebar, route protection, backend permission enforcement, branch-based data filtering.

### Phase 11-16: Advanced Features (ALL DONE)
Branch filtering refactor, barcode printing, timestamps, activity logging, advanced search, daily summary dashboard, AI sales forecasting, sales alert system.

### Phase 17: Supplier Module Enhancements & POS UI/UX (DONE - Mar 2026)
- Supplier total purchases on cards, ledger with running balance, PDF/Excel export
- Multiple bank accounts (up to 3) per supplier
- POS expense form with clear labels (General Expenses vs Supplier Purchases)
- Online sales fix (dashboard stats now includes online_sales)

### Phase 18: Statement Sharing, State Management, Performance & Mobile (DONE - Mar 2026)
- **Supplier Statement Sharing:** Share ledger via Email (PDF attachment) and/or WhatsApp (text summary) directly from the ledger dialog. POST /api/suppliers/{id}/share-statement endpoint.
- **Add Bill Bug Fixes:** Branch selector added to Add Purchase Bill dialog. Supplier auto-selected from card click with ability to change.
- **Zustand State Management:** Migrated core auth, branch, and UI state to Zustand stores. Integrated into DashboardLayout and LoginPage. Backward-compatible with localStorage.
- **API Pagination:** Sales and Expenses endpoints return paginated responses {data, total, page, limit, pages}. All frontend consumers updated to handle both formats.
- **MongoDB Indexes:** Created on startup for sales, expenses, suppliers, customers, stock_items, users, activity_logs, invoices, notifications - covering common query patterns.
- **Mobile Responsive:** Fixed page headers (flex-col sm:flex-row), text sizing (text-2xl sm:text-4xl), overflow-x-auto wrappers on tables in BankStatements, Fines, Partners pages.
- Test Results: Backend 100% (17/17), Frontend 100%

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234

## Zustand Store Architecture
```
/app/frontend/src/stores/
├── index.js          # Re-exports all stores
├── authStore.js      # user, token, login(), logout(), hasPermission()
├── branchStore.js    # branches[], fetchBranches(), getBranchName()
└── uiStore.js        # darkMode, sidebarCollapsed, toggle functions
```

## Prioritized Backlog
- Propagate get_branch_filter to remaining minor routers
- Advanced analytics refinements
- CCTV AI features expansion
- WhatsApp chatbot improvements
- Weekly/Monthly trend comparison reports
