from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from database import db, get_current_user, require_permission
from models import User, StockTransfer, StockEntry, StockUsage

router = APIRouter()


@router.get("/stock-transfers")
async def get_stock_transfers(status: str = None, branch_id: str = None, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "stock", "read")
    query = {}
    if status:
        query["status"] = status
    if branch_id:
        query["$or"] = [{"from_branch_id": branch_id}, {"to_branch_id": branch_id}]
    transfers = await db.stock_transfers.find(query, {"_id": 0}).sort("requested_at", -1).to_list(500)
    # Enrich with branch names
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    users = await db.users.find({}, {"_id": 0}).to_list(500)
    b_map = {b["id"]: b["name"] for b in branches}
    u_map = {u["id"]: u["name"] for u in users}
    for t in transfers:
        t["from_branch_name"] = b_map.get(t.get("from_branch_id"), "N/A")
        t["to_branch_name"] = b_map.get(t.get("to_branch_id"), "N/A")
        t["requested_by_name"] = u_map.get(t.get("requested_by"), "N/A")
        t["reviewed_by_name"] = u_map.get(t.get("reviewed_by"), "") if t.get("reviewed_by") else ""
    return transfers


@router.post("/stock-transfers")
async def create_stock_transfer(body: dict, current_user: User = Depends(get_current_user)):
    from_branch = body.get("from_branch_id")
    to_branch = body.get("to_branch_id")
    items = body.get("items", [])
    if not from_branch or not to_branch:
        raise HTTPException(status_code=400, detail="Both source and destination branches required")
    if from_branch == to_branch:
        raise HTTPException(status_code=400, detail="Source and destination must be different")
    if not items or len(items) == 0:
        raise HTTPException(status_code=400, detail="At least one item required")
    # Validate items exist
    for item in items:
        db_item = await db.items.find_one({"id": item["item_id"]}, {"_id": 0})
        if not db_item:
            raise HTTPException(status_code=404, detail=f"Item {item.get('item_id')} not found")
        item["item_name"] = db_item["name"]
        item["unit"] = db_item.get("unit", "pc")
    transfer = StockTransfer(
        from_branch_id=from_branch, to_branch_id=to_branch,
        items=items, reason=body.get("reason", ""),
        requested_by=current_user.id, notes=body.get("notes", ""),
    )
    t_dict = transfer.model_dump()
    t_dict["requested_at"] = t_dict["requested_at"].isoformat()
    await db.stock_transfers.insert_one(t_dict)
    # Create notification
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    b_map = {b["id"]: b["name"] for b in branches}
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "type": "stock_transfer_request",
        "message": f"Stock transfer request from {b_map.get(to_branch, 'N/A')} to {b_map.get(from_branch, 'N/A')}: {len(items)} items",
        "data": {"transfer_id": transfer.id}, "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Try WhatsApp notification
    try:
        config = await db.whatsapp_config.find_one({}, {"_id": 0})
        if config and config.get("account_sid") and config.get("auth_token"):
            from twilio.rest import Client
            client = Client(config["account_sid"], config["auth_token"])
            item_lines = "\n".join(f"  - {i['item_name']}: {i['quantity']} {i.get('unit', 'pc')}" for i in items)
            msg = f"*Stock Transfer Request*\nFrom: {b_map.get(to_branch, 'N/A')}\nTo: {b_map.get(from_branch, 'N/A')}\nItems:\n{item_lines}\nReason: {body.get('reason', 'N/A')}"
            recipients = [r.strip() for r in config.get("recipient_number", "").split(",") if r.strip()]
            for r in recipients:
                try:
                    client.messages.create(from_=f'whatsapp:{config["phone_number"]}', body=msg, to=f'whatsapp:{r}')
                except:
                    pass
    except:
        pass
    return {k: v for k, v in t_dict.items() if k != '_id'}


@router.put("/stock-transfers/{transfer_id}/approve")
async def approve_transfer(transfer_id: str, body: dict = {}, current_user: User = Depends(get_current_user)):
    t = await db.stock_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Transfer is already {t['status']}")
    await db.stock_transfers.update_one({"id": transfer_id}, {"$set": {
        "status": "approved", "reviewed_by": current_user.id,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }})
    return {"message": "Transfer approved"}


@router.put("/stock-transfers/{transfer_id}/reject")
async def reject_transfer(transfer_id: str, body: dict = {}, current_user: User = Depends(get_current_user)):
    t = await db.stock_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Transfer is already {t['status']}")
    await db.stock_transfers.update_one({"id": transfer_id}, {"$set": {
        "status": "rejected", "reviewed_by": current_user.id,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "rejection_reason": body.get("reason", ""),
    }})
    return {"message": "Transfer rejected"}


@router.put("/stock-transfers/{transfer_id}/complete")
async def complete_transfer(transfer_id: str, current_user: User = Depends(get_current_user)):
    t = await db.stock_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t["status"] != "approved":
        raise HTTPException(status_code=400, detail="Transfer must be approved before completing")
    now = datetime.now(timezone.utc)
    # Stock-out from source branch, Stock-in at destination branch
    for item in t["items"]:
        qty = float(item["quantity"])
        item_doc = await db.items.find_one({"id": item["item_id"]}, {"_id": 0})
        unit_cost = item_doc.get("cost_price", 0) if item_doc else 0
        # Stock OUT from source
        usage = StockUsage(
            item_id=item["item_id"], item_name=item["item_name"],
            branch_id=t["from_branch_id"], quantity=qty,
            used_by="transfer", notes=f"Transfer to {t['to_branch_id'][:8]}",
            date=now, created_by=current_user.id,
        )
        u_dict = usage.model_dump()
        u_dict["date"] = u_dict["date"].isoformat()
        u_dict["created_at"] = u_dict["created_at"].isoformat()
        await db.stock_usage.insert_one(u_dict)
        # Stock IN at destination
        entry = StockEntry(
            item_id=item["item_id"], item_name=item["item_name"],
            branch_id=t["to_branch_id"], quantity=qty,
            unit_cost=unit_cost, source="transfer",
            notes=f"Transfer from {t['from_branch_id'][:8]}",
            date=now, created_by=current_user.id,
        )
        e_dict = entry.model_dump()
        e_dict["date"] = e_dict["date"].isoformat()
        e_dict["created_at"] = e_dict["created_at"].isoformat()
        await db.stock_entries.insert_one(e_dict)
    await db.stock_transfers.update_one({"id": transfer_id}, {"$set": {
        "status": "completed", "completed_at": now.isoformat(),
    }})
    return {"message": "Transfer completed. Stock adjusted."}


@router.delete("/stock-transfers/{transfer_id}")
async def delete_transfer(transfer_id: str, current_user: User = Depends(get_current_user)):
    t = await db.stock_transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t["status"] == "completed":
        raise HTTPException(status_code=400, detail="Cannot delete completed transfer")
    await db.stock_transfers.delete_one({"id": transfer_id})
    return {"message": "Transfer deleted"}
