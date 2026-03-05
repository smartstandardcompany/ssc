# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
Financial Management | HR Management | Stock Management | Restaurant Operations | CCTV Security | Administration

## Session 4 (Mar 5, 2026) - All Backlog Items

### Module Guided Tours - POS, Kitchen, Customer Portal (DONE)
- POS tour: 4 steps (Point of Sale, Entry Type, Online & Regular, Recent Entries)
- Kitchen tour: 4 steps (Kitchen Stock Usage, Select Branch, Add Items, Submit Usage)
- Customer Portal tour: 4 steps (Customer Portal, Orders, Statements, Loyalty)
- Total: 8 module tours across the application

### Smart Archive Recommendations (DONE)
- GET /api/data-management/recommendations endpoint
- Health score (0-100) based on collection sizes and growth rates
- Priority levels: critical, high, medium, low
- Growth rate analysis (30-day vs 60-day comparison)
- Actionable recommendations with one-click archive buttons

### Data Management Automation Improvements (DONE)
- Smart recommendations UI with health score badge
- Auto-archive scheduling with cron jobs (weekly/monthly)
- Per-collection toggle with configurable month thresholds
- Archive history with restore/purge/status tracking

### Mobile Responsive Improvements (DONE)
- POSAnalyticsPage: grid-cols-2 sm:grid-cols-3 lg:grid-cols-5
- KitchenPage: responsive heading
- PartnersPage: hidden columns on mobile, responsive heading
- TransfersPage: responsive grid cards, responsive heading
- NotificationsPage: responsive heading text
- CompanyLoansPage: responsive heading and grid

### UI/UX Polishing (DONE)
- Reset Tours button in Settings > Deploy tab
- All pages with consistent heading sizes (text-2xl sm:text-4xl)
- Overflow-x-auto on all data tables
- data-testid attributes on all interactive elements

## Session 3 (Mar 5, 2026)
- Scheduled PDF Report Delivery (DONE)
- Data Management & Archiving page (DONE)
- Module tours: Sales, Stock, Employees, Analytics, Settings (DONE)
- Auto-archive backend scheduling (DONE)
- Mobile responsive: TransfersPage, PartnersPage, NotificationsPage, CompanyLoansPage (DONE)

## Session 2 (Mar 5, 2026)
- Employee offboarding UX overhaul (DONE)
- AI analytics & insights with OpenAI GPT (DONE)
- Backend pagination: Cash Transfers, Invoices, Fines, Customers (DONE)
- Employee Portal access for all roles (DONE)
- SMTP bug fix (code-level fix, external auth block) (DONE)
- PWA implementation (DONE)
- Dashboard guided tour (DONE)

## Pending Issues
- SMTP Email: Auth error 5.7.139 from Microsoft 365 - user needs Azure AD Security Defaults disabled

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Remaining Backlog
- P2: Email automation (blocked on SMTP)
- P3: Additional guided tours for more sub-modules
- P3: Advanced data analytics and reporting dashboards
