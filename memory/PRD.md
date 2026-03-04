# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments, evolved into a comprehensive business management ERP system named "SSC Track".

## Core Modules
- **Financial Management:** Sales (Bank/Cash/Online/Credit), Expenses (with Refunds), Supplier Payments (with Returns & Bill Images), Customer Credit, ZATCA Invoicing, P&L Reporting, Online Platform Sales & Commission Management, Supplier Aging Reports
- **HR Management:** Employee database, salary payments, leave tracking, loan management, Employee Self-Service Portal, End-of-Service Benefits (Saudi Labor Law), Employee Status Management (Active/Left/Terminated)
- **Staff Management:** Manual and AI-driven Shift Scheduling, Cashier shift management
- **Stock Management:** Inventory tracking, stock-in/out, multi-branch transfers, real-time low-stock alerts, AI-powered stock reordering suggestions
- **Restaurant Operations:** POS, KDS, Customer-Facing Order Status, Table Management, Reservations, Order Tracking
- **Asset & Liability Tracking:** Assets/liabilities module, document management with expiry alerts
- **CCTV Security:** Hikvision integration, AI monitoring
- **Cash Flow & Bank Reconciliation:** Branch transfers, central balance, bank statement analysis
- **Reporting & Analytics:** Customizable dashboards, advanced reporting, AI-driven predictive analytics, Scheduled PDF Reports with Email Delivery
- **Customer Portal:** Customer login, order history, credit balance, statements
- **Administration:** Role-based access, branding (logo upload), dark mode, multi-language, PWA, guided tours

## What's Implemented (as of March 4, 2026)

### Previous Sessions
- Full financial management, HR, Stock, POS, KDS, CCTV, Analytics, etc.

### Current Session (March 4, 2026)
**Batch 1 - P0 Features:**
- Advanced PDF exports with branded headers (logo, company info, colors)
- VirtualizedTable integrated into Sales, Stock, Expenses pages
- Quick Help/Tour button on all pages with page-specific guidance (16 pages)
- Branding Settings page with logo file upload
- Supplier Returns (3 types: Cash Refund, Credit Return, Full Invoice Return)
- Purchase Bill Image Upload for supplier payments
- Expense Refunds with negative expense entries
- Employee Status Filter (Active/Left/All)
- Scheduled PDF Reports page (daily/weekly/monthly)

**Batch 2 - P1 Features:**
- Complete Zustand state management migration (22 pages migrated to useBranchStore)
- SMTP Email integration (Microsoft 365, info@smartstandards.co) for scheduled reports
- End-of-Service Benefits calculation following Saudi Labor Law:
  - Resignation: 0 (< 2 yrs), 1/3 salary/yr (2-5), 2/3 salary/yr (5-10), full salary/yr (10+)
  - Termination: 1/2 salary/yr (first 5), full salary/yr (after 5)
- Enhanced employee settlement dialog with EOS breakdown

## Architecture
- **Frontend:** React + Shadcn UI + Zustand + TailwindCSS
- **Backend:** FastAPI + MongoDB + aiosmtplib (M365 SMTP)
- **3rd Party:** OpenAI (Emergent LLM Key), Twilio, reportlab, recharts, react-joyride, react-window

## Known Issues
- **M365 SMTP Auth:** Email delivery fails with "user credentials were incorrect". Microsoft 365 requires SMTP AUTH to be enabled on the account. User needs to go to Microsoft 365 Admin > Active Users > Mail > Manage email apps > Enable "Authenticated SMTP".

## Pending Tasks
- Fix M365 SMTP authentication (user action required)

## Future/Backlog
- Real-time WebSocket notifications for stock alerts
- Mobile-responsive improvements for remaining admin pages
- Performance optimization for very large datasets
- WhatsApp chatbot enhancements

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Test Operator: test@ssc.com / testtest
- Cashier PIN: 1234
- SMTP: info@smartstandards.co (M365)
