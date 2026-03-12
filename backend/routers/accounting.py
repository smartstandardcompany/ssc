from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
import uuid

from database import db, get_current_user, require_permission

router = APIRouter()

# ── Chart of Accounts ──────────────────────────────────────────

SEED_ACCOUNTS = [
    {"code": "1000", "name": "Cash", "type": "asset", "sub_type": "current_asset", "description": "Cash on hand", "is_system": True},
    {"code": "1010", "name": "Bank", "type": "asset", "sub_type": "current_asset", "description": "Bank accounts", "is_system": True},
    {"code": "1100", "name": "Accounts Receivable", "type": "asset", "sub_type": "current_asset", "description": "Money owed by customers", "is_system": True},
    {"code": "1200", "name": "Inventory", "type": "asset", "sub_type": "current_asset", "description": "Stock inventory value", "is_system": True},
    {"code": "1500", "name": "Fixed Assets", "type": "asset", "sub_type": "fixed_asset", "description": "Equipment, furniture, etc.", "is_system": True},
    {"code": "2000", "name": "Accounts Payable", "type": "liability", "sub_type": "current_liability", "description": "Money owed to suppliers", "is_system": True},
    {"code": "2100", "name": "VAT Payable", "type": "liability", "sub_type": "current_liability", "description": "Value Added Tax liability", "is_system": True},
    {"code": "2200", "name": "Accrued Expenses", "type": "liability", "sub_type": "current_liability", "description": "Expenses incurred but not yet paid", "is_system": True},
    {"code": "2500", "name": "Long-term Loans", "type": "liability", "sub_type": "long_term_liability", "description": "Bank loans and financing", "is_system": True},
    {"code": "3000", "name": "Owner's Equity", "type": "equity", "sub_type": "equity", "description": "Owner's capital investment", "is_system": True},
    {"code": "3100", "name": "Retained Earnings", "type": "equity", "sub_type": "equity", "description": "Accumulated profits", "is_system": True},
    {"code": "4000", "name": "Sales Revenue", "type": "revenue", "sub_type": "operating_revenue", "description": "Income from sales", "is_system": True},
    {"code": "4100", "name": "Service Revenue", "type": "revenue", "sub_type": "operating_revenue", "description": "Income from services", "is_system": True},
    {"code": "4500", "name": "Other Income", "type": "revenue", "sub_type": "other_revenue", "description": "Miscellaneous income", "is_system": True},
    {"code": "5000", "name": "Cost of Goods Sold", "type": "expense", "sub_type": "cost_of_sales", "description": "Direct costs of products sold", "is_system": True},
    {"code": "5100", "name": "Salaries & Wages", "type": "expense", "sub_type": "operating_expense", "description": "Employee compensation", "is_system": True},
    {"code": "5200", "name": "Rent Expense", "type": "expense", "sub_type": "operating_expense", "description": "Rental costs", "is_system": True},
    {"code": "5300", "name": "Utilities", "type": "expense", "sub_type": "operating_expense", "description": "Electricity, water, internet", "is_system": True},
    {"code": "5400", "name": "Maintenance", "type": "expense", "sub_type": "operating_expense", "description": "Repairs and maintenance", "is_system": True},
    {"code": "5500", "name": "Vehicle Expenses", "type": "expense", "sub_type": "operating_expense", "description": "Transport and vehicle costs", "is_system": True},
    {"code": "5600", "name": "Office Supplies", "type": "expense", "sub_type": "operating_expense", "description": "Stationery, consumables", "is_system": True},
    {"code": "5700", "name": "Marketing", "type": "expense", "sub_type": "operating_expense", "description": "Advertising and promotions", "is_system": True},
    {"code": "5900", "name": "Other Expenses", "type": "expense", "sub_type": "operating_expense", "description": "Miscellaneous expenses", "is_system": True},
]


