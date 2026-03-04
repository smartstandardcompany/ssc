# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments, evolved into a comprehensive business management ERP system named "SSC Track".

## Core Modules
- **Financial Management:** Sales (Bank/Cash/Online/Credit), Expenses, Supplier Payments, Customer Credit, ZATCA Invoicing, P&L Reporting, Online Platform Sales & Commission Management, Supplier Aging Reports
- **HR Management:** Employee database, salary payments, leave tracking, loan management, Employee Self-Service Portal
- **Staff Management:** Manual and AI-driven Shift Scheduling, Cashier shift management
- **Stock Management:** Inventory tracking, stock-in/out, multi-branch transfers, real-time low-stock alerts, AI-powered stock reordering suggestions
- **Restaurant Operations:** POS, KDS, Customer-Facing Order Status, Table Management, Reservations, Order Tracking
- **Asset & Liability Tracking:** Assets/liabilities module, document management with expiry alerts
- **CCTV Security:** Hikvision integration, AI monitoring
- **Cash Flow & Bank Reconciliation:** Branch transfers, central balance, bank statement analysis
- **Reporting & Analytics:** Customizable dashboards, advanced reporting, AI-driven predictive analytics
- **Customer Portal:** Customer login, order history, credit balance, statements
- **Administration:** Role-based access, branding, dark mode, multi-language, PWA, guided tours

## What's Implemented (as of March 4, 2026)
- Full financial management with sales, expenses, supplier payments
- Customer credit management & ZATCA invoicing
- Online platform sales with commission tracking
- HR module with employee database, salary, leave, loans
- Stock management with inventory, transfers, low-stock alerts
- AI-powered stock reordering suggestions page
- Enhanced P&L reporting page
- POS, KDS, Table Management, Reservations
- Customer Portal (auth + dashboard)
- Order Tracking (staff-facing)
- CCTV Security module
- Cash flow, bank reconciliation
- Analytics, visualizations, sales forecast
- Role-based access, dark mode, multi-language
- **Advanced PDF exports with branded headers (logo, company info, colors)**
- **VirtualizedTable integrated into Sales, Stock, Expenses pages**
- **Quick Help/Tour button on all pages with page-specific guidance**
- **Branding Settings page with logo upload**
- Zustand state management (partial migration)
- Supplier Aging Reports
- Anomaly Detection, Trend Comparison

## Architecture
- **Frontend:** React + Shadcn UI + Zustand + TailwindCSS
- **Backend:** FastAPI + MongoDB
- **3rd Party:** OpenAI (Emergent LLM Key), Twilio, reportlab, recharts, react-joyride, react-window

## Pending Tasks
### P1 - State Management
- Complete Zustand migration across remaining 20+ pages

### Future/Backlog
- Real-time WebSocket notifications for stock alerts
- Mobile-responsive improvements for remaining admin pages
- Performance optimization for very large datasets
- WhatsApp chatbot enhancements

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Test Operator: test@ssc.com / testtest
- Cashier PIN: 1234
