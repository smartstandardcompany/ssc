# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company, evolved from a simple sales/expenses tracker.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler, reportlab (PDF)
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-to-print
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o OCR, GPT-4o-mini categorization & forecasting)
- **Other:** Twilio (WhatsApp), qrcode (ZATCA)

## Architecture
```
/app/backend/ - FastAPI with 20+ modular routers
/app/frontend/ - React SPA with 36+ pages
```

## Features Implemented

### Core
- Full CRUD: Sales, Expenses, Customers, Suppliers, Employees, Branches
- Multi-payment POS (Cash/Bank/Online/Credit simultaneously)
- ZATCA-compliant invoicing with VAT toggle
- Invoice Image Upload + OCR Auto-Fill (GPT-4o)
- Role-based access with Job Title permissions

### Analytics & AI
- **Analytics Dashboard** with Today vs Yesterday comparison
- **Sales Target Tracker** - Monthly targets per branch with progress bars
- **AI Sales Forecast** - 7-day predictions using GPT-4o-mini
- **AI Auto-Categorization** - Expenses auto-categorized on description input
- **Export Analytics as PDF** - Downloadable PDF report
- Daily Summary, Top Customers, Cashier Performance reports
- Dashboard Quick Stats with % change badges
- Dashboard widget customization (show/hide sections)
- **Predictive Analytics Hub** (5 AI modules):
  - Expense Forecasting - predict next month by category (3-month moving avg)
  - Stock Reorder Predictions - AI estimates reorder dates & quantities
  - Revenue Trend Analysis - weekly/monthly with growth rates
  - Customer Churn Risk - identify inactive customers (4 risk levels)
  - Profit Margin Optimizer - item recommendations (star/promote/review/maintain)

### HR & People
- Employee management with auto user creation
- AI Shift Scheduling, Leave, Loan tracking
- Employee offboarding (resignation/termination)

### Stock & Operations
- Multi-branch inventory transfers
- Bank Reconciliation
- Live POS Analytics dashboard

### Administration
- Scheduled notifications (daily/weekly/monthly digest)
- Data import/export, database backup
- Company branding, Email/WhatsApp notifications

### UI/UX
- Grouped collapsible sidebar (7 sections)
- **Floating Quick Entry button** - instant POS access from any page
- Mobile card views for all data tables
- Responsive headings and layouts
- Currency consistency (SAR everywhere)
- **Real-time Stock Alerts** - Banner at top of dashboard when items drop below minimum stock level

## Key API Endpoints
- `/api/targets` + `/api/targets/progress` - Sales target CRUD & progress
- `/api/reports/sales-forecast` - AI sales prediction
- `/api/reports/analytics-pdf` - PDF export
- `/api/reports/eod-summary?date=YYYY-MM-DD` - End-of-Day summary report
- `/api/reports/partner-pnl` - Partner Profit & Loss report
- `/api/stock/alerts` - Low stock alerts (items below min_stock_level)
- `/api/expenses/auto-categorize` - AI expense categorization
- `/api/invoices/ocr-scan` - Invoice OCR
- `/api/dashboard/today-vs-yesterday` - Daily comparison
- `/api/whatsapp/send-to` - Send reports via WhatsApp (6 report types)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## Recently Completed (Feb 2026)
- **Real-time Stock Alerts** - Polling-based alerts in DashboardLayout with expandable banner
- **End-of-Day (EOD) Summary Report** - New tab in Reports page with date/branch filter, KPI cards, breakdowns, print
- **Partner Profit & Loss (P&L)** - New tab in Reports page showing company summary and per-partner breakdown with monthly charts
- **WhatsApp Report Integration** - Added EOD Summary and Partner P&L as report types in WhatsApp send dialog

## Backlog
- Additional AI features (predictive analytics enhancements)
- Further UX refinements based on user feedback
