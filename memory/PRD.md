# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-grid-layout
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision)
- **Other:** Twilio (WhatsApp), qrcode (ZATCA), pdfplumber/pandas (Bank statements)

## Recent Updates (Feb 28, 2026)

### Loan Management System (COMPLETED - Latest)
- Full CRUD: Create, approve/reject, record installments, delete
- Stats dashboard: Total, Active, Pending, Completed, Disbursed, Outstanding, Collected
- Loan detail view with payment history and progress bar
- Employee self-service: `/api/my/loans` for employees to view their own loans
- Loan types: Personal, Salary Advance, Emergency, Housing
- Auto-updates employee `loan_balance` on approve/installment

### Separate Waiter & Cashier Portals (COMPLETED)
- Added `pos_role` field to Employee model: "cashier", "waiter", "both", or null
- PIN login now returns `pos_role` in response
- Cashier login (`/cashier`) rejects waiter-only PINs
- Waiter login (`/waiter`) rejects cashier-only PINs
- Admin can assign POS roles via Employee edit form dropdown

### Employee Portal Enhancement (COMPLETED)
- Added **Loans tab** to Employee Portal showing all employee's loans
- Progress bars, installment tracking, remaining balance
- Loan status badges (Active/Pending/Completed)

### Expanded Keyboard Shortcuts (COMPLETED)
- New shortcuts: T=Tables, L=Loans, W=Waiter, C=Cashier, K=KDS, H=Employees, O=Order Status
- Updated shortcuts help modal with all new shortcuts

### Table Management Enhancements (COMPLETED)
- KDS: Large orange TABLE banner for dine-in orders
- Order Status: Table number badges with Armchair icon
- 20 tables across 5 sections (Main Hall, VIP Room, Outdoor, Balcony, Private Dining)

### Table Management & Waiter System (COMPLETED)
- Admin table designer, Waiter Mode with PIN login, table selection, order flow

## Key API Endpoints
### Loans
- `GET/POST /api/loans` - List/Create loans
- `GET /api/loans/{id}` - Loan detail with installments
- `POST /api/loans/{id}/approve` - Approve/reject (action: approve|reject)
- `POST /api/loans/{id}/installment` - Record payment
- `DELETE /api/loans/{id}` - Delete loan
- `GET /api/loans/summary/stats` - Statistics
- `GET /api/my/loans` - Employee self-service

### Tables
- `GET/POST /api/tables/sections` - Section CRUD
- `GET/POST/PUT/DELETE /api/tables` - Table CRUD
- `POST /api/tables/{id}/start-order` - Start order
- `POST /api/tables/{id}/add-items` - Add items
- `POST /api/tables/{id}/close-order` - Close/pay
- `POST /api/tables/{id}/mark-available` - Mark available

## File Structure
- `/app/backend/routers/loans.py` - Loan management (NEW)
- `/app/backend/routers/tables.py` - Table management
- `/app/backend/routers/cashier_pos.py` - Updated with pos_role
- `/app/backend/models.py` - Added Loan, LoanInstallment, pos_role
- `/app/frontend/src/pages/LoanManagementPage.jsx` - Loan page (NEW)
- `/app/frontend/src/pages/TableManagementPage.jsx` - Table admin
- `/app/frontend/src/pages/WaiterPage.jsx` - Waiter mode
- `/app/frontend/src/pages/EmployeePortalPage.jsx` - Enhanced with loans
- `/app/frontend/src/pages/EmployeesPage.jsx` - Added pos_role field
- `/app/frontend/src/components/DashboardLayout.jsx` - Updated shortcuts

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter PIN: 1234

## Backlog / Future Tasks
- HR: Leave Calendar View (visual calendar of leaves)
- Bank Reconciliation: Improvements to statement analyzer
- UI/UX: Additional Dark Mode polish across newer pages
- Restaurant: Customer-facing display improvements
