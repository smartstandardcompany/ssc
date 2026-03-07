from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone

from database import db, get_current_user, require_permission, get_branch_filter
from models import User, Sale, SaleCreate, SalePayment

router = APIRouter()

@router.get("/sales")
async def get_sales(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "sales", "read")
    query = get_branch_filter(current_user)
    if start_date:
        query["date"] = query.get("date", {})
        query["date"]["$gte"] = start_date
    if end_date:
        if "date" not in query: query["date"] = {}
        query["date"]["$lte"] = end_date + "T23:59:59"
    
    total = await db.sales.count_documents(query)
    skip = (page - 1) * limit
    sales = await db.sales.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    result = []
    for sale in sales:
        if isinstance(sale.get('date'), str): sale['date'] = datetime.fromisoformat(sale['date'])
        if isinstance(sale.get('created_at'), str): sale['created_at'] = datetime.fromisoformat(sale['created_at'])
        if 'discount' not in sale: sale['discount'] = 0
        if 'final_amount' not in sale: sale['final_amount'] = sale.get('amount', 0) - sale.get('discount', 0)
        # Ensure required fields exist (handle legacy/waiter data)
        if 'sale_type' not in sale: sale['sale_type'] = sale.get('payment_mode', 'cash')
        if 'created_by' not in sale: sale['created_by'] = sale.get('waiter_id', 'system')
        if 'credit_amount' not in sale: sale['credit_amount'] = 0
        if 'credit_received' not in sale: sale['credit_received'] = 0
        if 'payment_details' not in sale or sale['payment_details'] is None:
            payment_mode = sale.get('payment_mode', 'cash'); payment_status = sale.get('payment_status', 'received')
            if payment_mode == 'credit':
                if payment_status == 'pending':
                    sale['payment_details'] = []; sale['credit_amount'] = sale['final_amount']; sale['credit_received'] = 0
                else:
                    received_mode = sale.get('received_mode', 'cash')
                    sale['payment_details'] = [{"mode": received_mode, "amount": sale['final_amount']}]; sale['credit_amount'] = 0; sale['credit_received'] = 0
            else:
                sale['payment_details'] = [{"mode": payment_mode, "amount": sale['final_amount']}]; sale['credit_amount'] = 0; sale['credit_received'] = 0
        result.append(sale)
    return {"data": result, "total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit}

@router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "sales", "write")
    discount = sale_data.discount or 0; final_amount = sale_data.amount - discount
    total_cash_bank = sum(p["amount"] for p in sale_data.payment_details if p["mode"] in ["cash", "bank"])
    total_credit = sum(p["amount"] for p in sale_data.payment_details if p["mode"] == "credit")
    credit_amount = max(0, total_credit if total_credit > 0 else final_amount - total_cash_bank)
    sale_data_dict = sale_data.model_dump(); sale_data_dict.pop('discount', None)
    for f in ['branch_id', 'customer_id']:
        if not sale_data_dict.get(f): sale_data_dict[f] = None
    sale = Sale(**sale_data_dict, discount=discount, final_amount=final_amount, credit_amount=credit_amount, credit_received=0, created_by=current_user.id)
    sale_dict = sale.model_dump()
    sale_dict["date"] = sale_dict["date"].isoformat(); sale_dict["created_at"] = sale_dict["created_at"].isoformat()
    await db.sales.insert_one(sale_dict)
    # Log activity
    from routers.activity_logs import log_activity
    await log_activity(current_user, "create", "sales", sale.id, {"amount": final_amount})
    return sale

@router.post("/sales/{sale_id}/receive-credit")
async def receive_credit_payment(sale_id: str, payment: SalePayment, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "sales", "write")
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    remaining_credit = sale["credit_amount"] - sale["credit_received"]
    discount = payment.discount or 0; total_settle = payment.amount + discount
    if total_settle > remaining_credit + 0.01:
        raise HTTPException(status_code=400, detail=f"Payment + discount exceeds remaining credit of ${remaining_credit:.2f}")
    new_credit_received = sale["credit_received"] + total_settle
    new_payment_details = list(sale.get("payment_details", []))
    if payment.amount > 0: new_payment_details.append({"mode": payment.payment_mode, "amount": payment.amount})
    if discount > 0: new_payment_details.append({"mode": "discount", "amount": discount})
    await db.sales.update_one({"id": sale_id}, {"$set": {"credit_received": new_credit_received, "payment_details": new_payment_details, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Credit payment received", "received": payment.amount, "discount": discount, "remaining_credit": remaining_credit - total_settle}

@router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "sales", "write")
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    from routers.access_policies import check_delete_permission
    await check_delete_permission(current_user, "sales", sale.get("date"))
    result = await db.sales.delete_one({"id": sale_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sale not found")
    from routers.activity_logs import log_activity
    await log_activity(current_user, "delete", "sales", sale_id)
    return {"message": "Sale deleted successfully"}
