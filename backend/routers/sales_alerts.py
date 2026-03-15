"""
Sales Alert System - Sends notifications when predicted sales are below threshold.
Supports email and WhatsApp notifications with configurable settings.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import uuid

from database import db, get_current_user, require_permission, get_tenant_filter, stamp_tenant
from models import User

router = APIRouter()

class AlertConfig(BaseModel):
    id: str = ""
    enabled: bool = True
    threshold_percentage: int = 20  # Alert when predicted is X% below average
    alert_time: str = "08:00"  # Daily alert time (HH:MM)
    email_enabled: bool = True
    whatsapp_enabled: bool = True
    recipients: List[str] = []  # List of email addresses or phone numbers
    last_sent: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    
    def __init__(self, **data):
        if not data.get('id'):
            data['id'] = str(uuid.uuid4())
        if not data.get('created_at'):
            data['created_at'] = datetime.now(timezone.utc).isoformat()
        super().__init__(**data)

@router.get("/sales-alerts/config")
async def get_alert_config(current_user: User = Depends(get_current_user)):
    """Get current sales alert configuration."""
    require_permission(current_user, "settings", "read")
    
    config = await db.sales_alert_config.find_one(get_tenant_filter(current_user), {"_id": 0})
    if not config:
        # Return default config
        return AlertConfig().model_dump()
    return config

@router.post("/sales-alerts/config")
async def save_alert_config(config_data: dict, current_user: User = Depends(get_current_user)):
    """Save sales alert configuration."""
    require_permission(current_user, "settings", "write")
    
    existing = await db.sales_alert_config.find_one(get_tenant_filter(current_user))
    
    config_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if existing:
        await db.sales_alert_config.update_one({}, {"$set": config_data})
    else:
        config_data["id"] = str(uuid.uuid4())
        config_data["created_at"] = datetime.now(timezone.utc).isoformat()
        stamp_tenant(config_data, current_user)
        await db.sales_alert_config.insert_one(config_data)
    
    # Log activity
    from routers.activity_logs import log_activity
    await log_activity(current_user, "update", "sales_alerts", "config", {"enabled": config_data.get("enabled")})
    
    return {"message": "Alert configuration saved", "config": config_data}

@router.get("/sales-alerts/preview")
async def preview_alert(current_user: User = Depends(get_current_user)):
    """
    Preview what the alert would look like based on current data.
    Useful for testing before enabling alerts.
    """
    require_permission(current_user, "settings", "read")
    
    # Get config
    config = await db.sales_alert_config.find_one(get_tenant_filter(current_user), {"_id": 0}) or {}
    threshold = config.get("threshold_percentage", 20)
    
    # Get forecast data
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=180)).isoformat()
    
    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(50000)
    
    # Calculate daily averages
    from collections import defaultdict
    daily_sales = defaultdict(float)
    for s in sales:
        d = s.get("date", "")[:10]
        daily_sales[d] += s.get("final_amount", s.get("amount", 0))
    
    if not daily_sales:
        return {
            "alert_needed": False,
            "message": "Insufficient data for prediction",
            "predicted": 0,
            "historical_avg": 0,
            "threshold": threshold
        }
    
    # Calculate averages
    values = list(daily_sales.values())
    avg_30 = sum(values[-30:]) / min(len(values), 30) if values else 0
    
    # Simple prediction for tomorrow (use day-of-week pattern)
    tomorrow = now + timedelta(days=1)
    dow = tomorrow.weekday()
    
    dow_sales = defaultdict(list)
    for i, (d, v) in enumerate(sorted(daily_sales.items())):
        try:
            date_obj = datetime.fromisoformat(d)
            dow_sales[date_obj.weekday()].append(v)
        except:
            pass
    
    if dow_sales[dow]:
        predicted = sum(dow_sales[dow]) / len(dow_sales[dow])
    else:
        predicted = avg_30
    
    # Check if alert needed
    diff_pct = ((avg_30 - predicted) / max(avg_30, 1)) * 100
    alert_needed = diff_pct >= threshold
    
    return {
        "alert_needed": alert_needed,
        "predicted_sales": round(predicted, 2),
        "historical_avg": round(avg_30, 2),
        "difference_percentage": round(diff_pct, 1),
        "threshold": threshold,
        "prediction_date": tomorrow.strftime("%Y-%m-%d"),
        "prediction_day": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][dow],
        "message": f"Predicted sales (SAR {predicted:.2f}) are {abs(diff_pct):.1f}% {'below' if diff_pct > 0 else 'above'} the 30-day average (SAR {avg_30:.2f})"
    }

@router.post("/sales-alerts/send-test")
async def send_test_alert(current_user: User = Depends(get_current_user)):
    """Send a test alert to verify configuration."""
    require_permission(current_user, "settings", "write")
    
    config = await db.sales_alert_config.find_one(get_tenant_filter(current_user), {"_id": 0})
    if not config:
        raise HTTPException(status_code=400, detail="No alert configuration found")
    
    if not config.get("recipients"):
        raise HTTPException(status_code=400, detail="No recipients configured")
    
    # Get preview data
    preview = await preview_alert(current_user)
    
    results = {"email_sent": [], "whatsapp_sent": [], "errors": []}
    
    # Prepare message
    message = f"""
🔔 SSC Track Sales Alert (TEST)

📊 Sales Prediction for {preview.get('prediction_date')} ({preview.get('prediction_day')}):

💰 Predicted Sales: SAR {preview.get('predicted_sales', 0):,.2f}
📈 30-Day Average: SAR {preview.get('historical_avg', 0):,.2f}
📉 Difference: {preview.get('difference_percentage', 0):.1f}%

