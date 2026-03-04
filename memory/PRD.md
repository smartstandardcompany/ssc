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
- **CCTV Security:** Hikvision DVR integration, Live View with snapshot display, AI-powered analytics, Setup Guide with TV display options
- **Administration:** RBAC, Branding, Dark mode, Multi-language, PWA, Guided tours

## What's Been Implemented (Latest Session - Mar 2026)
1. **Employee Portal - Salary Record tab:** Month-by-month salary payment history with period, salary, paid amount, extras, deductions, net received, status, payment date, mode
2. **CCTV Live View Fix:** Replaced placeholder with actual camera snapshot display from Hikvision DVRs via ISAPI (Digest+Basic auth), auto-refresh every 3s, Pause/Play controls, fullscreen view
3. **CCTV Setup Guide:** New tab with 4 TV display options (HDMI, Web App, Hik-Connect, iVMS-4200), DVR web setup guide, troubleshooting section, RTSP URL reference
4. **DVR Configuration Improved:** Added HTTP Port and RTSP Port fields, improved device info with RTSP URL display

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
- **Backend:** FastAPI, Motor (MongoDB), httpx, aiosmtplib, reportlab
- **Database:** MongoDB
- **3rd Party:** OpenAI Vision (Emergent Key), Twilio (WhatsApp), Hikvision ISAPI

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
