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
- `/api/reports/heatmap-data` - Daily activity data for 365-day heatmap
- `/api/reports/sales-funnel` - Sales pipeline funnel with conversion rates
- `/api/reports/expense-treemap` - Hierarchical expense breakdown
- `/api/reports/kpi-gauges` - KPI gauge indicators
- `/api/reports/branch-radar` - Multi-metric branch comparison
- `/api/reports/cashflow-waterfall` - Cash flow waterfall chart data
- `/api/reports/money-flow` - Money flow (Sankey-style) data
- `/api/reports/time-series-compare` - Multi-period daily sales comparison
- `/api/stock/alerts` - Low stock alerts (items below min_stock_level)
- `/api/expenses/auto-categorize` - AI expense categorization
- `/api/invoices/ocr-scan` - Invoice OCR
- `/api/dashboard/today-vs-yesterday` - Daily comparison
- `/api/whatsapp/send-to` - Send reports via WhatsApp (6 report types)
- `/api/scheduler/config` - Scheduled job configs (incl. eod_summary auto-send)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

## Recently Completed (Dec 2025)
- **5 NEW AI Predictive Analytics Features:**
  1. **Cash Flow Prediction**: 14-day forecast based on 90-day historical patterns, low cash alerts, weekly pattern insights, risk level assessment
  2. **Seasonal Sales Forecasting**: Day-of-week analysis, best/worst days identification, weekend vs weekday comparison, next 7-day predictions
  3. **Employee Performance Scoring**: AI-calculated scores (sales, consistency, attendance, value), tier rankings (Top Performer, Good, Average, Needs Improvement), recommendations
  4. **Smart Expense Alerts**: Anomaly detection using 2-standard-deviation threshold, spending trend analysis, category breakdown, severity-based alerts
  5. **Supplier Payment Optimization**: Credit utilization analysis, payment schedule recommendations, cash impact predictions, priority-based scheduling

- **Full Multi-Language Support (4 Languages):**
  - LanguageContext with useLanguage hook and localStorage persistence
  - Full translations for English, Arabic (العربية), Urdu (اردو), Hindi (हिंदी)
  - 150+ translation keys covering all major UI elements
  - RTL layout auto-applied for Arabic and Urdu (dir="rtl")
  - LTR layout for English and Hindi
  - Language dropdown in sidebar footer (replaced cycle button)
  - All pages have useLanguage hook integrated
  - Dashboard, POS, Expenses, Stock, and navigation items translated

- **Language Dropdown Implementation:**
  - Converted language toggle from cycle button to dropdown menu
  - Shows all 4 languages with flag indicators (EN, عر, ار, हि)
  - Both desktop sidebar and mobile header have dropdown
  - Selected language highlighted in dropdown

- **Interactive Drill-Down on Visualizations:**
  - Heatmap day click → EOD Summary pre-filled with date
  - Funnel stage click → Customers or Sales page
  - Treemap category click → Expenses filtered by category
  - Waterfall step click → Sales (income) or Expenses (expense)
  - Radar branch click → Dashboard filtered by branch
  - "Click to drill down" hint text on all interactive charts

- **Dashboard Widget Customization:**
  - Toggle visibility for Stats, Charts, Cash/Bank, Payment Mode, Spending, Dues, VAT Summary
  - Settings persist in localStorage
  - react-grid-layout installed for future drag-and-drop

- **Advanced Data Visualizations (10 features)** — Heatmap, Funnel, Treemap, Gauges, Radar, Waterfall, Money Flow, Time-Series, Export PNG
- **Predictive Analytics Hub** — 5 AI modules
- **Scheduled EOD Auto-Send, Dark Mode, Keyboard Shortcuts, Mobile Bottom Nav, Sparklines**
- **Real-time Stock Alerts** - Polling-based alerts with expandable banner
- **End-of-Day (EOD) Summary Report** - New tab in Reports with date/branch filter
- **Partner Profit & Loss (P&L)** - New tab in Reports with partner breakdown
- **WhatsApp Report Integration** - EOD Summary and Partner P&L added as report types

## Backlog
- Implement full drag-and-drop dashboard widget rearrangement (react-grid-layout installed)
- Translate remaining hardcoded text (expense category buttons, chart labels)
- Additional AI features (predictive analytics enhancements)
- Further UX refinements based on user feedback
