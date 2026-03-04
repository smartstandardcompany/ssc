# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for tracking sales, expenses, supplier payments, and more.

## Tech Stack
- **Frontend:** React + Tailwind CSS + Shadcn/UI + Zustand + Recharts + @tanstack/react-virtual
- **Backend:** FastAPI (Python) + MongoDB (Motor) + Aggregation Pipelines + APScheduler
- **Auth:** JWT-based (Staff), Token-based (Customer Portal)
- **Integrations:** OpenAI GPT-4o, Twilio, aiosmtplib, Statsmodels

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234
- Customer Portal: Register with any email

## Implemented Phases Summary

### Phase 1-22: Core ERP + Advanced Features (ALL DONE)
Financial, HR, stock, POS, assets, CCTV, cash flow, reporting, admin, loyalty, security, barcodes, timestamps, logging, search, daily summary, AI forecasting, sales alerts, supplier enhancements, automated reminders, Zustand migration (partial).

### Phase 23: P0 Features (DONE - Mar 2026)
- AI-Powered Stock Reorder Page (`/stock-reorder`)
- Enhanced P&L Report Page (`/enhanced-pnl`)

### Phase 24: P1 Features (DONE - Mar 2026)

**1. Customer-Facing Portal**
Complete portal for customers to access their account information:
- **Routes:**
  - `/customer-portal` - Login/Register page
  - `/customer-portal/dashboard` - Account overview with credit balance, loyalty points, tier
  - `/customer-portal/orders` - Order history with pagination
  - `/customer-portal/statements` - Account statement with date filtering
  - `/customer-portal/invoices` - Invoice list
  - `/customer-portal/loyalty` - Loyalty points and tier benefits
- **Backend:** `/api/customer-portal/*` endpoints for login, register, profile, orders, statements, invoices, loyalty, logout
- **Auth:** Separate token system (`customer_token`) stored in localStorage
- **Features:** Self-registration, password hashing, running balance calculation, transaction history

**2. Performance Optimization**
- Created `VirtualizedTable` component using `@tanstack/react-virtual`
- Features: Virtual scrolling, configurable row height, row click handlers, column definitions
- Designed for large datasets (1000+ rows) without DOM performance issues

**3. Extended Zustand Migration**
- `EmployeesPage` now uses `useBranchStore`
- Total pages using Zustand: Dashboard, POS, Sales, Expenses, Suppliers, Customers, Employees, StockReorder, EnhancedPnL

Test Results: Backend 100% (14/14), Frontend 100%

## Key Pages & Routes
- `/stock-reorder` - AI Stock Reorder Suggestions
- `/enhanced-pnl` - Enhanced P&L Report
- `/customer-portal/*` - Customer Portal (6 routes)
- `/supplier-aging` - Supplier Aging Report
- `/supplier-reminders` - Payment Reminder Settings
- Plus 35+ existing pages

## Architecture
```
/app/
├── backend/
│   └── routers/
│       ├── customer_portal.py    # NEW: Customer portal API
│       ├── suppliers.py          # Supplier management
│       ├── dashboard.py          # Dashboard stats
│       └── ... (40+ routers)
├── frontend/
│   └── src/
│       ├── stores/               # Zustand stores
│       │   ├── authStore.js
│       │   ├── branchStore.js
│       │   └── uiStore.js
│       ├── components/
│       │   └── VirtualizedTable.jsx  # NEW: Performance component
│       └── pages/
│           ├── customer-portal/      # NEW: Customer portal pages
│           │   ├── CustomerPortalLogin.jsx
│           │   └── CustomerPortalPages.jsx
│           ├── StockReorderPage.jsx  # NEW
│           └── EnhancedPnLPage.jsx   # NEW
```

## Remaining Backlog
- Integrate VirtualizedTable into high-volume pages (Sales, Stock, Expenses)
- Continue Zustand migration to remaining pages
- Mobile-responsive improvements for admin pages
- WebSocket real-time notifications for stock alerts
