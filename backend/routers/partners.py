from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db, get_current_user
from models import User, Partner, PartnerCreate, PartnerTransaction, PartnerTransactionCreate, CompanyLoan, CompanyLoanPayment, Fine, FineCreate, Expense, Notification
from fastapi import UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
import uuid, os

from database import ROOT_DIR

router = APIRouter()

# Partner Routes
@router.get("/partners")
async def get_partners(current_user: User = Depends(get_current_user)):
    partners = await db.partners.find({}, {"_id": 0}).to_list(100)
    transactions = await db.partner_transactions.find({}, {"_id": 0}).to_list(10000)
    for p in partners:
        pt = [t for t in transactions if t.get("partner_id") == p["id"]]
        invested = sum(t["amount"] for t in pt if t.get("transaction_type") in ["investment"])
        withdrawn = sum(t["amount"] for t in pt if t.get("transaction_type") in ["withdrawal", "profit_share", "expense"])
        p["total_invested"] = invested; p["total_withdrawn"] = withdrawn; p["balance"] = invested - withdrawn
    return partners

@router.post("/partners")
async def create_partner(data: PartnerCreate, current_user: User = Depends(get_current_user)):
    partner = Partner(**data.model_dump()); p_dict = partner.model_dump(); p_dict["created_at"] = p_dict["created_at"].isoformat()
    await db.partners.insert_one(p_dict)
    return {k: v for k, v in p_dict.items() if k != '_id'}

@router.put("/partners/{partner_id}")
async def update_partner(partner_id: str, data: PartnerCreate, current_user: User = Depends(get_current_user)):
    await db.partners.update_one({"id": partner_id}, {"$set": data.model_dump()})
    return await db.partners.find_one({"id": partner_id}, {"_id": 0})

@router.delete("/partners/{partner_id}")
async def delete_partner(partner_id: str, current_user: User = Depends(get_current_user)):
    await db.partners.delete_one({"id": partner_id}); return {"message": "Partner deleted"}

