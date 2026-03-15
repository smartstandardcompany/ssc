from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from database import db, get_current_user, require_permission, get_tenant_filter, stamp_tenant
from models import User, BankAccount, BankAccountCreate

router = APIRouter()


@router.get("/bank-accounts")
async def get_bank_accounts(current_user: User = Depends(get_current_user)):
    accounts = await db.bank_accounts.find(get_tenant_filter(current_user), {"_id": 0}).to_list(50)
    return accounts


@router.post("/bank-accounts")
async def create_bank_account(data: BankAccountCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    account = BankAccount(**data.model_dump(), created_at=BankAccount.__fields__["created_at"].default_factory())
    doc = account.model_dump()
    # If setting as default, unset other defaults
    if doc.get("is_default"):
        await db.bank_accounts.update_many({}, {"$set": {"is_default": False}})
    stamp_tenant(doc, current_user)
    await db.bank_accounts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/bank-accounts/{account_id}")
async def update_bank_account(account_id: str, data: BankAccountCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    existing = await db.bank_accounts.find_one({"id": account_id, **get_tenant_filter(current_user)}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Bank account not found")
    update = data.model_dump()
    if update.get("is_default"):
        await db.bank_accounts.update_many({"id": {"$ne": account_id}}, {"$set": {"is_default": False}})
    await db.bank_accounts.update_one({"id": account_id, **get_tenant_filter(current_user)}, {"$set": update})
    return {**existing, **update}


@router.delete("/bank-accounts/{account_id}")
async def delete_bank_account(account_id: str, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    result = await db.bank_accounts.delete_one({"id": account_id, **get_tenant_filter(current_user)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return {"message": "Bank account deleted"}


@router.get("/reports/branch-dues-detail")
async def get_branch_dues_detail(current_user: User = Depends(get_current_user)):
    """Return detailed entries that make up branch dues for drill-down."""
    branches = await db.branches.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    suppliers = {s["id"]: s for s in await db.suppliers.find(get_tenant_filter(current_user), {"_id": 0}).to_list(1000)}
    employees = {e["id"]: e for e in await db.employees.find(get_tenant_filter(current_user), {"_id": 0}).to_list(1000)}

    entries = []

    # Expenses with cross-branch
    expenses = await db.expenses.find(
        {"branch_id": {"$exists": True, "$ne": None}}, {"_id": 0}
    ).to_list(10000)
    for e in expenses:
        pay_b = e.get("branch_id")
        expense_for_b = e.get("expense_for_branch_id")
        if expense_for_b and pay_b and expense_for_b != pay_b:
            entries.append({
                "type": "expense",
                "from_branch": branch_map.get(pay_b, "?"),
                "to_branch": branch_map.get(expense_for_b, "?"),
                "amount": e["amount"],
                "description": e.get("description", ""),
                "category": e.get("category", ""),
                "date": str(e.get("date", "")),
                "payment_mode": e.get("payment_mode", ""),
            })
        elif e.get("supplier_id"):
            sup = suppliers.get(e["supplier_id"], {})
            sup_b = sup.get("branch_id")
            if pay_b and sup_b and pay_b != sup_b:
                entries.append({
                    "type": "expense",
                    "from_branch": branch_map.get(pay_b, "?"),
                    "to_branch": branch_map.get(sup_b, "?"),
                    "amount": e["amount"],
                    "description": e.get("description", ""),
                    "category": e.get("category", ""),
                    "date": str(e.get("date", "")),
                    "payment_mode": e.get("payment_mode", ""),
                })

    # Supplier payments with cross-branch
    sp = await db.supplier_payments.find(
        {"supplier_id": {"$exists": True, "$ne": None}, "branch_id": {"$exists": True, "$ne": None}}, {"_id": 0}
    ).to_list(10000)
    for p in sp:
        pay_b = p.get("branch_id")
        sup = suppliers.get(p.get("supplier_id"), {})
        sup_b = sup.get("branch_id")
        expense_for_b = p.get("expense_for_branch_id")
        target_b = expense_for_b or sup_b
        if pay_b and target_b and pay_b != target_b:
            entries.append({
                "type": "supplier_payment",
                "from_branch": branch_map.get(pay_b, "?"),
                "to_branch": branch_map.get(target_b, "?"),
                "amount": p["amount"],
                "description": f"Payment to {sup.get('name', 'supplier')}",
                "category": "Supplier Payment",
                "date": str(p.get("date", "")),
                "payment_mode": p.get("payment_mode", ""),
            })

    # Salary payments with cross-branch
    salary_payments = await db.salary_payments.find(
        {"branch_id": {"$exists": True, "$ne": None}}, {"_id": 0}
    ).to_list(10000)
    for p in salary_payments:
        pay_b = p.get("branch_id")
        emp = employees.get(p.get("employee_id"), {})
        emp_b = emp.get("branch_id")
        if pay_b and emp_b and pay_b != emp_b:
            entries.append({
                "type": "salary",
                "from_branch": branch_map.get(pay_b, "?"),
                "to_branch": branch_map.get(emp_b, "?"),
                "amount": p["amount"],
                "description": f"Salary for {emp.get('name', 'employee')}",
                "category": "Salary",
                "date": str(p.get("date", "")),
                "payment_mode": p.get("payment_mode", ""),
            })

    # Cash transfers
    transfers = await db.cash_transfers.find(get_tenant_filter(current_user), {"_id": 0}).to_list(10000)
    for t in transfers:
        from_b = t.get("from_branch_id")
        to_b = t.get("to_branch_id")
        if from_b and to_b and from_b != to_b:
            entries.append({
                "type": "transfer",
                "from_branch": branch_map.get(from_b, "Office"),
                "to_branch": branch_map.get(to_b, "Office"),
                "amount": t["amount"],
                "description": t.get("notes", "Cash transfer"),
                "category": "Transfer",
                "date": str(t.get("date", "")),
                "payment_mode": t.get("mode", "cash"),
            })

    # Sort by date descending
    entries.sort(key=lambda x: x.get("date", ""), reverse=True)
    return {"entries": entries, "total": len(entries)}


@router.get("/bank-accounts/summary")
async def get_bank_account_summary(current_user: User = Depends(get_current_user)):
    """Auto-calculate how much each bank account received based on branch assignment.
    Logic: Each bank account is assigned to a branch. All bank-mode sales for that branch
    go to its assigned bank account. Unassigned branches go to the default bank account."""

    accounts = await db.bank_accounts.find(get_tenant_filter(current_user), {"_id": 0}).to_list(50)
    if not accounts:
        return {"accounts": [], "total_bank": 0}

    branches = await db.branches.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100)

    # Build mapping: branch_id -> bank_account_id
    branch_to_bank = {}
    default_bank = None
    for acc in accounts:
        if acc.get("is_default"):
            default_bank = acc["id"]
        if acc.get("branch_id"):
            branch_to_bank[acc["branch_id"]] = acc["id"]

    # If no default, use first account
    if not default_bank and accounts:
        default_bank = accounts[0]["id"]

    # Get all sales with bank payments
    all_sales = await db.sales.find(get_tenant_filter(current_user), {"_id": 0}).to_list(100000)

    # Calculate totals per bank account
    bank_totals = {acc["id"]: 0.0 for acc in accounts}
    bank_sales_count = {acc["id"]: 0 for acc in accounts}

    for sale in all_sales:
        branch_id = sale.get("branch_id")
        for pd in sale.get("payment_details", []):
            if pd.get("mode") == "bank" and pd.get("amount", 0) > 0:
                # Find which bank account this branch uses
                target_bank = branch_to_bank.get(branch_id, default_bank)
                if target_bank and target_bank in bank_totals:
                    bank_totals[target_bank] += pd["amount"]
                    bank_sales_count[target_bank] += 1

    # Also add expenses paid by bank to each bank account (money going out)
    all_expenses = await db.expenses.find({"payment_mode": "bank"}, {"_id": 0}).to_list(100000)
    bank_expense_totals = {acc["id"]: 0.0 for acc in accounts}
    for exp in all_expenses:
        branch_id = exp.get("branch_id")
        target_bank = branch_to_bank.get(branch_id, default_bank)
        if target_bank and target_bank in bank_expense_totals:
            bank_expense_totals[target_bank] += exp.get("amount", 0)

    # Build response
    result = []
    total_bank_in = 0
    total_bank_out = 0
    for acc in accounts:
        aid = acc["id"]
        incoming = bank_totals.get(aid, 0)
        outgoing = bank_expense_totals.get(aid, 0)
        total_bank_in += incoming
        total_bank_out += outgoing
        assigned_branch = None
        for b in branches:
            if b["id"] == acc.get("branch_id"):
                assigned_branch = b["name"]
                break
        result.append({
            "id": aid,
            "name": acc["name"],
            "bank_name": acc["bank_name"],
            "account_number": acc["account_number"],
            "assigned_branch": assigned_branch or "All Branches",
            "is_default": acc.get("is_default", False),
            "incoming": round(incoming, 2),
            "outgoing": round(outgoing, 2),
            "net": round(incoming - outgoing, 2),
            "sales_count": bank_sales_count.get(aid, 0),
        })

    return {
        "accounts": result,
        "total_bank_incoming": round(total_bank_in, 2),
        "total_bank_outgoing": round(total_bank_out, 2),
        "total_bank_net": round(total_bank_in - total_bank_out, 2),
    }
