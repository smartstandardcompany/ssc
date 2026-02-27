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
- **Reporting:** Multi-tab reports, real-time POS analytics, advanced analytics dashboard, daily/weekly/monthly digests
- **Administration:** Role-based access, Email/WhatsApp notifications, scheduled reports, company branding, data import/backup
- **UI/UX:** Mobile-optimized POS, grouped collapsible sidebar, responsive mobile views, dashboard widget customization
- **AI Features:** OCR invoice scanning, AI shift scheduling

## Tech Stack
- **Backend:** FastAPI, Pydantic, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-to-print
- **Database:** MongoDB
- **Integrations:** Twilio (WhatsApp), emergentintegrations (Gemini/GPT-4o OCR), qrcode (ZATCA)

## Architecture
```
/app/backend/ - FastAPI with modular routers (auth, sales, expenses, invoices, employees, stock, reports, dashboard, scheduler, transfers, etc.)
/app/frontend/ - React SPA with Shadcn UI (35+ pages)
```

## What's Been Implemented (Complete)

### Core CRUD
- Sales, Expenses, Customers, Suppliers, Employees, Branches

### Financial Features
- Multi-payment POS (Cash/Bank/Online/Credit simultaneously)
- ZATCA-compliant invoicing with VAT toggle
- Invoice Image Upload (attach, view, replace, delete + print preview)
- **OCR Auto-Fill for Invoices** - AI-powered scan using GPT-4o extracts items/prices from invoice images
- Supplier Payments, Cash Transfers, Customer Credit Management

### Analytics & Reporting
- **Analytics Dashboard** (/analytics) - Today vs Yesterday, Key Metrics, Profit Margin Trend, Cumulative Revenue, Payment Distribution, Top Customers/Cashiers, Branch Performance
- **Dashboard Quick Stats Comparison** - Today vs Yesterday % change on stat cards
- Daily Sales Summary, Top Customers, Cashier Performance reports
- Period comparison, Branch comparison, Trends, Item P&L

### HR & People
- Employee offboarding (resignation/termination)
- AI Shift Scheduling, Leave management, Loan tracking

### Stock & Operations
- Multi-branch inventory transfers
- Bank Reconciliation UI
- Live POS Analytics dashboard

### Administration
- Dashboard widget customization (show/hide sections, persisted in localStorage)
- Weekly/Monthly email digest scheduler jobs
- Role-based access with Job Title permissions
- Data import/export, database backup

### UI/UX
- Grouped collapsible sidebar (Operations, Finance, People, Stock, Reports, Assets, Admin)
- Mobile card views for Expenses, Employees, Stock tables
- Responsive headings and layouts across all pages
- Currency consistency (SAR everywhere)

## Key API Endpoints
- `/api/dashboard/today-vs-yesterday` - Today vs yesterday comparison
- `/api/invoices/ocr-scan` - AI OCR invoice scanning
- `/api/reports/daily-summary` | `/api/reports/top-customers` | `/api/reports/cashier-performance`
- `/api/scheduler/config` - Scheduled job configuration (daily/weekly/monthly)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## Backlog / Future
- Further user-requested enhancements
