# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler, pywebpush, aiosmtplib
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-grid-layout, date-fns
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision)
- **Push:** VAPID-based Web Push, Service Worker
- **WhatsApp:** Twilio (config-dependent)
- **PWA:** Full offline-capable Progressive Web App

## Latest Updates (Mar 2, 2026 — Session 4)

### Feature: Password Management System (COMPLETED)
- **Backend**: New password management endpoints in `auth.py`
  - `PUT /api/users/{id}/reset-password` — Admin resets user password with optional force-change flag
  - `POST /api/auth/forgot-password` — Self-service forgot password (sends email reset link)
  - `POST /api/auth/reset-password` — Reset password using token from email
  - `GET /api/auth/validate-reset-token/{token}` — Validate reset token before displaying form
  - `POST /api/auth/change-password` — User changes own password (supports forced change)
  - New models: `PasswordReset`, `ForgotPasswordRequest`, `ResetPasswordWithToken`, `ChangePassword`
  - User model updated with `must_change_password: bool` field
  - Login endpoint returns `must_change_password` flag for frontend redirect
- **Frontend**: Complete password management UI
  - **Login page**: Added "Forgot password?" link
  - **ForgotPasswordPage**: Email input form, sends reset link, shows success message
  - **ResetPasswordPage**: Token validation, new password form, error handling for expired tokens
  - **ChangePasswordPage**: For both voluntary and forced password changes
  - **UsersPage**: Reset Password button (key icon), Reset Password dialog with "Force change on login" checkbox
  - **"Must Change PW"** badge displays on users with pending forced password change
  - App.js updated to redirect users with `must_change_password=true` to change-password page
- **Email**: Uses SMTP via aiosmtplib (requires email settings configuration)
- **Security**: Tokens expire after 1 hour, prevents email enumeration, clears flag after successful change
- **Testing**: 100% pass rate (21/21 backend, all frontend features verified)

### Feature: Granular Role-Based Access Control (RBAC) (COMPLETED)
- **Backend**: New permission system with module-level access control
  - `has_permission(user, module, level)` — checks if user has read/write access
  - `require_permission(user, module, level)` — raises HTTPException 403 if denied
  - `get_branch_filter(user)` — returns MongoDB query filter for branch-restricted users
  - `normalize_permissions(perms)` — backward compatibility: converts old list format to dict
  - Updated routers: sales, expenses, customers, suppliers, employees with permission checks
  - User model updated with `Dict[str, str]` permissions and field_validator
- **Frontend**: New User Management UI
  - Module Permissions section with read/write/none dropdowns for each module
  - 25 modules organized by groups: Core, Finance, HR, Stock, Operations, Reports, Admin
  - Quick action buttons: "All Write", "All Read", "All None"
  - Permission summary badges in users table showing "X write, Y read"
  - Branch assignment dropdown for restricting users to specific branch data
  - Admin users show "Full Access" badge (no permission config needed)
- **Navigation**: DashboardLayout updated with `hasPermission()` for filtering navigation
- **Backward Compatibility**: Old list-based permissions auto-converted to new dict format
- **Testing**: 100% pass rate (16/16 backend, all frontend features verified)

## Previous Updates (Mar 1, 2026 — Session 3)

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

### Feature: Automated Reconciliation Alerts (COMPLETED)
- **Backend**: Weekly scheduled job that scans all bank statements for unmatched transactions above configurable threshold
  - `GET /api/reconciliation-alerts/settings` — configurable threshold, schedule (day/hour), channels, enabled toggle
  - `PUT /api/reconciliation-alerts/settings` — updates settings and manages APScheduler job
  - `POST /api/reconciliation-alerts/run` — manual trigger, generates alert, sends WhatsApp/Email/Push notifications
  - `GET /api/reconciliation-alerts` — alert history sorted by date
  - `GET /api/reconciliation-alerts/latest` — most recent alert
  - Flags high-value unmatched transactions with statement summaries and match rates
- **Frontend**: New "Alerts" tab on Reconciliation page
  - Alert Settings card with threshold dropdown (SAR 100-5000), schedule day/hour, enabled toggle, channel badges
  - "Run Now" button for manual execution
  - Alert History with Flagged/Clean status badges, statement summaries, top flagged item previews
- **Notifications**: Sends via WhatsApp, Push, and Email channels (WhatsApp/Email require credentials)
- **Testing**: 100% pass rate (20/20 backend, all frontend features verified)

### Feature: Automated Anomaly Detection (COMPLETED)
- **Backend**: New router `anomaly_detection.py` with 3 statistical detectors:
  - **Sales**: Daily spikes/drops, transaction count anomalies, payment mode shifts (15%+), branch underperformance
  - **Expenses**: Above category average (2+ std devs), weekly spending trends, category concentration (40%+)
  - **Bank**: Match rate drops, flagged transaction spikes, large unmatched transactions (5K+ SAR with z-score >= 3)
  - Uses z-scores and standard deviations for anomaly scoring
  - Endpoints: `GET /api/anomaly-detection/scan?days=N`, `GET /api/anomaly-detection/history`
  - Scan results saved to `anomaly_scans` collection
- **Frontend**: `/anomaly-detection` page with:
  - 7 summary cards (Total, Critical, Warning, Info, Sales, Expenses, Bank)
  - Category filter pills (All/Sales/Expenses/Bank)
  - Severity filter pills (All/Critical/Warning/Info)
  - Anomaly list with severity icons, category badges, descriptions, actual/expected/z-score values
  - Scan history with severity badges
  - Toast notifications on scan completion
- **Navigation**: Under Reports section, keyboard shortcut Alt+A
- **Testing**: 100% pass rate (21/21 backend, all frontend features verified)

### Feature: Scheduled Auto-Scan with Notifications (COMPLETED)
- **Backend**: Configurable daily/weekly auto-scan scheduler job
  - `GET /api/anomaly-detection/schedule` — settings (frequency, day, hour, period, threshold, channels)
  - `PUT /api/anomaly-detection/schedule` — updates settings and manages APScheduler CronTrigger job
  - `POST /api/anomaly-detection/test-scan` — manually triggers auto-scan with notifications
  - Smart alerting: only sends notifications when anomalies meet severity threshold (critical only, warning+, any)
  - Sends via push, WhatsApp, email channels (configurable)
  - Auto-scan records marked with `source: "auto"` for distinguishing from manual scans
- **Frontend**: Auto-Scan Schedule card on Anomaly Detection page
  - Enabled toggle, Frequency (Daily/Weekly), Day (for weekly), Time, Period, Alert threshold
  - Channel badges (push/whatsapp/email) with click-to-toggle
  - Test Now button, Last auto-scan timestamp
  - Scan history shows "auto" badge for scheduled scans
- **Testing**: 100% pass rate (27/27 backend, all frontend features verified)

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