@router.get("/partner-transactions")
async def get_partner_transactions(partner_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if partner_id: query["partner_id"] = partner_id
    txns = await db.partner_transactions.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
    for t in txns:
        for f in ['date', 'created_at']:
            if isinstance(t.get(f), str): t[f] = datetime.fromisoformat(t[f])
    return txns

@router.post("/partner-transactions")
async def create_partner_transaction(data: PartnerTransactionCreate, current_user: User = Depends(get_current_user)):
    partner = await db.partners.find_one({"id": data.partner_id}, {"_id": 0})
    if not partner: raise HTTPException(status_code=404, detail="Partner not found")
    txn = PartnerTransaction(**data.model_dump(), partner_name=partner["name"], created_by=current_user.id)
    t_dict = txn.model_dump(); t_dict["date"] = t_dict["date"].isoformat(); t_dict["created_at"] = t_dict["created_at"].isoformat()
    if t_dict.get("branch_id") == '': t_dict["branch_id"] = None
    await db.partner_transactions.insert_one(t_dict)
    return {k: v for k, v in t_dict.items() if k != '_id'}

@router.delete("/partner-transactions/{txn_id}")
async def delete_partner_transaction(txn_id: str, current_user: User = Depends(get_current_user)):
    await db.partner_transactions.delete_one({"id": txn_id}); return {"message": "Transaction deleted"}

@router.post("/partners/{partner_id}/pay-salary")
async def pay_partner_salary(partner_id: str, body: dict, current_user: User = Depends(get_current_user)):
    partner = await db.partners.find_one({"id": partner_id}, {"_id": 0})
    if not partner: raise HTTPException(status_code=404, detail="Partner not found")
    amount = float(body.get("amount", partner.get("salary", 0))); period = body.get("period", ""); ptype = body.get("type", "salary")
    mode = body.get("payment_mode", "cash"); branch_id = body.get("branch_id") or None
    txn = PartnerTransaction(partner_id=partner_id, partner_name=partner["name"], transaction_type="withdrawal" if ptype in ["salary", "advance"] else ptype, amount=amount, payment_mode=mode, branch_id=branch_id, description=f"{ptype.replace('_',' ').title()} - {period}", date=datetime.now(timezone.utc), created_by=current_user.id)
    t_dict = txn.model_dump(); t_dict["date"] = t_dict["date"].isoformat(); t_dict["created_at"] = t_dict["created_at"].isoformat()
    await db.partner_transactions.insert_one(t_dict)
    if ptype == "advance": await db.partners.update_one({"id": partner_id}, {"$inc": {"loan_balance": amount}})
    elif ptype == "loan_repayment": await db.partners.update_one({"id": partner_id}, {"$inc": {"loan_balance": -amount}})
    expense = Expense(category="partner_salary", description=f"Partner {ptype.title()} - {partner['name']} - {period}", amount=amount, payment_mode=mode, branch_id=branch_id, date=datetime.now(timezone.utc), created_by=current_user.id)
    e_dict = expense.model_dump(); e_dict["date"] = e_dict["date"].isoformat(); e_dict["created_at"] = e_dict["created_at"].isoformat()
    await db.expenses.insert_one(e_dict)
    return {"message": f"Partner {ptype} SAR {amount:.2f} recorded & added to expenses"}

# Company Loans
@router.get("/company-loans")
async def get_company_loans(current_user: User = Depends(get_current_user)):
    loans = await db.company_loans.find({}, {"_id": 0}).to_list(100)
    payments = await db.company_loan_payments.find({}, {"_id": 0}).to_list(10000)
    for l in loans:
        l["paid_amount"] = sum(p["amount"] for p in payments if p.get("loan_id") == l["id"])
        l["remaining"] = l["total_amount"] - l["paid_amount"]; l["status"] = "paid" if l["remaining"] <= 0 else "active"
        for f in ['start_date', 'created_at']:
            if isinstance(l.get(f), str): l[f] = datetime.fromisoformat(l[f])
    return loans

@router.post("/company-loans")
async def create_company_loan(body: dict, current_user: User = Depends(get_current_user)):
    loan = CompanyLoan(lender=body["lender"], loan_type=body.get("loan_type", "bank"), total_amount=float(body["total_amount"]), monthly_payment=float(body.get("monthly_payment", 0)), interest_rate=float(body.get("interest_rate", 0)), branch_id=body.get("branch_id") or None, start_date=datetime.fromisoformat(body["start_date"]), notes=body.get("notes", ""))
    l_dict = loan.model_dump(); l_dict["start_date"] = l_dict["start_date"].isoformat(); l_dict["created_at"] = l_dict["created_at"].isoformat()
    await db.company_loans.insert_one(l_dict)
    return {k: v for k, v in l_dict.items() if k != '_id'}

@router.post("/company-loans/{loan_id}/pay")
async def pay_company_loan(loan_id: str, body: dict, current_user: User = Depends(get_current_user)):
    loan = await db.company_loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan: raise HTTPException(status_code=404, detail="Loan not found")
    amount = float(body["amount"]); mode = body.get("payment_mode", "bank"); branch_id = body.get("branch_id") or loan.get("branch_id")
    payment = CompanyLoanPayment(loan_id=loan_id, amount=amount, payment_mode=mode, branch_id=branch_id, date=datetime.now(timezone.utc), notes=body.get("notes", ""))
    p_dict = payment.model_dump(); p_dict["date"] = p_dict["date"].isoformat(); p_dict["created_at"] = p_dict["created_at"].isoformat()
    await db.company_loan_payments.insert_one(p_dict)
    expense = Expense(category="loan_repayment", description=f"Loan repayment - {loan['lender']}", amount=amount, payment_mode=mode, branch_id=branch_id, date=datetime.now(timezone.utc), created_by=current_user.id)
    e_dict = expense.model_dump(); e_dict["date"] = e_dict["date"].isoformat(); e_dict["created_at"] = e_dict["created_at"].isoformat()
    await db.expenses.insert_one(e_dict)
    return {"message": f"Loan payment SAR {amount:.2f} recorded"}

@router.delete("/company-loans/{loan_id}")
async def delete_company_loan(loan_id: str, current_user: User = Depends(get_current_user)):
    await db.company_loans.delete_one({"id": loan_id}); return {"message": "Loan deleted"}

@router.get("/company-loan-payments")
async def get_loan_payments(loan_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"loan_id": loan_id} if loan_id else {}
    payments = await db.company_loan_payments.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    for p in payments:
        for f in ['date', 'created_at']:
            if isinstance(p.get(f), str): p[f] = datetime.fromisoformat(p[f])
    return payments

# Fines & Penalties Routes
@router.get("/fines")
async def get_fines(current_user: User = Depends(get_current_user)):
    fines = await db.fines.find({}, {"_id": 0}).sort("fine_date", -1).to_list(1000)
    for f in fines:
        for k in ['fine_date', 'due_date', 'paid_date', 'created_at']:
            if isinstance(f.get(k), str): f[k] = datetime.fromisoformat(f[k])
    return fines

@router.post("/fines")
async def create_fine(data: FineCreate, current_user: User = Depends(get_current_user)):
    fine = Fine(**data.model_dump()); f_dict = fine.model_dump()
    for k in ['fine_date', 'due_date', 'created_at']:
        if f_dict.get(k): f_dict[k] = f_dict[k].isoformat()
    for k in ['branch_id', 'employee_id']:
        if f_dict.get(k) == '': f_dict[k] = None
    await db.fines.insert_one(f_dict)
    if data.employee_id:
        emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
        if emp and emp.get("user_id"):
            msg = f"SAR {data.amount:.2f} fine ({data.fine_type}) from {data.department}. {data.description}"
            if data.deduct_from_salary and data.monthly_deduction: msg += f" | SAR {data.monthly_deduction:.2f}/month will be deducted from salary."
            n = Notification(user_id=emp["user_id"], title="Fine Charged to You", message=msg, type="fine_charged", related_id=fine.id)
            n_dict = n.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
            await db.notifications.insert_one(n_dict)
    return {k: v for k, v in f_dict.items() if k != '_id'}

@router.put("/fines/{fine_id}/pay")
async def pay_fine(fine_id: str, body: dict, current_user: User = Depends(get_current_user)):
    fine = await db.fines.find_one({"id": fine_id}, {"_id": 0})
    if not fine: raise HTTPException(status_code=404, detail="Fine not found")
    amount = float(body.get("amount", 0)); mode = body.get("payment_mode", "cash")
    new_paid = fine.get("paid_amount", 0) + amount; status = "paid" if new_paid >= fine["amount"] else "partial"
    await db.fines.update_one({"id": fine_id}, {"$set": {"paid_amount": new_paid, "payment_status": status, "payment_mode": mode, "paid_date": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Fine payment recorded", "paid_amount": new_paid, "status": status}

@router.delete("/fines/{fine_id}")
async def delete_fine(fine_id: str, current_user: User = Depends(get_current_user)):
    fine = await db.fines.find_one({"id": fine_id}, {"_id": 0})
    if fine and fine.get("file_path") and os.path.exists(fine["file_path"]): os.remove(fine["file_path"])
    await db.fines.delete_one({"id": fine_id}); return {"message": "Fine deleted"}

@router.post("/fines/{fine_id}/upload")
async def upload_fine_proof(fine_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    upload_dir = ROOT_DIR / "uploads" / "fines"; upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix; file_path = upload_dir / f"{fine_id}{ext}"
    with open(file_path, "wb") as f: f.write(await file.read())
    await db.fines.update_one({"id": fine_id}, {"$set": {"file_path": str(file_path), "file_name": file.filename}})
    return {"message": "Proof uploaded", "file_name": file.filename}

@router.get("/fines/{fine_id}/download")
async def download_fine_proof(fine_id: str, current_user: User = Depends(get_current_user)):
    fine = await db.fines.find_one({"id": fine_id}, {"_id": 0})
    if not fine or not fine.get("file_path"): raise HTTPException(status_code=404, detail="No file")
    if not os.path.exists(fine["file_path"]): raise HTTPException(status_code=404, detail="File missing")
    return FileResponse(fine["file_path"], filename=fine.get("file_name", "proof"))
