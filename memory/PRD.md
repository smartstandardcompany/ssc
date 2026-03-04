# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments, evolved into a comprehensive business management ERP system named "SSC Track".

## Core Modules
- **Financial Management:** Sales (Bank/Cash/Online/Credit), Expenses, Supplier Payments, Customer Credit, ZATCA Invoicing, P&L Reporting, Online Platform Sales & Commission Management, Supplier Aging Reports, Expense Refunds, Supplier Returns
- **HR Management:** Employee database, salary payments, leave tracking, loan management, Employee Self-Service Portal, Employee Status Management (Active/Left/Terminated)
- **Staff Management:** Manual and AI-driven Shift Scheduling, Cashier shift management
- **Stock Management:** Inventory tracking, stock-in/out, multi-branch transfers, real-time low-stock alerts, AI-powered stock reordering suggestions
- **Restaurant Operations:** POS, KDS, Customer-Facing Order Status, Table Management, Reservations, Order Tracking
- **Asset & Liability Tracking:** Assets/liabilities module, document management with expiry alerts
- **CCTV Security:** Hikvision integration, AI monitoring
- **Cash Flow & Bank Reconciliation:** Branch transfers, central balance, bank statement analysis
- **Reporting & Analytics:** Customizable dashboards, advanced reporting, AI-driven predictive analytics, Scheduled PDF Reports
- **Customer Portal:** Customer login, order history, credit balance, statements
- **Administration:** Role-based access, branding (logo upload), dark mode, multi-language, PWA, guided tours

## What's Implemented (as of March 4, 2026)

### Session 1-N (Prior work)
- Full financial management, HR, Stock, POS, KDS, CCTV, Analytics, etc.

### Current Session (March 4, 2026)
- **Advanced PDF exports** with branded headers (logo, company info, colors)
- **VirtualizedTable** integrated into Sales, Stock, Expenses pages
- **Quick Help/Tour** button on all pages with page-specific guidance (16 pages)
- **Branding Settings** page with logo file upload
- **Supplier Returns** - Three types: Cash Refund, Credit Return, Full Invoice Return
- **Purchase Bill Image Upload** - Attach bill/invoice images to supplier payments
- **Expense Refunds** - Record refunds with negative expense entries
- **Employee Status Filter** - Filter by Active/Left/All with clickable stat cards
- **Scheduled PDF Reports** - Configure daily/weekly/monthly auto-generated branded PDF reports
- Online sales bug verified as working (was empty DB issue)

## Architecture
- **Frontend:** React + Shadcn UI + Zustand + TailwindCSS
- **Backend:** FastAPI + MongoDB
- **3rd Party:** OpenAI (Emergent LLM Key), Twilio, reportlab, recharts, react-joyride, react-window

## Key New Files This Session
- `frontend/src/pages/ScheduledReportsPage.jsx`
- `frontend/src/components/PDFExportButton.jsx`
- `backend/routers/pdf_exports.py` (enhanced with logo upload, scheduled reports)
- `backend/routers/suppliers.py` (supplier returns, bill upload)
- `backend/routers/expenses.py` (expense refunds)

## Pending Tasks
### P1 - State Management
- Complete Zustand migration across remaining 20+ pages

### Future/Backlog
- Actual email sending for scheduled reports (SMTP integration)
- Real-time WebSocket notifications for stock alerts
- Mobile-responsive improvements for remaining admin pages
- Performance optimization for very large datasets
- WhatsApp chatbot enhancements
- End-of-service benefits calculation for employees (Saudi labor law)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Test Operator: test@ssc.com / testtest
- Cashier PIN: 1234

## Mocked Features
- Scheduled Reports "Send Now" records the action but doesn't send actual emails (SMTP not configured)
