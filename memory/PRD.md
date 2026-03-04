# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- **Financial Management:** Sales, Expenses, Supplier Payments, Customer Credit, ZATCA Invoicing, P&L Reporting, Online Platform Sales, Supplier Aging Reports
- **HR Management:** Employee DB, Salary Payments, Leave Tracking, Loan Management, Employee Self-Service Portal with Salary History
- **Staff Management:** Shift Scheduling, Cashier shift management
- **Stock Management:** Inventory, Stock-in/out, Multi-branch transfers, Low-stock alerts
- **Restaurant Operations:** POS, KDS, Order Status Display, Table Management, Reservations
- **Asset & Liability Tracking:** Assets, Liabilities, Document management with expiry alerts
- **Reporting & Analytics:** Dashboards, Reports, Scheduled PDF delivery, AI predictions
- **Administration:** RBAC, Branding, Dark mode, Multi-language, PWA, Guided tours

## What's Been Implemented (Complete)
- All core financial, HR, stock, restaurant, and admin modules
- Role-based access control with operator restrictions
- PWA support with corrected service worker
- Zustand state management migration (all pages)
- SearchableSelect component for long dropdowns
- Employee email sync to user accounts
- Password hashing security fix
- Supplier/expense returns and refunds
- Purchase bill image uploads
- Scheduled PDF reports (email delivery blocked by M365 SMTP AUTH)
- End-of-service benefits calculation (Saudi labor law)
- Email sending to employees (blocked by M365 SMTP AUTH)
- **Employee Portal - Salary Record tab** (Feb 2026): Month-by-month salary payment history showing period, salary, paid amount, extras, deductions, net received, status (paid/partial/unpaid), payment date, and mode

## Pending Issues
- **SMTP Email Delivery (BLOCKED):** User must enable SMTP AUTH in M365 admin for info@smartstandards.co

## Upcoming Tasks (P0)
- None currently queued

## Future/Backlog Tasks (P1-P2)
- Customer Order Tracking feature
- Performance optimization for large datasets
- Mobile-responsive design improvements for remaining admin pages

## Tech Stack
- **Frontend:** React, Zustand, Shadcn/UI, react-select, react-window
- **Backend:** FastAPI, Motor (MongoDB), aiosmtplib, reportlab
- **Database:** MongoDB
- **3rd Party:** OpenAI Vision (Emergent Key), Twilio (WhatsApp)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
