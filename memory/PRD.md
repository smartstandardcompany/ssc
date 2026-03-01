# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler, pywebpush
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-grid-layout, date-fns
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision)
- **Push:** VAPID-based Web Push, Service Worker
- **WhatsApp:** Twilio (config-dependent)
- **PWA:** Full offline-capable Progressive Web App

## Latest Updates (Mar 1, 2026 — Session 3)

### Feature: Bangla Language Support (COMPLETED)
- Added full Bangla (`bn`) translations to `/frontend/src/lib/i18n.js` (lines 734-902)
- Updated LANGUAGES array to include `{ code: 'bn', label: 'বাংলা', flag: 'বা', rtl: false }`
- All navigation, dashboard, sales, expenses, employees, stock, invoices, reports, and UI text translated

### Feature: Automated Performance Report (COMPLETED)
- **Backend**: `GET /api/performance-report?period=N` — comprehensive aggregation endpoint
  - KPI summary (sales, expenses, profit, margin, transactions, avg ticket, salary, compliance)
  - Sales & profit daily trend
  - Branch ranking (sales, expenses, profit, transactions, avg ticket)
  - Employee performance table (tasks received/completed, compliance %, status)
  - Expense breakdown by category
  - Payment mode distribution
  - Period comparison with growth %
- **Frontend**: `/performance-report` page with 4 tabs (Overview, Employees, Branches, Expenses)
  - 5 KPI cards with growth indicators
  - Area chart for sales/expense/profit trend
  - Pie chart for payment distribution
  - Bar charts for branch comparison and expense breakdown
  - Employee performance table with compliance status badges
  - Period selector (7/14/30/60/90 days)
- **Navigation**: Added under Reports section in sidebar
- **Testing**: 100% pass rate (11/11 backend, all frontend features verified)

### Feature: Enhanced Bank Reconciliation (COMPLETED)
- **Backend**: New endpoints:
  - `GET /api/bank-statements/{id}/unmatched` — unmatched transactions with top-3 match suggestions (score, tier, amount diff)
  - `POST /api/bank-statements/{id}/manual-match` — manually link bank transaction to sale/expense/supplier payment
- **Frontend**: 3-tab reconciliation: POS Reconciliation, Matched, Unmatched
  - Adjustable tolerance (SAR 1/5/10/50) and date range (1-7 days) controls
  - Confidence tier badges (Exact/Probable/Possible) on auto-matches
  - Manual "Link" button on each unmatched suggestion for one-click linking
- **Testing**: 100% pass rate (12/12 backend, all frontend features verified)

### Feature: Expanded Keyboard Shortcuts (COMPLETED)
- Grew from 15 to 31 total shortcuts
- **Single-key**: B (Reconciliation), F (Performance Report), G (Task Compliance), J (Invoices), M (Menu Items), Q (Schedule)
- **Ctrl+Shift**: R (Reconciliation), I (Invoices), D (Documents), T (Transfers)
- **Alt**: P (Performance Report), C (Task Compliance), V (Visualizations), S (Schedule), L (Leave Approvals), M (Menu Items)
- **Actions**: Ctrl+F (Filter), Ctrl+Shift+E (Export)
- Updated shortcut modal with all new entries grouped by category

### Previous Session Features
1. Enhanced Predictive Analytics (Inventory Demand, CLV, Peak Hours, Profit Decomposition)
2. Custom Report Builder with Saved Views, Column Toggles, CSV Export
3. Push Notification Preferences + WhatsApp Channel
4. Bank Reconciliation Auto-Matching Engine
5. System-wide Keyboard Shortcuts (15+ shortcuts, Ctrl+/ help dialog)
6. Full Mobile PWA (offline caching, install prompt)
7. Daily Digest Email (comprehensive daily summary)
8. AI-Powered Task Reminders (presets for Cleaner/Waiter/Cashier/Chef, scheduler)
9. Task Compliance Dashboard (role/employee analytics, heatmap, trend, flagged alerts)

### All Features (All Sessions Combined)
- Full core ERP: Sales, Expenses, Customers, Suppliers, Employees, Stock, Invoicing
- Table Management, Waiter/Cashier Portals, KDS
- Loan Management, HR Analytics, Leave Calendar
- Employee Self-Service Portal with Task Reminders
- 14 Predictive Analytics Models
- Bank Reconciliation with Auto-Match Engine
- Custom Report Builder with Saved Views
- Push Notifications + WhatsApp + Daily Digest
- Task Reminders System + Compliance Dashboard
- ZATCA Phase 2, AI CCTV, i18n (EN/AR/UR/HI/BN)
- Mobile POS, Dark Mode, PWA, Keyboard Shortcuts, Advanced Export

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Backlog / Future Tasks
- None remaining — all requested features implemented
