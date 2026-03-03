from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from database import db, get_current_user, require_permission, get_branch_filter
from models import User, Supplier, SupplierCreate, SupplierPayment, SupplierPaymentCreate, SupplierCreditPayment

router = APIRouter()

@router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(current_user: User = Depends(get_current_user)):
    require_permission(current_user, "suppliers", "read")
    # For branch-restricted users, include suppliers with their branch OR no branch (all branches)
    if current_user.role == "admin":
        query = {}
    elif current_user.branch_id:
        query = {"$or": [
            {"branch_id": current_user.branch_id},
            {"branch_id": None},
            {"branch_id": ""},
            {"branch_id": {"$exists": False}}
        ]}
    else:
        query = {}
    
    suppliers = await db.suppliers.find(query, {"_id": 0}).to_list(1000)
    for supplier in suppliers:
        if isinstance(supplier.get('created_at'), str):
            supplier['created_at'] = datetime.fromisoformat(supplier['created_at'])
    return suppliers


@router.get("/suppliers/names")
async def get_supplier_names(current_user: User = Depends(get_current_user)):
    """Get just supplier names and IDs for dropdowns. No permission required beyond login."""
    # For branch-restricted users, include suppliers with their branch OR no branch (all branches)
    if current_user.role == "admin":
        query = {}
    elif current_user.branch_id:
        # Include suppliers for user's branch OR suppliers with no branch (available to all)
        query = {"$or": [
            {"branch_id": current_user.branch_id},
            {"branch_id": None},
            {"branch_id": ""},
            {"branch_id": {"$exists": False}}
        ]}
    else:
        query = {}
    
    suppliers = await db.suppliers.find(query, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    return [{"id": s["id"], "name": s["name"]} for s in suppliers]


@router.put("/suppliers/recalculate-all-balances")
async def recalculate_all_supplier_balances(current_user: User = Depends(get_current_user)):
    """Recalculate all supplier balances based on actual expenses and payments."""
    require_permission(current_user, "suppliers", "write")
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    all_credit_expenses = await db.expenses.find({"payment_mode": "credit", "supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(50000)
    all_payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(50000)
    
    results = []
    for supplier in suppliers:
        sid = supplier["id"]
        # Credit expenses add to balance
        total_credit = sum(e.get("amount", 0) for e in all_credit_expenses if e.get("supplier_id") == sid)
        # Cash/bank payments reduce balance
        total_paid = sum(p.get("amount", 0) for p in all_payments if p.get("supplier_id") == sid and p.get("payment_mode") in ["cash", "bank"])
        
        correct_balance = max(0, total_credit - total_paid)
        old_balance = supplier.get("current_credit", 0)
        
        if old_balance != correct_balance:
            await db.suppliers.update_one({"id": sid}, {"$set": {"current_credit": correct_balance}})
            results.append({
                "supplier_name": supplier["name"],
                "old_balance": old_balance,
                "new_balance": correct_balance
            })
    
    return {
        "suppliers_updated": len(results),
        "updates": results
    }


@router.post("/suppliers", response_model=Supplier)
async def create_supplier(supplier_data: SupplierCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "suppliers", "write")
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
    require_permission(current_user, "suppliers", "write")
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
    require_permission(current_user, "suppliers", "write")
    result = await db.suppliers.delete_one({"id": supplier_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"message": "Supplier deleted successfully"}

@router.post("/suppliers/{supplier_id}/pay-credit")
async def pay_supplier_credit(supplier_id: str, payment: SupplierCreditPayment, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "supplier_payments", "write")
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
    require_permission(current_user, "supplier_payments", "read")
    payments = await db.supplier_payments.find({"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).sort("date", -1).to_list(1000)
    for payment in payments:
        if isinstance(payment.get('date'), str): payment['date'] = datetime.fromisoformat(payment['date'])
        if isinstance(payment.get('created_at'), str): payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    return payments

@router.post("/supplier-payments", response_model=SupplierPayment)
async def create_supplier_payment(payment_data: SupplierPaymentCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "supplier_payments", "write")
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
    require_permission(current_user, "supplier_payments", "write")
    
    # First get the payment to check payment mode and update supplier balance
    payment = await db.supplier_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    supplier_id = payment.get("supplier_id")
    payment_mode = payment.get("payment_mode")
    amount = payment.get("amount", 0)
    
    if supplier_id:
        supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
        if supplier:
            current_credit = supplier.get("current_credit", 0)
            
            if payment_mode == "credit":
                # Credit payment was adding to supplier credit - reverse by reducing
                new_credit = max(0, current_credit - amount)
            elif payment_mode in ["cash", "bank"]:
                # Cash/Bank payment was reducing supplier credit (paying them back)
                # Reverse by increasing credit (you now owe them again)
                new_credit = current_credit + amount
            else:
                new_credit = current_credit
            
            await db.suppliers.update_one(
                {"id": supplier_id},
                {"$set": {"current_credit": new_credit}}
            )
    
    result = await db.supplier_payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment deleted successfully", "supplier_balance_updated": True}

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


@router.get("/suppliers/{supplier_id}/ledger")
async def get_supplier_ledger(supplier_id: str, current_user: User = Depends(get_current_user)):
    """
    Get complete supplier ledger showing:
    - Purchase Invoices (from expenses): Cash purchases and Credit purchases
    - Credit Payments: Payments made to reduce credit balance
    """
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Get all expenses (purchase invoices) for this supplier
    expenses = await db.expenses.find(
        {"supplier_id": supplier_id}, {"_id": 0}
    ).sort("date", -1).to_list(10000)
    
    # Get all payments made to this supplier
    payments = await db.supplier_payments.find(
        {"supplier_id": supplier_id}, {"_id": 0}
    ).sort("date", -1).to_list(10000)
    
    # Build ledger entries
    ledger = []
    running_balance = 0
    
    # Combine and sort all transactions by date
    all_transactions = []
    
    for exp in expenses:
        all_transactions.append({
            "id": exp["id"],
            "date": exp.get("date"),
            "type": "purchase_invoice",
            "sub_type": "credit" if exp.get("payment_mode") == "credit" else "cash",
            "description": exp.get("description", "Purchase"),
            "category": exp.get("category", ""),
            "amount": exp.get("amount", 0),
            "payment_mode": exp.get("payment_mode"),
            "affects_balance": exp.get("payment_mode") == "credit",  # Only credit affects balance
            "source": "expense"
        })
    
    for pay in payments:
        # Payments via pay-credit (cash/bank) reduce balance
        # Payments with mode=credit increase balance (adding more credit)
        is_credit_payment = pay.get("payment_mode") in ["cash", "bank"]
        all_transactions.append({
            "id": pay["id"],
            "date": pay.get("date"),
            "type": "credit_payment" if is_credit_payment else "credit_addition",
            "sub_type": pay.get("payment_mode"),
            "description": pay.get("notes", "Payment to supplier"),
            "category": "",
            "amount": pay.get("amount", 0),
            "payment_mode": pay.get("payment_mode"),
            "affects_balance": True,
            "source": "supplier_payment"
        })
    
    # Sort by date descending
    all_transactions.sort(key=lambda x: x.get("date") or "", reverse=True)
    
    # Calculate totals
    total_purchases_cash = sum(e["amount"] for e in expenses if e.get("payment_mode") in ["cash", "bank"])
    total_purchases_credit = sum(e["amount"] for e in expenses if e.get("payment_mode") == "credit")
    total_credit_paid = sum(p["amount"] for p in payments if p.get("payment_mode") in ["cash", "bank"])
    total_credit_added = sum(p["amount"] for p in payments if p.get("payment_mode") == "credit")
    
    current_balance = supplier.get("current_credit", 0)
    
    return {
        "supplier_id": supplier_id,
        "supplier_name": supplier["name"],
        "current_balance": current_balance,
        "summary": {
            "total_purchases_cash": total_purchases_cash,
            "total_purchases_credit": total_purchases_credit,
            "total_credit_paid": total_credit_paid,
            "total_credit_added": total_credit_added,
            "purchase_invoices_count": len(expenses),
            "payments_count": len(payments)
        },
        "transactions": all_transactions
    }


@router.post("/suppliers/{supplier_id}/recalculate-balance")
async def recalculate_supplier_balance(supplier_id: str, current_user: User = Depends(get_current_user)):
    """Recalculate supplier balance based on actual credit expenses and payments."""
    require_permission(current_user, "suppliers", "write")
    supplier = await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Get all credit expenses for this supplier
    credit_expenses = await db.expenses.find({
        "supplier_id": supplier_id,
        "payment_mode": "credit"
    }, {"_id": 0}).to_list(10000)
    total_credit_added = sum(e.get("amount", 0) for e in credit_expenses)
    
    # Get all credit payments made to this supplier (money paid back)
    credit_payments = await db.supplier_payments.find({
        "supplier_id": supplier_id
    }, {"_id": 0}).to_list(10000)
    # Only count cash/bank payments as they reduce credit
    total_paid = sum(p.get("amount", 0) for p in credit_payments if p.get("payment_mode") in ["cash", "bank"])
    
    # Calculate correct balance
    correct_balance = max(0, total_credit_added - total_paid)
    old_balance = supplier.get("current_credit", 0)
    
    await db.suppliers.update_one(
        {"id": supplier_id},
        {"$set": {"current_credit": correct_balance}}
    )
    
    return {
        "supplier_id": supplier_id,
        "supplier_name": supplier["name"],
        "old_balance": old_balance,
        "new_balance": correct_balance,
        "total_credit_expenses": total_credit_added,
        "total_payments": total_paid,
        "message": f"Balance updated from {old_balance} to {correct_balance}"
    }


@router.post("/suppliers/migrate-payments-to-bills")
async def migrate_payments_to_bills(current_user: User = Depends(get_current_user)):
    """
    Migrate supplier payments to purchase bills (expenses).
    This converts entries in supplier_payments to expenses with the correct supplier_id.
    After migration, supplier balances are recalculated.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    import uuid
    
    # Get all supplier payments
    payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(50000)
    
    if not payments:
        return {"message": "No supplier payments to migrate", "migrated": 0}
    
    migrated_count = 0
    errors = []
    
    for payment in payments:
        try:
            # Create expense entry from payment
            expense = {
                "id": str(uuid.uuid4()),
                "amount": payment.get("amount", 0),
                "category": "Supplier Purchase",
                "description": payment.get("notes") or f"Migrated from supplier payment - {payment.get('supplier_name', 'Unknown')}",
                "payment_mode": payment.get("payment_mode", "credit"),  # Assume credit if buying on account
                "supplier_id": payment.get("supplier_id"),
                "branch_id": payment.get("branch_id", ""),
                "date": payment.get("date"),
                "created_by": payment.get("created_by"),
                "created_at": payment.get("created_at") or datetime.now(timezone.utc).isoformat(),
                "migrated_from": "supplier_payment",
                "original_payment_id": payment.get("id")
            }
            
            # Insert as expense
            await db.expenses.insert_one(expense)
            
            # Delete the old payment
            await db.supplier_payments.delete_one({"id": payment["id"]})
            
            migrated_count += 1
        except Exception as e:
            errors.append({"payment_id": payment.get("id"), "error": str(e)})
    
    # Recalculate all supplier balances
    suppliers = await db.suppliers.find({}, {"_id": 0}).to_list(1000)
    all_credit_expenses = await db.expenses.find(
        {"payment_mode": "credit", "supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}
    ).to_list(50000)
    all_payments = await db.supplier_payments.find(
        {"supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}
    ).to_list(50000)
    
    balance_updates = []
    for supplier in suppliers:
        sid = supplier["id"]
        total_credit = sum(e.get("amount", 0) for e in all_credit_expenses if e.get("supplier_id") == sid)
        total_paid = sum(p.get("amount", 0) for p in all_payments if p.get("supplier_id") == sid and p.get("payment_mode") in ["cash", "bank"])
        
        new_balance = max(0, total_credit - total_paid)
        old_balance = supplier.get("current_credit", 0)
        
        await db.suppliers.update_one({"id": sid}, {"$set": {"current_credit": new_balance}})
        
        if old_balance != new_balance:
            balance_updates.append({
                "supplier": supplier["name"],
                "old": old_balance,
                "new": new_balance
            })
    
    return {
        "message": f"Migration complete! {migrated_count} payments converted to purchase bills.",
        "migrated_count": migrated_count,
        "errors": errors,
        "balance_updates": balance_updates,
        "note": "All supplier payments have been converted to expenses (purchase bills) with payment_mode=credit. Balances recalculated."
    }


@router.get("/suppliers/migration-preview")
async def preview_migration(current_user: User = Depends(get_current_user)):
    """Preview what will be migrated without actually doing it."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    payments = await db.supplier_payments.find({}, {"_id": 0}).to_list(50000)
    
    # Group by supplier
    by_supplier = {}
    for p in payments:
        sname = p.get("supplier_name", "Unknown")
        if sname not in by_supplier:
            by_supplier[sname] = {"count": 0, "total": 0, "payments": []}
        by_supplier[sname]["count"] += 1
        by_supplier[sname]["total"] += p.get("amount", 0)
        by_supplier[sname]["payments"].append({
            "id": p.get("id"),
            "amount": p.get("amount"),
            "mode": p.get("payment_mode"),
            "date": p.get("date"),
            "notes": p.get("notes")
        })
    
    return {
        "total_payments": len(payments),
        "total_amount": sum(p.get("amount", 0) for p in payments),
        "by_supplier": by_supplier,
        "action": "These will be converted to purchase bills (expenses) with payment_mode matching original. Run POST /suppliers/migrate-payments-to-bills to execute."
    }
