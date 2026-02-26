# SSC Track - ERP System PRD

## Original Problem Statement
Data entry application to track sales, expenses, and supplier payments. Evolved into a comprehensive business management ERP named "SSC Track".

## Architecture
- **Backend:** FastAPI + MongoDB (Motor async) + JWT Auth + Pydantic
- **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts
- **Deployment:** Docker + Nginx + Railway
- **PWA:** Service Worker enabled for offline/installable

## Credentials
- Admin: SSC@SSC.com / Aa147258369SsC@
- Employee: ahmed@test.com / emp@123

## All Implemented Features

### Financial Management
- Sales: split payments, discounts, branch/online, credit tracking, color-coded chips
- Expenses: categories/sub-categories, payment modes, branch selection
- **Expense For Branch:** Cross-branch expense tracking (Branch A pays for Branch B) with dues calculation
- Supplier payments with credit limit enforcement
- Customer credit management with receive-credit flow
- Invoicing with item master list

### HR Management
- Employee CRUD with salary, docs, position, leave entitlements
- 6 payment types: Salary, Advance/Loan, Loan Repayment, Overtime, Tickets, ID Card
- Loan tracking, Leave management (Annual/Sick/Unpaid)
- Payslip PDF generation, Employee self-service portal
- Leave approval flow, Salary acknowledgment, In-app notifications

### Asset & Liability Tracking
- Document management with expiry alerts + file attachments
- Fines & Penalties tracking with file proof uploads
- Company Loans management
- Partner investments/salaries/loans

### Cash Flow Management
- Branch-to-branch cash transfers
- Central company balance tracking
- Inter-branch dues with payback recording
- **Cross-branch expense dues** integrated into branch dues

### Bank Statement Analysis
- PDF/XLS parser for Alinma & Albilad banks
- Transaction categorization (POS, SADAD, SARIE, Fees, VAT)
- POS sales reconciliation

### Reporting & Analytics
- Multi-tab dashboard with KPIs, % of sales, period comparison
- Branch-to-Branch Dues with payback deductions
- Advanced reports with charts + branch-wise cash/bank + date filters
- PDF/Excel export on all pages

### Administration
- Role-based access: admin, manager, operator, employee
- Granular module-specific permissions
- Email (SMTP) and WhatsApp (Twilio) settings
- Data import from XLS, one-click database backup
- Currency: SAR (Saudi Riyal)

## Completed Tasks (This Session - Feb 26, 2026)
- [x] Implemented "Expense For Branch" feature (P0) - full stack
- [x] Fixed bcrypt AttributeError warning (updated to 4.2.1)
- [x] Testing passed 100% (backend + frontend)

## Upcoming Tasks
- **P0:** WhatsApp Notification Triggers - add UI buttons/toggles to trigger reports
- **P1:** Enhanced Bank Reconciliation UI - side-by-side view for matching
- **P2:** Refactor server.py (>5000 lines) into separate routers/models/services
- **P2:** Break down large frontend components

## Key Technical Notes
- `server.py` is monolithic (>5000 lines) - needs refactoring
- Bank statement parser is specific to Alinma/Albilad formats
- Deployment configured for Railway with multi-stage Dockerfile
- User permissions controlled in DashboardLayout.jsx
