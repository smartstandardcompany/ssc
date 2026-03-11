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
1. **Dashboard** - Business overview with branch-wise KPIs, AI insights
2. **Sales Management** - Branch/online sales tracking, credit management, payment modes
3. **Expenses Management** - Category-based tracking, recurring expenses, refunds, branch summary
4. **Inventory/Stock** - Item tracking, AI reorder, stock transfers
5. **POS System** - Quick entry, cashier mode, waiter mode, kitchen display
6. **HR/People** - Employees, loans, leave approvals, scheduling, staff performance
7. **Menu Management** - V2 with add-on library, modifier groups, branch availability
8. **Analytics** - Menu analytics, peak hours, advanced analytics, visualizations
9. **Reports** - P&L, category reports, credit reports, trend comparison, export center
10. **Assets** - Branches, CCTV, documents, fines, partners
11. **Notifications** - Multi-channel (in-app, WhatsApp), preferences management

## What's Implemented (Complete)
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
- **[2026-03-11] Foodics-Inspired Sidebar UI** - Redesigned sidebar with light gray background (#f8f9fa), collapsible nav groups, cleaner active states
- **[2026-03-11] Expenses Filter Bug Fix** - Backend /api/expenses now supports server-side filtering by branch_id, category, payment_mode
- **[2026-03-11] Expenses Branch Summary** - Monthly branch-wise expense breakdown card at top of Expenses page (matching Sales page)
- **[2026-03-11] Pagination Improvement** - Numbered page buttons on both Sales and Expenses pages

## Key Technical Details
- MongoDB aggregation pipelines for analytics
- AI prompt engineering for schedules and duty plans
- Modular router architecture (each feature in its own router file)
- Zustand for state management (auth, UI, branches)
- Multi-language support (EN, AR, UR, HI)

## 3rd Party Integrations
- **OpenAI GPT-4o**: Via Emergent LLM Key - AI insights, scheduling, duty planning
- **Twilio**: WhatsApp notifications (requires user API key)
- **aiosmtplib**: SMTP email (BLOCKED - user M365 config needed)
- **recharts**: Charts and visualizations
- **lucide-react**: Icons

## Known Issues
- SMTP Email: BLOCKED - user needs to disable Security Defaults in M365/Azure AD
- Task reminder scheduler shows minor warning about NoneType (non-critical)

## Backlog
- P2: Email automation (blocked on SMTP)
- P3: Scheduled PDF report delivery (blocked on SMTP)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
