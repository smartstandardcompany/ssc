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
- Backend permission enforcement (require_permission + get_branch_filter) across all key routers
- Branch-based data filtering for branch-restricted users

### Phase 11: Branch Filtering Refactor (COMPLETED - Dec 2025)
- Refactored suppliers.py and customers.py to use centralized `get_branch_filter_with_global`
- Two helper functions now centralize all branch filtering logic in database.py

### Phase 12: Barcode & Timestamps (COMPLETED - Mar 2026)
- Print Barcode Feature for stock items with company logo
- updated_at Timestamps for data auditing

### Phase 13: Activity Logging & Advanced Search (COMPLETED - Mar 2026)
- User Activity Logging System with comprehensive audit trail
- Advanced Search Component (reusable filter component)

### Phase 14: Daily Summary Dashboard (COMPLETED - Mar 2026)
- Daily Summary Page with comprehensive daily business metrics

### Phase 15: Advanced Search & AI Forecasting (COMPLETED - Mar 2026)
- AdvancedSearch Integration into Sales, Expenses, Customers, Suppliers pages
- AI Sales Forecasting with predictive analytics

### Phase 16: Sales Alerts & Extended Search (COMPLETED - Mar 2026)
- Sales Alert System with email/WhatsApp notifications
- AdvancedSearch Extended to remaining pages

### Phase 17: Supplier Module Enhancements & POS UI/UX (COMPLETED - Mar 2026)
- **Supplier Total Purchases:** Backend aggregates total purchase amounts from expenses collection. Displayed on each supplier card with amber-themed "Total Purchases" badge.
- **Supplier Ledger:** Full ledger endpoint (`GET /api/suppliers/{id}/ledger`) with running balance, debit/credit entries, date filtering (start_date, end_date params). Ledger dialog shows summary cards (credit purchases, cash/bank purchases, credit paid, closing balance) and scrollable entries table.
- **Ledger Export:** PDF export via reportlab, Excel export via openpyxl (`GET /api/suppliers/{id}/ledger/export?format=pdf|excel`). Export buttons in ledger dialog.
- **Multiple Bank Accounts:** Up to 3 bank accounts per supplier (bank_name, account_number, iban, swift_code). Add/Edit form with add/remove bank account UI, (x/3) counter.
- **POS Expense Form Improvement:** "Expenses" tab renamed to "General Business Expenses" with clear help text distinguishing from supplier purchases. Payment modes limited to "Paid by Cash" and "Paid by Bank" (removed credit option for general expenses). Supplier field labeled "No Supplier (General)" as default.
- **Online Sales Fix:** Added `online_sales` field to `/api/dashboard/stats` by summing payment_details with mode "online_platform". POS page now reads online_sales directly from dashboard stats instead of separate platforms/summary call.
- **Duplicate Route Fix:** Removed duplicate `get_supplier_ledger` endpoint in suppliers.py.
- Test Results: Backend 100% (13/13), Frontend 100%

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234

## Prioritized Backlog

### Future Enhancements
- Frontend state management refactor (Zustand/Redux Toolkit)
- Propagate get_branch_filter to remaining minor routers (anomaly_detection, cctv)
- Mobile-responsive design for remaining admin pages
- Advanced analytics refinements
- CCTV AI features expansion
- WhatsApp chatbot improvements
- Performance optimization for large datasets
- Weekly/Monthly trend comparison reports
