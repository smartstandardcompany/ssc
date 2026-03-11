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
5. POS System - Foodics-style clean UI, cashier mode, waiter mode, kitchen display, schedule-aware items
6. HR/People - Employees, loans, leave approvals, scheduling, staff performance
7. Menu Management - Foodics-style cards, add-on library, modifier groups, branch availability, item scheduling
8. Analytics - Menu analytics, peak hours, advanced analytics, visualizations
9. Reports - P&L, category reports, credit reports, trend comparison, export center
10. Assets - Branches, CCTV, documents, fines, partners
11. Notifications - Multi-channel (in-app, WhatsApp), preferences management

## What's Implemented

### Session 2026-03-11 (Latest)
- **Foodics-Inspired Sidebar** - Light gray bg (#f8f9fa), collapsible nav groups, smooth animations, thin scrollbar
- **Expenses Filter Bug Fix** - Server-side filtering by branch_id, category, payment_mode
- **Expenses Branch Summary** - Monthly branch-wise expense breakdown card
- **Pagination Improvement** - Numbered page buttons on Sales & Expenses
- **Dashboard Compare Toggle** - Day/Week/Month selector with 6 comparison cards (Sales, Expenses, Profit, Transactions, Cash, Bank)
- **Menu Item Scheduling** - Schedule tab with day/time controls, presets, unavailable behavior (Hide/Disable)
- **POS Schedule Awareness** - Items hidden or greyed out based on schedule
- **Cashier POS UI Overhaul** - Foodics-style: borderless cards with shadows, pill category tabs, clean header with stats, polished cart panel, modern payment buttons
- **Menu Items Page UI Overhaul** - Foodics-style: white filter bar card, borderless item cards, rounded pill badges, cleaner edit/delete actions

### Previous Sessions
- Full CRUD for all modules
- Role-based access control
- Multi-branch support
- Advanced Menu Management V2
- Menu Analytics Dashboard + Peak Hours
- AI Staffing Suggestions
- Staff Performance Dashboard + AI Duty Planner
- Multi-Channel Notifications + Preferences

## Key API Endpoints
- `/api/dashboard/period-compare?period=day|week|month` - Period comparison
- `/api/expenses?branch_id=&category=&payment_mode=` - Server-side filtered expenses
- `/api/analytics/menu`, `/api/analytics/addons`, `/api/analytics/peak-hours`
- `/api/staff-performance`, `/api/shifts/staffing-insights`
- `/api/task-reminders/generate-ai-duties`
- `/api/employees/notification-preferences`

## 3rd Party Integrations
- **OpenAI GPT-4o**: Via Emergent LLM Key
- **Twilio**: WhatsApp notifications
- **aiosmtplib**: SMTP email (BLOCKED)
- **recharts**: Charts | **lucide-react**: Icons

## Known Issues
- SMTP Email: BLOCKED - user needs to disable Security Defaults in M365/Azure AD

## Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked on SMTP)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
