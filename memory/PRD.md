# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts (Radar/Pie/Bar/Area), react-grid-layout, date-fns
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision)

## Latest Updates (Mar 1, 2026)

### Customer-Facing Order Display (COMPLETED)
- Dark theme with orange gradient header and live clock (HH:MM:SS)
- Status summary bar showing Preparing/Ready counts
- Order cards with progress bars and estimated wait time
- Delayed order highlighting (>15min turns red with flame icon)
- Ready orders glow animation effect
- Table number badges for dine-in orders
- Mobile-responsive (stacks columns on small screens)
- "No Active Orders" empty state
- Live indicator in footer with auto-refresh every 3s

### Advanced Export Options (COMPLETED)
- New export types: **Loans**, **Attendance**, **Leaves** (Excel + PDF)
- Reusable `ExportButton` component (`/app/frontend/src/components/ExportButton.jsx`)
- Export dialogs with Excel/PDF format selection
- Added to: Employees page, Loans page, Leave Approvals page
- Backend: POST `/api/export/data` with `{type, format}`

### Mobile POS/Waiter Optimizations (COMPLETED)
- **Cashier POS**: Slide-in cart overlay on mobile, floating orange cart bar at bottom, responsive 2-col menu grid, hidden stats on small screens
- **Waiter Mode**: Same mobile cart pattern, responsive menu grid, mobile-friendly header
- Both pages: Cart panel hidden on desktop sidebar, shown as full-height overlay on mobile with close button

### All Completed Features
- Employee Self-Service Portal (profile, financials, leave balance bars, loans, letters, edit profile)
- HR Analytics (Radar, Pie, Bar, Area charts for department/salary/leave/loan analysis)
- Leave Calendar View (monthly grid with colored entries)
- Bank Reconciliation (diff %, pie chart, batch verify, CSV export)
- Dark Mode across all pages
- Loan Management (CRUD, installments, self-service)
- Separate Waiter & Cashier Portals (pos_role, role enforcement)
- Table Management (20 tables, 5 sections, visual designer)
- KDS with Table Banners, Keyboard Shortcuts
- AI CCTV, ZATCA Phase 2, i18n (EN/AR/UR/HI)
- Full core ERP: Sales, Expenses, Customers, Suppliers, Employees, Stock, Invoicing

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Backlog / Future Tasks
- More predictive analytics models
- Additional report customization options
- Push notifications for mobile users
