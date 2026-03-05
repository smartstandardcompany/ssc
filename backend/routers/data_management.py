from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from database import db, get_current_user
from models import User
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

ARCHIVABLE_COLLECTIONS = {
    "sales": {"date_field": "date", "label": "Sales"},
    "expenses": {"date_field": "date", "label": "Expenses"},
    "supplier_payments": {"date_field": "date", "label": "Supplier Payments"},
    "invoices": {"date_field": "created_at", "label": "Invoices"},
    "activity_logs": {"date_field": "timestamp", "label": "Activity Logs"},
    "scheduler_logs": {"date_field": "triggered_at", "label": "Scheduler Logs"},
    "notifications": {"date_field": "created_at", "label": "Notifications"},
}


@router.get("/data-management/stats")
async def get_data_stats(current_user: User = Depends(get_current_user)):
    """Get collection sizes and data age statistics."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    stats = []
    for coll_name, config in ARCHIVABLE_COLLECTIONS.items():
        collection = db[coll_name]
        total = await collection.count_documents({})
        oldest = await collection.find_one({}, {"_id": 0, config["date_field"]: 1}, sort=[(config["date_field"], 1)])
        newest = await collection.find_one({}, {"_id": 0, config["date_field"]: 1}, sort=[(config["date_field"], -1)])

        oldest_date = oldest.get(config["date_field"], "") if oldest else ""
        newest_date = newest.get(config["date_field"], "") if newest else ""

        # Count records older than thresholds
        now = datetime.now(timezone.utc)
        cutoffs = {}
        for months, label in [(3, "3_months"), (6, "6_months"), (12, "12_months")]:
            cutoff = (now - timedelta(days=months * 30)).isoformat()
            count = await collection.count_documents({config["date_field"]: {"$lt": cutoff}})
            cutoffs[label] = count

        stats.append({
            "collection": coll_name,
            "label": config["label"],
            "total": total,
            "oldest_date": str(oldest_date)[:10] if oldest_date else None,
            "newest_date": str(newest_date)[:10] if newest_date else None,
            "older_than_3_months": cutoffs["3_months"],
            "older_than_6_months": cutoffs["6_months"],
            "older_than_12_months": cutoffs["12_months"],
        })

    # Get archive history
    archives = await db.archive_history.find({}, {"_id": 0}).sort("archived_at", -1).to_list(20)

    return {"stats": stats, "archives": archives}


@router.get("/data-management/recommendations")
async def get_archive_recommendations(current_user: User = Depends(get_current_user)):
    """AI-powered smart archive recommendations based on collection growth patterns."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    recommendations = []
    now = datetime.now(timezone.utc)

    for coll_name, config in ARCHIVABLE_COLLECTIONS.items():
        collection = db[coll_name]
        total = await collection.count_documents({})

        if total == 0:
            continue

        date_field = config["date_field"]

        # Calculate growth rate (records in last 30 days vs previous 30 days)
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        sixty_days_ago = (now - timedelta(days=60)).isoformat()

        recent_count = await collection.count_documents({date_field: {"$gte": thirty_days_ago}})
        prev_count = await collection.count_documents({
            date_field: {"$gte": sixty_days_ago, "$lt": thirty_days_ago}
        })

        growth_rate = ((recent_count - prev_count) / max(prev_count, 1)) * 100 if prev_count > 0 else 0

        # Count old records by threshold
        old_6m = await collection.count_documents({date_field: {"$lt": (now - timedelta(days=180)).isoformat()}})
        old_12m = await collection.count_documents({date_field: {"$lt": (now - timedelta(days=365)).isoformat()}})

        # Determine priority and recommendation
        priority = "low"
        action = None
        reason = None
        suggested_months = None

        if total > 10000:
            priority = "critical"
            suggested_months = 6
            reason = f"Collection has {total:,} records. Large datasets can slow down queries and increase storage costs."
            action = f"Archive records older than 6 months ({old_6m:,} records)"
        elif total > 5000:
            priority = "high"
            suggested_months = 6
            reason = f"Collection has {total:,} records and is growing. Consider archiving to maintain performance."
            action = f"Archive records older than 6 months ({old_6m:,} records)"
        elif total > 1000 and old_12m > 0:
            priority = "medium"
            suggested_months = 12
            reason = f"{old_12m:,} records are over 12 months old. Archiving won't affect day-to-day operations."
            action = f"Archive records older than 12 months ({old_12m:,} records)"
        elif growth_rate > 50:
            priority = "medium"
            suggested_months = 12
            reason = f"Growth rate is {growth_rate:.0f}% month-over-month. At this rate, consider periodic archiving."
            action = f"Enable auto-archive for this collection"
        elif total > 500 and old_6m > total * 0.5:
            priority = "low"
            suggested_months = 12
            reason = f"Over half of records ({old_6m:,}/{total:,}) are older than 6 months."
            action = f"Archive records older than 12 months ({old_12m:,} records)"

        if action:
            recommendations.append({
                "collection": coll_name,
                "label": config["label"],
                "total_records": total,
                "priority": priority,
                "growth_rate_pct": round(growth_rate, 1),
                "recent_30d": recent_count,
                "old_6_months": old_6m,
                "old_12_months": old_12m,
                "suggested_months": suggested_months,
                "reason": reason,
                "action": action,
            })

    # Sort by priority: critical > high > medium > low
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recommendations.sort(key=lambda r: priority_order.get(r["priority"], 4))

    # Overall health score (0-100, higher is better)
    total_records = sum(r["total_records"] for r in recommendations) if recommendations else 0
    critical_count = sum(1 for r in recommendations if r["priority"] in ("critical", "high"))
    health_score = max(0, 100 - (critical_count * 20) - (len(recommendations) * 5) - min(total_records // 500, 30))

    return {
        "recommendations": recommendations,
        "health_score": health_score,
        "total_collections_analyzed": len(ARCHIVABLE_COLLECTIONS),
        "collections_needing_attention": len(recommendations),
        "analyzed_at": now.isoformat(),
    }


@router.post("/data-management/archive")
async def archive_data(body: dict, current_user: User = Depends(get_current_user)):
    """Archive old data by moving to archive collections."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    collection_name = body.get("collection")
    months = int(body.get("months", 12))

    if collection_name not in ARCHIVABLE_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Invalid collection. Valid: {list(ARCHIVABLE_COLLECTIONS.keys())}")

    config = ARCHIVABLE_COLLECTIONS[collection_name]
    date_field = config["date_field"]
    cutoff = (datetime.now(timezone.utc) - timedelta(days=months * 30)).isoformat()

    source = db[collection_name]
    archive = db[f"{collection_name}_archive"]

    # Find records to archive
    old_records = await source.find({date_field: {"$lt": cutoff}}, {"_id": 0}).to_list(50000)

    if not old_records:
        return {"message": "No records to archive", "archived_count": 0}

    # Insert into archive collection
    for rec in old_records:
        rec["archived_at"] = datetime.now(timezone.utc).isoformat()
        rec["archived_by"] = current_user.email

    await archive.insert_many(old_records)

    # Delete from source
    result = await source.delete_many({date_field: {"$lt": cutoff}})

    # Log the archive action
    log_entry = {
        "id": str(uuid.uuid4()),
        "collection": collection_name,
        "label": config["label"],
        "months_threshold": months,
        "cutoff_date": cutoff[:10],
        "archived_count": result.deleted_count,
        "archived_at": datetime.now(timezone.utc).isoformat(),
        "archived_by": current_user.email,
    }
    await db.archive_history.insert_one(log_entry)

    logger.info(f"Archived {result.deleted_count} records from {collection_name} older than {months} months")

    return {
        "message": f"Archived {result.deleted_count} records from {config['label']}",
        "archived_count": result.deleted_count,
        "cutoff_date": cutoff[:10],
    }


@router.post("/data-management/restore")
async def restore_archived_data(body: dict, current_user: User = Depends(get_current_user)):
    """Restore archived data back to the original collection."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    archive_id = body.get("archive_id")
    if not archive_id:
        raise HTTPException(status_code=400, detail="archive_id required")

    archive_entry = await db.archive_history.find_one({"id": archive_id}, {"_id": 0})
    if not archive_entry:
        raise HTTPException(status_code=404, detail="Archive record not found")

    collection_name = archive_entry["collection"]
    cutoff = archive_entry["cutoff_date"]
    archived_at = archive_entry["archived_at"]

    archive = db[f"{collection_name}_archive"]
    source = db[collection_name]

    # Find records that were archived in this batch
    records = await archive.find(
        {"archived_at": archived_at},
        {"_id": 0}
    ).to_list(50000)

    if not records:
        return {"message": "No records to restore", "restored_count": 0}

    # Remove archive metadata before restoring
    for rec in records:
        rec.pop("archived_at", None)
        rec.pop("archived_by", None)

    await source.insert_many(records)
    await archive.delete_many({"archived_at": archived_at})

    # Mark archive entry as restored
    await db.archive_history.update_one(
        {"id": archive_id},
        {"$set": {"restored_at": datetime.now(timezone.utc).isoformat(), "restored_by": current_user.email}}
    )

    return {"message": f"Restored {len(records)} records to {collection_name}", "restored_count": len(records)}


@router.delete("/data-management/purge")
async def purge_archived_data(body: dict, current_user: User = Depends(get_current_user)):
    """Permanently delete archived data (cannot be undone)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    archive_id = body.get("archive_id")
    if not archive_id:
        raise HTTPException(status_code=400, detail="archive_id required")

    archive_entry = await db.archive_history.find_one({"id": archive_id}, {"_id": 0})
    if not archive_entry:
        raise HTTPException(status_code=404, detail="Archive record not found")

    collection_name = archive_entry["collection"]
    archived_at = archive_entry["archived_at"]

    archive = db[f"{collection_name}_archive"]
    result = await archive.delete_many({"archived_at": archived_at})

    await db.archive_history.update_one(
        {"id": archive_id},
        {"$set": {"purged_at": datetime.now(timezone.utc).isoformat(), "purged_by": current_user.email}}
    )

    return {"message": f"Permanently deleted {result.deleted_count} archived records", "purged_count": result.deleted_count}


@router.get("/data-management/export/{collection_name}")
async def export_collection(collection_name: str, current_user: User = Depends(get_current_user)):
    """Export a collection as JSON for backup."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if collection_name not in ARCHIVABLE_COLLECTIONS:
        raise HTTPException(status_code=400, detail="Invalid collection")

    records = await db[collection_name].find({}, {"_id": 0}).to_list(50000)
    return {
        "collection": collection_name,
        "count": len(records),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "data": records,
    }


# =====================================================
# AUTO-ARCHIVE SCHEDULING
# =====================================================

@router.get("/data-management/auto-archive-settings")
async def get_auto_archive_settings(current_user: User = Depends(get_current_user)):
    """Get auto-archive configuration."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    settings = await db.auto_archive_settings.find_one({}, {"_id": 0})
    if not settings:
        settings = {
            "enabled": False,
            "frequency": "monthly",
            "day_of_month": 1,
            "hour": 2,
            "minute": 0,
            "default_months": 12,
            "collections": {name: {"enabled": False, "months": 12} for name in ARCHIVABLE_COLLECTIONS},
            "notify_on_archive": True,
            "last_run": None,
        }
    return settings


@router.put("/data-management/auto-archive-settings")
async def update_auto_archive_settings(body: dict, current_user: User = Depends(get_current_user)):
    """Update auto-archive configuration."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    body["updated_at"] = datetime.now(timezone.utc).isoformat()
    body["updated_by"] = current_user.email
    await db.auto_archive_settings.update_one({}, {"$set": body}, upsert=True)

    # Re-register the cron job
    from routers.scheduler import scheduler
    job_id = "ssc_auto_archive"
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass

    if body.get("enabled"):
        from apscheduler.triggers.cron import CronTrigger
        freq = body.get("frequency", "monthly")
        h = int(body.get("hour", 2))
        m = int(body.get("minute", 0))

        if freq == "weekly":
            dow = body.get("day_of_week", "sun")
            trigger = CronTrigger(day_of_week=dow, hour=h, minute=m)
        else:
            day = int(body.get("day_of_month", 1))
            trigger = CronTrigger(day=day, hour=h, minute=m)

        scheduler.add_job(run_auto_archive, trigger, id=job_id, replace_existing=True)

    return await get_auto_archive_settings(current_user)


async def run_auto_archive():
    """Automated archive job that runs on schedule."""
    settings = await db.auto_archive_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("enabled"):
        return

    total_archived = 0
    results = []

    for coll_name, coll_settings in settings.get("collections", {}).items():
        if not coll_settings.get("enabled") or coll_name not in ARCHIVABLE_COLLECTIONS:
            continue

        months = coll_settings.get("months", 12)
        config = ARCHIVABLE_COLLECTIONS[coll_name]
        date_field = config["date_field"]
        cutoff = (datetime.now(timezone.utc) - timedelta(days=months * 30)).isoformat()

        source = db[coll_name]
        archive = db[f"{coll_name}_archive"]

        old_records = await source.find({date_field: {"$lt": cutoff}}, {"_id": 0}).to_list(50000)
        if not old_records:
            continue

        for rec in old_records:
            rec["archived_at"] = datetime.now(timezone.utc).isoformat()
            rec["archived_by"] = "auto-archive"

        await archive.insert_many(old_records)
        result = await source.delete_many({date_field: {"$lt": cutoff}})

        log_entry = {
            "id": str(uuid.uuid4()),
            "collection": coll_name,
            "label": config["label"],
            "months_threshold": months,
            "cutoff_date": cutoff[:10],
            "archived_count": result.deleted_count,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "archived_by": "auto-archive",
        }
        await db.archive_history.insert_one(log_entry)
        total_archived += result.deleted_count
        results.append(f"{config['label']}: {result.deleted_count}")

    # Update last run
    await db.auto_archive_settings.update_one(
        {},
        {"$set": {"last_run": datetime.now(timezone.utc).isoformat(), "last_result": results}}
    )

    logger.info(f"Auto-archive completed: {total_archived} total records archived across {len(results)} collections")
