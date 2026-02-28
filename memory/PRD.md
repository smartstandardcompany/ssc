# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company, evolved from a simple sales/expenses tracker.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler, reportlab (PDF)
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-to-print, react-grid-layout
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o OCR, GPT-4o-mini categorization & forecasting)
- **Other:** Twilio (WhatsApp), qrcode (ZATCA)

## Architecture
```
/app/backend/ - FastAPI with 20+ modular routers
/app/frontend/ - React SPA with 40+ pages
```

## Features Implemented

### Core
- Full CRUD: Sales, Expenses, Customers, Suppliers, Employees, Branches
- Multi-payment POS (Cash/Bank/Online/Credit simultaneously)
- ZATCA-compliant invoicing with VAT toggle
- Invoice Image Upload + OCR Auto-Fill (GPT-4o)
- Role-based access with Job Title permissions

### Analytics & AI
- **Analytics Dashboard** with Today vs Yesterday comparison
- **Sales Target Tracker** - Monthly targets per branch with progress bars
- **AI Sales Forecast** - 7-day predictions using GPT-4o-mini
- **AI Auto-Categorization** - Expenses auto-categorized on description input
- **Export Analytics as PDF** - Downloadable PDF report
- Daily Summary, Top Customers, Cashier Performance reports
- Dashboard Quick Stats with % change badges
- Dashboard widget customization (show/hide sections)
- **Predictive Analytics Hub** (5 AI modules):
  - Expense Forecasting - predict next month by category (3-month moving avg)
  - Stock Reorder Predictions - AI estimates reorder dates & quantities
  - Revenue Trend Analysis - weekly/monthly with growth rates
  - Customer Churn Risk - identify inactive customers (4 risk levels)
  - Profit Margin Optimizer - item recommendations (star/promote/review/maintain)
- **Cash Flow Prediction**: 14-day forecast based on 90-day historical patterns
- **Seasonal Sales Forecasting**: Day-of-week analysis with pattern detection
- **Employee Performance Scoring**: AI-calculated scores with tier rankings
- **Smart Expense Alerts**: Anomaly detection using 2-standard-deviation threshold
- **Supplier Payment Optimization**: Credit utilization analysis and recommendations

### Restaurant POS System
- **Foodics-style POS Interface** at `/cashier/pos`
- **PIN-based Cashier Login** at `/cashier` - 4-digit PIN keypad with auto-submit
- **Cashier Shift Management** - Start/end shifts with cash counts, expected cash calculation
- **Menu Categories**: All Items, Popular, Main Dishes, Appetizers, Beverages, Desserts, Sides
- **Item Modifiers**: Size options (Regular/Large), extras with pricing
- **Menu Item Management** at `/menu-items` - CRUD with image upload
- **Order Types**: Dine-in, Takeaway, Delivery
- **Payment Methods**: Cash, Bank, Credit (customer credit)
- **Kitchen Display System (KDS)** at `/kds` - Real-time order display with status updates
- **Customer-Facing Order Display** at `/order-status` - "Preparing" and "Ready" columns, auto-refresh

### HR & People
- Employee management with auto user creation
- AI Shift Scheduling, Leave, Loan tracking
- Employee offboarding (resignation/termination)

### Stock & Operations
- Multi-branch inventory transfers
- Bank Reconciliation
- Live POS Analytics dashboard

### Administration
- Scheduled notifications (daily/weekly/monthly digest)
- Data import/export, database backup
- Company branding, Email/WhatsApp notifications

### UI/UX
- Grouped collapsible sidebar (7 sections)
- **Floating Quick Entry button** - instant POS access from any page
- Mobile card views for all data tables
- Responsive headings and layouts
- Currency consistency (SAR everywhere)
- **Real-time Stock Alerts** - Banner at top of dashboard
- **Dashboard Sparklines** - Mini SVG charts on stat cards
- **Dark Mode** - Toggle in sidebar footer
- **Keyboard Shortcuts** - D=Dashboard, N/P=POS, S=Sales, E=Expenses, I=Inventory, R=Reports, A=Analytics
- **Mobile Bottom Tab Bar** - 5-item quick nav
- **Full Multi-Language Support** - English, Arabic (RTL), Urdu (RTL), Hindi

## Key API Endpoints
- `/api/targets` + `/api/targets/progress` - Sales target CRUD & progress
- `/api/reports/sales-forecast` - AI sales prediction
- `/api/reports/analytics-pdf` - PDF export
- `/api/reports/eod-summary?date=YYYY-MM-DD` - End-of-Day summary report
- `/api/reports/partner-pnl` - Partner Profit & Loss report
- `/api/cashier/login` - PIN-based cashier login
- `/api/cashier/shift/start` - Start cashier shift with opening cash
- `/api/cashier/shift/current` - Get current shift with totals
- `/api/cashier/shift/end` - End shift with closing cash count
- `/api/cashier/menu` - Menu items CRUD
- `/api/cashier/menu/{item_id}/image` - Menu item image upload
- `/api/cashier/orders` - POS orders CRUD
- `/api/order-status/active` - Customer-facing order display (public)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier PIN: 1234

