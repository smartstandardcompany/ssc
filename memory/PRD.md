# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for a restaurant business (Smart Standard Company). Started as a simple data entry app and evolved into a full-featured restaurant operations platform.

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + shadcn/ui + recharts
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: JWT-based authentication with role-based access control
- **AI**: OpenAI GPT-4o via Emergent LLM Key for insights, scheduling, duty planning
- **Notifications**: Twilio (WhatsApp), in-app notifications
- **Email**: aiosmtplib (BLOCKED - user needs to fix M365 Security Defaults)

## Core Modules
1. Dashboard - Business overview with branch-wise KPIs, AI insights, period comparison
2. Sales Management - Branch/online sales tracking, credit management, payment modes
3. Expenses Management - Category-based tracking, recurring expenses, refunds, branch summary
4. Inventory/Stock - Item tracking, AI reorder, stock transfers
5. POS System - Quick entry, cashier mode, waiter mode, kitchen display, schedule-aware items
6. HR/People - Employees, loans, leave approvals, scheduling, staff performance
7. Menu Management - V2 with add-on library, modifier groups, branch availability, item scheduling
8. Analytics - Menu analytics, peak hours, advanced analytics, visualizations
9. Reports - P&L, category reports, credit reports, trend comparison, export center
10. Assets - Branches, CCTV, documents, fines, partners
11. Notifications - Multi-channel (in-app, WhatsApp), preferences management

## What's Implemented

### Latest Session (2026-03-11)
- **Foodics-Inspired Sidebar UI** - Redesigned sidebar with light gray background (#f8f9fa), collapsible nav groups, cleaner active states, thin scrollbar
- **Expenses Filter Bug Fix** - Backend /api/expenses supports server-side filtering by branch_id, category, payment_mode
- **Expenses Branch Summary** - Monthly branch-wise expense breakdown card at top of Expenses page
- **Pagination Improvement** - Numbered page buttons on both Sales and Expenses pages
- **Dashboard Compare Toggle** - Foodics-style Day/Week/Month period selector with Compare switch. Shows 6 comparison cards (Sales, Expenses, Profit, Transactions, Cash, Bank) with current vs previous period values and percentage changes
- **Menu Item Scheduling** - New Schedule tab in menu item editor: available days (Sun-Sat), time windows (start/end time), quick presets (All Day, Lunch, Dinner, Weekdays, Weekends), and unavailable behavior (Hide or Disable in POS)
- **POS Schedule Awareness** - CashierPOS respects item schedules: hides or greys out items based on schedule settings

### Previous Sessions
- Full CRUD for all modules (Sales, Expenses, Inventory, Suppliers, etc.)
- Role-based access control (admin, manager, operator, employee roles)
- Multi-branch support with branch-level permissions
- Advanced Menu Management V2 (central add-on library, modifier groups)
- Menu Analytics Dashboard (item sales, revenue by category, add-on usage)
- Peak Hours Analysis (order/revenue by hour and day)
- AI Staffing Suggestions (demand vs. coverage, smart recommendations)
- Staff Performance Dashboard (attendance, punctuality, performance tiers)
- AI Duty Planner (role-based task generation and assignment)
- Multi-Channel Notifications (WhatsApp + in-app)
- Notification Preferences page

## Key API Endpoints
- `/api/dashboard/period-compare?period=day|week|month` - Period comparison data
- `/api/dashboard/stats` - Dashboard statistics
- `/api/expenses?branch_id=&category=&payment_mode=` - Server-side filtered expenses
- `/api/analytics/menu`, `/api/analytics/addons`, `/api/analytics/peak-hours` - Analytics
- `/api/staff-performance` - Staff performance dashboard
- `/api/shifts/staffing-insights` - Staffing coverage analysis
- `/api/task-reminders/generate-ai-duties` - AI duty planning
- `/api/employees/notification-preferences` - Notification settings

## 3rd Party Integrations
- **OpenAI GPT-4o**: Via Emergent LLM Key
- **Twilio**: WhatsApp notifications (requires user API key)
- **aiosmtplib**: SMTP email (BLOCKED)
- **recharts**: Charts and visualizations
- **lucide-react**: Icons

## Known Issues
- SMTP Email: BLOCKED - user needs to disable Security Defaults in M365/Azure AD

## Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked on SMTP)
- Continue Foodics-style UI improvements for Cashier POS and other pages

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
