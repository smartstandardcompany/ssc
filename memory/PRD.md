# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-grid-layout, date-fns
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision)
- **Other:** Twilio (WhatsApp), qrcode (ZATCA)

## Recent Updates (Feb 28, 2026)

### Leave Calendar View (COMPLETED - Latest)
- Full monthly calendar with colored leave entries on date cells
- Color-coded by leave type: Annual=green, Sick=blue, Unpaid=orange, Personal=purple, Emergency=red
- Lighter shades for pending leaves
- Click any date to see leave details (employee, type, status, duration, reason)
- Month forward/back navigation
- Legend showing all leave types
- Stats cards: Total Requests, Pending, Approved, Rejected, Total Days Used
- Tab switching: List View | Calendar | Requests

### Bank Reconciliation Improvements (COMPLETED)
- **Diff % column**: Shows percentage difference per row, with color coding (>5% red, >1% amber)
- **Status Pie Chart**: SVG donut chart showing matched vs issues percentage
- **Batch Verify**: "Verify All Matched" button auto-flags all matched rows as verified
- **CSV Export**: Export full reconciliation data including diff % and flag status
- **Additional summary cards**: Verified count, Investigate count alongside existing totals
- Full dark mode support on all elements

### Dark Mode Polish (COMPLETED)
- Added `dark:` classes to: LoanManagementPage, TableManagementPage, LeaveApprovalsPage, ReconciliationPage
- Dark backgrounds (`dark:bg-stone-900`), dark text (`dark:text-white`), dark borders (`dark:border-stone-700`)
- Toggle persists across all pages via localStorage

### Previously Completed
- Loan Management System (Full CRUD, installments, self-service)
- Separate Waiter & Cashier Portals (pos_role field, role enforcement)
- Table Management & Waiter Ordering System (20 tables, 5 sections)
- KDS Table Banners, Order Status Table Info
- AI-Powered CCTV, ZATCA Phase 2, Partner P&L, Mobile Nav Customization
- Full Restaurant POS, KDS, Order Status, Cashier Shifts
- Complete CRUD: Sales, Expenses, Customers, Suppliers, Employees, Branches
- Analytics Dashboard, Predictive Analytics, AI Forecasting
- Stock Management, Bank Reconciliation, Cash Transfers
- Multi-language (EN, AR, UR, HI), Keyboard Shortcuts

## Key Files
- `/app/frontend/src/pages/LeaveApprovalsPage.jsx` - Leave calendar + list + approvals
- `/app/frontend/src/pages/ReconciliationPage.jsx` - Enhanced bank reconciliation
- `/app/frontend/src/pages/LoanManagementPage.jsx` - Loan management with dark mode
- `/app/frontend/src/pages/TableManagementPage.jsx` - Table admin with dark mode
- `/app/backend/routers/loans.py` - Loan management API
- `/app/backend/routers/tables.py` - Table management API

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Backlog / Future Tasks
- HR: Employee Self-Service Portal further enhancements
- UI/UX: More dark mode refinements, mobile responsiveness improvements
- Restaurant: Customer-facing display improvements
- Advanced reporting: More chart types, export options
