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

### Phase 1-24: Core ERP + All Features (ALL DONE)
Financial, HR, stock, POS, assets, CCTV, cash flow, reporting, admin, loyalty, security, barcodes, timestamps, logging, search, daily summary, AI forecasting, sales alerts, supplier enhancements, automated reminders, Zustand migration, AI stock reorder, enhanced P&L, customer portal.

### Phase 25: Final Feature Batch (DONE - Mar 2026)

**1. Customer Order Tracking & Notifications**
- **Route:** `/order-tracking`
- **Status Flow:** placed → confirmed → preparing → ready → out_for_delivery → delivered (+ cancelled)
- **Features:**
  - Status summary cards showing count per status (7 cards)
  - Recent orders list with customer name, amount, date, status
  - Click-to-update status with visual timeline
  - Notification Settings: Enable/disable, choose channels (Email/WhatsApp), select trigger statuses
  - Background notification sending via email and WhatsApp
  - Notification history logging
- **Backend Endpoints:**
  - `GET /api/order-tracking/config` - Get notification config
  - `POST /api/order-tracking/config` - Update notification config
  - `GET /api/order-tracking/recent` - Get orders for tracking
  - `POST /api/order-tracking/update-status` - Update order status + notify
  - `GET /api/order-tracking/order/{id}` - Get order tracking details
  - `GET /api/order-tracking/notifications/{id}` - Get notification history

**2. Extended Zustand Migration**
- `StockPage` now uses `useBranchStore`
- Total pages using Zustand: Dashboard, POS, Sales, Expenses, Suppliers, Customers, Employees, Stock, StockReorder, EnhancedPnL

**3. VirtualizedTable Component**
- Created reusable component at `/components/VirtualizedTable.jsx`
- Uses @tanstack/react-virtual for efficient rendering of large datasets
- Ready for integration into high-volume tables

Test Results: Backend 100% (16/16), Frontend 100%

## Complete Route Map
- **Operations:** `/pos`, `/waiter`, `/cashier`, `/kds`, `/order-status`, `/pos-analytics`
- **Finance:** `/sales`, `/platforms`, `/invoices`, `/expenses`, `/supplier-payments`, `/supplier-aging`, `/supplier-reminders`, `/cash-transfers`
- **People:** `/customers`, `/loyalty`, `/order-tracking`, `/suppliers`, `/employees`, `/loans`, `/leave-approvals`, `/schedule`
- **Stock:** `/stock`, `/stock-reorder`, `/transfers`, `/menu-items`, `/table-management`, `/reservations`, `/kitchen`
- **Reports:** `/analytics`, `/enhanced-pnl`, `/visualizations`, `/sales-forecast`, `/sales-alerts`, `/shift-report`, `/partner-pl-report`, `/reports`, `/credit-report`, `/supplier-report`, `/category-report`, `/bank-statements`, `/reconciliation`, `/performance-report`, `/anomaly-detection`, `/trend-comparison`
- **Assets:** `/assets`, `/documents`, `/cctv`
- **Admin:** `/users`, `/settings`, `/task-reminders`, `/task-compliance`, `/activity-logs`, `/branches`
- **Customer Portal:** `/customer-portal/*` (6 routes)

## Architecture
```
/app/
├── backend/
│   └── routers/           # 42 routers
│       ├── order_tracking.py   # NEW
│       ├── customer_portal.py
│       └── ... 
├── frontend/
│   └── src/
│       ├── stores/        # Zustand (3 stores)
│       ├── components/
│       │   └── VirtualizedTable.jsx  # NEW
│       └── pages/
│           ├── OrderTrackingPage.jsx  # NEW
│           └── ... (40+ pages)
```

## Remaining Backlog (Optional Enhancements)
- Integrate VirtualizedTable into Sales, Stock, Expenses tables for very large datasets
- Real-time WebSocket notifications for instant stock alerts
- Mobile-responsive improvements for remaining admin pages
- Advanced reporting PDF exports with company branding
