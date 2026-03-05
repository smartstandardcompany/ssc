# SSC Track - ERP System PRD

## Original Problem Statement
A comprehensive business management ERP system for tracking sales, expenses, supplier payments, HR operations, restaurant POS, stock management, and more.

## Core Modules
- Financial Management, HR Management, Stock Management, Restaurant Operations, CCTV Security, Administration

## Latest Session Implementations (Mar 2026)
1. Employee Portal - Salary Record tab
2. CCTV Live View Fix + Remote DVR Support + TV Setup Guide
3. Menu Management - Multi-Branch availability + Delivery Platform assignment + Export
4. **Online Platforms Bug Fix:** Sales weren't showing on platform page. Root cause: queries filtered by payment_mode at doc level but POS only set it in payment_details array. Fixed all 7 queries to filter by platform_id only. Also added platform_status to SaleCreate model and fixed POS to set payment_mode at top level.

## Pending Issues
- SMTP Email Delivery (BLOCKED): User must enable SMTP AUTH in M365 admin for info@smartstandards.co

## Upcoming Tasks
- Customer Order Tracking feature
- Performance optimization for large datasets  
- Mobile-responsive design improvements

## Credentials
- Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
- Cashier PIN: 1234
