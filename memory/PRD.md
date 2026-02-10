# DataEntry Hub - PRD

## Architecture
FastAPI + MongoDB | React + TailwindCSS + Shadcn/UI + Recharts | JWT Auth

## Implemented Features

### Sales & Customers
- Sales with split payments (cash/bank/credit), discounts | Credit tracking
- Customer CRUD with branch assignment

### Suppliers & Expenses
- Supplier CRUD with **categories + sub-categories** + credit tracking
- Expense tracking with **categories + sub-categories** + branch selection
- Supplier payments (cash/bank/credit + branch)

### Employee & Payroll
- Employee CRUD (name, doc ID, salary, position, branch, doc expiry, leave entitlements)
- 6 payment types: Salary, Advance/Loan, Loan Repayment, Overtime, Tickets, ID Card
- Loan tracking (advance increases, repayment decreases)
- Leave management: Annual, Sick, Unpaid, Other
- **Payslip PDF** with employee details, payment breakdown, signature/stamp area
- **Employee Portal** with self-service (view payments, apply leave, acknowledge salary)
- **Leave approval flow**: Employee applies → Admin approves/rejects → Notification
- **Salary acknowledgment**: "I Confirm Receipt" with timestamp

### Document Management
- Document CRUD with expiry tracking
- **File attachments**: Upload/download actual documents as backup
- Alerts on Dashboard + Documents page

### Reporting & Charts
- Reports with pie/bar charts + branch-wise cash/bank breakdown
- Supplier Report with period filter + Category Report with charts
- Date filter on Sales, Expenses, Supplier Payments
- PDF/Excel export on ALL pages

### Notifications
- In-app notification system (bell with unread count)
- Leave approval/rejection notifications
- Salary payment notifications

### User Management
- Roles: admin, manager, operator, employee
- Auto-create employee user accounts

## Credentials
- Admin: test@example.com / password123
- Employee: ahmed@test.com / emp@123

## Backlog
- WhatsApp notifications (needs Twilio credentials)
- Email alerts for document expiry
