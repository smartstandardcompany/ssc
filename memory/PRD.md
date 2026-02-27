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
- **Dashboard Sparklines** - Mini SVG charts on stat cards showing 7-day trends
- **Dark Mode** - Toggle in sidebar footer and mobile header (class-based Tailwind)
- **Keyboard Shortcuts** - D=Dashboard, N/P=POS, S=Sales, E=Expenses, I=Inventory, R=Reports, A=Analytics, ?=Help
- **Mobile Bottom Tab Bar** - 5-item quick nav (Home, Sales, Expenses, Stock, Reports)

## Key API Endpoints
- `/api/targets` + `/api/targets/progress` - Sales target CRUD & progress
- `/api/reports/sales-forecast` - AI sales prediction
- `/api/reports/analytics-pdf` - PDF export
- `/api/reports/eod-summary?date=YYYY-MM-DD` - End-of-Day summary report
- `/api/reports/partner-pnl` - Partner Profit & Loss report
- `/api/reports/expense-forecast` - Predicted expenses by category
- `/api/reports/stock-reorder` - Stock reorder predictions
- `/api/reports/revenue-trends` - Weekly/monthly revenue trends with growth rates
- `/api/reports/customer-churn` - Customer churn risk analysis
- `/api/reports/margin-optimizer` - Item margin analysis & recommendations
- `/api/stock/alerts` - Low stock alerts (items below min_stock_level)
- `/api/expenses/auto-categorize` - AI expense categorization
- `/api/invoices/ocr-scan` - Invoice OCR
- `/api/dashboard/today-vs-yesterday` - Daily comparison
- `/api/whatsapp/send-to` - Send reports via WhatsApp (6 report types)
- `/api/scheduler/config` - Scheduled job configs (incl. eod_summary auto-send)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## Recently Completed (Feb 2026)
- **Scheduled EOD Auto-Send** - New `eod_summary` scheduler job, configurable time/channels in Settings
- **Predictive Analytics Hub** - 5 new AI modules: Expense Forecast, Stock Reorder, Revenue Trends, Customer Churn, Margin Optimizer
- **Dashboard Sparklines** - Mini SVG trend charts on Total Sales, Expenses, Net Profit stat cards
- **Dark Mode** - Full dark mode support with toggle in sidebar & mobile header
- **Keyboard Shortcuts** - 8 navigation shortcuts + modal help
- **Mobile Bottom Tab Bar** - 5-item quick access nav for mobile users
- **Real-time Stock Alerts** - Polling-based alerts with expandable banner
- **End-of-Day (EOD) Summary Report** - New tab in Reports with date/branch filter
- **Partner Profit & Loss (P&L)** - New tab in Reports with partner breakdown
- **WhatsApp Report Integration** - EOD Summary and Partner P&L added as report types

## Backlog
- Further UX refinements based on user feedback
- Advanced data visualization options
