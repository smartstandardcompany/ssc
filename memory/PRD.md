# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- Financial Management, HR Management, Stock Management, Restaurant Operations, CCTV Security, Administration

## Session Implementations (Mar 2026)
1. Employee Portal - Salary Record tab
2. CCTV Live View + Remote DVR + TV Setup Guide
3. Menu Management (multi-branch + platform assignment + export)
4. Online Platforms sales bug fix
5. Customer Order Tracking (public /track-order page)
6. Supplier Payments pagination + mobile responsive
7. **Stock entries & usage pagination** - supports page/limit params
8. **QR Code on receipts** - CashierPOS receipt shows QR linking to /track-order
9. **Auto-track from URL** - /track-order?id=ORDER_ID auto-searches (QR scan support)

## Pending Issues
- SMTP Email Delivery (BLOCKED): User must enable SMTP AUTH in M365 admin

## All Paginated Endpoints
- GET /api/sales?page=1&limit=100
- GET /api/supplier-payments?page=1&limit=100&supplier_id=&start_date=&end_date=
- GET /api/expenses?page=1&limit=100
- GET /api/stock/entries?page=1&limit=100
- GET /api/stock/usage?page=1&limit=100

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
