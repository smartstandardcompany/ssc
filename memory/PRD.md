# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments, evolved into a comprehensive business management ERP system named "SSC Track".

## Core Modules
- **Financial Management:** Sales (Bank/Cash/Online/Credit), Expenses (with Refunds), Supplier Payments (with Returns, Bill Images, Searchable Selection), Customer Credit, ZATCA Invoicing, P&L Reporting, Online Platform Sales & Commission Management, Supplier Aging Reports
- **HR Management:** Employee database, salary payments, leave tracking, loan management, Employee Self-Service Portal, End-of-Service Benefits (Saudi Labor Law), Employee Status Management (Active/Left/Terminated)
- **Staff Management:** Manual and AI-driven Shift Scheduling, Cashier shift management
- **Stock Management:** Inventory tracking, stock-in/out, multi-branch transfers, real-time low-stock alerts, AI-powered stock reordering suggestions
- **Restaurant Operations:** POS (with searchable supplier/customer select), KDS, Customer-Facing Order Status, Table Management, Reservations, Order Tracking
- **Reporting & Analytics:** Customizable dashboards, advanced reporting, AI-driven predictive analytics, Scheduled PDF Reports with Email Delivery
- **Administration:** Role-based access, branding (logo upload), dark mode, multi-language, PWA, guided tours

## Architecture
- **Frontend:** React + Shadcn UI + Zustand + TailwindCSS
- **Backend:** FastAPI + MongoDB + aiosmtplib (M365 SMTP)
- **Key Components:** SearchableSelect, VirtualizedTable, PDFExportButton, QuickHelpButton

## Known Issues
- M365 SMTP Auth needs to be enabled by user in admin portal

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Test Operator: test@ssc.com / testtest
- Cashier PIN: 1234
