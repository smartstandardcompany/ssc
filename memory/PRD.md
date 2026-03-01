# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts (Radar/Pie/Bar/Area), react-grid-layout, date-fns
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision)
- **Push:** pywebpush + VAPID keys for browser push notifications

## Latest Updates (Mar 1, 2026)

### Phase 1: Enhanced Predictive Analytics (COMPLETED)
- **Inventory Demand Forecast** — Weighted moving average per item, day-of-week patterns, stockout prediction
- **Customer Lifetime Value (CLV)** — Predicts annual value, purchase frequency, retention, segments (Platinum/Gold/Silver/Bronze)
- **Peak Hours Analysis** — Hourly order distribution, peak/slow hours, staffing recommendations, heatmap
- **Profit Decomposition** — Daily profit vs 7-day trend, day-of-week seasonality, monthly P&L, anomaly detection
- New tabs added to Analytics Dashboard Predictive Hub

### Phase 2: Report Customization (COMPLETED)
- **Custom Report Builder** — Select report type (Sales/Expenses/Stock/Employees/Customers), date range, branch filter
- **Column Visibility Toggles** — Click to show/hide columns in report output
- **Save View** — Save custom report configurations and reload them later
- **CSV Export** — One-click CSV download of any custom report
- Backend: `/api/report-views` CRUD, `/api/report-views/data/{type}` filtered data

### Phase 3: Push Notifications (COMPLETED)
- **Browser Push** — Service Worker registration, VAPID key-based Web Push subscription
- **Notification Preferences** — Per-type toggles: Low Stock, Leave Requests, Order Updates, Loan Installments, Expense Anomalies, Document Expiry, Daily Summary
- **Notification Preferences Page** — New page at `/notification-preferences` with sidebar link
- Backend: `/api/push/` endpoints for subscribe, unsubscribe, preferences, status

### All Completed Features
- Employee Self-Service Portal (profile, financials, leave balance bars, loans, letters, edit profile)
- HR Analytics (Radar, Pie, Bar, Area charts for department/salary/leave/loan analysis)
- Leave Calendar View (monthly grid with colored entries)
- Bank Reconciliation (diff %, pie chart, batch verify, CSV export)
- Dark Mode across all pages
- Loan Management (CRUD, installments, self-service)
- Separate Waiter & Cashier Portals (pos_role, role enforcement)
- Table Management (20 tables, 5 sections, visual designer)
- KDS with Table Banners, Keyboard Shortcuts
- AI CCTV, ZATCA Phase 2, i18n (EN/AR/UR/HI)
- Full core ERP: Sales, Expenses, Customers, Suppliers, Employees, Stock, Invoicing
- Customer-Facing Order Display (dark theme, progress bars, estimated wait time)
- Advanced Export (Loans, Attendance, Leaves — Excel + PDF)
- Mobile POS/Waiter Optimizations (slide-in cart, floating action bar)
- 14 Predictive Analytics Models (Expense Forecast, Stock Reorder, Revenue Trends, Customer Churn, Margin Optimizer, Cash Flow, Seasonal, Team Score, Expense Anomalies, Supplier Optimization, Inventory Demand, CLV, Peak Hours, Profit Decomposition)
- Custom Report Builder with Saved Views
- Push Notification Preferences with per-type toggles

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Backlog / Future Tasks
- Bank Reconciliation: Full statement analyzer logic
- Expand system-wide keyboard shortcuts
