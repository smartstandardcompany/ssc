from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from database import db, get_current_user, require_permission
from models import User, Branch, BranchCreate, CashTransfer, CashTransferCreate, BranchPayback

router = APIRouter()

@router.get("/branches", response_model=List[Branch])
async def get_branches(current_user: User = Depends(get_current_user)):
    branches = await db.branches.find({}, {"_id": 0}).to_list(1000)
    for branch in branches:
        if isinstance(branch.get('created_at'), str):
            branch['created_at'] = datetime.fromisoformat(branch['created_at'])
    return branches

@router.post("/branches", response_model=Branch)
async def create_branch(branch_data: BranchCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "branches", "write")
    branch = Branch(**branch_data.model_dump())
    branch_dict = branch.model_dump()
    branch_dict["created_at"] = branch_dict["created_at"].isoformat()
    await db.branches.insert_one(branch_dict)
    return branch

@router.put("/branches/{branch_id}", response_model=Branch)
async def update_branch(branch_id: str, branch_data: BranchCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "branches", "write")
    result = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Branch not found")
    await db.branches.update_one({"id": branch_id}, {"$set": branch_data.model_dump()})
    updated = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Branch(**updated)

@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, current_user: User = Depends(get_current_user)):
    result = await db.branches.delete_one({"id": branch_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted successfully"}

@router.get("/branches/{branch_id}/summary")
async def get_branch_summary(branch_id: str, current_user: User = Depends(get_current_user)):
    branch = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    sales = await db.sales.find({"branch_id": branch_id}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find({"branch_id": branch_id}, {"_id": 0}).to_list(10000)
    sp = await db.supplier_payments.find({"branch_id": branch_id, "supplier_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(10000)
    total_sales = sum(s.get("final_amount", s.get("amount", 0)) for s in sales)
    cash_sales = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "cash")
    bank_sales = sum(p["amount"] for s in sales for p in s.get("payment_details", []) if p.get("mode") == "bank")
    credit_sales = sum(s.get("credit_amount", 0) - s.get("credit_received", 0) for s in sales)
    total_expenses = sum(e["amount"] for e in expenses)
    exp_cash = sum(e["amount"] for e in expenses if e.get("payment_mode") == "cash")
    exp_bank = sum(e["amount"] for e in expenses if e.get("payment_mode") == "bank")
    total_sp = sum(p["amount"] for p in sp)
    sp_cash = sum(p["amount"] for p in sp if p.get("payment_mode") == "cash")
    sp_bank = sum(p["amount"] for p in sp if p.get("payment_mode") == "bank")
    exp_categories = {}
    for e in expenses:
        cat = e.get("category", "other")
        exp_categories[cat] = exp_categories.get(cat, 0) + e["amount"]
    recs = await db.recurring_expenses.find({"$or": [{"branch_id": branch_id}, {"branch_id": None}]}, {"_id": 0}).to_list(100)
    monthly_fixed = sum(r["amount"] for r in recs if r.get("frequency") == "monthly")
    return {
        "branch_id": branch_id, "branch_name": branch["name"],
        "total_sales": total_sales, "sales_cash": cash_sales, "sales_bank": bank_sales, "sales_credit": credit_sales, "sales_count": len(sales),
        "total_expenses": total_expenses, "expenses_cash": exp_cash, "expenses_bank": exp_bank, "expenses_count": len(expenses),
        "total_supplier_payments": total_sp, "sp_cash": sp_cash, "sp_bank": sp_bank, "sp_count": len(sp),
        "net_profit": total_sales - total_expenses - total_sp,
        "cash_in_hand": cash_sales - exp_cash - sp_cash,
        "bank_in_hand": bank_sales - exp_bank - sp_bank,
        "expense_categories": exp_categories,
        "monthly_fixed": monthly_fixed,
        "is_loss": (total_sales - total_expenses - total_sp) < 0
    }

# Cash Transfer Routes
@router.get("/cash-transfers")
async def get_cash_transfers(current_user: User = Depends(get_current_user)):
    transfers = await db.cash_transfers.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    for t in transfers:
        for f in ['date', 'created_at']:
            if isinstance(t.get(f), str):
                t[f] = datetime.fromisoformat(t[f])
    return transfers

@router.post("/cash-transfers")
async def create_cash_transfer(data: CashTransferCreate, current_user: User = Depends(get_current_user)):
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
    from_name = branches.get(data.from_branch_id, "Office") if data.from_branch_id else "Office"
    to_name = branches.get(data.to_branch_id, "Office") if data.to_branch_id else "Office"
    transfer = CashTransfer(**data.model_dump(), from_branch_name=from_name, to_branch_name=to_name, created_by=current_user.id)
    t_dict = transfer.model_dump()
    t_dict["date"] = t_dict["date"].isoformat()
    t_dict["created_at"] = t_dict["created_at"].isoformat()
    for f in ['from_branch_id', 'to_branch_id']:
        if t_dict.get(f) == '':
            t_dict[f] = None
    await db.cash_transfers.insert_one(t_dict)
    return {k: v for k, v in t_dict.items() if k != '_id'}

@router.delete("/cash-transfers/{transfer_id}")
async def delete_cash_transfer(transfer_id: str, current_user: User = Depends(get_current_user)):
    result = await db.cash_transfers.delete_one({"id": transfer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return {"message": "Transfer deleted"}

# Branch Payback Routes
@router.get("/branch-paybacks")
async def get_branch_paybacks(current_user: User = Depends(get_current_user)):
    paybacks = await db.branch_paybacks.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    for p in paybacks:
        for f in ['date', 'created_at']:
            if isinstance(p.get(f), str): p[f] = datetime.fromisoformat(p[f])
    return paybacks

@router.post("/branch-paybacks")
async def create_branch_payback(body: dict, current_user: User = Depends(get_current_user)):
    branches = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
    payback = BranchPayback(
        from_branch_id=body["from_branch_id"], to_branch_id=body["to_branch_id"],
        from_branch_name=branches.get(body["from_branch_id"], "?"), to_branch_name=branches.get(body["to_branch_id"], "?"),
        amount=float(body["amount"]), payment_mode=body.get("payment_mode", "cash"),
        date=datetime.fromisoformat(body["date"]), notes=body.get("notes", ""), created_by=current_user.id
    )
    p_dict = payback.model_dump()
    p_dict["date"] = p_dict["date"].isoformat()
    p_dict["created_at"] = p_dict["created_at"].isoformat()
    await db.branch_paybacks.insert_one(p_dict)
    return {k: v for k, v in p_dict.items() if k != '_id'}
