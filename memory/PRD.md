# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company, evolved from a simple sales/expenses tracker.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler, reportlab (PDF)
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts, react-to-print, react-grid-layout
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision for Face Recognition, Object Detection, People Counting, Motion Analysis)
- **Other:** Twilio (WhatsApp), qrcode (ZATCA)

## Architecture
```
/app/backend/ - FastAPI with 20+ modular routers
/app/frontend/ - React SPA with 40+ pages
```

## Recent Updates (Feb 28, 2026)

### P3 Features (COMPLETED)

#### ZATCA Phase 2 Compliance
- **UBL 2.1 XML Generation**: Full compliance with ZATCA e-invoicing schema
  - ProfileID, UUID, InvoiceNumber, IssueDate/Time
  - InvoiceTypeCode (381 for simplified B2C, 388 for standard B2B)
  - Digital signature structure placeholder (requires CSID)
  - Supplier/Customer party details
  - PaymentMeans, TaxTotal, LegalMonetaryTotal
  - InvoiceLine details with tax categories
- **9-Tag TLV QR Code**: Base64-encoded QR with
  - Tag 1: Seller Name
  - Tag 2: VAT Number
  - Tag 3: Timestamp (ISO 8601)
  - Tag 4: Total with VAT
  - Tag 5: VAT Amount
  - Tag 6: SHA-256 Hash of XML
  - Tags 7-9: Signature/PublicKey/CSID placeholders (requires ZATCA registration)
- **ZATCA Settings Section** (Settings > ZATCA tab):
  - Enable/Disable Phase 2 toggle
  - Environment selection (Sandbox/Production)
  - CSID credentials for both environments
  - Advanced: Certificate and Private Key (PEM format)
  - Invoice Settings: Auto-submit, Invoice Counter (ICV), OTP
  - Test Connection button (validates credential format)
  - Link to ZATCA Fatoora Portal
  - 6-step Registration Guide
- **API Endpoints**:
  - `GET /api/invoices/{id}/zatca-phase2` - Generate Phase 2 XML and QR
  - `POST /api/invoices/{id}/zatca-submit` - Prepare for ZATCA submission
  - `GET/POST /api/settings/zatca` - ZATCA configuration
  - `POST /api/settings/zatca/test` - Test connection
  - `GET /api/settings/zatca/status` - Status summary
- **Backend Service**: `/app/backend/services/zatca_phase2.py`

#### Internationalization (i18n) Expansion
Added 50+ new translation keys across all 4 languages (EN, AR, UR, HI) for:
- CCTV features (cctv_title, live_view, face_recognition, object_detection, people_count, motion_analysis, etc.)
- Partner P&L (partner_pl_title, company_summary, partner_breakdown, profit_share, etc.)
- ZATCA Phase 2 (zatca_phase2, generate_xml, submit_zatca, xml_invoice, qr_code, etc.)
- Scheduled Monitoring (scheduled_monitoring, monitoring_interval, notification_channels, etc.)
- Mobile Navigation (customize_nav, reset_default, select_items, more)

#### UX Refinements
- Mobile bottom navigation customization with 12 options
- Persistent navigation preferences (localStorage)
- Reset to Default functionality

### P1 & P2 Features (COMPLETED)

#### P1: Scheduled AI Monitoring with Notifications
- **Enable/Disable Toggle** - Turn automatic monitoring on/off
- **Monitoring Interval** - Configure 1, 5, 15, or 30 minute intervals
- **Features Selection** - Choose from People Counting, Motion Detection, Object Detection
- **Notification Channels** - In-App, WhatsApp, Email alerts for motion/security events
- **Manual Trigger** - "Run Now" button to execute monitoring immediately
- **Logging** - All monitoring runs logged with timestamps and results

#### P1: Motion Detection Alerts
- Automatic alerts when motion is detected above configured sensitivity
- In-app notifications stored in database
- WhatsApp notifications via Twilio (requires configured credentials)
- Email notifications via SMTP (requires configured credentials)
- Alert severity levels: none, low, medium, high, critical

