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
/app/backend/ - FastAPI with 21+ modular routers (including tables)
/app/frontend/ - React SPA with 42+ pages
```

## Recent Updates (Feb 28, 2026)

### Table Management Enhancements (COMPLETED - Latest)

#### 1. KDS Table Number Banners
- Large orange `TABLE XX` banner at top of each dine-in order card
- Armchair icon + bold white text, highly visible for kitchen staff
- "Dine In" badge alongside table number
- Only shows for orders with `order_type=dine_in` and `table_number` set

#### 2. Customer-Facing Order Status with Table Info
- `/order-status` page now shows table number badges on orders
- Orange badge with Armchair icon: "Table T1", "Table V2", etc.
- Both "Preparing" and "Ready" columns show table info
- Backend endpoint `GET /api/order-status/active` now returns `table_number` and `table_id`

#### 3. Expanded Restaurant Layout (20 Tables, 5 Sections)
- **Main Hall** (orange): T1-T8, 4 seats each
- **VIP Room** (purple): V1-V3, 6 seats each
- **Outdoor** (green): O1-O4, 2-4 seats each
- **Balcony** (teal): B1-B3, 2 seats each (2nd floor)
- **Private Dining** (pink): P1-P2, 10-12 seats each
- Total capacity: 89 seats across 20 tables

### Table Management & Waiter Ordering System (COMPLETED)

#### Backend (/app/backend/routers/tables.py)
- Table Sections CRUD, Tables CRUD with status management
- Waiter Management with PIN-based login
- Full table order flow: start-order → add-items → close-order → mark-available
- Table Statistics API

#### Frontend
- **Table Management Page** (`/table-management`): Admin page with stats, section tabs, grid layout
- **Waiter Mode** (`/waiter`): PIN login, table selection, menu ordering, kitchen integration, payment

### Previously Completed Features
- AI-Powered CCTV Suite (Face Recognition, Object Detection, People Counting, Motion Analysis)
- Scheduled Monitoring & Alerts
- ZATCA Phase 2 Compliance with Settings & CSID Expiry Alerts
- Partner P&L Report
- Mobile Nav Customization
- Admin Seeding Script for new deployments
- Full i18n (EN, AR, UR, HI)
- Restaurant POS, KDS, Order Status Display, Cashier Shift Management
- Analytics Dashboard, Predictive Analytics, AI Forecasting
- Full CRUD for Sales, Expenses, Customers, Suppliers, Employees, Branches
- Stock Management, Bank Reconciliation, Cash Transfers
- Dark Mode, Keyboard Shortcuts, Multi-Language Support

## Key API Endpoints (Table Management)
- `GET/POST /api/tables/sections` - Section CRUD
- `GET/POST/PUT/DELETE /api/tables` - Table CRUD
- `POST /api/tables/{id}/status` - Status update
- `POST /api/tables/{id}/start-order` - Start order
- `POST /api/tables/{id}/add-items` - Add items to order
- `POST /api/tables/{id}/close-order` - Close/pay order
- `POST /api/tables/{id}/mark-available` - Mark available
- `GET /api/tables/stats` - Statistics
- `GET /api/order-status/active` - Public order status (now with table_number)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Backlog / Future Tasks
- HR: Leave Tracking, Loan Management, Employee Self-Service Portal
- Bank Reconciliation: Statement Analyzer, Manual side-by-side reconciliation tool
- UI/UX: Dark Mode improvements, additional Keyboard Shortcuts
