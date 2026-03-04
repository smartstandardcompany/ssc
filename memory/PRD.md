# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for tracking sales, expenses, supplier payments, and more.

## Tech Stack
- **Frontend:** React + Tailwind CSS + Shadcn/UI + Zustand
- **Backend:** FastAPI (Python) + MongoDB (Motor) + Aggregation Pipelines
- **Auth:** JWT-based
- **Integrations:** OpenAI GPT-4o, Twilio, aiosmtplib, APScheduler, Statsmodels

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234

## All Implemented Phases

### Phase 1-16: Core ERP + Advanced Features (ALL DONE)
All financial modules, HR, stock, restaurant POS, assets, CCTV, cash flow, reporting, admin, loyalty, security, barcodes, timestamps, activity logging, search, daily summary, AI forecasting, sales alerts.

### Phase 17: Supplier Module Enhancements & POS UI/UX (DONE)
Supplier total purchases, ledger with running balance + PDF/Excel export, multiple bank accounts, POS expense form clarity, online sales fix.

### Phase 18: Statement Sharing, Zustand, Pagination, Mobile (DONE)
Supplier statement sharing (email/WhatsApp), Zustand stores, API pagination, MongoDB indexes, responsive fixes.

### Phase 19: Critical Bug Fixes & Performance (DONE)
MongoDB aggregation pipelines for dashboard/suppliers, user branch optional, supplier payments revamp with Add Bill.

### Phase 20: Backlog Features Complete (DONE - Mar 2026)
- **Supplier Aging Report:** New page `/supplier-aging` with FIFO-based aging calculation. Groups outstanding balances by 0-30, 31-60, 61-90, 90+ days. Visual bar chart, expandable supplier details with unpaid invoices. Branch filter. PDF/Excel export. Backend: `GET /api/suppliers/aging-report`, `GET /api/suppliers/aging-report/export?format=pdf|excel`.
- **Branch Filter Propagation:** Added `get_branch_filter_with_global` to assets.py, documents.py. Added branch enforcement for restricted users in transfers.py.
- **Trend Comparison:** New page `/trend-comparison` showing this week vs last week, this month vs last month for sales/expenses/profit. 14-day daily trend bar chart with sales bars and expense markers. Backend: `GET /api/reports/trend-comparison`.
- **CCTV AI Expansion:** New CRUD endpoints for monitoring schedules (camera_ids, days, start/end times, alert_types, sensitivity). Motion alerts with type, severity, zone, confidence, acknowledgment. Endpoints: `/api/cctv/monitoring-schedules`, `/api/cctv/motion-alerts`.
- **WhatsApp Chatbot Improvements:** Added supplier commands: `supplier all` (all balances), `supplier [name]` (specific supplier), `aging` (quick aging view). Updated help message with all available commands.
- Test Results: Backend 100% (11/11), Frontend 100%

## Architecture
```
/app/
├── backend/
│   ├── routers/ (auth, sales, expenses, suppliers, dashboard, reports, cctv, whatsapp, etc.)
│   ├── models.py, database.py, server.py
│   └── tests/
├── frontend/
│   └── src/
│       ├── stores/ (authStore, branchStore, uiStore)
│       ├── pages/ (SupplierAgingPage, TrendComparisonPage, + 30+ existing pages)
│       └── components/ (DashboardLayout, AdvancedSearch, ExportButtons, etc.)
```

## Remaining Backlog
- None - all requested features implemented
