from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone

from database import db, get_current_user, require_permission, get_branch_filter
from models import User, Expense, ExpenseCreate, RecurringExpense, RecurringExpenseCreate

import uuid

router = APIRouter()

@router.get("/expenses")
async def get_expenses(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, "expenses", "read")
    query = get_branch_filter(current_user)
    if start_date:
        query["date"] = query.get("date", {})
        query["date"]["$gte"] = start_date
    if end_date:
        if "date" not in query: query["date"] = {}
        query["date"]["$lte"] = end_date + "T23:59:59"
    
    total = await db.expenses.count_documents(query)
    skip = (page - 1) * limit
    expenses = await db.expenses.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    for expense in expenses:
        if isinstance(expense.get('date'), str): expense['date'] = datetime.fromisoformat(expense['date'])
        if isinstance(expense.get('created_at'), str): expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    return {"data": expenses, "total": total, "page": page, "limit": limit, "pages": (total + limit - 1) // limit}

@router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "expenses", "write")
    data = expense_data.model_dump()
    for f in ['branch_id', 'supplier_id', 'sub_category', 'expense_for_branch_id']:
        if data.get(f) == '': data[f] = None
    if data.get('supplier_id') and expense_data.payment_mode == "credit":
        supplier = await db.suppliers.find_one({"id": data['supplier_id']}, {"_id": 0})
        if supplier:
            credit_limit = supplier.get("credit_limit", 0); current_credit = supplier.get("current_credit", 0)
            new_credit = current_credit + expense_data.amount
            if credit_limit > 0 and new_credit > credit_limit:
                available = credit_limit - current_credit
                raise HTTPException(status_code=400, detail=f"Expense exceeds supplier credit limit. Available: SAR {available:.2f}")
    expense = Expense(**data, created_by=current_user.id)
    expense_dict = expense.model_dump()
    expense_dict["date"] = expense_dict["date"].isoformat(); expense_dict["created_at"] = expense_dict["created_at"].isoformat()
    await db.expenses.insert_one(expense_dict)
    if data.get('supplier_id') and expense_data.payment_mode == "credit":
        supplier = await db.suppliers.find_one({"id": data['supplier_id']}, {"_id": 0})
        if supplier:
            new_credit = supplier.get("current_credit", 0) + expense_data.amount
            await db.suppliers.update_one({"id": data['supplier_id']}, {"$set": {"current_credit": new_credit}})
    # Log activity
    from routers.activity_logs import log_activity
    await log_activity(current_user, "create", "expenses", expense.id, {"amount": expense_data.amount, "category": expense_data.category})
    return expense