Alert Threshold: {config.get('threshold_percentage', 20)}%
Status: {'⚠️ Below Threshold' if preview.get('alert_needed') else '✅ Normal'}

This is a TEST alert. Configure settings at your SSC Track dashboard.
"""
    
    # Send emails
    if config.get("email_enabled"):
        email_recipients = [r for r in config.get("recipients", []) if "@" in r]
        for email in email_recipients:
            try:
                # Use existing email sending infrastructure
                from routers.auth import send_email
                await send_email(
                    email,
                    "🔔 SSC Track Sales Alert (TEST)",
                    message.replace("\n", "<br>")
                )
                results["email_sent"].append(email)
            except Exception as e:
                results["errors"].append(f"Email to {email}: {str(e)}")
    
    # Send WhatsApp
    if config.get("whatsapp_enabled"):
        phone_recipients = [r for r in config.get("recipients", []) if "@" not in r and r.startswith("+")]
        for phone in phone_recipients:
            try:
                from routers.whatsapp import send_whatsapp_message
                await send_whatsapp_message(phone, message)
                results["whatsapp_sent"].append(phone)
            except Exception as e:
                results["errors"].append(f"WhatsApp to {phone}: {str(e)}")
    
    return {
        "message": "Test alert sent",
        "results": results,
        "preview": preview
    }

@router.get("/sales-alerts/history")
async def get_alert_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get history of sent alerts."""
    require_permission(current_user, "settings", "read")
    
    alerts = await db.sales_alert_history.find(get_tenant_filter(current_user), {"_id": 0}).sort("sent_at", -1).limit(limit).to_list(limit)
    return alerts

async def check_and_send_daily_alert():
    """
    Background task to check and send daily sales alerts.
    Called by the scheduler at the configured time.
    """
    config = await db.sales_alert_config.find_one({}, {"_id": 0})
    if not config or not config.get("enabled"):
        return {"skipped": True, "reason": "Alerts disabled"}
    
    if not config.get("recipients"):
        return {"skipped": True, "reason": "No recipients"}
    
    # Get prediction
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=180)).isoformat()
    
    sales = await db.sales.find({"date": {"$gte": start_date}}, {"_id": 0}).to_list(50000)
    
    from collections import defaultdict
    daily_sales = defaultdict(float)
    for s in sales:
        d = s.get("date", "")[:10]
        daily_sales[d] += s.get("final_amount", s.get("amount", 0))
    
    if not daily_sales:
        return {"skipped": True, "reason": "Insufficient data"}
    
    values = list(daily_sales.values())
    avg_30 = sum(values[-30:]) / min(len(values), 30) if values else 0
    
    tomorrow = now + timedelta(days=1)
    dow = tomorrow.weekday()
    
    dow_sales = defaultdict(list)
    for d, v in sorted(daily_sales.items()):
        try:
            date_obj = datetime.fromisoformat(d)
            dow_sales[date_obj.weekday()].append(v)
        except:
            pass
    
    predicted = sum(dow_sales[dow]) / len(dow_sales[dow]) if dow_sales[dow] else avg_30
    
    threshold = config.get("threshold_percentage", 20)
    diff_pct = ((avg_30 - predicted) / max(avg_30, 1)) * 100
    
    if diff_pct < threshold:
        return {"skipped": True, "reason": "Prediction above threshold", "diff_pct": diff_pct}
    
    # Send alert
    day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][dow]
    message = f"""
🔔 SSC Track Sales Alert

📊 Sales Prediction for {tomorrow.strftime('%Y-%m-%d')} ({day_name}):

⚠️ BELOW THRESHOLD ALERT

💰 Predicted Sales: SAR {predicted:,.2f}
📈 30-Day Average: SAR {avg_30:,.2f}
📉 Difference: {diff_pct:.1f}% below average

Consider:
• Running promotions
• Special offers
• Marketing campaigns
• Staff scheduling adjustments

View detailed forecast: /sales-forecast
"""
    
    results = {"email_sent": [], "whatsapp_sent": [], "errors": []}
    
    if config.get("email_enabled"):
        email_recipients = [r for r in config.get("recipients", []) if "@" in r]
        for email in email_recipients:
            try:
                from routers.auth import send_email
                await send_email(email, "⚠️ SSC Track: Low Sales Predicted", message.replace("\n", "<br>"))
                results["email_sent"].append(email)
            except Exception as e:
                results["errors"].append(f"Email to {email}: {str(e)}")
    
    if config.get("whatsapp_enabled"):
        phone_recipients = [r for r in config.get("recipients", []) if "@" not in r and r.startswith("+")]
        for phone in phone_recipients:
            try:
                from routers.whatsapp import send_whatsapp_message
                await send_whatsapp_message(phone, message)
                results["whatsapp_sent"].append(phone)
            except Exception as e:
                results["errors"].append(f"WhatsApp to {phone}: {str(e)}")
    
    # Log to history
    await db.sales_alert_history.insert_one({
        "id": str(uuid.uuid4()),
        "sent_at": now.isoformat(),
        "prediction_date": tomorrow.strftime("%Y-%m-%d"),
        "predicted_sales": predicted,
        "historical_avg": avg_30,
        "difference_pct": diff_pct,
        "threshold": threshold,
        "results": results
    })
    
    # Update last sent
    await db.sales_alert_config.update_one({}, {"$set": {"last_sent": now.isoformat()}})
    
    return {"sent": True, "results": results}