## Recently Completed (Feb 2026)

### 4-Part Feature Enhancement (Latest - Feb 28, 2026):

1. **Daily Shift Report Generation**
   - New `ShiftReportPage.jsx` at `/shift-report`
   - Two tabs: Daily Report and Date Range
   - Daily view shows: Total Shifts, Total Sales, Opening/Closing/Expected Cash, Cash Difference
   - Payment Method Breakdown pie chart
   - Sales by Branch bar chart
   - Detailed Shift table with cashier, times, duration, all cash amounts, status
   - Top Selling Items for the day
   - Range view shows: Days, Total Shifts/Sales/Orders, Avg Sales/Day
   - Daily Sales Trend line chart
   - Daily Breakdown table
   - Backend endpoints: `/api/cashier/shift-report`, `/api/cashier/shift-report/range`

2. **Full Drag-and-Drop Widget Customization**
   - Enhanced widget settings dialog with 8 toggleable sections
   - Each widget has label, description, and toggle switch
   - Widget options: Main Statistics, Quick Charts, Cash & Bank, Payment Modes, Spending Details, Dues & Alerts, Branch Dues, VAT Summary
   - "Show All" and "Minimize" quick actions
   - Preferences saved to backend via `/api/dashboard/layout`
   - Persisted across devices (synced via API)

3. **Bulk Salary Payment UI**
   - New `BulkSalaryPayment.jsx` component in Employees page
   - "Bulk Pay Salaries" button opens dialog
   - Period selector with month options
   - Branch filter for targeted payments
   - Preview step shows: To Pay count, Already Paid count, Total Amount
   - Employee list with checkboxes and Select All
   - Payment Mode and Date selectors
   - Results show paid/skipped/failed breakdown by branch
   - Backend endpoints: `/api/salary-payments/bulk-preview`, `/api/salary-payments/bulk`

4. **General API Improvements**
   - Dashboard layout preferences API (GET/POST/DELETE `/api/dashboard/layout`)
   - Shift report aggregation endpoints with branch filtering
   - Bulk salary payment with duplicate detection
   - Automatic expense creation for salary payments
   - Employee notification on salary payment

### 5-Part POS and Dashboard Enhancement (Earlier):

1. **Cashier Shift Management (Start/End with Cash Count)**
   - New `CashierShiftModal.jsx` component
   - "Shift Active" button in POS header opens modal
   - Start shift with opening cash amount
   - View current shift totals: total sales, payment breakdown (Cash, Card, Online, Credit)
   - Expected cash calculation (opening + cash sales)
   - End shift with closing cash count and difference detection (shortage/overage)
   - Backend endpoints: `/api/cashier/shift/start`, `/api/cashier/shift/current`, `/api/cashier/shift/end`

2. **Customer-Facing Order Status Display** at `/order-status`
   - Public page (no auth required)
   - Two columns: "Preparing" (amber) and "Ready for Pickup" (green)
   - Real-time clock with date
   - Auto-refresh every 3 seconds
   - Order cards show order number, customer name, order type
   - Pulsing animation on ready orders

3. **Cashier PIN Login** at `/cashier`
   - 4-digit numeric PIN keypad
   - Auto-submit after 4 digits entered (requires Sign In click confirmation)
   - Clear and Backspace buttons
   - Links to Main Login and Kitchen Display
   - Backend supports both PIN-only and email/password login

4. **Menu Item Images**
   - New `MenuItemsPage.jsx` at `/menu-items`
   - Grid view of all menu items with category filter and search
   - Image upload on hover (supports JPEG, PNG, WebP, GIF, max 5MB)
   - Edit/delete buttons per item
   - Add Item dialog with all fields (name EN/AR, category, price, cost, prep time, tags)
   - Backend endpoints: `/api/cashier/menu/{id}/image` (POST/DELETE)
   - Static files served from `/uploads/menu`

5. **Dashboard Widget Customization**
   - react-grid-layout library installed
   - "Customize Widgets" button opens settings dialog
   - 7 toggleable widgets: Stats, Charts, Cash/Bank, Payment Mode, Spending, Dues, VAT Summary
   - Widget visibility persisted in localStorage
   - "Edit Layout" mode for drag-and-drop (foundation in place)

## Backlog
- Implement full drag-and-drop widget rearrangement (react-grid-layout is installed)
- Translate remaining hardcoded text (expense category buttons, some chart labels)
- Further UX refinements based on user feedback
- Add more menu item images via the new upload feature

## File Structure Updates
- `/app/frontend/src/components/CashierShiftModal.jsx` - NEW
- `/app/frontend/src/pages/MenuItemsPage.jsx` - NEW
- `/app/frontend/src/pages/OrderStatusPage.jsx` - Updated with full implementation
- `/app/frontend/src/pages/CashierPOSPage.jsx` - Added shift management integration
- `/app/backend/routers/cashier_pos.py` - Added image upload endpoints
- `/app/backend/server.py` - Added static file serving for /uploads
