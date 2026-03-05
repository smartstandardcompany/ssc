# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- **Financial Management:** Sales, Expenses, Supplier Payments, Customer Credit, ZATCA Invoicing, P&L
- **HR Management:** Employee DB, Salary Payments, Leave, Loans, Employee Portal with Salary History
- **Stock Management:** Inventory, Stock-in/out, Multi-branch transfers, Low-stock alerts
- **Restaurant Operations:** POS, KDS, Order Status, Table Management, Menu Management (multi-branch + platform)
- **CCTV Security:** Hikvision DVR (Local/Remote/Cloud), Live View, AI Analytics, Setup Guide
- **Administration:** RBAC, Branding, Dark mode, Multi-language, PWA

## Latest Session Implementations (Mar 2026)
1. **Employee Portal - Salary Record tab:** Month-by-month salary payment history
2. **CCTV Live View Fix:** Actual camera snapshots via Hikvision ISAPI with auto-refresh
3. **CCTV Remote DVR Support:** 3 connection types + port forwarding guide + TV display guide
4. **Menu Management - Multi-Branch:** Items can be assigned to specific branches or all branches
5. **Menu Management - Platform Integration:** Assign items to HungerStation, Keeta, Jahez, etc. with custom platform prices
6. **Bulk Operations:** Select multiple items and assign branches/platforms in bulk
7. **Platform Menu Export:** Export menu items for each delivery platform as downloadable file

## Pending Issues
- **SMTP Email Delivery (BLOCKED):** User must enable SMTP AUTH in M365 admin for info@smartstandards.co

## Upcoming Tasks
- Customer Order Tracking feature
- Performance optimization for large datasets
- Mobile-responsive design improvements

## Tech Stack
- Frontend: React, Zustand, Shadcn/UI, react-select
- Backend: FastAPI, Motor (MongoDB), httpx, aiosmtplib
- Database: MongoDB
- 3rd Party: OpenAI Vision (Emergent Key), Twilio, Hikvision ISAPI

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
