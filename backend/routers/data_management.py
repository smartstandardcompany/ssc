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
