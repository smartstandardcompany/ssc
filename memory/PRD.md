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
- **Administration:** Role-based access, Email/WhatsApp notifications, scheduled reports (daily/weekly/monthly), company branding, data import/backup
- **UI/UX:** Mobile-optimized POS, grouped collapsible sidebar, responsive mobile views, dashboard widget customization

## Tech Stack
- **Backend:** FastAPI, Pydantic, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-to-print
- **Database:** MongoDB
- **Integrations:** Twilio (WhatsApp), emergentintegrations (Gemini OCR), qrcode (ZATCA)

## Architecture
```
/app/backend/ - FastAPI app with modular routers
/app/frontend/ - React app with Shadcn UI components
```

## What's Been Implemented (Complete)
### Core Features
- Full CRUD for Sales, Expenses, Customers, Suppliers, Employees, Branches
- Multi-payment POS (Cash/Bank/Online/Credit simultaneously)
- ZATCA-compliant invoicing with VAT toggle in Settings
- Invoice Image Upload (attach, view, replace, delete + print preview)
- AI Shift Scheduling, Live POS Analytics
- Multi-branch inventory transfers
- Employee offboarding (resignation/termination)
- Bank Reconciliation UI
- Data import/export, database backup
- Role-based access with Job Title permissions

### Enhanced Reporting (Feb 2026)
- Daily Sales Summary report with chart + table
- Top Customers ranking by purchases + credit tracking
- Cashier Performance report with sales/avg per transaction
- Currency consistency: All pages use SAR (fixed $ -> SAR)

### Mobile Optimizations (Feb 2026)
- Card-based mobile views for Expenses, Employees, Stock tables
- Responsive headings (text-2xl sm:text-4xl) across all pages
- Mobile hamburger menu with slide-out sidebar

### Dashboard Customization (Feb 2026)
- Widget show/hide toggle (stats, charts, cashBank, paymentMode, spending, dues, vatSummary)
- Preferences persist in localStorage

### Scheduled Notifications (Feb 2026)
- Daily Sales Summary, Low Stock Alert, Expense Summary
- **Weekly Digest** - configurable day of week (Sun-Sat)
- **Monthly Digest** - configurable day of month (1-28)
- Channels: WhatsApp and/or Email

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## Backlog / Future
- Further user-requested enhancements
