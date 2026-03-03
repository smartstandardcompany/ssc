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
- **Frontend:** React + Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB (via Motor async driver)
- **Auth:** JWT-based
- **Integrations:** OpenAI GPT-4o (via Emergent LLM Key), Twilio (WhatsApp), aiosmtplib (email)

## User Roles
- **Admin (ss@ssc.com):** Full access to everything. Protected from deletion/password changes.
- **Manager:** Access to most modules except admin-only ones (users, settings, partners).
- **Operator:** Limited access based on assigned permissions. Branch-restricted.
- **Employee:** Self-service portal only.
- **Cashier/Waiter:** POS-only access via PIN login.

## What's Been Implemented (Completed)

### Phase 1-9: Core ERP Features (ALL DONE)
- All financial modules (sales, expenses, suppliers, invoices, credit management)
- HR and employee management (portal, leave, salary, loans)
- Stock management with smart alerts
- Restaurant POS system (KDS, tables, reservations, waiter mode)
- Asset & liability tracking
- CCTV security integration
- Cash flow & bank reconciliation
- Reporting & analytics (dashboards, visualizations, anomaly detection)
- Admin tools (settings, branding, PWA, i18n, dark mode)
- Customer Loyalty Program

### Phase 10: Security & Access Control (COMPLETED - Feb 2026)
- Protected admin account (ss@ssc.com) from deletion/password changes
- Role-based sidebar navigation filtering (users only see permitted links)
- Client-side route protection with Access Denied page (prevents URL-based bypass)
- Backend permission enforcement (require_permission + get_branch_filter) across all key routers:
  - sales.py, expenses.py, customers.py, suppliers.py, employees.py, platforms.py (already had)
  - stock.py, invoices.py, branches.py, settings.py, reports.py, transfers.py, dashboard.py (newly added)
- Branch-based data filtering for branch-restricted users

### Phase 11: Branch Filtering Refactor (COMPLETED - Dec 2025)
- Refactored suppliers.py to use centralized `get_branch_filter_with_global` instead of manual filtering logic
- Refactored customers.py to use centralized `get_branch_filter_with_global` for consistent behavior
- Two helper functions now centralize all branch filtering logic in database.py:
  - `get_branch_filter()`: Strict branch filtering for sales, expenses, stock entries - restricts to user's branch only
  - `get_branch_filter_with_global()`: Includes branch-specific AND global (no branch) items - used for suppliers, customers
- Verified 100% test pass rate (12/12 backend tests, frontend verified)
- Admin sees all data, restricted users see appropriate filtered data based on their branch assignment

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / Test@123
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234

## Prioritized Backlog

### P0 (None - all critical items done)

### P1 (High Priority)
- Implement `createdAt` and `updatedAt` timestamps for all major DB collections (data auditing)
- Add "Print Barcode" feature for stock items

### P2 (Medium Priority)
- Implement "Advanced Search" component for all main data tables (Sales, Stock, etc.)
- User activity logging to track key actions (logins, deletions, settings changes)
- Propagate get_branch_filter to remaining minor routers (anomaly_detection, cctv, etc.)

### P3 (Future/Backlog)
- Mobile-responsive design for admin pages
- Frontend state management refactor (Zustand/Redux Toolkit)
- AI-powered sales forecasting in reports
- Advanced analytics refinements
- CCTV AI features expansion
- WhatsApp chatbot improvements
- Performance optimization for large datasets