@router.get("/accounting/accounts")
async def get_accounts(current_user=Depends(get_current_user)):
    require_permission(current_user, "settings", "read")
    accounts = await db.chart_of_accounts.find({}, {"_id": 0}).sort("code", 1).to_list(500)
    if not accounts:
        # Seed default accounts
        for acc in SEED_ACCOUNTS:
            acc["id"] = str(uuid.uuid4())
            acc["balance"] = 0
            acc["is_active"] = True
            acc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.chart_of_accounts.insert_many(SEED_ACCOUNTS)
        accounts = await db.chart_of_accounts.find({}, {"_id": 0}).sort("code", 1).to_list(500)
    return accounts


@router.post("/accounting/accounts")
async def create_account(body: dict, current_user=Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    existing = await db.chart_of_accounts.find_one({"code": body["code"]})
    if existing:
        raise HTTPException(status_code=400, detail="Account code already exists")
    account = {
        "id": str(uuid.uuid4()),
        "code": body["code"],
        "name": body["name"],
        "type": body["type"],
        "sub_type": body.get("sub_type", ""),
        "description": body.get("description", ""),
        "balance": 0,
        "is_active": True,
        "is_system": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chart_of_accounts.insert_one(account)
    account.pop("_id", None)
    return account


@router.put("/accounting/accounts/{account_id}")
async def update_account(account_id: str, body: dict, current_user=Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    acc = await db.chart_of_accounts.find_one({"id": account_id})
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    updates = {}
    for field in ["name", "description", "sub_type", "is_active"]:
        if field in body:
            updates[field] = body[field]
    if updates:
        await db.chart_of_accounts.update_one({"id": account_id}, {"$set": updates})
    updated = await db.chart_of_accounts.find_one({"id": account_id}, {"_id": 0})
    return updated


@router.delete("/accounting/accounts/{account_id}")
async def delete_account(account_id: str, current_user=Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    acc = await db.chart_of_accounts.find_one({"id": account_id})
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    if acc.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system accounts")
    await db.chart_of_accounts.delete_one({"id": account_id})
    return {"success": True}


# ── Tax / VAT Settings ─────────────────────────────────────────

SEED_TAX_RATES = [
    {"name": "VAT 15%", "rate": 15.0, "type": "vat", "is_default": True, "description": "Standard VAT rate (Saudi Arabia)"},
    {"name": "VAT 5%", "rate": 5.0, "type": "vat", "is_default": False, "description": "Reduced VAT rate (UAE, Bahrain)"},
    {"name": "Zero Rated", "rate": 0.0, "type": "vat", "is_default": False, "description": "Zero rated goods/services"},
    {"name": "Exempt", "rate": 0.0, "type": "exempt", "is_default": False, "description": "VAT exempt items"},
]


@router.get("/accounting/tax-rates")
async def get_tax_rates(current_user=Depends(get_current_user)):
    rates = await db.tax_rates.find({}, {"_id": 0}).sort("rate", -1).to_list(100)
    if not rates:
        for rate in SEED_TAX_RATES:
            rate["id"] = str(uuid.uuid4())
            rate["is_active"] = True
            rate["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.tax_rates.insert_many(SEED_TAX_RATES)
        rates = await db.tax_rates.find({}, {"_id": 0}).sort("rate", -1).to_list(100)
    return rates


@router.post("/accounting/tax-rates")
async def create_tax_rate(body: dict, current_user=Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    rate = {
        "id": str(uuid.uuid4()),
        "name": body["name"],
        "rate": body["rate"],
        "type": body.get("type", "vat"),
        "is_default": body.get("is_default", False),
        "is_active": True,
        "description": body.get("description", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if rate["is_default"]:
        await db.tax_rates.update_many({}, {"$set": {"is_default": False}})
    await db.tax_rates.insert_one(rate)
    rate.pop("_id", None)
    return rate


@router.put("/accounting/tax-rates/{rate_id}")
async def update_tax_rate(rate_id: str, body: dict, current_user=Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    updates = {}
    for field in ["name", "rate", "type", "is_default", "is_active", "description"]:
        if field in body:
            updates[field] = body[field]
    if updates.get("is_default"):
        await db.tax_rates.update_many({}, {"$set": {"is_default": False}})
    if updates:
        await db.tax_rates.update_one({"id": rate_id}, {"$set": updates})
    updated = await db.tax_rates.find_one({"id": rate_id}, {"_id": 0})
    return updated


@router.delete("/accounting/tax-rates/{rate_id}")
async def delete_tax_rate(rate_id: str, current_user=Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    await db.tax_rates.delete_one({"id": rate_id})
    return {"success": True}


# ── Bills (Supplier Bills / Purchase Bills) ────────────────────

@router.get("/accounting/bills")
async def get_bills(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    current_user=Depends(get_current_user),
):
    require_permission(current_user, "expenses", "read")
    query = {}
    if status:
        query["status"] = status
    if supplier_id:
        query["supplier_id"] = supplier_id
    total = await db.bills.count_documents(query)
    skip = (page - 1) * limit
    bills = await db.bills.find(query, {"_id": 0}).sort("due_date", 1).skip(skip).limit(limit).to_list(limit)
    return {"bills": bills, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.post("/accounting/bills")
async def create_bill(body: dict, current_user=Depends(get_current_user)):
    require_permission(current_user, "expenses", "write")
    items = body.get("items", [])
    subtotal = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
    tax_rate = body.get("tax_rate", 15.0)
    tax_amount = round(subtotal * tax_rate / 100, 2)
    total = round(subtotal + tax_amount - body.get("discount", 0), 2)

    bill = {
        "id": str(uuid.uuid4()),
        "bill_number": body.get("bill_number", f"BILL-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"),
        "supplier_id": body.get("supplier_id"),
        "supplier_name": body.get("supplier_name", ""),
        "branch_id": body.get("branch_id"),
        "items": items,
        "subtotal": round(subtotal, 2),
        "discount": body.get("discount", 0),
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total": total,
        "amount_paid": 0,
        "balance_due": total,
        "currency": body.get("currency", "SAR"),
        "status": "unpaid",
        "issue_date": body.get("issue_date", datetime.now(timezone.utc).isoformat()),
        "due_date": body.get("due_date"),
        "payment_terms": body.get("payment_terms", "net_30"),
        "notes": body.get("notes", ""),
        "category": body.get("category", ""),
        "created_by": getattr(current_user, "name", None) or getattr(current_user, "email", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "payments": [],
    }
    await db.bills.insert_one(bill)
    bill.pop("_id", None)
    return bill


@router.put("/accounting/bills/{bill_id}")
async def update_bill(bill_id: str, body: dict, current_user=Depends(get_current_user)):
    require_permission(current_user, "expenses", "write")
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    updates = {}
    for field in ["supplier_name", "branch_id", "items", "discount", "tax_rate", "due_date", "payment_terms", "notes", "category", "currency"]:
        if field in body:
            updates[field] = body[field]
    if "items" in updates:
        items = updates["items"]
        subtotal = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
        tax_rate = updates.get("tax_rate", bill.get("tax_rate", 15.0))
        tax_amount = round(subtotal * tax_rate / 100, 2)
        total = round(subtotal + tax_amount - updates.get("discount", bill.get("discount", 0)), 2)
        updates["subtotal"] = round(subtotal, 2)
        updates["tax_amount"] = tax_amount
        updates["total"] = total
        updates["balance_due"] = round(total - bill.get("amount_paid", 0), 2)
    if updates:
        await db.bills.update_one({"id": bill_id}, {"$set": updates})
    updated = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    return updated


@router.post("/accounting/bills/{bill_id}/payment")
async def record_bill_payment(bill_id: str, body: dict, current_user=Depends(get_current_user)):
    require_permission(current_user, "expenses", "write")
    bill = await db.bills.find_one({"id": bill_id})
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    amount = body.get("amount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    payment = {
        "id": str(uuid.uuid4()),
        "amount": amount,
        "method": body.get("method", "cash"),
        "date": body.get("date", datetime.now(timezone.utc).isoformat()),
        "reference": body.get("reference", ""),
        "recorded_by": getattr(current_user, "name", None) or getattr(current_user, "email", ""),
    }
    new_amount_paid = round(bill.get("amount_paid", 0) + amount, 2)
    new_balance = round(bill.get("total", 0) - new_amount_paid, 2)
    new_status = "paid" if new_balance <= 0 else "partial"

    await db.bills.update_one({"id": bill_id}, {
        "$push": {"payments": payment},
        "$set": {
            "amount_paid": new_amount_paid,
            "balance_due": max(new_balance, 0),
            "status": new_status,
        }
    })
    updated = await db.bills.find_one({"id": bill_id}, {"_id": 0})
    return updated


@router.delete("/accounting/bills/{bill_id}")
async def delete_bill(bill_id: str, current_user=Depends(get_current_user)):
    require_permission(current_user, "expenses", "write")
    await db.bills.delete_one({"id": bill_id})
    return {"success": True}


# ── Profit & Loss Report ───────────────────────────────────────

@router.get("/accounting/profit-loss")
async def get_profit_loss(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    require_permission(current_user, "reports", "read")

    # Default to current month
    now = datetime.now(timezone.utc)
    if not start_date:
        start_date = now.replace(day=1).strftime("%Y-%m-%d")
    if not end_date:
        end_date = now.strftime("%Y-%m-%d")

    # Build date query
    date_query_sales = {"date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}}
    date_query_expenses = {"date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}}

    if branch_id:
        date_query_sales["branch_id"] = branch_id
        date_query_expenses["branch_id"] = branch_id

    # Revenue: Sum all sales
    sales_pipeline = [
        {"$match": date_query_sales},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1},
                     "cash": {"$sum": "$cash"}, "bank": {"$sum": "$bank"},
                     "online": {"$sum": "$online"}, "credit": {"$sum": "$credit"}}}
    ]
    sales_result = await db.sales.aggregate(sales_pipeline).to_list(1)
    sales_total = sales_result[0]["total"] if sales_result else 0
    sales_count = sales_result[0]["count"] if sales_result else 0
    sales_cash = sales_result[0].get("cash", 0) if sales_result else 0
    sales_bank = sales_result[0].get("bank", 0) if sales_result else 0
    sales_online = sales_result[0].get("online", 0) if sales_result else 0

    # Expenses: Group by category
    expense_pipeline = [
        {"$match": date_query_expenses},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    expense_results = await db.expenses.aggregate(expense_pipeline).to_list(100)
    expenses_by_category = {}
    expenses_total = 0
    for exp in expense_results:
        cat = exp["_id"] or "Other"
        expenses_by_category[cat] = {"total": exp["total"], "count": exp["count"]}
        expenses_total += exp["total"]

    # Supplier payments
    supplier_query = {"date": {"$gte": start_date, "$lte": end_date + "T23:59:59"}}
    if branch_id:
        supplier_query["branch_id"] = branch_id
    supplier_pipeline = [
        {"$match": supplier_query},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    supplier_result = await db.supplier_payments.aggregate(supplier_pipeline).to_list(1)
    supplier_total = supplier_result[0]["total"] if supplier_result else 0

    # Bills summary
    bills_pipeline = [
        {"$group": {"_id": "$status", "total": {"$sum": "$total"}, "count": {"$sum": 1}}}
    ]
    bills_results = await db.bills.aggregate(bills_pipeline).to_list(10)
    bills_summary = {r["_id"]: {"total": r["total"], "count": r["count"]} for r in bills_results}

    # Calculate P&L
    total_revenue = sales_total
    total_cogs = expenses_by_category.get("Supplier", {}).get("total", 0) + supplier_total
    gross_profit = total_revenue - total_cogs
    total_operating_expenses = expenses_total - expenses_by_category.get("Supplier", {}).get("total", 0)
    net_profit = gross_profit - total_operating_expenses

    # VAT estimate (15% of sales)
    vat_collected = round(total_revenue * 15 / 115, 2)  # Extract VAT from inclusive price

    return {
        "period": {"start": start_date, "end": end_date},
        "revenue": {
            "sales": round(sales_total, 2),
            "sales_count": sales_count,
            "by_method": {
                "cash": round(sales_cash, 2),
                "bank": round(sales_bank, 2),
                "online": round(sales_online, 2),
            },
            "other_income": 0,
            "total": round(total_revenue, 2),
        },
        "cost_of_sales": {
            "supplier_purchases": round(supplier_total, 2),
            "supplier_expenses": round(expenses_by_category.get("Supplier", {}).get("total", 0), 2),
            "total": round(total_cogs, 2),
        },
        "gross_profit": round(gross_profit, 2),
        "operating_expenses": {
            "by_category": {k: round(v["total"], 2) for k, v in expenses_by_category.items() if k != "Supplier"},
            "total": round(total_operating_expenses, 2),
        },
        "net_profit": round(net_profit, 2),
        "gross_margin": round((gross_profit / total_revenue * 100) if total_revenue else 0, 1),
        "net_margin": round((net_profit / total_revenue * 100) if total_revenue else 0, 1),
        "vat": {
            "collected": vat_collected,
            "rate": 15.0,
        },
        "bills_summary": bills_summary,
    }


# ── Currency Settings ──────────────────────────────────────────

MIDDLE_EAST_CURRENCIES = [
    {"code": "SAR", "name": "Saudi Riyal", "symbol": "SAR", "country": "Saudi Arabia"},
    {"code": "AED", "name": "UAE Dirham", "symbol": "AED", "country": "UAE"},
    {"code": "KWD", "name": "Kuwaiti Dinar", "symbol": "KWD", "country": "Kuwait"},
    {"code": "BHD", "name": "Bahraini Dinar", "symbol": "BHD", "country": "Bahrain"},
    {"code": "OMR", "name": "Omani Rial", "symbol": "OMR", "country": "Oman"},
    {"code": "QAR", "name": "Qatari Riyal", "symbol": "QAR", "country": "Qatar"},
    {"code": "EGP", "name": "Egyptian Pound", "symbol": "EGP", "country": "Egypt"},
    {"code": "JOD", "name": "Jordanian Dinar", "symbol": "JOD", "country": "Jordan"},
    {"code": "USD", "name": "US Dollar", "symbol": "$", "country": "United States"},
    {"code": "EUR", "name": "Euro", "symbol": "EUR", "country": "Europe"},
    {"code": "GBP", "name": "British Pound", "symbol": "GBP", "country": "United Kingdom"},
]


@router.get("/accounting/currencies")
async def get_currencies(current_user=Depends(get_current_user)):
    settings = await db.accounting_settings.find_one({"type": "currency"}, {"_id": 0})
    return {
        "available": MIDDLE_EAST_CURRENCIES,
        "default": settings.get("default_currency", "SAR") if settings else "SAR",
        "enabled": settings.get("enabled_currencies", ["SAR"]) if settings else ["SAR"],
    }


@router.put("/accounting/currencies")
async def update_currency_settings(body: dict, current_user=Depends(get_current_user)):
    require_permission(current_user, "settings", "write")
    await db.accounting_settings.update_one(
        {"type": "currency"},
        {"$set": {
            "type": "currency",
            "default_currency": body.get("default_currency", "SAR"),
            "enabled_currencies": body.get("enabled_currencies", ["SAR"]),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"success": True}


# ── Accounts Receivable / Payable Summary ──────────────────────

@router.get("/accounting/summary")
async def get_accounting_summary(current_user=Depends(get_current_user)):
    require_permission(current_user, "reports", "read")

    # AR: Outstanding customer credits
    credit_pipeline = [
        {"$match": {"credit": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$credit"}, "count": {"$sum": 1}}}
    ]
    ar_result = await db.sales.aggregate(credit_pipeline).to_list(1)
    ar_total = ar_result[0]["total"] if ar_result else 0

    # AP: Unpaid bills
    ap_pipeline = [
        {"$match": {"status": {"$in": ["unpaid", "partial"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$balance_due"}, "count": {"$sum": 1}}}
    ]
    ap_result = await db.bills.aggregate(ap_pipeline).to_list(1)
    ap_total = ap_result[0]["total"] if ap_result else 0

    # Overdue bills
    now_str = datetime.now(timezone.utc).isoformat()
    overdue_pipeline = [
        {"$match": {"status": {"$in": ["unpaid", "partial"]}, "due_date": {"$lt": now_str}}},
        {"$group": {"_id": None, "total": {"$sum": "$balance_due"}, "count": {"$sum": 1}}}
    ]
    overdue_result = await db.bills.aggregate(overdue_pipeline).to_list(1)
    overdue_total = overdue_result[0]["total"] if overdue_result else 0
    overdue_count = overdue_result[0]["count"] if overdue_result else 0

    # This month revenue & expenses
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    month_end = now.strftime("%Y-%m-%d")

    sales_pipeline = [
        {"$match": {"date": {"$gte": month_start, "$lte": month_end + "T23:59:59"}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    month_sales = await db.sales.aggregate(sales_pipeline).to_list(1)

    expense_pipeline = [
        {"$match": {"date": {"$gte": month_start, "$lte": month_end + "T23:59:59"}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    month_expenses = await db.expenses.aggregate(expense_pipeline).to_list(1)

    return {
        "accounts_receivable": round(ar_total, 2),
        "accounts_payable": round(ap_total, 2),
        "overdue_bills": {"total": round(overdue_total, 2), "count": overdue_count},
        "month_revenue": round(month_sales[0]["total"] if month_sales else 0, 2),
        "month_expenses": round(month_expenses[0]["total"] if month_expenses else 0, 2),
    }


# ── Journal Entries ─────────────────────────────────────────────

@router.get("/accounting/journal-entries")
async def get_journal_entries(
    page: int = 1,
    limit: int = 50,
    entry_type: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    query = {}
    if entry_type:
        query["entry_type"] = entry_type
    total = await db.journal_entries.count_documents(query)
    skip = (page - 1) * limit
    entries = await db.journal_entries.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    return {"entries": entries, "total": total, "page": page, "pages": (total + limit - 1) // limit}


@router.post("/accounting/journal-entries")
async def create_journal_entry(body: dict, current_user=Depends(get_current_user)):
    lines = body.get("lines", [])
    total_debit = sum(l.get("debit", 0) for l in lines)
    total_credit = sum(l.get("credit", 0) for l in lines)
    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(status_code=400, detail=f"Debits ({total_debit}) must equal Credits ({total_credit})")
    if len(lines) < 2:
        raise HTTPException(status_code=400, detail="At least 2 lines required")

    entry = {
        "id": str(uuid.uuid4()),
        "entry_number": f"JE-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}",
        "date": body.get("date", datetime.now(timezone.utc).isoformat()),
        "description": body.get("description", ""),
        "entry_type": body.get("entry_type", "manual"),
        "reference": body.get("reference", ""),
        "lines": lines,
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "status": "posted",
        "created_by": getattr(current_user, "name", None) or getattr(current_user, "email", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.journal_entries.insert_one(entry)
    entry.pop("_id", None)
    return entry


@router.delete("/accounting/journal-entries/{entry_id}")
async def delete_journal_entry(entry_id: str, current_user=Depends(get_current_user)):
    result = await db.journal_entries.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"success": True}


# ── Balance Sheet ──────────────────────────────────────────────

@router.get("/accounting/balance-sheet")
async def get_balance_sheet(
    as_of_date: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user=Depends(get_current_user),
):
    if not as_of_date:
        as_of_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    date_query = {"$lte": as_of_date + "T23:59:59"}
    branch_query = {"branch_id": branch_id} if branch_id else {}

    # Assets
    # Cash: sum of sales cash - expenses cash
    sales_cash_pipeline = [
        {"$match": {**branch_query, "date": date_query}},
        {"$group": {"_id": None, "cash": {"$sum": "$cash"}, "bank": {"$sum": "$bank"}, "online": {"$sum": "$online"}}}
    ]
    sales_cash = await db.sales.aggregate(sales_cash_pipeline).to_list(1)
    total_cash_in = sales_cash[0]["cash"] if sales_cash else 0
    total_bank_in = (sales_cash[0].get("bank", 0) + sales_cash[0].get("online", 0)) if sales_cash else 0

    expense_cash_pipeline = [
        {"$match": {**branch_query, "date": date_query}},
        {"$group": {"_id": "$payment_mode", "total": {"$sum": "$amount"}}}
    ]
    expense_results = await db.expenses.aggregate(expense_cash_pipeline).to_list(20)
    expense_by_mode = {r["_id"]: r["total"] for r in expense_results}
    total_cash_out = expense_by_mode.get("Cash", 0) + expense_by_mode.get("cash", 0)
    total_bank_out = expense_by_mode.get("Bank Transfer", 0) + expense_by_mode.get("bank", 0) + expense_by_mode.get("Card", 0)

    # Accounts Receivable (outstanding credits from sales)
    ar_pipeline = [
        {"$match": {**branch_query, "credit": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$credit"}}}
    ]
    ar_result = await db.sales.aggregate(ar_pipeline).to_list(1)
    accounts_receivable = ar_result[0]["total"] if ar_result else 0

    # Inventory value
    inv_pipeline = [
        {"$match": {"quantity": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": {"$multiply": ["$quantity", {"$ifNull": ["$cost_price", 0]}]}}}}
    ]
    inv_result = await db.inventory.aggregate(inv_pipeline).to_list(1)
    inventory_value = inv_result[0]["total"] if inv_result else 0

    # Liabilities
    # Accounts Payable (unpaid bills + supplier credit)
    ap_pipeline = [
        {"$match": {"status": {"$in": ["unpaid", "partial"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$balance_due"}}}
    ]
    ap_result = await db.bills.aggregate(ap_pipeline).to_list(1)
    accounts_payable = ap_result[0]["total"] if ap_result else 0

    # Supplier credits
    supplier_credit_pipeline = [
        {"$match": {"credit_balance": {"$gt": 0}}},
        {"$group": {"_id": None, "total": {"$sum": "$credit_balance"}}}
    ]
    supplier_credit = await db.suppliers.aggregate(supplier_credit_pipeline).to_list(1)
    supplier_credit_total = supplier_credit[0]["total"] if supplier_credit else 0

    # VAT Payable (estimated)
    total_sales_pipeline = [
        {"$match": {**branch_query, "date": date_query}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    total_sales = await db.sales.aggregate(total_sales_pipeline).to_list(1)
    vat_payable = round((total_sales[0]["total"] if total_sales else 0) * 15 / 115, 2)

    # Equity = Total Revenue - Total Expenses (retained earnings)
    total_revenue = total_sales[0]["total"] if total_sales else 0
    total_exp_pipeline = [
        {"$match": {**branch_query, "date": date_query}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    total_exp = await db.expenses.aggregate(total_exp_pipeline).to_list(1)
    total_expenses = total_exp[0]["total"] if total_exp else 0
    retained_earnings = total_revenue - total_expenses

    # Build balance sheet
    cash_balance = round(total_cash_in - total_cash_out, 2)
    bank_balance = round(total_bank_in - total_bank_out, 2)

    assets = {
        "current_assets": {
            "Cash on Hand": round(max(cash_balance, 0), 2),
            "Bank Accounts": round(max(bank_balance, 0), 2),
            "Accounts Receivable": round(accounts_receivable, 2),
            "Inventory": round(inventory_value, 2),
        },
        "fixed_assets": {},
        "total": round(max(cash_balance, 0) + max(bank_balance, 0) + accounts_receivable + inventory_value, 2),
    }

    liabilities = {
        "current_liabilities": {
            "Accounts Payable": round(accounts_payable, 2),
            "Supplier Credits": round(supplier_credit_total, 2),
            "VAT Payable": round(vat_payable, 2),
        },
        "long_term_liabilities": {},
        "total": round(accounts_payable + supplier_credit_total + vat_payable, 2),
    }

    equity = {
        "items": {
            "Retained Earnings": round(retained_earnings, 2),
        },
        "total": round(retained_earnings, 2),
    }

    return {
        "as_of_date": as_of_date,
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "total_liabilities_equity": round(liabilities["total"] + equity["total"], 2),
        "is_balanced": abs(assets["total"] - (liabilities["total"] + equity["total"])) < 1,
    }


# ── Financial Dashboard ───────────────────────────────────────

@router.get("/accounting/financial-dashboard")
async def get_financial_dashboard(
    current_user=Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    month_end = now.strftime("%Y-%m-%d")
    end_filter = month_end + "T23:59:59"

    # Monthly revenue trend (last 6 months)
    revenue_trend = []
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        ms = f"{y}-{m:02d}-01"
        if m == 12:
            me = f"{y + 1}-01-01"
        else:
            me = f"{y}-{m + 1:02d}-01"
        pipeline = [
            {"$match": {"date": {"$gte": ms, "$lt": me}}},
            {"$group": {"_id": None, "revenue": {"$sum": "$total"}, "count": {"$sum": 1}}}
        ]
        result = await db.sales.aggregate(pipeline).to_list(1)
        exp_pipeline = [
            {"$match": {"date": {"$gte": ms, "$lt": me}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        exp_result = await db.expenses.aggregate(exp_pipeline).to_list(1)
        revenue_trend.append({
            "month": f"{y}-{m:02d}",
            "revenue": round(result[0]["revenue"], 2) if result else 0,
            "expenses": round(exp_result[0]["total"], 2) if exp_result else 0,
            "profit": round((result[0]["revenue"] if result else 0) - (exp_result[0]["total"] if exp_result else 0), 2),
            "sales_count": result[0]["count"] if result else 0,
        })

    # Expense breakdown by category (current month)
    expense_cat_pipeline = [
        {"$match": {"date": {"$gte": month_start, "$lte": end_filter}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    expense_cats = await db.expenses.aggregate(expense_cat_pipeline).to_list(50)
    expense_breakdown = [{"category": r["_id"] or "Other", "amount": round(r["total"], 2), "count": r["count"]} for r in expense_cats]
    expense_breakdown.sort(key=lambda x: x["amount"], reverse=True)

    # Revenue by payment method (current month)
    revenue_method_pipeline = [
        {"$match": {"date": {"$gte": month_start, "$lte": end_filter}}},
        {"$group": {"_id": None, "cash": {"$sum": "$cash"}, "bank": {"$sum": "$bank"},
                    "online": {"$sum": "$online"}, "credit": {"$sum": "$credit"}, "total": {"$sum": "$total"}}}
    ]
    rev_method = await db.sales.aggregate(revenue_method_pipeline).to_list(1)
    payment_breakdown = []
    if rev_method:
        rm = rev_method[0]
        for k in ["cash", "bank", "online", "credit"]:
            if rm.get(k, 0) > 0:
                payment_breakdown.append({"method": k.capitalize(), "amount": round(rm[k], 2)})

    # Cash flow (in vs out this month)
    total_in = rev_method[0]["total"] if rev_method else 0
    total_out_pipeline = [
        {"$match": {"date": {"$gte": month_start, "$lte": end_filter}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    total_out_result = await db.expenses.aggregate(total_out_pipeline).to_list(1)
    total_out = total_out_result[0]["total"] if total_out_result else 0

    # Outstanding amounts
    ar_pipeline = [{"$match": {"credit": {"$gt": 0}}}, {"$group": {"_id": None, "total": {"$sum": "$credit"}, "count": {"$sum": 1}}}]
    ar = await db.sales.aggregate(ar_pipeline).to_list(1)
    ap_pipeline = [{"$match": {"status": {"$in": ["unpaid", "partial"]}}}, {"$group": {"_id": None, "total": {"$sum": "$balance_due"}, "count": {"$sum": 1}}}]
    ap = await db.bills.aggregate(ap_pipeline).to_list(1)

    return {
        "revenue_trend": revenue_trend,
        "expense_breakdown": expense_breakdown,
        "payment_breakdown": payment_breakdown,
        "cash_flow": {
            "inflow": round(total_in, 2),
            "outflow": round(total_out, 2),
            "net": round(total_in - total_out, 2),
        },
        "outstanding": {
            "receivable": round(ar[0]["total"] if ar else 0, 2),
            "receivable_count": ar[0]["count"] if ar else 0,
            "payable": round(ap[0]["total"] if ap else 0, 2),
            "payable_count": ap[0]["count"] if ap else 0,
        },
        "month": month_start,
    }
