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

### Table Management & Waiter Ordering System (COMPLETED - Latest)

#### Backend (/app/backend/routers/tables.py)
- **Table Sections:** CRUD for sections (Main Hall, Outdoor, VIP Room, etc.) with colors and floor assignment
- **Tables:** CRUD with table_number, section, capacity, shape (square/round/rectangle), status (available/occupied/reserved/cleaning)
- **Table Status Management:** Status transitions with order linking
- **Waiter Management:** PIN-based waiter login (reuses cashier PIN system), waiter-table assignment
- **Table Order Flow:**
  - `POST /api/tables/{id}/start-order` - Creates order, marks table occupied
  - `POST /api/tables/{id}/add-items` - Adds items to order, sends to kitchen queue
  - `POST /api/tables/{id}/close-order` - Processes payment, creates sale record, sets table to cleaning
  - `POST /api/tables/{id}/mark-available` - Marks table available after cleaning
- **Table Stats:** Real-time occupancy rate, customer count, availability

#### Frontend - Table Management Page (/app/frontend/src/pages/TableManagementPage.jsx)
- Admin page at `/table-management` in the sidebar under "Stock"
- Stats cards: Total, Available, Occupied, Reserved, Cleaning, Customers, Occupancy %
- Section tabs with color coding and delete option
- Table grid with status color coding (green=available, red=occupied, amber=reserved, blue=cleaning)
- Add/Edit table dialog: table number, section, capacity, shape
- Add section dialog: name, color picker, floor number
- Status legend at bottom

#### Frontend - Waiter Mode (/app/frontend/src/pages/WaiterPage.jsx)
- Standalone page at `/waiter` (no sidebar, optimized for tablets)
- **PIN Login:** 4-digit PIN keypad, same auth as cashier system
- **Tables View:** Floor plan grid showing all tables, section tabs, auto-refresh every 10s, status colors
  - Tap available table → start new order
  - Tap occupied table → resume existing order
  - Tap cleaning table → mark available
- **Order View:** Full POS-style interface
  - Left panel: Menu with category tabs, search, item cards
  - Right panel: Cart with existing items (greyed/sent) and new items
  - Modifiers dialog for items with options
  - "Send to Kitchen" button - sends new items only
  - "Pay" button - opens payment dialog (Cash/Bank/Credit)
  - VAT (15%) calculation
  - Back button to return to tables view

**API Endpoints:**
- `GET /api/tables/sections` - List sections
- `POST /api/tables/sections` - Create section
- `DELETE /api/tables/sections/{id}` - Delete section
- `GET /api/tables` - List tables (filterable by section, status, branch)
- `POST /api/tables` - Create table
- `PUT /api/tables/{id}` - Update table
- `DELETE /api/tables/{id}` - Delete table
- `POST /api/tables/{id}/status` - Update table status
- `POST /api/tables/{id}/assign-waiter` - Assign waiter
- `POST /api/tables/{id}/start-order` - Start/resume order
- `POST /api/tables/{id}/add-items` - Add items to order
- `POST /api/tables/{id}/close-order` - Close order with payment
- `POST /api/tables/{id}/mark-available` - Mark available
- `GET /api/tables/stats` - Table statistics
- `GET /api/waiters` - List waiters
- `POST /api/waiters` - Create waiter
- `POST /api/waiters/login` - Waiter PIN login
- `GET /api/waiters/{id}/tables` - Get waiter's tables

### P3 Features (COMPLETED)

#### ZATCA Phase 2 Compliance
- UBL 2.1 XML Generation, 9-Tag TLV QR Code
- ZATCA Settings Section in Settings page
- CSID Expiry Alerts

#### Internationalization (i18n) Expansion
- 50+ translation keys across EN, AR, UR, HI

#### UX Refinements
- Mobile bottom navigation customization
- Persistent navigation preferences

### P1 & P2 Features (COMPLETED)
- Scheduled AI Monitoring with Notifications
- Motion Detection Alerts
- Partner P&L Report
- Mobile Tab Bar Customization

### AI-Powered CCTV Features (COMPLETED)
- Face Recognition, Object Detection, People Counting, Motion Analysis

### Core Features (COMPLETED)
- Full CRUD: Sales, Expenses, Customers, Suppliers, Employees, Branches
- Multi-payment POS, ZATCA invoicing, Invoice OCR
- Role-based access, Employee management
- Analytics Dashboard, AI Sales Forecast, Predictive Analytics Hub
- Restaurant POS, KDS, Order Status Display, Cashier Shift Management
- Stock Management, Bank Reconciliation, Cash Transfers
- Dark Mode, Keyboard Shortcuts, Multi-Language Support

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter PIN: 1234

## Backlog / Future Tasks
- **Restaurant Operations:** Kitchen Display System (KDS) enhancements for table orders, Customer-Facing Display updates with table info
- **HR Management:** Leave Tracking, Loan Management, Employee Self-Service Portal
- **Bank Reconciliation:** Statement Analyzer, Manual side-by-side reconciliation tool
- **UI/UX:** Dark Mode improvements, additional Keyboard Shortcuts

## File Structure Updates
- `/app/backend/routers/tables.py` - Table management router (Feb 28, 2026)
- `/app/frontend/src/pages/TableManagementPage.jsx` - Admin table designer (Feb 28, 2026)
- `/app/frontend/src/pages/WaiterPage.jsx` - Waiter mode (Feb 28, 2026)
