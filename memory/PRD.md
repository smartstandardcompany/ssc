# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-grid-layout, date-fns
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision)
- **Push:** pywebpush + VAPID keys for browser Web Push
- **WhatsApp:** Twilio (config-dependent, requires user to set Twilio credentials)
- **PWA:** Full offline-capable Progressive Web App with Service Worker

## Latest Updates (Mar 1, 2026 — Session 2)

### Feature Set 1: Bank Reconciliation — Full Auto-Matching Engine (COMPLETED)
- Smart auto-matching of bank transactions to system sales/expenses/supplier payments
- Fuzzy matching with amount tolerance (±SAR 5) and date range (±3 days)
- Confidence scoring (60-100%) with supplier name boosting
- Confirm/reject individual matches with status tracking
- Frontend: Auto-Match button, tab toggle (POS Reconciliation / Transaction Matches), match results table with confirm/reject actions
- Backend: `POST /api/bank-statements/{id}/auto-match`, `GET .../matches`, `POST .../confirm`, `DELETE .../reject`

### Feature Set 2: System-wide Keyboard Shortcuts (COMPLETED)
- `useKeyboardShortcuts` hook with 15+ shortcuts (Ctrl+1..9 for nav, Ctrl+N/E for new entries, Ctrl+K search, Ctrl+/ help)
- `ShortcutHelpDialog` component triggered by Ctrl+/ or window event
- Updated DashboardLayout shortcuts modal with both single-key and Ctrl+key shortcuts
- Shortcuts disabled when focus is on input/textarea elements

### Feature Set 3: Full Mobile PWA (COMPLETED)
- Enhanced Service Worker (`sw.js`) with offline caching:
  - Cache-first for static assets (JS, CSS, images)
  - Network-first for API calls
  - Stale-while-revalidate for asset updates
- `PWAInstallPrompt` component with dismiss/install UX
- Complete `manifest.json` with categories, scope, lang, orientation
- All PWA meta tags in index.html (theme-color, apple-mobile-web-app-capable, etc.)

### Feature Set 4: WhatsApp Notification Channel (COMPLETED)
- Added `channel_push` and `channel_whatsapp` toggles to notification preferences
- Backend `send_whatsapp_notification` function using existing Twilio integration
- Notifications route through preferences: if WhatsApp enabled and Twilio configured, alerts sent via WhatsApp
- Frontend: Delivery Channels section in Notification Preferences page

### Feature Set 5: Daily Digest Email (COMPLETED)
- Comprehensive daily business summary: sales, expenses, payments, P&L, branch breakdown, top expenses, action items
- Registered as `daily_digest` job type in scheduler (default: 6 AM daily)
- Can be triggered manually via `POST /api/scheduler/ai-reports/daily_digest/trigger`
- Sent via email (if SMTP configured) and/or WhatsApp (if Twilio configured)

### Previous Session Completions
- 14 Predictive Analytics Models (Inventory Demand, CLV, Peak Hours, Profit Decomposition, + 10 existing)
- Custom Report Builder with Saved Views, column toggles, CSV export
- Push Notification Preferences with per-type toggles
- Table Management, Waiter/Cashier Portals, Loan Management, HR Analytics
- Employee Self-Service Portal, Leave Calendar, KDS, ZATCA, i18n
- Full core ERP, Mobile POS optimizations, Dark Mode, CCTV AI

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Backlog / Future Tasks
- None remaining — all requested features implemented