#### P2: Partner P&L Report (`/partner-pl-report`)
- **Company Summary Cards** - Total Revenue, Cost of Goods, Gross Profit, Operating Expenses, Net Profit
- **Partner Breakdown** - Per-partner ownership %, revenue share, expense share, profit share
- **Period Transactions** - Investments, withdrawals, profit taken per partner
- **Balance Tracking** - Current balance, profit entitlement, available for withdrawal
- **Expense Categories** - Pie chart breakdown of expenses by category
- **Payment Modes** - Bar chart of revenue by payment mode (Cash, Bank, Online, Credit)
- **Export to CSV** - Download report data

#### P2: Mobile Tab Bar Customization
- Customizable bottom navigation for mobile users
- Choose up to 5 items from 12 options (Home, Sales, Expenses, Stock, Reports, Customers, Employees, Branches, Analytics, CCTV, Credits, Settings)
- Persistent across sessions (localStorage)
- Reset to Default button
- "More" button opens customization modal

### AI-Powered CCTV Features (COMPLETED)
- **Face Recognition for Attendance**
  - Register employee faces via image upload
  - AI-powered face matching (>70% confidence auto-logs attendance)
  - View registered faces and daily attendance records
  - Uses GPT-4o Vision via emergentintegrations
  
- **Object Detection for Inventory**
  - Upload camera images to detect and count objects
  - Context selection (Retail, Warehouse, Kitchen, Office, Grocery)
  - Target objects filter (specific items to look for)
  - Stock level analysis (high/medium/low/empty)
  - Auto-creates alerts for low stock or empty shelves
  
- **AI People Counting**
  - Upload images to count people in frame
  - Crowd density analysis (empty/low/medium/high/very_high)
  - Estimated entries/exits tracking
  - Demographics breakdown (adults, children, groups)
  
- **AI Motion Analysis**
  - Upload camera frames for motion/security analysis
  - Activity type detection (person, vehicle, animal, object)
  - Alert level (none/low/medium/high/critical)
  - Security concern flagging with automatic alert creation
  - Snapshot saving on detected motion

**CCTV Frontend (8 Tabs):**
- Live View - Camera grid with branch filtering
- Analytics - Traffic trends and hourly distribution
- Face Recognition - Register faces, view attendance
- Object Detection - Upload images, detect objects
- People Count - Upload images, count people
- Motion - Upload images, analyze motion
- Alerts - View and acknowledge motion/inventory alerts
- Devices - Manage DVRs and cameras

**AI Backend APIs:**
- `/api/cctv/ai/count-people` - AI people counting
- `/api/cctv/ai/detect-objects` - AI object detection
- `/api/cctv/ai/recognize-face` - AI face recognition
- `/api/cctv/ai/analyze-motion` - AI motion analysis
- `/api/cctv/faces/register` - Register employee face
- `/api/cctv/faces` - List registered faces
- `/api/cctv/attendance` - Face recognition attendance

### CCTV Security Module (Base)
- **Full Hikvision Integration** with Hik-Connect cloud support
- **Settings Page Configuration** - CCTV tab in Settings for all configuration
- **Live Camera Grid View**: 2x2, 3x3, 4x4 layouts with branch filtering
- **DVR/NVR Management**: Add, configure, delete DVRs per branch
- **AI People Counting**: 
  - Configurable counting interval (1, 5, 15, 30 min)
  - Tracks entries/exits per camera
  - Daily visitor statistics with hourly breakdown
- **Motion Detection Alerts**:
  - Configurable sensitivity (Low, Medium, High)
  - Auto-saves snapshots on motion detection
  - Alert acknowledgment system
- **Analytics Dashboard**: Daily traffic trends, hourly distribution, peak hours
- **Face Recognition** (placeholder for future AI integration)
- **Recording Playback** support for local DVRs via RTSP

**Settings Page (CCTV Tab):**
- Hik-Connect Cloud Configuration (email/password)
- DVR/NVR Configuration (add Cloud or Local IP DVRs)
- AI Features Configuration (People Counting, Motion Alerts)
- Help guide for finding DVR serial numbers