@router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "expenses", "write")
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    from routers.access_policies import check_delete_permission
    await check_delete_permission(current_user, "expenses", expense.get("date"))
    
    # If expense was on credit with a supplier, reduce their credit balance
    if expense.get("supplier_id") and expense.get("payment_mode") == "credit":
        supplier = await db.suppliers.find_one({"id": expense["supplier_id"]}, {"_id": 0})
        if supplier:
            new_credit = max(0, supplier.get("current_credit", 0) - expense.get("amount", 0))
            await db.suppliers.update_one(
                {"id": expense["supplier_id"]}, 
                {"$set": {"current_credit": new_credit}}
            )
    
    result = await db.expenses.delete_one({"id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    # Log activity
    from routers.activity_logs import log_activity
    await log_activity(current_user, "delete", "expenses", expense_id)
    return {"message": "Expense deleted successfully"}


# =====================================================
# EXPENSE REFUNDS / RETURNS
# =====================================================

@router.post("/expense-refunds")
async def create_expense_refund(body: dict, current_user: User = Depends(get_current_user)):
    """Record a refund for an expense. Creates a negative expense entry."""
    require_permission(current_user, "expenses", "write")
    
    original_expense_id = body.get("original_expense_id")
    amount = float(body.get("amount", 0))
    reason = body.get("reason", "")
    refund_mode = body.get("refund_mode", "cash")  # cash, bank, credit
    date_str = body.get("date", datetime.now(timezone.utc).isoformat())
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Valid refund amount required")
    
    # If linked to an original expense, get its details
    original = None
    if original_expense_id:
        original = await db.expenses.find_one({"id": original_expense_id}, {"_id": 0})
    
    refund_id = str(uuid.uuid4())
    refund = {
        "id": refund_id,
        "original_expense_id": original_expense_id,
        "amount": amount,
        "reason": reason,
        "refund_mode": refund_mode,
        "category": original.get("category", "Refund") if original else body.get("category", "Refund"),
        "description": f"REFUND: {reason or (original.get('description', '') if original else '')}",
        "branch_id": body.get("branch_id") or (original.get("branch_id") if original else None),
        "supplier_id": original.get("supplier_id") if original else body.get("supplier_id"),
        "date": date_str,
        "is_refund": True,
        "created_by": current_user.id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.expense_refunds.insert_one(refund)
    
    # Also create a negative expense to reflect in totals
    neg_expense = Expense(
        category=refund["category"],
        description=refund["description"],
        amount=-amount,
        payment_mode=refund_mode,
        branch_id=refund.get("branch_id"),
        supplier_id=refund.get("supplier_id"),
        date=datetime.fromisoformat(date_str.replace("Z", "+00:00")) if isinstance(date_str, str) else date_str,
        notes=f"Refund: {reason}",
        created_by=current_user.id,
    )
    ne_dict = neg_expense.model_dump()
    ne_dict["date"] = ne_dict["date"].isoformat()
    ne_dict["created_at"] = ne_dict["created_at"].isoformat()
    ne_dict["is_refund"] = True
    ne_dict["refund_id"] = refund_id
    await db.expenses.insert_one(ne_dict)
    
    # If supplier credit refund, reduce supplier balance
    if refund.get("supplier_id") and refund_mode == "credit":
        supplier = await db.suppliers.find_one({"id": refund["supplier_id"]}, {"_id": 0})
        if supplier:
            new_credit = max(0, supplier.get("current_credit", 0) - amount)
            await db.suppliers.update_one({"id": refund["supplier_id"]}, {"$set": {"current_credit": new_credit}})
    
    return {k: v for k, v in refund.items() if k != '_id'}


@router.get("/expense-refunds")
async def get_expense_refunds(current_user: User = Depends(get_current_user)):
    """Get all expense refunds"""
    require_permission(current_user, "expenses", "read")
    refunds = await db.expense_refunds.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return refunds


@router.post("/expenses/auto-categorize")
async def auto_categorize_expense(body: dict, current_user: User = Depends(get_current_user)):
    """Use AI to suggest a category for an expense based on its description."""
    import os
    description = body.get("description", "")
    if not description:
        return {"category": "general", "confidence": "low"}
    categories = await db.categories.find({}, {"_id": 0}).to_list(100)
    cat_names = [c.get("name", "") for c in categories] if categories else []
    default_cats = ["salary", "rent", "utilities", "food", "transport", "supplies", "maintenance", "marketing", "insurance", "tickets", "id_card", "bonus", "overtime"]
    all_cats = list(set(cat_names + default_cats))
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            return {"category": "general", "confidence": "low"}
        chat = LlmChat(
            api_key=api_key,
            session_id=f"cat-{uuid.uuid4()}",
            system_message=f"You are an expense categorizer. Given an expense description, return ONLY the most appropriate category from this list: {', '.join(all_cats)}. If none match well, return 'general'. Return ONLY the category name, nothing else."
        ).with_model("openai", "gpt-4o-mini")
        response = await chat.send_message(UserMessage(text=f"Categorize this expense: {description}"))
        cat = response.strip().lower().replace(" ", "_")
        if cat in [c.lower().replace(" ", "_") for c in all_cats]:
            return {"category": cat, "confidence": "high"}
        return {"category": cat, "confidence": "medium"}
    except:
        return {"category": "general", "confidence": "low"}

# Capital Expenses
@router.get("/capital-expenses")
async def get_capital_expenses(current_user: User = Depends(get_current_user)):
    return await db.capital_expenses.find({}, {"_id": 0}).sort("date", -1).to_list(1000)

@router.post("/capital-expenses")
async def create_capital_expense(body: dict, current_user: User = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "title": body.get("title",""), "category": body.get("category","goodwill"),
           "description": body.get("description",""), "amount": float(body.get("amount",0)),
           "branch_id": body.get("branch_id") or None, "payment_mode": body.get("payment_mode","cash"),
           "date": body.get("date", datetime.now(timezone.utc).isoformat()),
           "notes": body.get("notes",""), "created_by": current_user.id,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.capital_expenses.insert_one(doc)
    return {k: v for k, v in doc.items() if k != '_id'}

@router.delete("/capital-expenses/{cap_id}")
async def delete_capital_expense(cap_id: str, current_user: User = Depends(get_current_user)):
    await db.capital_expenses.delete_one({"id": cap_id})
    return {"message": "Deleted"}

# Recurring Expenses
@router.get("/recurring-expenses")
async def get_recurring_expenses(current_user: User = Depends(get_current_user)):
    recs = await db.recurring_expenses.find({}, {"_id": 0}).to_list(100)
    now = datetime.now(timezone.utc)
    for r in recs:
        for f in ['next_due_date', 'created_at']:
            if isinstance(r.get(f), str): r[f] = datetime.fromisoformat(r[f])
        due = r.get('next_due_date')
        if due:
            if due.tzinfo is None: due = due.replace(tzinfo=timezone.utc)
            r['days_until_due'] = (due - now).days
    return recs

@router.post("/recurring-expenses")
async def create_recurring_expense(data: RecurringExpenseCreate, current_user: User = Depends(get_current_user)):
    rec = RecurringExpense(**data.model_dump())
    r_dict = rec.model_dump()
    r_dict["next_due_date"] = r_dict["next_due_date"].isoformat(); r_dict["created_at"] = r_dict["created_at"].isoformat()
    if r_dict.get("branch_id") == '': r_dict["branch_id"] = None
    await db.recurring_expenses.insert_one(r_dict)
    return {k: v for k, v in r_dict.items() if k != '_id'}

@router.delete("/recurring-expenses/{rec_id}")
async def delete_recurring_expense(rec_id: str, current_user: User = Depends(get_current_user)):
    await db.recurring_expenses.delete_one({"id": rec_id})
    return {"message": "Recurring expense deleted"}

@router.post("/recurring-expenses/{rec_id}/renew-pay")
async def renew_pay_recurring(rec_id: str, body: dict, current_user: User = Depends(get_current_user)):
    rec = await db.recurring_expenses.find_one({"id": rec_id}, {"_id": 0})
    if not rec: raise HTTPException(status_code=404, detail="Not found")
    amount = float(body.get("amount", rec["amount"])); mode = body.get("payment_mode", "cash")
    branch_id = body.get("branch_id") or rec.get("branch_id")
    if branch_id == '': branch_id = None
    expense = Expense(category=rec.get("category", "other"), description=f"{rec['name']} - Renewed", amount=amount, payment_mode=mode, branch_id=branch_id, date=datetime.now(timezone.utc), notes=f"Recurring: {rec['name']}", created_by=current_user.id)
    e_dict = expense.model_dump(); e_dict["date"] = e_dict["date"].isoformat(); e_dict["created_at"] = e_dict["created_at"].isoformat()
    await db.expenses.insert_one(e_dict)
    freq = rec.get("frequency", "monthly"); due = rec.get("next_due_date")
    if isinstance(due, str): due = datetime.fromisoformat(due)
    if due is None: due = datetime.now(timezone.utc)
    if freq == "monthly": new_due = due.replace(month=due.month % 12 + 1) if due.month < 12 else due.replace(year=due.year + 1, month=1)
    elif freq == "quarterly":
        m = due.month + 3; new_due = due.replace(year=due.year + m // 12, month=m % 12 or 12) if m > 12 else due.replace(month=m)
    elif freq == "yearly": new_due = due.replace(year=due.year + 1)
    else: new_due = due.replace(month=due.month % 12 + 1) if due.month < 12 else due.replace(year=due.year + 1, month=1)
    await db.recurring_expenses.update_one({"id": rec_id}, {"$set": {"next_due_date": new_due.isoformat(), "amount": amount}})
    return {"message": f"Paid SAR {amount:.2f} & renewed. Next due: {new_due.strftime('%d %b %Y')}"}
