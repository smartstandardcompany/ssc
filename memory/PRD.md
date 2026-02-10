# DataEntry Hub - PRD

## Architecture
FastAPI + MongoDB | React + TailwindCSS + Shadcn/UI + Recharts | JWT Auth

## All Implemented Features

### Sales & Customers
- Sales: split payments, discounts, branch/online, credit tracking
- Customer CRUD with branch assignment
- **Customer balance**: total sales, cash, bank, credit breakdown per customer
- **Receive credit** directly from customer page (auto-applies to oldest credit sales)

### Suppliers & Expenses  
- Supplier CRUD with **categories + sub-categories** + credit tracking
- Expense tracking with **categories + sub-categories** + branch selection
- Supplier payments with branch selection | Pay credit from branch cash/bank
- Empty strings auto-cleaned to null (no more branch errors)

### Employee & Payroll
- Employee CRUD with salary, doc ID, position, leave entitlements
- 6 payment types: Salary, Advance/Loan, Loan Repayment, Overtime, Tickets, ID Card
- Loan tracking | Leave management (Annual/Sick/Unpaid)
- **Payslip PDF** with signature/stamp area | Employee can download
- **Employee Portal** (self-service) | Leave approval flow | Salary acknowledgment
- In-app notifications

### Document Management
- Document CRUD with expiry tracking + **custom type categories**
- **File attachments**: upload/download actual documents
- Alerts on Dashboard + Documents page

### Reporting & Charts
- Reports with charts + branch-wise cash/bank + date filters
- Credit Report with **discount + final amount** columns
- PDF/Excel export on ALL pages

### User Management
- Roles: admin, manager, operator, employee
- Auto-create employee user accounts

## Credentials
- Admin: test@example.com / password123
- Employee: ahmed@test.com / emp@123