**Backend APIs:**
- `/api/cctv/hik-connect/auth` - Hik-Connect authentication
- `/api/cctv/settings` - AI features settings
- `/api/cctv/dvrs` - DVR CRUD operations
- `/api/cctv/cameras` - Camera management
- `/api/cctv/stream/{camera_id}` - Get stream URL
- `/api/cctv/snapshot/{camera_id}` - Get camera snapshot
- `/api/cctv/people-count` - People counting data
- `/api/cctv/process-frame` - AI frame processing
- `/api/cctv/detect-motion` - Motion detection processing
- `/api/cctv/alerts` - Motion alerts
- `/api/cctv/analytics` - CCTV analytics

**Frontend:**
- `/cctv` - CCTV Security page with Live View, Analytics, Alerts, Devices tabs
- `/settings` → CCTV tab - Full configuration interface

### Translation & UX Improvements
- **Full i18n Translation Coverage** for:
  - Shift Report page (all labels, card titles, table headers)
  - Bulk Salary Payment dialog (all labels, buttons, status messages)
  - Dashboard widget customization (widget names and descriptions)
  - Expense categories (main and sub-categories)
  - Common UI elements (loading, status, actions)
- **4-Language Support**: English (EN), Arabic (AR), Urdu (UR), Hindi (HI)
- **RTL Support**: Proper right-to-left layout for Arabic and Urdu
- **Loading Skeleton**: Added animated loading skeletons for ShiftReportPage
- **Mobile Responsiveness**: Verified and working on all new pages

### 4-Part Feature Enhancement (Feb 28, 2026)
1. **Daily Shift Report** (`/shift-report`)
   - Daily & date range views with summary cards
   - Payment breakdown pie chart, branch sales bar chart
   - Shift details table with all cash amounts
   - Backend endpoints: `/api/cashier/shift-report`, `/api/cashier/shift-report/range`

2. **Full Dashboard Widget Customization**
   - 8 toggleable widgets with descriptions
   - Show All/Minimize quick actions
   - Backend persistence via `/api/dashboard/layout`

3. **Bulk Salary Payment UI** (Employees page)
   - One-click salary for all/selected employees
   - Preview with to-pay/already-paid counts
   - Auto-creates expense records and notifications

4. **General API Improvements**
   - Dashboard layout preferences API
   - Shift report aggregation with branch filtering
   - Bulk salary with duplicate detection

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
- `/api/cashier/shift-report?date=YYYY-MM-DD&branch_id=X` - Daily shift report
- `/api/cashier/shift-report/range?start_date=X&end_date=Y` - Shift report range
- `/api/salary-payments/bulk-preview?period=X` - Preview bulk salary payment
- `/api/salary-payments/bulk` - Execute bulk salary payment
- `/api/dashboard/layout` - Save/load user dashboard preferences
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
- Future enhancements based on user feedback

## File Structure Updates
- `/app/frontend/src/pages/CCTVPage.jsx` - CCTV Security page with 8 AI tabs
- `/app/frontend/src/components/cctv/AIFeatures.jsx` - AI panels (FaceRecognition, ObjectDetection, PeopleCounting, MotionAnalysis)
- `/app/backend/services/ai_vision.py` - AI Vision service using GPT-4o via emergentintegrations
- `/app/backend/routers/cctv.py` - CCTV and AI endpoints
- `/app/frontend/src/pages/ShiftReportPage.jsx` - Shift Report (Feb 28)
- `/app/frontend/src/components/BulkSalaryPayment.jsx` - Bulk Salary (Feb 28)
- `/app/frontend/src/components/CashierShiftModal.jsx` - Shift management
- `/app/frontend/src/pages/MenuItemsPage.jsx` - Menu item management
- `/app/frontend/src/pages/OrderStatusPage.jsx` - Order status display
- `/app/frontend/src/pages/CashierPOSPage.jsx` - POS with shift integration
- `/app/backend/routers/cashier_pos.py` - Image upload endpoints
- `/app/backend/server.py` - Static file serving for /uploads
