# SSC Track - Product Requirements Document

## Original Problem Statement
A data entry application to track sales, expenses, and supplier payments, evolved into a comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Core Requirements
- **Financial Management:** Sales (Bank/Cash/Online/Credit), Expenses, Supplier Payments, Customer Credit, ZATCA-compliant Invoicing, Item-level P&L
- **HR Management:** Employee database, Job Title permissions, salary/bonus/overtime, leave, loans, offboarding, Self-Service Portal
- **Staff Management:** Manual & AI-driven Shift Scheduling
- **Stock Management:** Inventory tracking, stock-in/out, multi-branch transfers
- **Asset & Liability:** Documents with expiry alerts, fines, loans, partner investments
- **Cash Flow:** Branch-to-branch transfers, central balance
- **Bank Reconciliation:** Statement analyzer, side-by-side reconciliation
- **Reporting:** Multi-tab dashboard, real-time POS analytics, stock reports, daily summary, top customers, cashier performance
- **Administration:** Role-based access, Email/WhatsApp notifications, scheduled reports, company branding, data import/backup
- **UI/UX:** Mobile-optimized POS, grouped collapsible sidebar navigation, responsive mobile views

## Tech Stack
- **Backend:** FastAPI, Pydantic, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-to-print
- **Database:** MongoDB
- **Integrations:** Twilio (WhatsApp), emergentintegrations (Gemini OCR), qrcode (ZATCA)

## Architecture
```
/app/
├── backend/
│   ├── server.py (entry point, includes all routers)
│   ├── database.py, models.py
│   └── routers/ (auth, banks, branches, company, dashboard, documents, employees, exports, expenses, invoices, partners, pnl, reports, sales, scheduler, settings, shifts, stock, transfers)
├── frontend/
│   ├── src/App.js (routes)
│   ├── src/components/DashboardLayout.jsx (grouped sidebar)
│   └── src/pages/ (34+ page components)
```

## What's Been Implemented (Complete)
- Full CRUD for Sales, Expenses, Customers, Suppliers, Employees, Branches
- Multi-payment POS (Cash/Bank/Online/Credit simultaneously)
- ZATCA-compliant invoicing with VAT toggle in Settings
- Invoice Image Upload (attach, view, replace, delete + print preview)
- Grouped collapsible sidebar navigation (Operations, Finance, People, Stock, Reports, Assets, Admin)
- Mobile-responsive layout with hamburger menu
- **Enhanced Reporting**: Daily Sales Summary, Top Customers ranking, Cashier Performance reports
- **Currency consistency**: All pages use SAR (fixed $ -> SAR across Reports, Sales, Dashboard)
- **Mobile optimization**: Card-based mobile views for report tables, responsive headings, larger touch targets
- AI Shift Scheduling, Live POS Analytics
- Multi-branch inventory transfers
- Employee offboarding (resignation/termination)
- Bank Reconciliation UI
- Scheduled notifications (APScheduler)
- Advanced stock reporting (Item P&L)
- Data import/export, database backup
- Role-based access with Job Title permissions

## Key API Endpoints (New)
- `/api/reports/daily-summary` - Day-by-day sales/expenses/profit with payment breakdown
- `/api/reports/top-customers` - Customer rankings by total purchases with credit info
- `/api/reports/cashier-performance` - User/cashier sales performance metrics
- `/api/invoices/{id}/upload-image` - Upload image to invoice
- `/api/invoices/images/{filename}` - Serve uploaded invoice image
- `/api/invoices/{id}/image` (DELETE) - Remove invoice image

## Backlog / Future
- Further UX refinements based on user feedback
- Additional mobile optimizations

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
