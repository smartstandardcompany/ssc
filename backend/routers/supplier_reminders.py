"""
Supplier Payment Reminders - Automated daily checks on supplier aging.
Sends notifications when invoices reach configurable age thresholds (30/60/90/120 days).
Supports email and WhatsApp notifications with configurable recipients.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid

from database import db, get_current_user, require_permission
from models import User

router = APIRouter()


class ReminderConfig(BaseModel):
    id: str = ""
    enabled: bool = True
    thresholds: List[int] = [30, 60, 90, 120]
    alert_time: str = "09:00"
    email_enabled: bool = True
    whatsapp_enabled: bool = True
    recipients_email: List[str] = []
    recipients_phone: List[str] = []
    include_summary: bool = True
    last_sent: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""


@router.get("/supplier-reminders/config")
async def get_reminder_config(current_user: User = Depends(get_current_user)):
    require_permission(current_user, "suppliers", "read")
    config = await db.supplier_reminder_config.find_one({}, {"_id": 0})
    if not config:
        config = ReminderConfig(
            id=str(uuid.uuid4()),
            created_at=datetime.now(timezone.utc).isoformat()
        ).dict()
    return config


@router.post("/supplier-reminders/config")
async def save_reminder_config(config: dict, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "suppliers", "write")
    config["updated_at"] = datetime.now(timezone.utc).isoformat()
    if not config.get("id"):
        config["id"] = str(uuid.uuid4())
        config["created_at"] = datetime.now(timezone.utc).isoformat()

    await db.supplier_reminder_config.update_one(
        {}, {"$set": config}, upsert=True
    )
    return {"message": "Reminder configuration saved", "config": config}


@router.post("/supplier-reminders/test")
async def test_reminder(current_user: User = Depends(get_current_user)):
    """Send a test reminder immediately"""
    require_permission(current_user, "suppliers", "read")
    result = await run_supplier_reminder_check(is_test=True)
    return result


@router.get("/supplier-reminders/history")
async def get_reminder_history(limit: int = 20, current_user: User = Depends(get_current_user)):
    """Get history of sent reminders"""
    require_permission(current_user, "suppliers", "read")
    history = await db.supplier_reminder_history.find(
        {}, {"_id": 0}
    ).sort("sent_at", -1).to_list(limit)
    return history


async def run_supplier_reminder_check(is_test: bool = False):
    """
    Core function: Check supplier aging and send reminders.
    Called by the scheduler daily or manually via test endpoint.
    """
    config = await db.supplier_reminder_config.find_one({}, {"_id": 0})
    if not config:
        # Use defaults for test mode
        if is_test:
            config = {"enabled": True, "thresholds": [30, 60, 90, 120], "email_enabled": False, "whatsapp_enabled": False, "recipients_email": [], "recipients_phone": []}
        else:
            return {"message": "No reminder configuration found", "sent": False}
    
    if not config.get("enabled") and not is_test:
        return {"message": "Reminders are disabled", "sent": False}
    
    thresholds = sorted(config.get("thresholds", [30, 60, 90, 120]))
    
    # Get all suppliers with outstanding credit
    suppliers = await db.suppliers.find(
        {"current_credit": {"$gt": 0}}, {"_id": 0}
    ).to_list(1000)
    
    if not suppliers:
        return {"message": "No suppliers with outstanding balances", "sent": False}
    
    now = datetime.now(timezone.utc)
    alerts = []
    
    for supplier in suppliers:
        sid = supplier["id"]
        
        # Get credit purchases
        credit_expenses = await db.expenses.find(
            {"supplier_id": sid, "payment_mode": "credit"},
            {"_id": 0, "date": 1, "amount": 1, "description": 1}
        ).sort("date", 1).to_list(5000)
        
        # Get payments
        payments = await db.supplier_payments.find(
            {"supplier_id": sid, "payment_mode": {"$in": ["cash", "bank"]}},
            {"_id": 0, "amount": 1}
        ).to_list(5000)
        
        total_paid = sum(p.get("amount", 0) for p in payments)
        remaining_payment = total_paid
        
        # FIFO: apply payments to oldest invoices
        for exp in credit_expenses:
            if remaining_payment >= exp["amount"]:
                remaining_payment -= exp["amount"]
                continue
            
            unpaid = exp["amount"] - remaining_payment
            remaining_payment = 0
            
            # Calculate age
            try:
                if isinstance(exp.get("date"), str):
                    exp_date = datetime.fromisoformat(exp["date"].replace("Z", "+00:00"))
                else:
                    exp_date = exp.get("date", now)
                if exp_date.tzinfo is None:
                    exp_date = exp_date.replace(tzinfo=timezone.utc)
                age_days = (now - exp_date).days
            except:
                age_days = 0
            
            # Check if age crosses any threshold
            for threshold in thresholds:
                if age_days >= threshold:
                    severity = "critical" if threshold >= 90 else "high" if threshold >= 60 else "medium" if threshold >= 30 else "low"
                    alerts.append({
                        "supplier_name": supplier["name"],
                        "supplier_id": sid,
                        "supplier_phone": supplier.get("phone", ""),
                        "amount": unpaid,
                        "age_days": age_days,
                        "threshold": threshold,
                        "severity": severity,
                        "description": exp.get("description", "Purchase"),
                        "total_outstanding": supplier.get("current_credit", 0),
                    })
                    break  # Only alert for highest threshold crossed
    
    if not alerts:
        return {"message": "No invoices have crossed reminder thresholds", "sent": False, "alerts": []}
    
    # Group alerts by supplier for cleaner messaging
    supplier_alerts = {}
    for alert in alerts:
        sid = alert["supplier_id"]
        if sid not in supplier_alerts:
            supplier_alerts[sid] = {
                "supplier_name": alert["supplier_name"],
                "total_outstanding": alert["total_outstanding"],
                "invoices": [],
                "max_severity": "low",
            }
        supplier_alerts[sid]["invoices"].append(alert)
        # Track highest severity
        sev_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        if sev_order.get(alert["severity"], 0) > sev_order.get(supplier_alerts[sid]["max_severity"], 0):
            supplier_alerts[sid]["max_severity"] = alert["severity"]
    
    # Build messages
    results = {"email": None, "whatsapp": None, "alerts_count": len(alerts), "suppliers_count": len(supplier_alerts)}
    
    # --- Email ---
    if config.get("email_enabled") and config.get("recipients_email"):
        try:
            import aiosmtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            
            email_settings = await db.email_settings.find_one({}, {"_id": 0})
            if email_settings and email_settings.get("smtp_host"):
                # Build HTML email
                html = "<h2>Supplier Payment Reminders</h2>"
                html += f"<p>Date: {now.strftime('%Y-%m-%d %H:%M')}</p>"
                html += f"<p><strong>{len(supplier_alerts)} suppliers</strong> have overdue invoices ({len(alerts)} total invoices)</p><hr>"
                
                for sid, sa in sorted(supplier_alerts.items(), key=lambda x: x[1]["total_outstanding"], reverse=True):
                    sev_color = {"critical": "#dc2626", "high": "#ea580c", "medium": "#d97706", "low": "#65a30d"}
                    html += f'<h3 style="color:{sev_color.get(sa["max_severity"], "#333")}">{sa["supplier_name"]} - SAR {sa["total_outstanding"]:,.2f}</h3>'
                    html += "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;font-size:13px'>"
                    html += "<tr style='background:#f5f5f5'><th>Age</th><th>Amount</th><th>Threshold</th><th>Description</th></tr>"
                    for inv in sa["invoices"]:
                        html += f"<tr><td>{inv['age_days']} days</td><td>SAR {inv['amount']:,.2f}</td>"
                        html += f"<td>{inv['threshold']}+ days</td><td>{inv['description'][:40]}</td></tr>"
                    html += "</table><br>"
                
                html += "<p style='color:#666;font-size:12px'>This is an automated reminder from SSC Track.</p>"
                
                for recipient in config["recipients_email"]:
                    msg = MIMEMultipart()
                    msg["Subject"] = f"Payment Reminder: {len(supplier_alerts)} suppliers with overdue invoices"
                    msg["From"] = email_settings.get("from_email", email_settings["username"])
                    msg["To"] = recipient
                    msg.attach(MIMEText(html, "html"))
                    
                    await aiosmtplib.send(msg,
                        hostname=email_settings["smtp_host"],
                        port=email_settings["smtp_port"],
                        username=email_settings["username"],
                        password=email_settings["password"],
                        use_tls=email_settings.get("use_tls", True))
                
                results["email"] = {"success": True, "sent_to": config["recipients_email"]}
            else:
                results["email"] = {"success": False, "error": "Email not configured in settings"}
        except Exception as e:
            results["email"] = {"success": False, "error": str(e)}
    
    # --- WhatsApp ---
    if config.get("whatsapp_enabled") and config.get("recipients_phone"):
        try:
            wa_config = await db.whatsapp_config.find_one({}, {"_id": 0})
            if wa_config and wa_config.get("account_sid"):
                from twilio.rest import Client
                client_tw = Client(wa_config["account_sid"], wa_config["auth_token"])
                
                # Build WhatsApp message
                msg_lines = ["*SSC Track - Payment Reminders*", f"Date: {now.strftime('%Y-%m-%d')}", ""]
                
                for sid, sa in sorted(supplier_alerts.items(), key=lambda x: x[1]["total_outstanding"], reverse=True):
                    severity_icon = {"critical": "!!!", "high": "!!", "medium": "!", "low": ""}
                    msg_lines.append(f"*{sa['supplier_name']}* {severity_icon.get(sa['max_severity'], '')}")
                    msg_lines.append(f"Outstanding: SAR {sa['total_outstanding']:,.2f}")
                    for inv in sa["invoices"][:3]:
                        msg_lines.append(f"  - {inv['age_days']}d overdue: SAR {inv['amount']:,.2f}")
                    msg_lines.append("")
                
                msg_lines.append(f"Total: {len(alerts)} overdue invoices from {len(supplier_alerts)} suppliers")
                wa_msg = "\n".join(msg_lines)
                
                for phone in config["recipients_phone"]:
                    client_tw.messages.create(
                        from_=f'whatsapp:{wa_config["phone_number"]}',
                        body=wa_msg,
                        to=f'whatsapp:{phone}'
                    )
                
                results["whatsapp"] = {"success": True, "sent_to": config["recipients_phone"]}
            else:
                results["whatsapp"] = {"success": False, "error": "WhatsApp not configured"}
        except Exception as e:
            results["whatsapp"] = {"success": False, "error": str(e)}
    
    # Save to history
    history_entry = {
        "id": str(uuid.uuid4()),
        "sent_at": now.isoformat(),
        "is_test": is_test,
        "alerts_count": len(alerts),
        "suppliers_count": len(supplier_alerts),
        "results": results,
        "supplier_summary": [
            {"name": sa["supplier_name"], "outstanding": sa["total_outstanding"], "severity": sa["max_severity"], "invoices": len(sa["invoices"])}
            for sa in supplier_alerts.values()
        ]
    }
    await db.supplier_reminder_history.insert_one(history_entry)
    history_entry.pop("_id", None)
    
    # Update last_sent
    await db.supplier_reminder_config.update_one(
        {}, {"$set": {"last_sent": now.isoformat()}}
    )
    
    return {
        "message": f"Reminders sent for {len(supplier_alerts)} suppliers ({len(alerts)} overdue invoices)",
        "sent": True,
        "results": results,
        "supplier_summary": history_entry["supplier_summary"]
    }
