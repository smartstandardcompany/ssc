"""
Loan Management System
Create, approve, track, and manage employee loans with installment payments.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
import math

from database import db, get_current_user
from models import User, Loan, LoanCreate, LoanInstallment, Notification, Expense

router = APIRouter()


@router.get("/loans")
async def get_loans(status: Optional[str] = None, employee_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    if employee_id:
        query["employee_id"] = employee_id
    loans = await db.loans.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return loans


@router.post("/loans")
async def create_loan(data: LoanCreate, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    amount = data.amount
    installment = data.monthly_installment
    total_inst = data.total_installments

    if installment > 0 and total_inst == 0:
        total_inst = math.ceil(amount / installment)
    elif total_inst > 0 and installment == 0:
        installment = round(amount / total_inst, 2)

    loan = Loan(
        employee_id=data.employee_id,
        employee_name=emp["name"],
        loan_type=data.loan_type,
        amount=amount,
        monthly_installment=installment,
        total_installments=total_inst,
        paid_installments=0,
        remaining_balance=amount,
        status="pending",
        start_date=data.start_date,
        reason=data.reason,
        notes=data.notes,
    )
    l_dict = loan.model_dump()
    for f in ["start_date", "created_at", "approved_at"]:
        if l_dict.get(f) and isinstance(l_dict[f], datetime):
            l_dict[f] = l_dict[f].isoformat()
    await db.loans.insert_one(l_dict)

    # Notify employee
    if emp.get("user_id"):
        n = Notification(
            user_id=emp["user_id"],
            title="Loan Request Created",
            message=f"Your {data.loan_type} loan request for SAR {amount:.2f} has been submitted.",
            type="loan_created",
            related_id=loan.id,
        )
        n_dict = n.model_dump()
        n_dict["created_at"] = n_dict["created_at"].isoformat()
        await db.notifications.insert_one(n_dict)

    return {k: v for k, v in l_dict.items() if k != "_id"}


@router.get("/loans/{loan_id}")
async def get_loan(loan_id: str, current_user: User = Depends(get_current_user)):
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    installments = await db.loan_installments.find({"loan_id": loan_id}, {"_id": 0}).sort("date", -1).to_list(500)
    return {"loan": loan, "installments": installments}


@router.post("/loans/{loan_id}/approve")
async def approve_loan(loan_id: str, body: dict, current_user: User = Depends(get_current_user)):
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] not in ["pending"]:
        raise HTTPException(status_code=400, detail="Loan is not in pending status")

    action = body.get("action", "approve")
    now = datetime.now(timezone.utc).isoformat()

    if action == "approve":
        await db.loans.update_one(
            {"id": loan_id},
            {"$set": {"status": "active", "approved_by": current_user.id, "approved_at": now}},
        )
        # Update employee loan balance
        emp = await db.employees.find_one({"id": loan["employee_id"]}, {"_id": 0})
        if emp:
            new_balance = emp.get("loan_balance", 0) + loan["amount"]
            await db.employees.update_one({"id": loan["employee_id"]}, {"$set": {"loan_balance": new_balance}})

        # Notify
        if emp and emp.get("user_id"):
            n = Notification(
                user_id=emp["user_id"],
                title="Loan Approved",
                message=f"Your {loan['loan_type']} loan of SAR {loan['amount']:.2f} has been approved.",
                type="loan_approved",
                related_id=loan_id,
            )
            n_dict = n.model_dump()
            n_dict["created_at"] = n_dict["created_at"].isoformat()
            await db.notifications.insert_one(n_dict)

        return {"message": "Loan approved", "status": "active"}
    else:
        await db.loans.update_one({"id": loan_id}, {"$set": {"status": "rejected", "notes": body.get("reason", "")}})
        return {"message": "Loan rejected", "status": "rejected"}


@router.post("/loans/{loan_id}/installment")
async def record_installment(loan_id: str, body: dict, current_user: User = Depends(get_current_user)):
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] != "active":
        raise HTTPException(status_code=400, detail="Loan is not active")

    amount = float(body.get("amount", loan.get("monthly_installment", 0)))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    remaining = loan["remaining_balance"] - amount
    if remaining < 0:
        remaining = 0
        amount = loan["remaining_balance"]

    paid = loan.get("paid_installments", 0) + 1
    new_status = "completed" if remaining <= 0 else "active"

    installment = LoanInstallment(
        loan_id=loan_id,
        employee_id=loan["employee_id"],
        employee_name=loan["employee_name"],
        amount=amount,
        payment_mode=body.get("payment_mode", "deduction"),
        period=body.get("period", ""),
        remaining_balance=round(remaining, 2),
        notes=body.get("notes", ""),
        created_by=current_user.id,
    )
    i_dict = installment.model_dump()
    i_dict["date"] = i_dict["date"].isoformat()
    i_dict["created_at"] = i_dict["created_at"].isoformat()
    await db.loan_installments.insert_one(i_dict)

    await db.loans.update_one(
        {"id": loan_id},
        {"$set": {"remaining_balance": round(remaining, 2), "paid_installments": paid, "status": new_status}},
    )

    # Update employee loan balance
    emp = await db.employees.find_one({"id": loan["employee_id"]}, {"_id": 0})
    if emp:
        new_emp_balance = max(0, emp.get("loan_balance", 0) - amount)
        await db.employees.update_one({"id": loan["employee_id"]}, {"$set": {"loan_balance": round(new_emp_balance, 2)}})

    return {k: v for k, v in i_dict.items() if k != "_id"}


@router.delete("/loans/{loan_id}")
async def delete_loan(loan_id: str, current_user: User = Depends(get_current_user)):
    loan = await db.loans.find_one({"id": loan_id}, {"_id": 0})
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    if loan["status"] == "active" and loan["paid_installments"] > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a loan with paid installments")
    await db.loans.delete_one({"id": loan_id})
    await db.loan_installments.delete_many({"loan_id": loan_id})
    return {"message": "Loan deleted"}


@router.get("/loans/summary/stats")
async def get_loan_stats(current_user: User = Depends(get_current_user)):
    loans = await db.loans.find({}, {"_id": 0}).to_list(5000)
    active = [l for l in loans if l["status"] == "active"]
    pending = [l for l in loans if l["status"] == "pending"]
    completed = [l for l in loans if l["status"] == "completed"]
    return {
        "total_loans": len(loans),
        "active_loans": len(active),
        "pending_loans": len(pending),
        "completed_loans": len(completed),
        "total_disbursed": sum(l["amount"] for l in active + completed),
        "total_outstanding": sum(l.get("remaining_balance", 0) for l in active),
        "total_collected": sum(l["amount"] - l.get("remaining_balance", 0) for l in active + completed),
    }


# Employee self-service: get my loans
@router.get("/my/loans")
async def get_my_loans(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    loans = await db.loans.find({"employee_id": emp["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return loans
