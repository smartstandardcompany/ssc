# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- Financial Management, HR Management, Stock Management, Restaurant Operations, CCTV Security, Administration

## Latest Session (Mar 5, 2026) - All Implementations

### Employee Offboarding (DONE)
- 3 exit types, clearance checklist, settlement PDF, email notifications
- Visible Exit/Settlement/Review buttons

### AI-Powered Business Insights (DONE)
- **Dashboard Widget:** Business Health, Stock Alerts, Sales Trends
- **Stock Reorder Page:** AI Stock Analysis card
- **Sales Forecast Page:** AI Sales Analysis card
- **Analytics Hub - 3 New AI Tabs:**
  - AI Profit: Product profitability analysis with revenue/profit/margin table
  - AI Churn: Customer churn detection with status breakdown (Active/Cooling/At Risk/Churned)
  - AI Revenue: 12-week revenue prediction with bar chart
- All using OpenAI GPT-4.1-mini via Emergent LLM Key

### Performance & Mobile Responsive (DONE)
- Backend pagination: Cash Transfers, Invoices, Fines, Customers
- Mobile responsive: CashTransfers, Invoices, Fines, Activity Logs, Documents
- Customer CLV & customers-balance bug fixes

## AI Insight Endpoints
- GET /api/ai-insights/dashboard
- GET /api/ai-insights/stock
- GET /api/ai-insights/sales-trends
- GET /api/ai-insights/profit-analysis
- GET /api/ai-insights/customer-churn
- GET /api/ai-insights/revenue-prediction

## Pending Issues
- SMTP Email Delivery (BLOCKED): User must enable SMTP AUTH in M365

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest

## Backlog
- SMTP email automation (blocked on user action)
- Additional mobile responsive improvements for LoansPage, LeaveApprovalsPage, SchedulePage
