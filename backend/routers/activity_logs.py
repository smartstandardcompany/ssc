"""
Activity Logging module for audit trail.
Tracks user actions across the application.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db, get_current_user, require_permission, get_tenant_filter, stamp_tenant
from models import User

router = APIRouter()


class ActivityLog(BaseModel):
    id: str = ""
    user_id: str
    user_email: str
    action: str  # login, logout, create, update, delete, view
    resource: str  # sales, expenses, customers, suppliers, settings, users, etc.
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = None
    
    def __init__(self, **data):
        if not data.get('id'):
            data['id'] = str(uuid.uuid4())
        if not data.get('timestamp'):
            data['timestamp'] = datetime.now(timezone.utc)
        super().__init__(**data)


async def log_activity(
    user: User,
    action: str,
    resource: str,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None
):
    """
    Log user activity to the database.
    
    Args:
        user: The user performing the action
        action: Type of action (login, logout, create, update, delete, view)
        resource: Resource being acted upon (sales, expenses, etc.)
        resource_id: ID of the specific resource
        details: Additional details about the action
        request: FastAPI request object for IP/user agent
    """
    ip_address = None
    user_agent = None
    
    if request:
        # Get client IP (handle proxies)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ip_address = forwarded.split(",")[0].strip()
        else:
            ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent", "")[:500]  # Limit length
    
    log_entry = ActivityLog(
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource=resource,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    log_dict = log_entry.model_dump()
    log_dict["timestamp"] = log_dict["timestamp"].isoformat()
    
    stamp_tenant(log_dict, user)
    await db.activity_logs.insert_one(log_dict)
    return log_entry


@router.get("/activity-logs")
async def get_activity_logs(
    limit: int = 100,
    offset: int = 0,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get activity logs. Admin only.
    """
    require_permission(current_user, "settings", "read")  # Admin-level permission
    
    query = {}
    
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if resource:
        query["resource"] = resource
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date + "T23:59:59"
        else:
            query["timestamp"] = {"$lte": end_date + "T23:59:59"}
    
    total = await db.activity_logs.count_documents(query)
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    
    # Convert timestamps
    for log in logs:
        if isinstance(log.get('timestamp'), str):
            log['timestamp'] = datetime.fromisoformat(log['timestamp'].replace('Z', '+00:00'))
    
    return {
        "total": total,
        "logs": logs,
        "limit": limit,
        "offset": offset
    }


@router.get("/activity-logs/summary")
async def get_activity_summary(
    days: int = 7,
    current_user: User = Depends(get_current_user)
):
    """
    Get activity summary statistics. Admin only.
    """
    require_permission(current_user, "settings", "read")
    
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Aggregate by action type
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$action",
            "count": {"$sum": 1}
        }}
    ]
    action_counts = await db.activity_logs.aggregate(pipeline).to_list(20)
    
    # Aggregate by resource
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$resource",
            "count": {"$sum": 1}
        }}
    ]
    resource_counts = await db.activity_logs.aggregate(pipeline).to_list(50)
    
    # Aggregate by user
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff}}},
        {"$group": {
            "_id": {"user_id": "$user_id", "user_email": "$user_email"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    user_activity = await db.activity_logs.aggregate(pipeline).to_list(10)
    
    # Recent logins
    recent_logins = await db.activity_logs.find(
        {"action": "login", "timestamp": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    return {
        "period_days": days,
        "by_action": {item["_id"]: item["count"] for item in action_counts},
        "by_resource": {item["_id"]: item["count"] for item in resource_counts},
        "top_users": [
            {"user_id": item["_id"]["user_id"], "user_email": item["_id"]["user_email"], "count": item["count"]}
            for item in user_activity
        ],
        "recent_logins": recent_logins
    }


@router.delete("/activity-logs/cleanup")
async def cleanup_old_logs(
    days_to_keep: int = 90,
    current_user: User = Depends(get_current_user)
):
    """
    Delete activity logs older than specified days. Admin only.
    """
    require_permission(current_user, "settings", "write")
    
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days_to_keep)).isoformat()
    
    result = await db.activity_logs.delete_many({"timestamp": {"$lt": cutoff}})
    
    return {
        "deleted_count": result.deleted_count,
        "cutoff_date": cutoff
    }
