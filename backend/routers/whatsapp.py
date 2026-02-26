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
