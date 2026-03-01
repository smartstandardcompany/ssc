# SSC Track - Product Requirements Document

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for Smart Standard Company.

## Tech Stack
- **Backend:** FastAPI, Motor (async MongoDB), JWT auth, APScheduler
- **Frontend:** React, TailwindCSS, Shadcn UI, Recharts (Radar, Pie, Bar, Area, Line), react-grid-layout, date-fns
- **Database:** MongoDB
- **AI:** emergentintegrations (GPT-4o Vision)
- **Other:** Twilio (WhatsApp), qrcode (ZATCA)

## Latest Updates (Mar 1, 2026)

### Employee Self-Service Portal Enhancements (COMPLETED)
- **Profile Card**: Employee photo placeholder, name, position, phone, email, branch with Edit Info dialog
- **Financial Summary Card**: Current salary, due balance, loan balance, active loan count
- **Leave Balance Card**: Visual progress bars for Annual/Sick leave (used/total), ticket balance
- **Pending Payments Alert**: Highlighted card for unconfirmed salary payments
- **6 Tabs**: Attendance (table with hours calc), Payments (with payslip PDF), Leaves (with apply), Loans (with progress bars), Requests (with new request form), Letters (4 letter types with PDF generation)
- **Edit Profile Dialog**: Phone and email self-update
- Full dark mode support

### Mobile Responsiveness (COMPLETED)
- Tables wrapped in overflow-x-auto for horizontal scrolling
- Period/Payslip columns hidden on mobile (hidden sm:table-cell)
- Grid layouts stack to single column on mobile
- Tabs scrollable horizontally on small screens
- Responsive font sizes and spacing

### Advanced HR Analytics Reporting (COMPLETED)
- New **HR Analytics** tab in Reports page
- **6 Stats Cards**: Employees, Monthly Payroll, Avg Salary, Active Loans, Outstanding, Total Leaves
- **Department Distribution** - Pie chart
- **Salary Distribution** - Bar chart (0-2K, 2K-4K, 4K-6K, 6K-8K, 8K+ buckets)
- **Department Radar** - Radar chart showing headcount, leaves, loans per department
- **Leave by Type** - Donut chart (Annual, Sick, Unpaid, Personal, Emergency)
- **Loan Breakdown** - Horizontal bar chart by loan type
- **Monthly Leave Trend** - Area chart

### Previously Completed
- Leave Calendar View (visual monthly calendar with colored leave entries)
- Bank Reconciliation (diff %, pie chart, batch verify, CSV export)
- Dark Mode Polish across all newer pages
- Loan Management System (CRUD, installments, self-service)
- Separate Waiter & Cashier Portals (pos_role, role enforcement)
- Table Management & Waiter Ordering System (20 tables, 5 sections)
- KDS Table Banners, Order Status Table Info
- AI-Powered CCTV, ZATCA Phase 2, Partner P&L
- Restaurant POS, KDS, Order Status, Cashier Shifts
- All core CRUD modules, Analytics, Forecasting, Stock, Bank, Transfers
- Multi-language (EN, AR, UR, HI), Keyboard Shortcuts

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123
- Cashier/Waiter/Kitchen PIN: 1234

## Backlog / Future Tasks
- Customer-facing display improvements
- Advanced export options across all modules
- Additional mobile optimizations for POS/Waiter pages
- More predictive analytics models
