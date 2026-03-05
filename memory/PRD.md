# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- Financial Management, HR Management, Stock Management, Restaurant Operations, CCTV Security, Administration

## Latest Session (Mar 5, 2026 - Session 3)

### Module Guided Tours (DONE)
- 5 module-specific guided tours: Sales (4 steps), Stock (4 steps), Employees (4 steps), Analytics (4 steps), Settings (3 steps)
- Each tour has Skip/Next/Back/Close navigation with progress bar
- Tours track completion in localStorage, auto-trigger on first visit
- Reset All Tours button in Settings > Deploy tab

### Auto-Archive Scheduling (DONE)
- Cron-based auto-archive with configurable frequency (weekly/monthly)
- Per-collection enable/disable with customizable month thresholds (3/6/12)
- Scheduled via APScheduler with configurable time and day
- Auto-archive settings saved to MongoDB and synced on startup

### Data Management Automation (DONE)
- Auto-archive settings UI with toggle, frequency, collection toggles
- Runs automatically on schedule (monthly by default)
- Archive history tracking with restore/purge capabilities

### Mobile-Responsive Improvements (DONE)
- TransfersPage: grid-cols-1 sm:grid-cols-2 for transfer cards
- PartnersPage: hidden sm:table-cell for table columns, responsive heading
- NotificationsPage: responsive heading text sizes
- CompanyLoansPage: responsive heading and grid layout

### Scheduled PDF Report Delivery Enhancement (DONE - Session 2)
- APScheduler wired to scheduled_reports collection
- PDF reports auto-send on daily/weekly/monthly schedule
- Email blocked by external M365 auth issue

### Previous Sessions - Completed Features
- Employee offboarding UX, clearance checklist, settlement PDF
- AI-powered business insights (OpenAI GPT via Emergent LLM Key)
- Performance optimization: pagination on 4+ endpoints
- Employee Portal access for all roles
- SMTP bug fix (code-level, external auth block remains)
- PWA implementation
- Dashboard guided tour (9 steps)

## Pending Issues
- SMTP Email: Auth error 5.7.139 - user needs to check Azure AD Security Defaults
- Analytics page: pre-existing 500 error on some analytics data loads

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Backlog
- P2: Further UI/UX polishing (additional pages)
- P2: Email automation features (blocked on SMTP auth)
- P2: In-app guided tours for additional modules (POS, Kitchen, Customer Portal)
- P3: Data management archiving automation improvements
