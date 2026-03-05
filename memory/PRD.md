# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- Financial Management, HR Management, Stock Management, Restaurant Operations, CCTV Security, Administration

## Latest Session (Mar 5, 2026)

### Employee Offboarding (DONE)
- 3 exit types, clearance checklist, settlement PDF, email notifications
- Visible Exit/Settlement/Review buttons

### AI-Powered Business Insights (DONE)
- Dashboard, Stock Reorder, Sales Forecast widgets
- Analytics Hub: AI Profit, AI Churn, AI Revenue tabs
- OpenAI GPT-4.1-mini via Emergent LLM Key

### Performance & Mobile Responsive (DONE)
- Backend pagination: Cash Transfers, Invoices, Fines, Customers
- Mobile responsive: CashTransfers, Invoices, Fines, Activity Logs, Documents

### Employee Portal Access Fix (DONE)
- "My Portal" link added to TOP of sidebar for ALL users (operators, admins)
- Previously hidden inside collapsed PEOPLE section
- Graceful "no profile linked" page with instructions for unlinked users

### SMTP Email Fix (DONE)
- Fixed `use_tls=True` bug across ALL routers (was causing timeout on port 587)
- Changed to `start_tls=True` for Office 365 compatibility
- Better error messages (shows auth error instead of generic timeout)
- Note: Still blocked by Microsoft 365 authentication (5.7.139 - SMTP AUTH or Security Defaults issue)

## Pending Issues
- SMTP Email: Auth error 5.7.139 - user needs to check Azure AD Security Defaults or use alternative provider

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Backlog
- PWA (Progressive Web App) for mobile/desktop installable experience
- Remaining mobile responsive: LoansPage, LeaveApprovalsPage, SchedulePage
- Email automation (blocked on SMTP auth)
