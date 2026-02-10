# DataEntry Hub - Product Requirements Document

## Original Problem Statement
Build a data entry application to track sales, expenses, supplier payments, employees/payroll, and documents with expiry tracking. Features include branch management, customer tracking, supplier management with categories, credit tracking, user roles, reporting with charts and exports, and document expiry alerts.

## Architecture
- **Backend:** FastAPI (Python) with MongoDB (motor async driver)
- **Frontend:** React with TailwindCSS, Shadcn/UI, Recharts
- **Auth:** JWT-based authentication with role-based access control
- **Database:** MongoDB

## What's Been Implemented

### Core Features
- [x] User authentication (register/login) with JWT
- [x] Role-based access control (admin, manager, operator)
- [x] Branch management (CRUD)
- [x] Customer management with branch assignment
- [x] Supplier management with managed categories
- [x] Sales tracking with split payments (cash/bank/credit), discounts
- [x] Expense tracking with managed categories + branch selection
- [x] Supplier payments with credit tracking + branch selection
- [x] Pay supplier credit with branch + cash/bank selection
- [x] Dashboard with key metrics + document expiry alerts

### Employee & Payroll Module
- [x] Employee CRUD (name, doc ID, salary, position, pay frequency, branch, doc expiry)
- [x] Salary payment tracking (amount, mode, branch, period)
- [x] Document expiry tracking per employee
- [x] Monthly payroll summary

### Document Expiry Module
- [x] Document CRUD (name, type, number, related_to, issue/expiry dates, alert_days)
- [x] Auto-calculated status (active, expiring_soon, expired)
- [x] Days-left counter
- [x] Expiry alerts on Dashboard and Documents page
- [x] Alert endpoint combining documents + employee doc expiries

### Reporting & Charts
- [x] Credit Sales Report with payment reception
- [x] Supplier Report with charts, date period filter (day/month/year)
- [x] Category Report with bar + pie charts
- [x] Reports page with charts (pie, bar) + branch-wise cash/bank breakdown
- [x] Branch-wise cash vs bank detailed table

### Date Filtering
- [x] DateFilter component (Today/This Month/This Year/Custom Range)
- [x] Applied to Sales, Expenses, Supplier Payments pages

### Export (All Pages)
- [x] PDF/Excel export on Sales, Customers, Suppliers, Supplier Payments, Expenses, Employees pages
- [x] PDF/Excel export on Credit Report, Supplier Report, Category Report
- [x] Full report export from Reports page

### User Management
- [x] User CRUD (admin only)
- [x] Role assignment + permissions + branch assignment

## Backlog

### P1 - WhatsApp Daily Sales + Expiry Alerts
- Backend Twilio integration exists but needs credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
- WhatsApp settings UI exists on Reports page
- Needs: daily automated sending + document expiry alerts via WhatsApp

### P2 - Email Alerts
- Send email alerts when documents approach expiry
- Needs email provider credentials (SendGrid/Gmail SMTP)

## API Endpoints
- `/api/auth/`: register, login, me
- `/api/users/`: CRUD
- `/api/branches/`: CRUD
- `/api/customers/`: CRUD
- `/api/suppliers/`: CRUD + pay-credit
- `/api/sales/`: CRUD + receive-credit
- `/api/expenses/`: CRUD
- `/api/supplier-payments/`: CRUD
- `/api/employees/`: CRUD
- `/api/salary-payments/`: CRUD
- `/api/documents/`: CRUD + alerts/upcoming
- `/api/categories/`: CRUD
- `/api/dashboard/stats`
- `/api/reports/`: credit-sales, suppliers, supplier-categories, branch-cashbank, supplier-balance
- `/api/export/`: reports, data
- `/api/whatsapp/`: settings, send-daily-report

## Test Credentials
- Email: test@example.com
- Password: password123
- Role: admin
