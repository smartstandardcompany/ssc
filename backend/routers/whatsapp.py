from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone, timedelta
from io import BytesIO
import uuid
import os
import re
import pandas as pd
from twilio.rest import Client

from database import db, get_current_user
from models import User

router = APIRouter()

# Helper: send email notification
async def send_email_notification(subject: str, body_text: str, to_email: str = None):
    import aiosmtplib
    from email.mime.text import MIMEText
    settings = await db.email_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("smtp_host") or not settings.get("password"):
        return False
    try:
        recipient = to_email or settings.get("from_email", settings["username"])
        msg = MIMEText(body_text)
        msg["Subject"] = subject
        msg["From"] = settings.get("from_email", settings["username"])
        msg["To"] = recipient
        await aiosmtplib.send(msg, hostname=settings["smtp_host"], port=settings["smtp_port"],
                              username=settings["username"], password=settings["password"],
                              use_tls=settings.get("use_tls", True))
        return True
    except:
        return False

# Helper: send WhatsApp message
async def send_whatsapp_message(message: str):
    config = await db.whatsapp_config.find_one({}, {"_id": 0})
    if not config or not config.get("account_sid") or not config.get("auth_token"):
        return False, "WhatsApp not configured"
    try:
        client_tw = Client(config["account_sid"], config["auth_token"])
        recipients = [r.strip() for r in config.get("recipient_number", "").split(",") if r.strip()]
        sent = 0
        for recipient in recipients:
            try:
                client_tw.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=message, to=f'whatsapp:{recipient}')
                sent += 1
            except: pass
        return sent > 0, f"Sent to {sent}/{len(recipients)} recipients"
    except Exception as e:
        return False, str(e)

