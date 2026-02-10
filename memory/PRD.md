# DataEntry Hub - PRD

## Architecture
FastAPI + MongoDB | React + TailwindCSS + Shadcn/UI + Recharts | JWT Auth

## Implemented Features

### Sales & Customers
- Sales with split payments (cash/bank/credit), discounts | Credit tracking + receive payments
- Customer CRUD with branch assignment

### Suppliers & Expenses
- Supplier CRUD with managed categories + credit tracking | Pay credit (cash/bank + branch)
- Expense tracking with categories + branch selection | Supplier payments

### Employee & Payroll
- Employee CRUD (name, doc ID, salary, position, branch, doc expiry, leave entitlements)
- **6 payment types**: Salary, Advance/Loan, Loan Repayment, Overtime, Tickets, ID Card
- **Loan tracking**: Advance increases loan_balance, Repayment decreases it
- **Leave management**: Annual, Sick, Unpaid, Other with days/dates/reason
- **3-tab Summary**: Salary & Payments (monthly balance) | Loan/Advance (taken/repaid/outstanding) | Leave (used/remaining)
- Tickets & ID Card auto-create Expense records

### Document Expiry
- Document CRUD with expiry tracking, alerts on Dashboard + Documents page

### Reporting & Charts
- Reports with pie/bar charts + branch-wise cash/bank breakdown
- Supplier Report with period filter + Category Report with charts
- Date filter (Today/Month/Year/Custom) on Sales, Expenses, Supplier Payments
- PDF/Excel export on ALL pages

### User Management
- User CRUD with roles (admin/manager/operator) + permissions

## Backlog
- WhatsApp notifications (needs Twilio credentials)
- Email alerts for document expiry

## Credentials: test@example.com / password123 (admin)
