from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import json
import os
import logging

from database import db, get_current_user
from models import User

router = APIRouter()
logger = logging.getLogger(__name__)

# VAPID keys for Web Push
# Generate once and store - these are for the demo
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS = {"sub": "mailto:admin@ssctrack.com"}


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}


class NotificationPreferences(BaseModel):
    low_stock_alerts: bool = True
    leave_requests: bool = True
    order_updates: bool = True
    loan_installments: bool = True
    expense_anomalies: bool = True
    document_expiry: bool = True
    daily_summary: bool = False
    channel_push: bool = True
    channel_whatsapp: bool = False


@router.get("/push/vapid-key")
async def get_vapid_public_key():
    """Return the VAPID public key for push subscription."""
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe")
async def subscribe_push(subscription: PushSubscription, current_user: User = Depends(get_current_user)):
    """Register a push notification subscription."""
    sub_dict = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True
    }
    # Upsert by endpoint
    await db.push_subscriptions.update_one(
        {"user_id": current_user.id, "endpoint": subscription.endpoint},
        {"$set": sub_dict},
        upsert=True
    )
    return {"message": "Subscribed to push notifications"}


@router.delete("/push/unsubscribe")
async def unsubscribe_push(current_user: User = Depends(get_current_user)):
    """Remove all push subscriptions for user."""
    await db.push_subscriptions.delete_many({"user_id": current_user.id})
    return {"message": "Unsubscribed from push notifications"}


@router.get("/push/preferences")
async def get_notification_preferences(current_user: User = Depends(get_current_user)):
    """Get user's notification preferences."""
    prefs = await db.notification_preferences.find_one({"user_id": current_user.id}, {"_id": 0})
    if not prefs:
        prefs = {
            "user_id": current_user.id,
            "low_stock_alerts": True,
            "leave_requests": True,
            "order_updates": True,
            "loan_installments": True,
            "expense_anomalies": True,
            "document_expiry": True,
            "daily_summary": False,
            "channel_push": True,
            "channel_whatsapp": False
        }
    return prefs


@router.put("/push/preferences")
async def update_notification_preferences(prefs: NotificationPreferences, current_user: User = Depends(get_current_user)):
    """Update notification preferences."""
    prefs_dict = prefs.dict()
    prefs_dict["user_id"] = current_user.id
    prefs_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.notification_preferences.update_one(
        {"user_id": current_user.id},
        {"$set": prefs_dict},
        upsert=True
    )
    return {"message": "Preferences updated"}


@router.get("/push/status")
async def get_push_status(current_user: User = Depends(get_current_user)):
    """Check if user has active push subscription."""
    count = await db.push_subscriptions.count_documents({"user_id": current_user.id, "active": True})
    return {"subscribed": count > 0, "subscription_count": count}


async def send_push_to_user(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to a specific user. Called internally."""
    if not VAPID_PRIVATE_KEY:
        return

    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id, "active": True}, {"_id": 0}
    ).to_list(10)

    if not subscriptions:
        return

    try:
        from pywebpush import webpush, WebPushException
        payload = json.dumps({"title": title, "body": body, "data": data or {}})

        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                    data=payload,
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims=VAPID_CLAIMS
                )
            except WebPushException as e:
                if "410" in str(e) or "404" in str(e):
                    await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
                logger.warning(f"Push failed for {user_id}: {e}")
            except Exception as e:
                logger.warning(f"Push error: {e}")
    except ImportError:
        logger.warning("pywebpush not installed")


async def send_push_to_admins(title: str, body: str, data: dict = None):
    """Send push notification to all admin users."""
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(100)
    for admin in admins:
        await send_push_to_user(admin["id"], title, body, data)


async def create_and_push_notification(user_id: str, notif_type: str, title: str, message: str, data: dict = None):
    """Create in-app notification and optionally send push."""
    # Create in-app notification
    n_dict = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(n_dict)

    # Check preferences
    prefs = await db.notification_preferences.find_one({"user_id": user_id}, {"_id": 0})
    pref_map = {
        "low_stock": "low_stock_alerts",
        "leave_request": "leave_requests",
        "order_update": "order_updates",
        "loan_installment": "loan_installments",
        "expense_anomaly": "expense_anomalies",
        "document_expiry": "document_expiry"
    }

    pref_key = pref_map.get(notif_type)
    should_push = True
    if prefs and pref_key:
        should_push = prefs.get(pref_key, True)

    if should_push:
        if prefs.get("channel_push", True):
            await send_push_to_user(user_id, title, message, data)
        if prefs.get("channel_whatsapp", False):
            await send_whatsapp_notification(message)
