# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system named "SSC Track" for a restaurant business (Smart Standard Company).

## Architecture
- **Frontend**: React (CRA) + Tailwind CSS + shadcn/ui + recharts
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: JWT-based authentication with role-based access control
- **AI**: OpenAI GPT-4o via Emergent LLM Key
- **Notifications**: Twilio (WhatsApp), in-app
- **Email**: aiosmtplib (BLOCKED)

## What's Implemented

### Session 2026-03-11 (Latest)
- **Foodics-Inspired Sidebar** - Light gray bg, collapsible nav groups, clean active states
- **Expenses Filter Bug Fix** - Server-side filtering by branch_id, category, payment_mode
- **Expenses Branch Summary** - Monthly branch-wise expense breakdown card
- **Pagination Improvement** - Numbered page buttons on Sales & Expenses
- **Dashboard Compare Toggle** - Day/Week/Month selector with 6 comparison cards
- **Menu Item Scheduling** - Day/time availability with Hide/Disable POS behavior
- **POS Schedule Awareness** - Items hidden or greyed out based on schedule
- **Cashier POS UI Overhaul** - Foodics-style: borderless cards, pill tabs, clean header
- **Menu Items Page UI Overhaul** - Foodics-style: white filter card, borderless item cards
- **POS Dynamic Categories** - Auto-includes custom categories from DB + menu_items.distinct()
- **SizesEditor Redesign** - Branch-specific pricing: checkboxes per branch with custom SAR price inputs under each size
- **Printer Management** - Full CRUD for printers (receipt/kitchen/label) with IP, port, paper width, default/auto-print settings, test connection

### Previous Sessions
- Full CRUD for all modules (Sales, Expenses, Inventory, Suppliers, etc.)
- Role-based access control, multi-branch support
- Advanced Menu Management V2 (add-on library, modifier groups)
- Menu/Peak Hours Analytics, AI Staffing, Staff Performance, AI Duty Planner
- Multi-Channel Notifications + Preferences

## Key API Endpoints
- `/api/dashboard/period-compare?period=day|week|month`
- `/api/expenses?branch_id=&category=&payment_mode=`
- `/api/cashier/categories` - Auto-includes custom categories
- `/api/cashier/printers` - Full CRUD for printer management
- `/api/cashier/printers/{id}/test` - Test printer connection
- `/api/analytics/menu`, `/api/analytics/addons`, `/api/analytics/peak-hours`

## 3rd Party Integrations
- **OpenAI GPT-4o**: Via Emergent LLM Key
- **Twilio**: WhatsApp notifications
- **aiosmtplib**: SMTP (BLOCKED)

## Known Issues
- SMTP Email: BLOCKED - user needs to disable Security Defaults in M365/Azure AD

## Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked on SMTP)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
