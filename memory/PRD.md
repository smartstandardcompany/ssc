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
8. QR Code on receipts
9. **Employee Offboarding Enhancement (DONE):**
    - 3 exit types: Resignation, Termination, End of Contract
    - Clearance checklist with toggleable checkboxes (7 items)
    - Settlement calculation per Saudi Labor Law
    - Settlement PDF download
    - Complete exit & account deactivation
    - Automated email notifications on exit initiation and completion
10. **Employee Offboarding UX Fix (DONE):**
    - Exit button now has visible label + orange border for active employees
    - Settlement button (blue) for resigned/terminated employees
    - Review button for 'left' employees to view settlement history
    - Mobile card view includes all exit buttons
11. **Customer CLV Bug Fix (DONE):**
    - Fixed KeyError 'id' in customer CLV prediction endpoint
12. **Backend Pagination (DONE):**
    - Cash Transfers: GET /api/cash-transfers now returns {data, total, page, limit, pages}
    - Invoices: GET /api/invoices now returns paginated format
    - Fines: GET /api/fines now returns paginated format
13. **Mobile Responsive Tables (DONE):**
    - Cash Transfers: Sender/Receiver hidden on md, Notes on lg, Mode on sm
    - Invoices: Date on sm, Items/Subtotal/Credit on md, Discount/VAT/Img on lg
    - Fines: Department on md, Description on sm, Paid on lg

## Pending Issues
- SMTP Email Delivery (BLOCKED): User must enable SMTP AUTH in M365 admin for info@smartstandards.co

## Key API Endpoints
- POST /api/employees/{id}/resign
- PUT /api/employees/{id}/clearance
- GET /api/employees/{id}/settlement
- GET /api/employees/{id}/settlement/pdf
- POST /api/employees/{id}/complete-exit
- GET /api/predictions/customer-clv (FIXED)
- GET /api/cash-transfers?page=1&limit=100 (PAGINATED)
- GET /api/invoices?page=1&limit=100 (PAGINATED)
- GET /api/fines?page=1&limit=100 (PAGINATED)
- GET /api/reports/stock-reorder (AI stock reorder predictions)
- GET /api/predictions/sales-forecast (AI sales forecasting)

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234

## Existing AI Analytics
- Stock Reorder Suggestions: /stock-reorder page (uses statistical model)
- Sales Forecast: /sales-forecast page (uses statistical model)
- Customer CLV: /api/predictions/customer-clv (fixed)
- Revenue Trends: /api/reports/revenue-trends

## Upcoming Tasks (P1)
- AI-driven analytics enhancements (LLM-powered insights)

## Backlog (P2)
- Further mobile-responsive design improvements for remaining pages
- Continued performance optimization
