# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for tracking sales, expenses, supplier payments, and more.

## Tech Stack
- **Frontend:** React + Tailwind CSS + Shadcn/UI + Zustand
- **Backend:** FastAPI (Python) + MongoDB (Motor) + Aggregation Pipelines + APScheduler
- **Auth:** JWT-based
- **Integrations:** OpenAI GPT-4o, Twilio, aiosmtplib, Statsmodels

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234

## Implemented Phases Summary

### Phase 1-16: Core ERP + Advanced Features (ALL DONE)
Financial, HR, stock, POS, assets, CCTV, cash flow, reporting, admin, loyalty, security, barcodes, timestamps, logging, search, daily summary, AI forecasting, sales alerts.

### Phase 17-19: Supplier Enhancements, State Management, Performance (DONE)
Supplier ledger/export/bank accounts, POS UI, Zustand, pagination, MongoDB indexes, aggregation pipelines, bug fixes.

### Phase 20: Backlog Features (DONE)
Supplier aging report, branch filter propagation, trend comparison, CCTV monitoring schedules/motion alerts, WhatsApp chatbot improvements.

### Phase 21: Automated Supplier Payment Reminders (DONE - Mar 2026)
- **Backend:** New router `supplier_reminders.py` with config CRUD, test endpoint, and reminder check logic
- **Scheduler:** Daily job via APScheduler CronTrigger (default 9:00 AM) to auto-check supplier aging
- **Aging Logic:** FIFO-based invoice aging with configurable thresholds (30/60/90/120 days default, plus 150/180 selectable)
- **Severity Levels:** Low (<30d), Medium (30-59d), High (60-89d), Critical (90d+)
- **Notifications:** Email (HTML table with all overdue invoices) and WhatsApp (formatted text summary) with configurable recipient lists
- **History:** Full audit trail of all sent reminders with supplier summaries and channel results
- **Frontend:** New `/supplier-reminders` page with:
  - Enable/disable toggle
  - Threshold selection (30/60/90/120/150/180 days)
  - Alert time picker
  - Email and WhatsApp channel toggles with recipient management (add/remove)
  - Test Now button for immediate reminder check
  - Reminder history with severity-colored supplier badges
- **Sidebar:** "Payment Reminders" link under Finance section
- Test Results: Backend 100% (7/7), Frontend 100%

## Key Pages & Routes
- `/supplier-aging` - Supplier Aging Report
- `/supplier-reminders` - Payment Reminder Settings
- `/trend-comparison` - Weekly/Monthly Trend Comparison
- `/supplier-payments` - Supplier Payments with Add Bill
- Plus 30+ existing pages

## Remaining Backlog
- None - all requested features implemented
