# DataEntry Hub - Product Requirements Document

## Original Problem Statement
Data entry application for sales, expenses, supplier payments, employees/payroll, and document expiry tracking.

## Architecture
- **Backend:** FastAPI + MongoDB (motor) | **Frontend:** React + TailwindCSS + Shadcn/UI + Recharts
- **Auth:** JWT with role-based access | **Database:** MongoDB

## Implemented Features

### Sales & Customers
- [x] Sales with split payments (cash/bank/credit), discounts, branch/online types
- [x] Customer CRUD with branch assignment
- [x] Credit sales tracking + receive credit payments

### Suppliers & Expenses
- [x] Supplier CRUD with managed categories + credit tracking
- [x] Pay supplier credit (cash/bank + branch selection)
- [x] Expense tracking with categories + branch selection
- [x] Supplier payments (cash/bank/credit + branch)

### Employee & Payroll Module
- [x] Employee CRUD (name, doc ID, salary, position, pay frequency, branch, doc expiry)
- [x] 5 payment types: Salary, Advance, Overtime, Tickets, ID Card
- [x] Cash or Bank payment mode
- [x] Tickets & ID Card payments auto-create Expense records
- [x] Per-employee monthly summary: salary paid, balance, advance, overtime, tickets, id_card
- [x] Payment history with View Summary dialog

### Document Expiry Module
- [x] Document CRUD with type, expiry date, alert_days
- [x] Auto status: Active / Expiring Soon / Expired
- [x] Alerts on Dashboard + Documents page

### Reporting & Charts
- [x] Reports page with pie/bar charts + branch-wise cash/bank breakdown
- [x] Supplier Report with date period filter + charts
- [x] Category Report with charts
- [x] Credit Sales Report

### Export & Filtering
- [x] PDF/Excel export on ALL pages (Sales, Customers, Suppliers, Supplier Payments, Expenses, Employees, Reports)
- [x] Date filter (Today/Month/Year/Custom) on Sales, Expenses, Supplier Payments

### User Management
- [x] User CRUD with roles (admin/manager/operator) + permissions

## Backlog
- WhatsApp daily sales + document expiry alerts (needs Twilio credentials)
- Email alerts for document expiry (needs email provider)

## Test Credentials
- Email: test@example.com | Password: password123 | Role: admin
