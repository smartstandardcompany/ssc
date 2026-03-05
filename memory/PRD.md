# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- Financial Management, HR Management, Stock Management, Restaurant Operations, CCTV Security, Administration

## Latest Session Implementations (Mar 5, 2026)

### Employee Offboarding Enhancement (DONE)
- 3 exit types: Resignation, Termination, End of Contract
- Clearance checklist with 7 toggleable items
- Settlement calculation per Saudi Labor Law (EOS benefits)
- Settlement PDF download
- Complete exit & account deactivation
- Automated email notifications on exit/completion
- Improved UX: visible Exit/Settlement/Review buttons with labels

### AI-Powered Business Insights (DONE)
- Dashboard widget with 3 insight categories (Business Health, Stock Alerts, Sales Trends)
- OpenAI GPT-4.1-mini via Emergent LLM Key
- Endpoints: /api/ai-insights/dashboard, /api/ai-insights/stock, /api/ai-insights/sales-trends
- Stock Reorder page: AI Stock Analysis card
- Sales Forecast page: AI Sales Analysis card

### Performance Optimization (DONE)
- Backend pagination: Cash Transfers, Invoices, Fines, Customers
- All return {data, total, page, limit, pages} format
- Frontend pages updated to handle paginated responses

### Mobile Responsive Improvements (DONE)
- Cash Transfers: Sender/Receiver hidden on md, Notes on lg
- Invoices: Date on sm, Items/Subtotal/Credit on md, Discount/VAT/Img on lg
- Fines: Department on md, Description on sm, Paid on lg
- Activity Logs: Resource on sm, Details on md, IP on lg

### Bug Fixes (DONE)
- Customer CLV prediction 500 error (KeyError 'id')
- Customers-balance endpoint KeyError fix

## Pending Issues
- SMTP Email Delivery (BLOCKED): User must enable SMTP AUTH in M365 admin for info@smartstandards.co

## Key API Endpoints
- AI: /api/ai-insights/dashboard, /api/ai-insights/stock, /api/ai-insights/sales-trends
- Employee: /api/employees/{id}/resign, /clearance, /settlement, /settlement/pdf, /complete-exit
- Paginated: /api/cash-transfers, /api/invoices, /api/fines, /api/customers, /api/expenses, /api/sales

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234

## 3rd Party Integrations
- OpenAI GPT-4.1-mini (via Emergent LLM Key) - AI business insights
- Twilio - WhatsApp notifications
- httpx - Hikvision DVR integration
- qrcode.react - QR codes on receipts

## Backlog
- LLM-powered deeper analytics (profit prediction per product, customer churn detection)
- Further mobile-responsive improvements
- Email automation (blocked on SMTP AUTH)