# Test WhatsApp
@router.post("/settings/whatsapp/test")
async def test_whatsapp(current_user: User = Depends(get_current_user)):
    config = await db.whatsapp_config.find_one({}, {"_id": 0})
    if not config or not config.get("account_sid") or not config.get("auth_token"):
        raise HTTPException(status_code=400, detail="WhatsApp not configured")
    try:
        client = Client(config["account_sid"], config["auth_token"])
        recipients = [r.strip() for r in config.get("recipient_number", "").split(",") if r.strip()]
        sent = 0
        for recipient in recipients:
            try:
                client.messages.create(from_=f'whatsapp:{config["phone_number"]}', body="Test message from SSC Track - WhatsApp is working!", to=f'whatsapp:{recipient}')
                sent += 1
            except: pass
        return {"message": f"Test sent to {sent}/{len(recipients)} recipients"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WhatsApp failed: {str(e)}")

# Send daily sales report
@router.post("/send-daily-report")
async def send_daily_report(current_user: User = Depends(get_current_user)):
    prefs = await db.notification_prefs.find_one({}, {"_id": 0}) or {}
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    sales = await db.sales.find({"date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}, {"_id": 0}).to_list(1000)
    expenses = await db.expenses.find({"date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}, {"_id": 0}).to_list(1000)
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    total_sales = sum(s.get("final_amount", s["amount"]) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    branch_lines = ""
    for b in branches:
        bt = sum(s.get("final_amount", s["amount"]) for s in sales if s.get("branch_id") == b["id"])
        if bt > 0:
            branch_lines += f"  {b['name']}: SAR {bt:.2f}\n"
    report = f"Daily Sales Report - {datetime.now().strftime('%d %b %Y')}\n\nTotal Sales: SAR {total_sales:.2f}\nTotal Expenses: SAR {total_expenses:.2f}\nNet: SAR {(total_sales - total_expenses):.2f}\n"
    if branch_lines:
        report += f"\nBranch-wise Sales:\n{branch_lines}"
    results = []
    if prefs.get("email_daily_sales"):
        sent = await send_email_notification("SSC Track - Daily Sales Report", report)
        results.append(f"Email: {'sent' if sent else 'failed (check email settings)'}")
    if prefs.get("whatsapp_daily_sales"):
        config = await db.whatsapp_config.find_one({}, {"_id": 0})
        if config and config.get("account_sid") and config.get("auth_token"):
            try:
                client = Client(config["account_sid"], config["auth_token"])
                client.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=report, to=f'whatsapp:{config["recipient_number"]}')
                results.append("WhatsApp: sent")
            except Exception as e:
                results.append(f"WhatsApp: failed ({str(e)[:50]})")
        else:
            results.append("WhatsApp: not configured")
    if not results:
        return {"message": "No notification channels enabled. Go to Settings to configure."}
    return {"message": "Report sent", "details": results}

# Branch report via WhatsApp
@router.post("/whatsapp/send-branch-report")
async def send_branch_report_wa(body: dict, current_user: User = Depends(get_current_user)):
    branch_id = body.get("branch_id")
    all_branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    if branch_id:
        target_branches = [b for b in all_branches if b["id"] == branch_id]
    else:
        target_branches = all_branches
    sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    sp = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    lines = ["SSC Track - Branch Report\n"]
    for br in target_branches:
        bid = br["id"]
        br_sales = sum(s.get("final_amount", s["amount"]) for s in sales if s.get("branch_id") == bid)
        br_exp = sum(e["amount"] for e in expenses if e.get("branch_id") == bid)
        br_sp = sum(p["amount"] for p in sp if p.get("branch_id") == bid)
        cash = sum(p["amount"] for s in sales if s.get("branch_id") == bid for p in s.get("payment_details", []) if p.get("mode") == "cash")
        bank = sum(p["amount"] for s in sales if s.get("branch_id") == bid for p in s.get("payment_details", []) if p.get("mode") == "bank")
        profit = br_sales - br_exp - br_sp
        exp_cats = {}
        for e in expenses:
            if e.get("branch_id") == bid:
                exp_cats[e["category"]] = exp_cats.get(e["category"], 0) + e["amount"]
        cat_str = " | ".join(f"{k}: SAR {v:,.0f}" for k, v in sorted(exp_cats.items(), key=lambda x: -x[1])[:5])
        lines.append(f"*{br['name']}*")
        lines.append(f"Sales: SAR {br_sales:,.2f}")
        lines.append(f"Cash: SAR {cash:,.0f} | Bank: SAR {bank:,.0f}")
        lines.append(f"Expenses: SAR {br_exp:,.2f}")
        if cat_str: lines.append(f"  {cat_str}")
        lines.append(f"Supplier: SAR {br_sp:,.2f}")
        lines.append(f"{'Profit' if profit >= 0 else 'LOSS'}: SAR {profit:,.2f}")
        lines.append("")
    ok, err = await send_whatsapp_message("\n".join(lines))
    if ok: return {"message": "Branch report sent"}
    raise HTTPException(status_code=500, detail=err)

@router.post("/whatsapp/send-employee-report")
async def send_employee_report_wa(body: dict, current_user: User = Depends(get_current_user)):
    employees = await db.employees.find({"active": {"$ne": False}}, {"_id": 0}).to_list(1000)
    total_salary = sum(e.get("salary", 0) for e in employees)
    total_loan = sum(e.get("loan_balance", 0) for e in employees)
    msg = f"SSC Track - Employee Summary\n\nTotal Employees: {len(employees)}\nMonthly Payroll: SAR {total_salary:,.2f}\nTotal Loans: SAR {total_loan:,.2f}"
    ok, err = await send_whatsapp_message(msg)
    if ok: return {"message": "Employee report sent"}
    raise HTTPException(status_code=500, detail=err)

@router.post("/whatsapp/send-custom")
async def send_custom_wa(body: dict, current_user: User = Depends(get_current_user)):
    message = body.get("message", "")
    if not message: raise HTTPException(status_code=400, detail="Message required")
    ok, err = await send_whatsapp_message(f"SSC Track\n\n{message}")
    if ok: return {"message": "Message sent"}
    raise HTTPException(status_code=500, detail=err)

@router.post("/whatsapp/send-to")
async def send_whatsapp_to_number(body: dict, current_user: User = Depends(get_current_user)):
    phone = body.get("phone", "").strip()
    report_type = body.get("report_type", "daily_sales")
    branch_id = body.get("branch_id")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number required")
    config = await db.whatsapp_config.find_one({}, {"_id": 0})
    if not config or not config.get("account_sid") or not config.get("auth_token"):
        raise HTTPException(status_code=400, detail="WhatsApp not configured. Go to Settings -> WhatsApp to set up Twilio credentials.")
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    if report_type == "daily_sales":
        sales = await db.sales.find({"date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}, {"_id": 0}).to_list(5000)
        expenses = await db.expenses.find({"date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}, {"_id": 0}).to_list(5000)
        total_sales = sum(s.get("final_amount", s["amount"]) for s in sales)
        total_exp = sum(e["amount"] for e in expenses)
        branch_lines = ""
        for b in branches:
            bt = sum(s.get("final_amount", s["amount"]) for s in sales if s.get("branch_id") == b["id"])
            if bt > 0: branch_lines += f"  {b['name']}: SAR {bt:,.2f}\n"
        msg = f"*SSC Track - Daily Sales*\n{datetime.now().strftime('%d %b %Y')}\n\nTotal Sales: SAR {total_sales:,.2f}\nTotal Expenses: SAR {total_exp:,.2f}\nNet: SAR {(total_sales - total_exp):,.2f}\n"
        if branch_lines: msg += f"\nBranch Sales:\n{branch_lines}"
    elif report_type == "low_stock":
        query = {"branch_id": branch_id} if branch_id else {}
        items = await db.items.find({}, {"_id": 0}).to_list(1000)
        entries = await db.stock_entries.find(query, {"_id": 0}).to_list(10000)
        usage_records = await db.stock_usage.find(query, {"_id": 0}).to_list(10000)
        stock_in = {}
        for e in entries: stock_in[e["item_id"]] = stock_in.get(e["item_id"], 0) + e["quantity"]
        stock_out = {}
        for u in usage_records: stock_out[u["item_id"]] = stock_out.get(u["item_id"], 0) + u["quantity"]
        low_items = []
        for item in items:
            si = stock_in.get(item["id"], 0); so = stock_out.get(item["id"], 0); bal = si - so
            min_lvl = item.get("min_stock_level", 0)
            if min_lvl > 0 and bal <= min_lvl:
                low_items.append(f"  {item['name']}: {bal} {item.get('unit','pc')} (min: {min_lvl})")
        branch_name = branch_map.get(branch_id, "All Branches") if branch_id else "All Branches"
        msg = f"*SSC Track - Low Stock Alert*\n{branch_name}\n\n"
        if low_items: msg += "\n".join(low_items)
        else: msg += "All items are above minimum stock level."
    elif report_type == "expense_summary":
        expenses = await db.expenses.find({"date": {"$gte": today_start.isoformat(), "$lt": today_end.isoformat()}}, {"_id": 0}).to_list(5000)
        total = sum(e["amount"] for e in expenses)
        cat_totals = {}
        for e in expenses: cat_totals[e["category"]] = cat_totals.get(e["category"], 0) + e["amount"]
        cat_lines = "\n".join(f"  {k}: SAR {v:,.2f}" for k, v in sorted(cat_totals.items(), key=lambda x: -x[1]))
        msg = f"*SSC Track - Expense Summary*\n{datetime.now().strftime('%d %b %Y')}\n\nTotal: SAR {total:,.2f}\n"
        if cat_lines: msg += f"\nBy Category:\n{cat_lines}"
    elif report_type == "branch_report":
        sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
        lines = ["*SSC Track - Branch Report*\n"]
        target = [b for b in branches if b["id"] == branch_id] if branch_id else branches
        for br in target:
            bid = br["id"]
            br_sales = sum(s.get("final_amount", s["amount"]) for s in sales if s.get("branch_id") == bid)
            br_exp = sum(e["amount"] for e in expenses if e.get("branch_id") == bid)
            profit = br_sales - br_exp
            lines.append(f"*{br['name']}*: Sales SAR {br_sales:,.0f} | Exp SAR {br_exp:,.0f} | {'Profit' if profit>=0 else 'LOSS'} SAR {profit:,.0f}")
        msg = "\n".join(lines)
    elif report_type == "eod_summary":
        report_date = body.get("report_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        day_s = f"{report_date}T00:00:00"
        day_e = f"{report_date}T23:59:59"
        sq = {"date": {"$gte": day_s, "$lte": day_e}}
        eq = {"date": {"$gte": day_s, "$lte": day_e}}
        spq = {"date": {"$gte": day_s, "$lte": day_e}, "supplier_id": {"$exists": True, "$ne": None}}
        if branch_id:
            sq["branch_id"] = branch_id
            eq["branch_id"] = branch_id
            spq["branch_id"] = branch_id
        sales = await db.sales.find(sq, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find(eq, {"_id": 0}).to_list(10000)
        sp = await db.supplier_payments.find(spq, {"_id": 0}).to_list(10000)
        ts = sum(s.get("final_amount", s["amount"]) for s in sales)
        te = sum(e["amount"] for e in expenses)
        tsp = sum(p["amount"] for p in sp)
        s_cash = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
        s_bank = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
        bn = branch_map.get(branch_id, "All Branches") if branch_id else "All Branches"
        msg = f"*SSC Track - EOD Summary*\n{report_date} | {bn}\n\n"
        msg += f"*Sales:* SAR {ts:,.2f} ({len(sales)} txn)\n"
        msg += f"  Cash: SAR {s_cash:,.2f} | Bank: SAR {s_bank:,.2f}\n"
        msg += f"*Expenses:* SAR {te:,.2f} ({len(expenses)} items)\n"
        msg += f"*Supplier Payments:* SAR {tsp:,.2f}\n"
        msg += f"\n*Net Profit:* SAR {(ts - te - tsp):,.2f}\n"
        msg += f"*Cash in Hand:* SAR {(s_cash - sum(e['amount'] for e in expenses if e.get('payment_mode')=='cash') - sum(p['amount'] for p in sp if p.get('payment_mode')=='cash')):,.2f}"
    elif report_type == "partner_pnl":
        partners = await db.partners.find({}, {"_id": 0}).to_list(100)
        transactions_data = await db.partner_transactions.find({}, {"_id": 0}).to_list(10000)
        sales = await db.sales.find({}, {"_id": 0}).to_list(10000)
        expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
        sp = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
        total_rev = sum(s.get("final_amount", s["amount"]) for s in sales)
        total_exp = sum(e["amount"] for e in expenses)
        total_spp = sum(p["amount"] for p in sp)
        net = total_rev - total_exp - total_spp
        msg = f"*SSC Track - Partner P&L*\n\nCompany Net Profit: SAR {net:,.2f}\n"
        for partner in partners:
            pt = [t for t in transactions_data if t.get("partner_id") == partner["id"]]
            inv = sum(t["amount"] for t in pt if t.get("transaction_type") == "investment")
            wd = sum(t["amount"] for t in pt if t.get("transaction_type") in ["withdrawal", "profit_share", "expense"])
            share = partner.get("share_percentage", 0)
            entitled = (net * share / 100) if share > 0 else 0
            msg += f"\n*{partner['name']}* ({share}%)\n"
            msg += f"  Invested: SAR {inv:,.2f} | Withdrawn: SAR {wd:,.2f}\n"
            msg += f"  Balance: SAR {(inv - wd):,.2f} | Profit Share: SAR {entitled:,.2f}"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown report type: {report_type}")
    try:
        client_tw = Client(config["account_sid"], config["auth_token"])
        client_tw.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=msg, to=f'whatsapp:{phone}')
        return {"message": f"Report sent to {phone}", "preview": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WhatsApp send failed: {str(e)}")

@router.post("/whatsapp/send-supplier-report")
async def send_supplier_report_wa(current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    total_credit = sum(s.get("current_credit", 0) for s in suppliers)
    lines = [f"SSC Track - Supplier Report\n\nTotal Suppliers: {len(suppliers)}\nTotal Credit Due: SAR {total_credit:,.2f}\n"]
    for s in suppliers[:10]:
        if s.get("current_credit", 0) > 0:
            lines.append(f"- {s['name']}: SAR {s['current_credit']:,.2f}")
    ok, err = await send_whatsapp_message("\n".join(lines))
    if ok: return {"message": "Supplier report sent"}
    raise HTTPException(status_code=500, detail=err)


# Send Low Stock Alert via WhatsApp
@router.post("/whatsapp/send-low-stock-alert")
async def send_low_stock_alert_wa(current_user: User = Depends(get_current_user)):
    """Send low stock alert notification via WhatsApp"""
    items = await db.stock_items.find({}, {"_id": 0}).to_list(1000)
    low_stock_items = [i for i in items if i.get("current_stock", 0) <= i.get("min_stock", 0) and i.get("min_stock", 0) > 0]
    
    if not low_stock_items:
        return {"message": "No low stock items to report"}
    
    lines = [f"⚠️ SSC Track - Low Stock Alert\n\n{len(low_stock_items)} item(s) below minimum stock:\n"]
    for item in low_stock_items[:15]:
        lines.append(f"• {item['name']}: {item.get('current_stock', 0)} (min: {item.get('min_stock', 0)})")
    
    ok, err = await send_whatsapp_message("\n".join(lines))
    if ok: return {"message": f"Low stock alert sent for {len(low_stock_items)} items"}
    raise HTTPException(status_code=500, detail=err)

# Send Leave Approval Notification via WhatsApp
@router.post("/whatsapp/send-leave-notification")
async def send_leave_notification_wa(body: dict, current_user: User = Depends(get_current_user)):
    """Send leave approval/rejection notification via WhatsApp"""
    leave_id = body.get("leave_id")
    status = body.get("status", "approved")  # approved/rejected
    
    leave = await db.leave_requests.find_one({"id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    employee = await db.employees.find_one({"id": leave.get("employee_id")}, {"_id": 0})
    emp_name = employee.get("name", "Employee") if employee else "Employee"
    emp_phone = employee.get("phone") if employee else None
    
    status_emoji = "✅" if status == "approved" else "❌"
    msg = f"{status_emoji} SSC Track - Leave {status.upper()}\n\nEmployee: {emp_name}\nType: {leave.get('leave_type', 'Leave')}\nFrom: {leave.get('start_date', 'N/A')}\nTo: {leave.get('end_date', 'N/A')}\nDays: {leave.get('days', 1)}\n\nStatus: {status.upper()}"
    
    if leave.get("admin_notes"):
        msg += f"\nNotes: {leave['admin_notes']}"
    
    # Send to employee if phone available
    if emp_phone:
        config = await db.whatsapp_config.find_one({}, {"_id": 0})
        if config and config.get("account_sid"):
            try:
                client = Client(config["account_sid"], config["auth_token"])
                client.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=msg, to=f'whatsapp:{emp_phone}')
                return {"message": f"Leave notification sent to {emp_name}"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
    
    # Fallback: send to admin numbers
    ok, err = await send_whatsapp_message(msg)
    if ok: return {"message": "Leave notification sent"}
    raise HTTPException(status_code=500, detail=err)

# Send Salary Payment Notification via WhatsApp
@router.post("/whatsapp/send-salary-notification")
async def send_salary_notification_wa(body: dict, current_user: User = Depends(get_current_user)):
    """Send salary payment notification to employee via WhatsApp"""
    employee_id = body.get("employee_id")
    amount = body.get("amount", 0)
    period = body.get("period", "")
    
    employee = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    emp_name = employee.get("name", "Employee")
    emp_phone = employee.get("phone")
    
    msg = f"💰 SSC Track - Salary Payment\n\nDear {emp_name},\n\nYour salary for {period} has been processed.\n\nAmount: SAR {amount:,.2f}\n\nPlease acknowledge receipt.\n\nThank you!"
    
    if emp_phone:
        config = await db.whatsapp_config.find_one({}, {"_id": 0})
        if config and config.get("account_sid"):
            try:
                client = Client(config["account_sid"], config["auth_token"])
                client.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=msg, to=f'whatsapp:{emp_phone}')
                return {"message": f"Salary notification sent to {emp_name}"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
    
    return {"message": "Employee phone not available, notification not sent"}

# Send Bulk Salary Notification via WhatsApp
@router.post("/whatsapp/send-bulk-salary-notification")
async def send_bulk_salary_notification_wa(body: dict, current_user: User = Depends(get_current_user)):
    """Send salary payment notifications to multiple employees"""
    employee_ids = body.get("employee_ids", [])
    period = body.get("period", "")
    
    if not employee_ids:
        raise HTTPException(status_code=400, detail="No employees specified")
    
    employees = await db.employees.find({"id": {"$in": employee_ids}}, {"_id": 0}).to_list(500)
    
    config = await db.whatsapp_config.find_one({}, {"_id": 0})
    if not config or not config.get("account_sid"):
        raise HTTPException(status_code=400, detail="WhatsApp not configured")
    
    client = Client(config["account_sid"], config["auth_token"])
    sent = 0
    failed = 0
    
    for emp in employees:
        if emp.get("phone"):
            try:
                msg = f"💰 SSC Track - Salary Payment\n\nDear {emp.get('name', 'Employee')},\n\nYour salary for {period} has been processed.\n\nAmount: SAR {emp.get('salary', 0):,.2f}\n\nPlease acknowledge receipt."
                client.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=msg, to=f'whatsapp:{emp["phone"]}')
                sent += 1
            except:
                failed += 1
        else:
            failed += 1
    
    return {"message": f"Notifications sent: {sent} success, {failed} failed"}

# Send Custom WhatsApp Message
@router.post("/whatsapp/send-custom")
async def send_custom_wa(body: dict, current_user: User = Depends(get_current_user)):
    """Send a custom WhatsApp message"""
    message = body.get("message", "")
    phone = body.get("phone")  # Optional: specific phone, otherwise uses configured recipients
    
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    if phone:
        config = await db.whatsapp_config.find_one({}, {"_id": 0})
        if not config or not config.get("account_sid"):
            raise HTTPException(status_code=400, detail="WhatsApp not configured")
        try:
            client = Client(config["account_sid"], config["auth_token"])
            client.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=message, to=f'whatsapp:{phone}')
            return {"message": f"Message sent to {phone}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        ok, err = await send_whatsapp_message(message)
        if ok: return {"message": "Message sent to configured recipients"}
        raise HTTPException(status_code=500, detail=err)


# =====================================================
# WHATSAPP CHATBOT - Incoming Message Handler
# =====================================================

# Chatbot command handlers
async def handle_chatbot_command(message: str, from_number: str) -> str:
    """Process incoming WhatsApp message and return response"""
    message = message.lower().strip()
    
    # Help command
    if message in ['help', 'مساعدة', '?']:
        return """SSC Track Chatbot Commands:

*Sales*
- sales today - Today's sales summary
- sales week - This week's sales
- sales [branch] - Sales for specific branch

*Stock*
- stock low - Low stock items
- stock [item] - Check item stock

*Expenses*
- expenses today - Today's expenses
- expenses week - This week's expenses

*Suppliers*
- supplier all - All supplier balances
- supplier [name] - Specific supplier balance
- aging - Supplier aging quick view

*Customers*
- dues - Customer dues summary

*Reports*
- summary - Daily business summary
- profit - Today's profit/loss

Type any command to get started!"""

    # Sales commands
    if message.startswith('sales'):
        parts = message.split()
        period = parts[1] if len(parts) > 1 else 'today'
        
        if period == 'today':
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            sales = await db.sales.find({"date": {"$gte": today_start.isoformat()}}, {"_id": 0}).to_list(1000)
            total = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
            return f"💰 *Today's Sales*\n\nTotal: SAR {total:,.2f}\nTransactions: {len(sales)}"
        
        elif period == 'week':
            week_start = datetime.now(timezone.utc) - timedelta(days=7)
            sales = await db.sales.find({"date": {"$gte": week_start.isoformat()}}, {"_id": 0}).to_list(5000)
            total = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
            return f"💰 *This Week's Sales*\n\nTotal: SAR {total:,.2f}\nTransactions: {len(sales)}\nDaily Avg: SAR {total/7:,.2f}"
        
        else:
            # Search by branch name
            branches = await db.branches.find({"name": {"$regex": period, "$options": "i"}}, {"_id": 0}).to_list(10)
            if branches:
                branch = branches[0]
                sales = await db.sales.find({"branch_id": branch["id"]}, {"_id": 0}).to_list(1000)
                total = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
                return f"💰 *{branch['name']} Sales*\n\nTotal: SAR {total:,.2f}\nTransactions: {len(sales)}"
            return "❌ Branch not found. Try: sales today, sales week, or sales [branch name]"
    
    # Stock commands
    if message.startswith('stock'):
        parts = message.split(maxsplit=1)
        if len(parts) == 1 or parts[1] == 'low':
            items = await db.stock_items.find({}, {"_id": 0}).to_list(1000)
            low_stock = [i for i in items if i.get("current_stock", 0) <= i.get("min_stock", 0) and i.get("min_stock", 0) > 0]
            if not low_stock:
                return "✅ *Stock Status*\n\nAll items are well-stocked!"
            response = "⚠️ *Low Stock Items*\n\n"
            for item in low_stock[:10]:
                response += f"• {item['name']}: {item.get('current_stock', 0)} (min: {item.get('min_stock', 0)})\n"
            return response
        else:
            item_name = parts[1]
            items = await db.stock_items.find({"name": {"$regex": item_name, "$options": "i"}}, {"_id": 0}).to_list(10)
            if items:
                item = items[0]
                return f"📦 *{item['name']}*\n\nCurrent Stock: {item.get('current_stock', 0)}\nMin Stock: {item.get('min_stock', 0)}\nUnit: {item.get('unit', 'pcs')}"
            return f"❌ Item '{item_name}' not found"
    
    # Expense commands
    if message.startswith('expense'):
        parts = message.split()
        period = parts[1] if len(parts) > 1 else 'today'
        
        if period == 'today':
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            expenses = await db.expenses.find({"date": {"$gte": today_start.isoformat()}}, {"_id": 0}).to_list(1000)
            total = sum(e.get("amount", 0) for e in expenses)
            return f"💸 *Today's Expenses*\n\nTotal: SAR {total:,.2f}\nTransactions: {len(expenses)}"
        
        elif period == 'week':
            week_start = datetime.now(timezone.utc) - timedelta(days=7)
            expenses = await db.expenses.find({"date": {"$gte": week_start.isoformat()}}, {"_id": 0}).to_list(5000)
            total = sum(e.get("amount", 0) for e in expenses)
            return f"💸 *This Week's Expenses*\n\nTotal: SAR {total:,.2f}\nTransactions: {len(expenses)}"
    
    # Customer dues
    if message in ['dues', 'credit', 'customers']:
        customers = await db.customers.find({}, {"_id": 0}).to_list(500)
        total_credit = sum(c.get("current_credit", 0) for c in customers)
        with_dues = [c for c in customers if c.get("current_credit", 0) > 0]
        response = f"*Customer Dues*\n\nTotal Credit: SAR {total_credit:,.2f}\nCustomers with dues: {len(with_dues)}\n\n"
        for c in with_dues[:5]:
            response += f"- {c['name']}: SAR {c.get('current_credit', 0):,.2f}\n"
        return response
    
    # Supplier balance check
    if message.startswith('supplier') or message.startswith('balance'):
        parts = message.split(maxsplit=1)
        if len(parts) == 1 or parts[1] in ['dues', 'balance', 'all']:
            suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(500)
            total_dues = sum(s.get("current_credit", 0) for s in suppliers)
            with_dues = [s for s in suppliers if s.get("current_credit", 0) > 0]
            with_dues.sort(key=lambda x: x.get("current_credit", 0), reverse=True)
            response = f"*Supplier Balances*\n\nTotal Outstanding: SAR {total_dues:,.2f}\nSuppliers with balance: {len(with_dues)}\n\n"
            for s in with_dues[:8]:
                response += f"- {s['name']}: SAR {s.get('current_credit', 0):,.2f}\n"
            return response
        else:
            name = parts[1]
            suppliers = await db.suppliers.find({"name": {"$regex": name, "$options": "i"}}, {"_id": 0}).to_list(10)
            if suppliers:
                s = suppliers[0]
                return (
                    f"*{s['name']}*\n\n"
                    f"Credit Balance: SAR {s.get('current_credit', 0):,.2f}\n"
                    f"Credit Limit: SAR {s.get('credit_limit', 0):,.2f}\n"
                    f"Phone: {s.get('phone', '-')}"
                )
            return f"Supplier '{name}' not found. Try: supplier all, or supplier [name]"
    
    # Aging report quick view
    if message in ['aging', 'overdue', 'supplier aging']:
        suppliers = await db.suppliers.find({"current_credit": {"$gt": 0}}, {"_id": 0}).to_list(500)
        if not suppliers:
            return "*Supplier Aging*\n\nNo outstanding balances!"
        suppliers.sort(key=lambda x: x.get("current_credit", 0), reverse=True)
        total = sum(s.get("current_credit", 0) for s in suppliers)
        response = f"*Supplier Aging Quick View*\n\nTotal Outstanding: SAR {total:,.2f}\nSuppliers: {len(suppliers)}\n\n"
        for s in suppliers[:5]:
            pct = (s.get("current_credit", 0) / s.get("credit_limit", 1)) * 100 if s.get("credit_limit", 0) > 0 else 0
            status = "!!!" if pct > 80 else "!" if pct > 50 else ""
            response += f"- {s['name']}: SAR {s.get('current_credit', 0):,.2f} {status}\n"
        response += "\nType *supplier [name]* for details"
        return response
    
    # Summary command
    if message in ['summary', 'report', 'daily']:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        sales = await db.sales.find({"date": {"$gte": today_start.isoformat()}}, {"_id": 0}).to_list(1000)
        expenses = await db.expenses.find({"date": {"$gte": today_start.isoformat()}}, {"_id": 0}).to_list(1000)
        total_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
        total_expenses = sum(e.get("amount", 0) for e in expenses)
        profit = total_sales - total_expenses
        
        return f"""📊 *Daily Summary*
{datetime.now().strftime('%d %b %Y')}

💰 Sales: SAR {total_sales:,.2f}
💸 Expenses: SAR {total_expenses:,.2f}
{'📈' if profit >= 0 else '📉'} Net: SAR {profit:,.2f}

Transactions: {len(sales)} sales, {len(expenses)} expenses"""
    
    # Profit command
    if message in ['profit', 'p&l', 'pnl']:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        sales = await db.sales.find({"date": {"$gte": today_start.isoformat()}}, {"_id": 0}).to_list(1000)
        expenses = await db.expenses.find({"date": {"$gte": today_start.isoformat()}}, {"_id": 0}).to_list(1000)
        total_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
        total_expenses = sum(e.get("amount", 0) for e in expenses)
        profit = total_sales - total_expenses
        margin = (profit / total_sales * 100) if total_sales > 0 else 0
        
        return f"""{'📈' if profit >= 0 else '📉'} *Today's Profit*

Revenue: SAR {total_sales:,.2f}
Costs: SAR {total_expenses:,.2f}
Net Profit: SAR {profit:,.2f}
Margin: {margin:.1f}%"""
    
    # Default response
    return "🤖 I didn't understand that. Type *help* to see available commands."


# Twilio Webhook for incoming WhatsApp messages
@router.post("/whatsapp/webhook")
async def whatsapp_webhook(
    Body: str = Form(default=""),
    From: str = Form(default=""),
    To: str = Form(default=""),
    MessageSid: str = Form(default="")
):
    """Handle incoming WhatsApp messages from Twilio webhook"""
    
    # Extract phone number from Twilio format (whatsapp:+1234567890)
    from_number = From.replace("whatsapp:", "").strip()
    
    # Log the incoming message
    await db.whatsapp_messages.insert_one({
        "id": str(uuid.uuid4()),
        "direction": "incoming",
        "from": from_number,
        "to": To,
        "body": Body,
        "message_sid": MessageSid,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    # Process the command and get response
    response_text = await handle_chatbot_command(Body, from_number)
    
    # Send response via WhatsApp
    config = await db.whatsapp_config.find_one({}, {"_id": 0})
    if config and config.get("account_sid") and config.get("auth_token"):
        try:
            client = Client(config["account_sid"], config["auth_token"])
            message = client.messages.create(
                from_=To,  # Use the same number that received the message
                body=response_text,
                to=From
            )
            
            # Log the outgoing message
            await db.whatsapp_messages.insert_one({
                "id": str(uuid.uuid4()),
                "direction": "outgoing",
                "from": To,
                "to": From,
                "body": response_text,
                "message_sid": message.sid,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "in_reply_to": MessageSid
            })
            
        except Exception as e:
            print(f"WhatsApp send error: {e}")
    
    # Return TwiML response (empty response to acknowledge receipt)
    return {"status": "processed"}


# Get chatbot message history
@router.get("/whatsapp/messages")
async def get_whatsapp_messages(
    phone: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get WhatsApp message history"""
    query = {}
    if phone:
        query["$or"] = [{"from": {"$regex": phone}}, {"to": {"$regex": phone}}]
    
    messages = await db.whatsapp_messages.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return messages


# Test chatbot command (for debugging)
@router.post("/whatsapp/test-command")
async def test_chatbot_command(body: dict, current_user: User = Depends(get_current_user)):
    """Test a chatbot command without sending via WhatsApp"""
    command = body.get("command", "help")
    response = await handle_chatbot_command(command, "test")
    return {"command": command, "response": response}
