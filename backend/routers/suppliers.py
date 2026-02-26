from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from database import db, get_current_user
from models import User, Supplier, SupplierCreate, SupplierPayment, SupplierPaymentCreate, SupplierCreditPayment

router = APIRouter()

@router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.branch_id and current_user.role != "admin":
        query["branch_id"] = current_user.branch_id
    suppliers = await db.suppliers.find(query, {"_id": 0}).to_list(1000)
    for supplier in suppliers:
        if isinstance(supplier.get('created_at'), str):
            supplier['created_at'] = datetime.fromisoformat(supplier['created_at'])
    return suppliers

@router.post("/suppliers", response_model=Supplier)
async def create_supplier(supplier_data: SupplierCreate, current_user: User = Depends(get_current_user)):
    data = supplier_data.model_dump()
    for f in ['branch_id', 'category', 'sub_category', 'phone', 'email']:
        if data.get(f) == '': data[f] = None
    supplier = Supplier(**data)
    supplier_dict = supplier.model_dump()
    supplier_dict["created_at"] = supplier_dict["created_at"].isoformat()
    await db.suppliers.insert_one(supplier_dict)
    return supplier

@router.put("/suppliers/{supplier_id}", response_model=Supplier)
async def update_supplier(supplier_id: str, supplier_data: SupplierCreate, current_user: User = Depends(get_current_user)):
    result = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Supplier not found")
    update_data = supplier_data.model_dump()
    for f in ['branch_id', 'category', 'sub_category', 'phone', 'email']:
        if update_data.get(f) == '': update_data[f] = None
    await db.suppliers.update_one({"id": supplier_id}, {"$set": update_data})
    updated = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Supplier(**updated)

@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, current_user: User = Depends(get_current_user)):
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted successfully"}

@router.post("/suppliers/{supplier_id}/pay-credit")
async def pay_supplier_credit(supplier_id: str, payment: SupplierCreditPayment, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if payment.amount > supplier["current_credit"]:
        raise HTTPException(status_code=400, detail="Payment amount exceeds current credit")
    new_credit = supplier["current_credit"] - payment.amount
    await db.suppliers.update_one({"id": supplier_id}, {"$set": {"current_credit": new_credit}})
    payment_record = SupplierPayment(supplier_id=supplier_id, supplier_name=supplier["name"], amount=payment.amount, payment_mode=payment.payment_mode, branch_id=payment.branch_id, date=datetime.now(timezone.utc), notes=f"Credit payment - Remaining: SAR {new_credit:.2f}", created_by=current_user.id)
    payment_dict = payment_record.model_dump()
    payment_dict["date"] = payment_dict["date"].isoformat()
    payment_dict["created_at"] = payment_dict["created_at"].isoformat()
    await db.supplier_payments.insert_one(payment_dict)
    return {"message": "Credit payment recorded", "remaining_credit": new_credit}

# Supplier Payment Routes
@router.get("/supplier-payments", response_model=List[SupplierPayment])
async def get_supplier_payments(current_user: User = Depends(get_current_user)):
    payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).sort("date", -1).to_list(1000)
    for payment in payments:
        if isinstance(payment.get('date'), str): payment['date'] = datetime.fromisoformat(payment['date'])
        if isinstance(payment.get('created_at'), str): payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    return payments

@router.post("/supplier-payments", response_model=SupplierPayment)
async def create_supplier_payment(payment_data: SupplierPaymentCreate, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": payment_data.supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if payment_data.payment_mode == "credit":
        credit_limit = supplier.get("credit_limit", 0); current_credit = supplier.get("current_credit", 0)
        new_credit = current_credit + payment_data.amount
        if credit_limit > 0 and new_credit > credit_limit:
            available = credit_limit - current_credit
            raise HTTPException(status_code=400, detail=f"Payment exceeds credit limit. Available: SAR {available:.2f}")
    payment = SupplierPayment(**payment_data.model_dump(), supplier_name=supplier["name"], created_by=current_user.id)
    payment_dict = payment.model_dump()
    payment_dict["date"] = payment_dict["date"].isoformat()
    payment_dict["created_at"] = payment_dict["created_at"].isoformat()
    await db.supplier_payments.insert_one(payment_dict)
    if payment_data.payment_mode == "credit":
        new_credit = supplier.get("current_credit", 0) + payment_data.amount
        await db.suppliers.update_one({"id": payment_data.supplier_id}, {"$set": {"current_credit": new_credit}})
    return payment

@router.delete("/supplier-payments/{payment_id}")
async def delete_supplier_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    result = await db.supplier_payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment deleted successfully"}

@router.get("/suppliers/{supplier_id}/payment-breakdown")
async def get_supplier_payment_breakdown(supplier_id: str, current_user: User = Depends(get_current_user)):
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    payments = await db.supplier_payments.find({"supplier_id": supplier_id}, {"_id": 0}).to_list(10000)
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
    total_cash = sum(p["amount"] for p in payments if p.get("payment_mode") == "cash")
    total_bank = sum(p["amount"] for p in payments if p.get("payment_mode") == "bank")
    total_credit = sum(p["amount"] for p in payments if p.get("payment_mode") == "credit")
    by_branch = {}
    for p in payments:
        bid = p.get("branch_id"); bname = branches.get(bid, "No Branch") if bid else "No Branch"
        if bname not in by_branch: by_branch[bname] = {"cash": 0, "bank": 0, "credit": 0, "total": 0}
        mode = p.get("payment_mode", "cash"); by_branch[bname][mode] = by_branch[bname].get(mode, 0) + p["amount"]; by_branch[bname]["total"] += p["amount"]
    return {"supplier_id": supplier_id, "supplier_name": supplier["name"], "total_cash": total_cash, "total_bank": total_bank, "total_credit": total_credit, "total": total_cash + total_bank + total_credit, "by_branch": by_branch}

@router.get("/suppliers/payment-summaries")
async def get_all_supplier_summaries(current_user: User = Depends(get_current_user)):
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
    result = {}
    for sup in suppliers:
        sid = sup["id"]; sp = [p for p in payments if p.get("supplier_id") == sid]
        by_branch = {}
        for p in sp:
            bid = p.get("branch_id"); bname = branches.get(bid, "No Branch") if bid else "No Branch"
            if bname not in by_branch: by_branch[bname] = {"cash": 0, "bank": 0}
            if p.get("payment_mode") == "cash": by_branch[bname]["cash"] += p["amount"]
            elif p.get("payment_mode") == "bank": by_branch[bname]["bank"] += p["amount"]
        result[sid] = {"cash": sum(p["amount"] for p in sp if p.get("payment_mode") == "cash"), "bank": sum(p["amount"] for p in sp if p.get("payment_mode") == "bank"), "by_branch": by_branch}
    return result
