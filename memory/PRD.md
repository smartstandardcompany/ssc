# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- Financial Management, HR Management, Stock Management, Restaurant Operations, CCTV Security, Administration

## Latest Session (Mar 5, 2026 - Session 2)

### Scheduled PDF Report Delivery (DONE)
- Wired APScheduler CronTrigger to `scheduled_reports` collection
- PDF reports now auto-send on daily/weekly/monthly schedule via email
- Supports sales, expenses, P&L, supplier aging report types
- Email delivery blocked by Microsoft 365 auth (external issue)

### Data Management & Archiving (DONE)
- New `/data-management` page with 7 archivable collections
- Archive old records (3/6/12 months threshold) to `{collection}_archive`
- Restore archived data back to original collection
- Permanent purge with double confirmation
- JSON export for any collection
- Archive history with status tracking

## Previous Session (Mar 5, 2026 - Session 1)

### Employee Offboarding (DONE)
- 3 exit types, clearance checklist, settlement PDF, email notifications

### AI-Powered Business Insights (DONE)
- Dashboard, Stock Reorder, Sales Forecast widgets
- Analytics Hub: AI Profit, AI Churn, AI Revenue tabs
- OpenAI GPT via Emergent LLM Key

### Performance & Mobile Responsive (DONE)
- Backend pagination: Cash Transfers, Invoices, Fines, Customers
- Mobile responsive: CashTransfers, Invoices, Fines, Activity Logs, Documents

### Employee Portal Access Fix (DONE)
- "My Portal" link at TOP of sidebar for ALL users

### SMTP Email Fix (DONE - External Block)
- Fixed `use_tls=True` bug across ALL routers
- Changed to `start_tls=True` for Office 365 compatibility
- Still blocked by Microsoft 365 authentication (5.7.139)

### PWA Implementation (DONE)
- Installable Progressive Web App with install prompt

### Guided Tours (DONE)
- 9-step interactive dashboard tour with Arabic support

## Pending Issues
- SMTP Email: Auth error 5.7.139 - user needs to check Azure AD Security Defaults

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Backlog
- P2: UI/UX polishing across remaining pages
- P2: In-app guided tours for additional modules (beyond dashboard)
- P2: Email automation features (blocked on SMTP auth)
- P2: Data management archiving automation (auto-archive old data on schedule)
