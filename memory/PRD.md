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

### Feature: AI-Powered Task Reminders (COMPLETED)
- **Admin Task Reminder Manager** at `/task-reminders`
  - Create custom recurring reminders per role (Cleaner, Waiter, Cashier, Chef) or per individual employee
  - Preset templates: 5 for Cleaner, 4 for Waiter, 4 for Cashier, 5 for Chef
  - "Quick Setup" bulk creation from presets
  - Configurable: interval (hours), active hours (start/end), days of week, channels
  - Pause/resume, delete, view acknowledgement history
- **Scheduler Integration** — Reminders processed every 5 minutes via APScheduler
  - Matches employees by job title or pos_role
  - Sends push + in-app notifications to matching employees
  - Logs all alerts in `reminder_alerts` collection
- **Employee Self-Service** — "My Tasks" tab in Employee Portal
  - Employees see assigned reminders with "Done" acknowledge button
  - Acknowledgement tracked in `reminder_acknowledgements` collection
- **Stats Dashboard**: Total reminders, active count, roles covered, total triggers

### Previously Completed Features (This Session)
- Bank Reconciliation Auto-Matching Engine
- System-wide Keyboard Shortcuts (15+ shortcuts, Ctrl+/ help dialog)
- Full Mobile PWA (offline caching, install prompt)
- WhatsApp Notification Channel
- Daily Digest Email (comprehensive daily summary)
- Enhanced Predictive Analytics (Inventory Demand, CLV, Peak Hours, Profit Decomposition)
- Custom Report Builder with Saved Views
- Push Notification Preferences

### All Completed Features (All Sessions)
- Full core ERP: Sales, Expenses, Customers, Suppliers, Employees, Stock, Invoicing
- Table Management, Waiter/Cashier Portals, KDS
- Loan Management, HR Analytics, Leave Calendar
- Employee Self-Service Portal with Task Reminders
- 14 Predictive Analytics Models
- Bank Reconciliation with Auto-Match Engine
- Custom Report Builder with Saved Views, Column Toggles, CSV Export
- Push Notification Preferences + WhatsApp Channel
- Daily Digest Email + Task Reminders System
- ZATCA Phase 2, AI CCTV, i18n (EN/AR/UR/HI)
- Mobile POS, Dark Mode, PWA, Keyboard Shortcuts
- Advanced Export (Employees, Loans, Attendance, Leaves)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Key Collections (New)
- `task_reminders`: id, name, message, target_type, target_value, interval_hours, active_start_hour, active_end_hour, days_of_week, channels, enabled, last_triggered, trigger_count
- `reminder_acknowledgements`: id, reminder_id, employee_id, employee_name, acknowledged_at
- `reminder_alerts`: id, reminder_id, reminder_name, target_type, target_value, employees_notified, sent_at

## Backlog / Future Tasks
- None remaining — all requested features implemented
