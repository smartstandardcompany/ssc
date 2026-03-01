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

## Latest Updates (Mar 1, 2026 — Session 2)

### Feature: Task Compliance Dashboard (COMPLETED)
- **Backend**: `GET /api/task-reminders/compliance?days=N` — comprehensive analytics endpoint
  - Per-role compliance % with progress bars
  - Per-employee leaderboard with ranked scores (excellent/good/needs_attention/critical)
  - Time-of-day x day-of-week acknowledgement heatmap
  - 30-day compliance trend (line chart)
  - Auto-flagged employees below 50% threshold
  - Period selector (7/14/30/60 days)
- **Frontend**: `/task-compliance` page with 7 overview cards, Radar chart, leaderboard, trend line, heatmap grid, flagged section
- **Navigation**: Sidebar links for Task Reminders + Compliance under Admin, cross-links between pages

### All Features Completed (This Session)
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
- ZATCA Phase 2, AI CCTV, i18n (EN/AR/UR/HI)
- Mobile POS, Dark Mode, PWA, Keyboard Shortcuts, Advanced Export

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Backlog / Future Tasks
- None remaining — all requested features implemented
