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
7. Stock entries & usage pagination
8. QR Code on receipts - CashierPOS receipt shows QR linking to /track-order
9. Auto-track from URL - /track-order?id=ORDER_ID auto-searches
10. **Employee Offboarding Enhancement (DONE):**
    - 3 exit types: Resignation, Termination, End of Contract
    - Clearance checklist with toggleable checkboxes (7 items)
    - Settlement calculation per Saudi Labor Law (EOS benefits)
    - Settlement PDF download
    - Complete exit & account deactivation

## Pending Issues
- SMTP Email Delivery (BLOCKED): User must enable SMTP AUTH in M365 admin for info@smartstandards.co

## Key API Endpoints
### Offboarding
- POST /api/employees/{id}/resign - Mark employee for exit (3 types)
- PUT /api/employees/{id}/clearance - Update clearance checklist items
- GET /api/employees/{id}/settlement - Get settlement calculation
- GET /api/employees/{id}/settlement/pdf - Download settlement PDF
- POST /api/employees/{id}/complete-exit - Finalize exit & deactivate

### Paginated Endpoints
- GET /api/sales?page=1&limit=100
- GET /api/supplier-payments?page=1&limit=100
- GET /api/expenses?page=1&limit=100
- GET /api/stock/entries?page=1&limit=100
- GET /api/stock/usage?page=1&limit=100

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234

## Upcoming Tasks (P1)
- AI-driven analytics: stock reordering suggestions, sales forecasting

## Backlog (P2)
- Performance optimization for remaining large-data pages
- Mobile-responsive improvements for remaining pages
