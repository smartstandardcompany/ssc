# DataEntry Hub - Product Requirements Document

## Original Problem Statement
Build a data entry application to track sales, expenses, and supplier payments with features for branch management, customer tracking, supplier management with categories, credit tracking, user roles, reporting with exports, and WhatsApp notifications.

## Architecture
- **Backend:** FastAPI (Python) with MongoDB (motor async driver)
- **Frontend:** React with TailwindCSS, Shadcn/UI components
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
- [x] Expense tracking with managed categories
- [x] Supplier payments with credit tracking
- [x] Dashboard with key metrics

### Reporting
- [x] Credit Sales Report with payment reception
- [x] Supplier Report page
- [x] Category Report page (supplier category breakdown)
- [x] Reports page with filters (date, branch, type)
- [x] PDF export
- [x] Excel export

### User Management
- [x] User CRUD (admin only)
- [x] Role assignment (admin/manager/operator)
- [x] Permission management
- [x] Branch assignment per user

### Categories
- [x] Managed supplier categories (add via UI, select from dropdown)
- [x] Managed expense categories (default + custom via UI)
- [x] Category CRUD API (/api/categories)

## Backlog

### P2 - WhatsApp Notifications
- Backend logic exists (Twilio integration)
- No frontend UI for configuration
- Requires Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)

## API Endpoints
- `/api/auth/`: register, login, me
- `/api/users/`: CRUD (admin only)
- `/api/branches/`: CRUD
- `/api/customers/`: CRUD
- `/api/suppliers/`: CRUD + pay-credit
- `/api/sales/`: CRUD + receive-credit
- `/api/expenses/`: CRUD
- `/api/supplier-payments/`: CRUD
- `/api/categories/`: CRUD (supplier/expense types)
- `/api/dashboard/stats`: Dashboard statistics
- `/api/reports/`: credit-sales, suppliers, supplier-categories
- `/api/export/reports`: PDF/Excel export
- `/api/whatsapp/`: settings, send-daily-report

## Test Credentials
- Email: test@example.com
- Password: password123
- Role: admin
