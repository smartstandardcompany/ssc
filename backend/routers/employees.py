from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.units import inch

from database import db, hash_password, get_current_user, ROOT_DIR, require_permission, get_branch_filter
from models import (User, Employee, EmployeeCreate, SalaryPayment, SalaryPaymentCreate,
                    Leave, LeaveCreate, Notification, Attendance, EmployeeDocument,
                    EmployeeDocumentCreate, EmployeeRequest, EmployeeRequestCreate,
                    Expense, SalaryDeduction, SalaryDeductionCreate, SalaryHistory)
from fastapi import Query

router = APIRouter()

# Employee CRUD
@router.get("/employees")
async def get_employees(current_user: User = Depends(get_current_user)):
    require_permission(current_user, "employees", "read")
    query = get_branch_filter(current_user)
    employees = await db.employees.find(query, {"_id": 0}).to_list(1000)
    for emp in employees:
        for f in ['created_at', 'join_date', 'document_expiry']:
            if isinstance(emp.get(f), str): emp[f] = datetime.fromisoformat(emp[f])
    return employees

@router.post("/employees")
async def create_employee(data: EmployeeCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "employees", "write")
    emp = Employee(**data.model_dump())
    emp_dict = emp.model_dump()
    if data.email:
        existing_user = await db.users.find_one({"email": data.email}, {"_id": 0})
        if not existing_user:
            user = User(email=data.email, name=data.name, role="employee", permissions=["self_service"])
            user_dict = user.model_dump()
            user_dict["password"] = hash_password("emp@123")
            user_dict["created_at"] = user_dict["created_at"].isoformat()
            await db.users.insert_one(user_dict)
            emp_dict["user_id"] = user.id
        else:
            emp_dict["user_id"] = existing_user["id"]
    for f in ['created_at', 'join_date', 'document_expiry']:
        if emp_dict.get(f): emp_dict[f] = emp_dict[f].isoformat()
    await db.employees.insert_one(emp_dict)
    return {k: v for k, v in emp_dict.items() if k != '_id'}

@router.post("/employees/{emp_id}/link-user")
async def link_employee_user(emp_id: str, body: dict, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    email = body.get("email")
    if not email: raise HTTPException(status_code=400, detail="Email required")
    # Resolve permissions from job title
    jt_perms = ["self_service"]
    if emp.get("job_title_id"):
        jt = await db.job_titles.find_one({"id": emp["job_title_id"]}, {"_id": 0})
        if jt and jt.get("permissions"):
            jt_perms = list(set(jt_perms) | set(jt["permissions"]))
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        await db.employees.update_one({"id": emp_id}, {"$set": {"user_id": existing["id"]}})
        # Merge job title permissions into existing user
        merged = list(set(existing.get("permissions", [])) | set(jt_perms))
        await db.users.update_one({"id": existing["id"]}, {"$set": {"permissions": merged}})
        return {"message": f"Linked to existing user {email}", "user_id": existing["id"]}
    user = User(email=email, name=emp["name"], role="employee", permissions=jt_perms)
    user_dict = user.model_dump()
    user_dict["password"] = hash_password("emp@123")
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    await db.users.insert_one(user_dict)
    await db.employees.update_one({"id": emp_id}, {"$set": {"user_id": user.id}})
    return {"message": f"Created account for {email} (password: emp@123)", "user_id": user.id}

@router.put("/employees/{emp_id}")
async def update_employee(emp_id: str, data: EmployeeCreate, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "employees", "write")
    result = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not result: raise HTTPException(status_code=404, detail="Employee not found")
    update = data.model_dump()
    for f in ['join_date', 'document_expiry']:
        if update.get(f): update[f] = update[f].isoformat()
    await db.employees.update_one({"id": emp_id}, {"$set": update})
    
    # Sync email to linked user account if employee has a user_id
    if result.get("user_id") and update.get("email"):
        old_email = result.get("email", "")
        new_email = update["email"]
        if old_email != new_email:
            await db.users.update_one(
                {"id": result["user_id"]},
                {"$set": {"email": new_email}}
            )
    
    return await db.employees.find_one({"id": emp_id}, {"_id": 0})

@router.post("/employees/{emp_id}/send-email")
async def send_employee_email(emp_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Send an email to an employee"""
    require_permission(current_user, "employees", "write")
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    if not emp.get("email"): raise HTTPException(status_code=400, detail="Employee has no email address")
    
    subject = body.get("subject", "")
    message = body.get("message", "")
    if not subject or not message: raise HTTPException(status_code=400, detail="Subject and message required")
    
    from utils.email_service import send_email
    
    # Get company branding for email template
    branding = await db.settings.find_one({"type": "branding"}, {"_id": 0}) or {}
    company_name = branding.get("company_name", "SSC Track")
    
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: {branding.get('primary_color', '#10B981')}; padding: 20px; border-radius: 12px 12px 0 0;">
            <h2 style="color: white; margin: 0;">{company_name}</h2>
        </div>
        <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h3 style="color: #1f2937; margin-top: 0;">{subject}</h3>
            <div style="color: #4b5563; white-space: pre-wrap;">{message}</div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="color: #9ca3af; font-size: 12px;">This email was sent from {company_name}.</p>
        </div>
    </div>
    """
    
    success = await send_email(
        to_emails=[emp["email"]],
        subject=f"{company_name} - {subject}",
        html_body=html_body,
    )
    
    if success:
        return {"message": f"Email sent to {emp['email']}", "status": "sent"}
    else:
        return {"message": f"Email delivery failed to {emp['email']}. Check SMTP settings.", "status": "failed"}


@router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, current_user: User = Depends(get_current_user)):
    require_permission(current_user, "employees", "write")
    result = await db.employees.delete_one({"id": emp_id})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted"}


# Employee Status Management (Resignation / Termination)
@router.post("/employees/{emp_id}/resign")
async def resign_employee(emp_id: str, body: dict, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    resignation_date = body.get("resignation_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    notice_days = int(body.get("notice_period_days", 30))
    from datetime import timedelta as td
    last_day = body.get("last_working_day") or (datetime.fromisoformat(resignation_date) + td(days=notice_days)).strftime("%Y-%m-%d")
    reason = body.get("reason", "")
    status = body.get("status", "resigned")
    update = {
        "status": status,
        "resignation_date": resignation_date,
        "last_working_day": last_day,
        "notice_period_days": notice_days,
        "termination_reason": reason,
        "exit_type": body.get("exit_type", status),  # resigned, terminated, end_of_contract
        "clearance": body.get("clearance", {
            "company_assets_returned": False,
            "id_card_returned": False,
            "laptop_returned": False,
            "keys_returned": False,
            "pending_work_handed_over": False,
            "no_pending_loans": emp.get("loan_balance", 0) <= 0,
            "exit_interview_done": False,
        }),
    }
    await db.employees.update_one({"id": emp_id}, {"$set": update})
    
    # --- Send automated offboarding emails ---
    branding = await db.settings.find_one({"type": "branding"}, {"_id": 0}) or {}
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    co_name = company.get("company_name", branding.get("company_name", "SSC Track"))
    primary_color = branding.get("primary_color", "#F5841F")
    exit_label = {"resigned": "Resignation", "terminated": "Termination", "end_of_contract": "End of Contract"}.get(status, status.replace("_", " ").title())
    
    from utils.email_service import send_email
    import asyncio
    
    email_tasks = []
    
    # 1. Email to departing employee
    if emp.get("email"):
        emp_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {primary_color}; padding: 20px; border-radius: 12px 12px 0 0;">
                <h2 style="color: white; margin: 0;">{co_name}</h2>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0;">Employee Exit Notification</p>
            </div>
            <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #1f2937;">Dear <strong>{emp['name']}</strong>,</p>
                <p style="color: #4b5563;">This is to inform you that your exit process has been initiated.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Exit Type</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">{exit_label}</td></tr>
                    <tr><td style="padding: 8px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Effective Date</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">{resignation_date}</td></tr>
                    <tr><td style="padding: 8px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Last Working Day</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">{last_day}</td></tr>
                    <tr><td style="padding: 8px; color: #6b7280;">Notice Period</td><td style="padding: 8px; font-weight: bold;">{notice_days} days</td></tr>
                </table>
                <div style="background: #FFF7ED; border: 1px solid #FDBA74; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <p style="color: #9A3412; margin: 0; font-size: 14px;"><strong>Next Steps:</strong></p>
                    <ul style="color: #9A3412; font-size: 13px; margin: 8px 0;">
                        <li>Complete all pending work handover</li>
                        <li>Return company assets (laptop, ID card, keys)</li>
                        <li>Schedule your exit interview with HR</li>
                        <li>Your final settlement will be processed after clearance</li>
                    </ul>
                </div>
                {f'<p style="color: #6b7280; font-size: 13px;"><strong>Reason:</strong> {reason}</p>' if reason else ''}
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
                <p style="color: #9ca3af; font-size: 12px;">This is an automated notification from {co_name}.</p>
            </div>
        </div>
        """
        email_tasks.append(send_email(
            to_emails=[emp["email"]],
            subject=f"{co_name} - Exit Process Initiated ({exit_label})",
            html_body=emp_html,
        ))
    
    # 2. Email to admins - clearance reminder
    admins = await db.users.find({"role": {"$in": ["admin", "manager"]}}, {"_id": 0}).to_list(100)
    admin_emails = [a["email"] for a in admins if a.get("email")]
    if admin_emails:
        clearance_items = "".join([
            f'<li style="padding: 4px 0;">{item}</li>' for item in [
                "Company Assets Returned", "ID Card Returned", "Laptop/Equipment Returned",
                "Keys Returned", "Pending Work Handed Over", "No Pending Loans", "Exit Interview Done"
            ]
        ])
        admin_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {primary_color}; padding: 20px; border-radius: 12px 12px 0 0;">
                <h2 style="color: white; margin: 0;">{co_name}</h2>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0;">Clearance Reminder</p>
            </div>
            <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #1f2937;">An employee exit process has been initiated:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr><td style="padding: 8px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Employee</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">{emp['name']}</td></tr>
                    <tr><td style="padding: 8px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Position</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{emp.get('position', '-')}</td></tr>
                    <tr><td style="padding: 8px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Exit Type</td><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #e5e7eb;">{exit_label}</td></tr>
                    <tr><td style="padding: 8px; color: #6b7280;">Last Working Day</td><td style="padding: 8px; font-weight: bold;">{last_day}</td></tr>
                </table>
                <div style="background: #EFF6FF; border: 1px solid #93C5FD; border-radius: 8px; padding: 12px; margin: 16px 0;">
                    <p style="color: #1E40AF; margin: 0 0 8px 0; font-size: 14px;"><strong>Clearance Checklist:</strong></p>
                    <ul style="color: #1E40AF; font-size: 13px; margin: 0;">{clearance_items}</ul>
                </div>
                <p style="color: #4b5563; font-size: 13px;">Please ensure all clearance items are completed before the final settlement is processed. You can manage the checklist from the Employees page.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
                <p style="color: #9ca3af; font-size: 12px;">This is an automated notification from {co_name}.</p>
            </div>
        </div>
        """
        email_tasks.append(send_email(
            to_emails=admin_emails,
            subject=f"{co_name} - Clearance Required: {emp['name']} ({exit_label})",
            html_body=admin_html,
        ))
    
    # Send emails in background (don't block the response)
    if email_tasks:
        for task in email_tasks:
            asyncio.ensure_future(task)
    
    return {"message": f"Employee marked as {status}", "last_working_day": last_day}


@router.put("/employees/{emp_id}/clearance")
async def update_clearance(emp_id: str, body: dict, current_user: User = Depends(get_current_user)):
    """Update clearance checklist items"""
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    clearance = emp.get("clearance", {})
    clearance.update(body)
    await db.employees.update_one({"id": emp_id}, {"$set": {"clearance": clearance}})
    return {"success": True, "clearance": clearance}


@router.get("/employees/{emp_id}/settlement")
async def get_settlement(emp_id: str, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    salary = emp.get("salary", 0)
    daily_rate = salary / 30
    
    # --- End-of-Service Benefits (Saudi Labor Law) ---
    join_date_str = emp.get("join_date") or emp.get("created_at", "")
    resignation_date_str = emp.get("resignation_date") or emp.get("last_working_day") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    try:
        join_date = datetime.fromisoformat(str(join_date_str).replace("Z", "+00:00"))
        if join_date.tzinfo is None:
            join_date = join_date.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        join_date = datetime.now(timezone.utc)
    
    try:
        end_date = datetime.fromisoformat(str(resignation_date_str).replace("Z", "+00:00"))
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        end_date = datetime.now(timezone.utc)
    
    service_days = (end_date - join_date).days
    service_years = service_days / 365.25
    service_months = service_days / 30.44
    
    # Saudi labor law EOS calculation:
    # Resignation: 1/3 salary per year (2-5 years), 2/3 salary per year (5-10 years), full salary per year (10+ years)
    # Termination: 1/2 salary per year (first 5), full salary per year (after 5)
    status = emp.get("status", "resigned")
    exit_type = emp.get("exit_type", status)
    is_terminated = status in ["terminated", "fired"] or exit_type == "end_of_contract"
    
    eos_amount = 0.0
    if is_terminated:
        # Termination by employer
        if service_years <= 5:
            eos_amount = (salary / 2) * service_years
        else:
            eos_amount = (salary / 2) * 5 + salary * (service_years - 5)
    else:
        # Resignation by employee
        if service_years < 2:
            eos_amount = 0  # No EOS for < 2 years
        elif service_years <= 5:
            eos_amount = (salary / 3) * service_years
        elif service_years <= 10:
            eos_amount = (salary / 3) * 5 + (salary * 2 / 3) * (service_years - 5)
        else:
            eos_amount = (salary / 3) * 5 + (salary * 2 / 3) * 5 + salary * (service_years - 10)
    
    eos_amount = round(eos_amount, 2)
    
    # --- Leave Encashment ---
    leaves = await db.leaves.find({"employee_id": emp_id, "status": "approved"}, {"_id": 0}).to_list(1000)
    annual_used = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "annual")
    annual_entitled = emp.get("annual_leave_entitled", 30)
    leave_balance = max(0, annual_entitled - annual_used)
    leave_encashment = round(leave_balance * daily_rate, 2)
    
    # --- Pending Salary ---
    current_month = datetime.now(timezone.utc).strftime("%Y-%m")
    paid_this_month = await db.salary_payments.find({"employee_id": emp_id, "period": current_month, "payment_type": "salary"}, {"_id": 0}).to_list(10)
    pending_salary = salary if not paid_this_month else 0
    
    # --- Loan Balance ---
    loan_balance = emp.get("loan_balance", 0)
    
    # --- Total Settlement ---
    total_settlement = round(pending_salary + leave_encashment + eos_amount - loan_balance, 2)
    
    clearance = emp.get("clearance", {})
    clearance_complete = all(clearance.values()) if clearance else False
    
    return {
        "employee_id": emp_id,
        "employee_name": emp.get("name", ""),
        "status": emp.get("status", "active"),
        "exit_type": exit_type,
        "clearance": clearance,
        "clearance_complete": clearance_complete,
        "monthly_salary": salary,
        "join_date": str(join_date_str)[:10],
        "end_date": str(resignation_date_str)[:10],
        "service_years": round(service_years, 2),
        "service_months": round(service_months, 1),
        "service_days": service_days,
        "end_of_service_benefit": eos_amount,
        "eos_calculation_type": "termination" if is_terminated else "resignation",
        "pending_salary": pending_salary,
        "leave_balance_days": leave_balance,
        "leave_encashment": leave_encashment,
        "loan_balance": loan_balance,
        "total_settlement": total_settlement,
        "resignation_date": emp.get("resignation_date"),
        "last_working_day": emp.get("last_working_day"),
        "breakdown": {
            "pending_salary": pending_salary,
            "leave_encashment": leave_encashment,
            "end_of_service": eos_amount,
            "loan_deduction": -loan_balance,
            "total": total_settlement,
        }
    }


@router.get("/employees/{emp_id}/settlement/pdf")
async def settlement_pdf(emp_id: str, current_user: User = Depends(get_current_user)):
    """Generate a settlement PDF for download"""
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Reuse settlement calculation
    settlement_data = await get_settlement(emp_id, current_user)
    
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    co_name = company.get("company_name", "Smart Standard Company")
    addr_parts = [company.get("address_line1",""), company.get("address_line2",""), company.get("city",""), company.get("country","")]
    co_addr = ", ".join([p for p in addr_parts if p])
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40, leftMargin=50, rightMargin=50)
    elements = []
    styles = getSampleStyleSheet()
    
    title_s = ParagraphStyle('T', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#F5841F'), alignment=1, spaceAfter=5)
    sub_s = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=9, textColor=colors.grey, alignment=1, spaceAfter=3)
    body_s = ParagraphStyle('B', parent=styles['Normal'], fontSize=10, leading=16, spaceAfter=8)
    
    logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.jpg"
    if not logo_path.exists():
        logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.png"
    if logo_path.exists():
        from reportlab.platypus import Image as RLImage
        try:
            logo = RLImage(str(logo_path), width=1.5*inch, height=0.7*inch)
            logo.hAlign = 'CENTER'
            elements.append(logo)
        except:
            pass
    
    elements.append(Paragraph(co_name.upper(), title_s))
    if co_addr:
        elements.append(Paragraph(co_addr, sub_s))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#F5841F')))
    elements.append(Spacer(1, 0.3*inch))
    
    # Title
    exit_type = settlement_data.get("exit_type", settlement_data["status"])
    exit_label = {"terminated": "Termination", "resigned": "Resignation", "end_of_contract": "End of Contract"}.get(exit_type, exit_type.replace("_", " ").title())
    elements.append(Paragraph(f"<b>FINAL SETTLEMENT - {exit_label.upper()}</b>", ParagraphStyle('H', parent=styles['Heading2'], fontSize=14, alignment=1, spaceAfter=15)))
    elements.append(Paragraph(f"Date: {datetime.now().strftime('%d %B %Y')}", ParagraphStyle('R', parent=styles['Normal'], fontSize=9, alignment=2)))
    elements.append(Spacer(1, 0.15*inch))
    
    # Employee Info
    info_rows = [
        ["Employee Name:", settlement_data["employee_name"], "Document ID:", emp.get("document_id", "-")],
        ["Position:", emp.get("position", "-"), "Join Date:", settlement_data.get("join_date", "-")],
        ["Exit Type:", exit_label, "End Date:", settlement_data.get("end_date", "-")],
        ["Service Period:", f"{settlement_data['service_years']} years ({settlement_data['service_days']} days)", "Monthly Salary:", f"SAR {settlement_data['monthly_salary']:,.2f}"],
    ]
    it = Table(info_rows, colWidths=[1.2*inch, 2*inch, 1.2*inch, 2*inch])
    it.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'), ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9), ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FAFAFA')),
    ]))
    elements.append(it)
    elements.append(Spacer(1, 0.2*inch))
    
    # Settlement Breakdown
    elements.append(Paragraph("<b>Settlement Breakdown</b>", ParagraphStyle('SH', parent=styles['Heading3'], fontSize=12, textColor=colors.HexColor('#F5841F'))))
    elements.append(Spacer(1, 0.1*inch))
    
    bd = settlement_data["breakdown"]
    settle_rows = [
        ["Description", "Amount (SAR)"],
        ["Pending Salary", f"{bd['pending_salary']:,.2f}"],
        [f"Leave Encashment ({settlement_data['leave_balance_days']} days)", f"{bd['leave_encashment']:,.2f}"],
        [f"End-of-Service Benefit ({settlement_data['eos_calculation_type'].title()})", f"{bd['end_of_service']:,.2f}"],
        ["Loan Deduction", f"{bd['loan_deduction']:,.2f}"],
        ["", ""],
        ["TOTAL SETTLEMENT", f"{bd['total']:,.2f}"],
    ]
    st = Table(settle_rows, colWidths=[4.5*inch, 2*inch])
    st.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F5841F')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#FFF3E0')),
        ('FONTSIZE', (0,-1), (-1,-1), 11),
    ]))
    elements.append(st)
    elements.append(Spacer(1, 0.2*inch))
    
    # Clearance Checklist
    clearance = settlement_data.get("clearance", {})
    if clearance:
        elements.append(Paragraph("<b>Clearance Checklist</b>", ParagraphStyle('CH', parent=styles['Heading3'], fontSize=12, textColor=colors.HexColor('#F5841F'))))
        elements.append(Spacer(1, 0.1*inch))
        cl_rows = [["Item", "Status"]]
        labels = {
            "company_assets_returned": "Company Assets Returned",
            "id_card_returned": "ID Card Returned",
            "laptop_returned": "Laptop/Equipment Returned",
            "keys_returned": "Keys Returned",
            "pending_work_handed_over": "Pending Work Handed Over",
            "no_pending_loans": "No Pending Loans",
            "exit_interview_done": "Exit Interview Done",
        }
        for key, label in labels.items():
            val = clearance.get(key, False)
            cl_rows.append([label, "Completed" if val else "Pending"])
        ct = Table(cl_rows, colWidths=[4.5*inch, 2*inch])
        ct.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F5841F')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('ALIGN', (1,1), (1,-1), 'CENTER'),
        ]))
        for i, row in enumerate(cl_rows[1:], 1):
            if row[1] == "Completed":
                ct.setStyle(TableStyle([('TEXTCOLOR', (1,i), (1,i), colors.HexColor('#059669'))]))
            else:
                ct.setStyle(TableStyle([('TEXTCOLOR', (1,i), (1,i), colors.HexColor('#DC2626'))]))
        elements.append(ct)
        elements.append(Spacer(1, 0.3*inch))
    
    # Signatures
    elements.append(Spacer(1, 0.3*inch))
    sig_rows = [
        ["Employee Signature:", "____________________", "HR / Manager:", "____________________"],
        ["", "", "", ""],
        ["Date:", "____________________", "Date:", "____________________"],
    ]
    sig_t = Table(sig_rows, colWidths=[1.3*inch, 2*inch, 1.3*inch, 2*inch])
    sig_t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'), ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9), ('BOTTOMPADDING', (0,0), (-1,-1), 15),
    ]))
    elements.append(sig_t)
    
    doc.build(elements)
    buffer.seek(0)
    fname = f"settlement_{emp['name'].replace(' ', '_')}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={fname}"})



@router.post("/employees/{emp_id}/complete-exit")
async def complete_exit(emp_id: str, body: dict, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    settlement_amount = float(body.get("settlement_amount", 0))
    await db.employees.update_one({"id": emp_id}, {"$set": {
        "active": False, "status": body.get("status", "left"),
        "final_settlement_amount": settlement_amount,
        "final_settlement_paid": body.get("paid", True),
    }})
    # Deactivate user account
    if emp.get("user_id"):
        await db.users.update_one({"id": emp["user_id"]}, {"$set": {"permissions": [], "active": False}})
    
    # --- Send settlement summary email to employee ---
    if emp.get("email"):
        branding = await db.settings.find_one({"type": "branding"}, {"_id": 0}) or {}
        company = await db.company_settings.find_one({}, {"_id": 0}) or {}
        co_name = company.get("company_name", branding.get("company_name", "SSC Track"))
        primary_color = branding.get("primary_color", "#F5841F")
        
        exit_type = emp.get("exit_type", emp.get("status", "resigned"))
        exit_label = {"resigned": "Resignation", "terminated": "Termination", "end_of_contract": "End of Contract"}.get(exit_type, exit_type.replace("_", " ").title())
        
        settlement_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: {primary_color}; padding: 20px; border-radius: 12px 12px 0 0;">
                <h2 style="color: white; margin: 0;">{co_name}</h2>
                <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0;">Final Settlement</p>
            </div>
            <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="color: #1f2937;">Dear <strong>{emp['name']}</strong>,</p>
                <p style="color: #4b5563;">Your exit process has been completed. Below is a summary of your final settlement:</p>
                <div style="background: #EFF6FF; border: 1px solid #93C5FD; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 6px 0; color: #6b7280;">Exit Type</td><td style="padding: 6px 0; text-align: right; font-weight: bold;">{exit_label}</td></tr>
                        <tr><td style="padding: 6px 0; color: #6b7280;">Last Working Day</td><td style="padding: 6px 0; text-align: right;">{emp.get('last_working_day', '-')}</td></tr>
                        <tr style="border-top: 2px solid #93C5FD;"><td style="padding: 10px 0; font-weight: bold; font-size: 16px;">Total Settlement</td><td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 16px; color: {'#059669' if settlement_amount >= 0 else '#DC2626'};">SAR {settlement_amount:,.2f}</td></tr>
                    </table>
                </div>
                <p style="color: #4b5563; font-size: 13px;">The settlement amount has been processed. If you have any questions, please contact HR.</p>
                <p style="color: #4b5563; font-size: 13px;">We wish you all the best in your future endeavors.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
                <p style="color: #9ca3af; font-size: 12px;">This is an automated notification from {co_name}.</p>
            </div>
        </div>
        """
        from utils.email_service import send_email
        import asyncio
        asyncio.ensure_future(send_email(
            to_emails=[emp["email"]],
            subject=f"{co_name} - Final Settlement Processed",
            html_body=settlement_html,
        ))
    
    return {"message": "Employee exit completed, account deactivated"}


# Salary Payments
@router.get("/salary-payments")
async def get_salary_payments(current_user: User = Depends(get_current_user)):
    payments = await db.salary_payments.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    for p in payments:
        for f in ['date', 'created_at']:
            if isinstance(p.get(f), str): p[f] = datetime.fromisoformat(p[f])
    return payments

@router.post("/salary-payments")
async def create_salary_payment(data: SalaryPaymentCreate, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    if data.payment_type == "salary":
        existing = await db.salary_payments.find_one({"employee_id": data.employee_id, "period": data.period, "payment_type": "salary"}, {"_id": 0})
        if existing: raise HTTPException(status_code=400, detail=f"Salary already paid for {data.period}. Use overtime/bonus for extra payments.")
    payment = SalaryPayment(**data.model_dump(), employee_name=emp["name"], created_by=current_user.id)
    p_dict = payment.model_dump()
    p_dict["date"] = p_dict["date"].isoformat()
    p_dict["created_at"] = p_dict["created_at"].isoformat()
    await db.salary_payments.insert_one(p_dict)
    loan_balance = emp.get("loan_balance", 0)
    if data.payment_type == "advance":
        await db.employees.update_one({"id": data.employee_id}, {"$set": {"loan_balance": loan_balance + data.amount}})
    elif data.payment_type == "loan_repayment":
        await db.employees.update_one({"id": data.employee_id}, {"$set": {"loan_balance": max(0, loan_balance - data.amount)}})
    if data.payment_type == "old_balance":
        old_bal = emp.get("old_salary_balance", 0)
        await db.employees.update_one({"id": data.employee_id}, {"$set": {"old_salary_balance": max(0, old_bal - data.amount)}})
    if data.payment_type != "loan_repayment":
        cat_map = {"salary": "salary", "advance": "salary", "overtime": "salary", "bonus": "salary", "old_balance": "salary", "tickets": "tickets", "id_card": "id_card"}
        type_label = data.payment_type.replace("_", " ").title()
        expense = Expense(category=cat_map.get(data.payment_type, "salary"), description=f"{type_label} - {emp['name']} - {data.period}", amount=data.amount, payment_mode=data.payment_mode, branch_id=data.branch_id, date=data.date, notes=data.notes or f"Employee: {emp['name']}", created_by=current_user.id)
        e_dict = expense.model_dump()
        e_dict["date"] = e_dict["date"].isoformat(); e_dict["created_at"] = e_dict["created_at"].isoformat()
        await db.expenses.insert_one(e_dict)
    if emp.get("user_id"):
        type_label = data.payment_type.replace("_", " ").title()
        notif = Notification(user_id=emp["user_id"], title=f"{type_label} Payment Received", message=f"SAR {data.amount:.2f} {type_label} for {data.period} via {data.payment_mode}. Please acknowledge receipt.", type="salary_paid", related_id=payment.id)
        n_dict = notif.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
        await db.notifications.insert_one(n_dict)
    return {k: v for k, v in p_dict.items() if k != '_id'}

@router.get("/employees/{emp_id}/summary")
async def get_employee_summary(emp_id: str, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    payments = await db.salary_payments.find({"employee_id": emp_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    leaves = await db.leaves.find({"employee_id": emp_id}, {"_id": 0}).to_list(1000)
    deductions = await db.salary_deductions.find({"employee_id": emp_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    fines = await db.fines.find({"employee_id": emp_id}, {"_id": 0}).sort("fine_date", -1).to_list(1000)
    monthly = {}; total_advance = 0; total_repaid = 0
    for p in payments:
        period = p.get("period", "Unknown")
        if period not in monthly:
            monthly[period] = {"salary_paid": 0, "advance": 0, "overtime": 0, "tickets": 0, "id_card": 0, "loan_repayment": 0, "total": 0, "payments": []}
        pt = p.get("payment_type", "salary"); amount = p.get("amount", 0)
        if pt in monthly[period]: monthly[period][pt] += amount
        else: monthly[period]["salary_paid"] += amount
        monthly[period]["total"] += amount
        if pt == "advance": total_advance += amount
        if pt == "loan_repayment": total_repaid += amount
        monthly[period]["payments"].append({"id": p["id"], "payment_type": pt, "amount": amount, "payment_mode": p.get("payment_mode", "cash"), "date": p["date"], "notes": p.get("notes", "")})
    salary = emp.get("salary", 0)
    summary = []
    for period, data in monthly.items():
        balance = salary - data["salary_paid"]
        summary.append({"period": period, "monthly_salary": salary, "salary_paid": data["salary_paid"], "advance": data["advance"], "overtime": data["overtime"], "tickets": data["tickets"], "id_card": data["id_card"], "loan_repayment": data["loan_repayment"], "total_paid": data["total"], "balance": balance, "payments": data["payments"]})
    annual_used = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "annual")
    sick_used = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "sick")
    unpaid_used = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "unpaid")
    return {"employee": {"id": emp["id"], "name": emp["name"], "salary": salary, "position": emp.get("position", ""), "loan_balance": emp.get("loan_balance", 0), "annual_leave_entitled": emp.get("annual_leave_entitled", 30), "sick_leave_entitled": emp.get("sick_leave_entitled", 15)}, "monthly_summary": summary, "total_all_time": sum(p.get("amount", 0) for p in payments), "loan": {"total_advance": total_advance, "total_repaid": total_repaid, "balance": emp.get("loan_balance", 0)}, "old_salary_balance": emp.get("old_salary_balance", 0), "leave": {"annual_used": annual_used, "annual_remaining": emp.get("annual_leave_entitled", 30) - annual_used, "sick_used": sick_used, "sick_remaining": emp.get("sick_leave_entitled", 15) - sick_used, "unpaid_used": unpaid_used}, "deductions": [{"id": d["id"], "type": d.get("deduction_type",""), "amount": d["amount"], "period": d.get("period",""), "reason": d.get("reason",""), "date": d.get("date","")} for d in deductions], "total_deductions": sum(d["amount"] for d in deductions), "fines": [{"id": f["id"], "type": f.get("fine_type",""), "department": f.get("department",""), "amount": f["amount"], "paid": f.get("paid_amount",0), "status": f.get("payment_status","unpaid"), "description": f.get("description","")} for f in fines], "total_fines": sum(f["amount"] for f in fines), "unpaid_fines": sum(f["amount"] - f.get("paid_amount",0) for f in fines if f.get("payment_status") != "paid")}

@router.delete("/salary-payments/{payment_id}")
async def delete_salary_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    result = await db.salary_payments.delete_one({"id": payment_id})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Salary payment deleted"}

# Leaves
@router.get("/leaves")
async def get_leaves(employee_id: Optional[str] = None, status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if employee_id: query["employee_id"] = employee_id
    if status: query["status"] = status
    leaves = await db.leaves.find(query, {"_id": 0}).sort("start_date", -1).to_list(1000)
    for l in leaves:
        for f in ['start_date', 'end_date', 'created_at', 'approved_at']:
            if isinstance(l.get(f), str): l[f] = datetime.fromisoformat(l[f])
    return leaves

@router.post("/leaves")
async def create_leave(data: LeaveCreate, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    if data.with_ticket:
        ticket_balance = emp.get("ticket_entitled", 1) - emp.get("ticket_used", 0)
        if ticket_balance <= 0: raise HTTPException(status_code=400, detail="No ticket balance available")
    leave = Leave(**data.model_dump(), employee_name=emp["name"])
    l_dict = leave.model_dump()
    for f in ['start_date', 'end_date', 'created_at', 'approved_at']:
        if l_dict.get(f): l_dict[f] = l_dict[f].isoformat()
    await db.leaves.insert_one(l_dict)
    if data.status == "pending":
        admins = await db.users.find({"role": "admin"}, {"_id": 0}).to_list(100)
        for admin in admins:
            notif = Notification(user_id=admin["id"], title="New Leave Request", message=f"{emp['name']} has requested {data.days} days {data.leave_type} leave", type="leave_request", related_id=leave.id)
            n_dict = notif.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
            await db.notifications.insert_one(n_dict)
    return {k: v for k, v in l_dict.items() if k != '_id'}

@router.put("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, current_user: User = Depends(get_current_user)):
    leave = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    if not leave: raise HTTPException(status_code=404, detail="Leave not found")
    await db.leaves.update_one({"id": leave_id}, {"$set": {"status": "approved", "approved_by": current_user.id, "approved_at": datetime.now(timezone.utc).isoformat()}})
    if leave.get("with_ticket"):
        emp_doc = await db.employees.find_one({"id": leave["employee_id"]}, {"_id": 0})
        if emp_doc: await db.employees.update_one({"id": leave["employee_id"]}, {"$set": {"ticket_used": emp_doc.get("ticket_used", 0) + 1}})
    emp = await db.employees.find_one({"id": leave["employee_id"]}, {"_id": 0})
    if emp and emp.get("user_id"):
        notif = Notification(user_id=emp["user_id"], title="Leave Approved", message=f"Your {leave['days']} days {leave['leave_type']} leave has been approved", type="leave_approved", related_id=leave_id)
        n_dict = notif.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
        await db.notifications.insert_one(n_dict)
    return {"message": "Leave approved"}

@router.put("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, reason: Optional[dict] = None, current_user: User = Depends(get_current_user)):
    leave = await db.leaves.find_one({"id": leave_id}, {"_id": 0})
    if not leave: raise HTTPException(status_code=404, detail="Leave not found")
    rej_reason = reason.get("reason", "") if reason else ""
    await db.leaves.update_one({"id": leave_id}, {"$set": {"status": "rejected", "approved_by": current_user.id, "approved_at": datetime.now(timezone.utc).isoformat(), "rejection_reason": rej_reason}})
    emp = await db.employees.find_one({"id": leave["employee_id"]}, {"_id": 0})
    if emp and emp.get("user_id"):
        notif = Notification(user_id=emp["user_id"], title="Leave Rejected", message=f"Your {leave['leave_type']} leave request was rejected. {rej_reason}", type="leave_rejected", related_id=leave_id)
        n_dict = notif.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
        await db.notifications.insert_one(n_dict)
    return {"message": "Leave rejected"}

@router.delete("/leaves/{leave_id}")
async def delete_leave(leave_id: str, current_user: User = Depends(get_current_user)):
    result = await db.leaves.delete_one({"id": leave_id})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="Leave not found")
    return {"message": "Leave deleted"}

# Employee Report PDF
@router.get("/employees/{emp_id}/report/pdf")
async def employee_report_pdf(emp_id: str, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    payments = await db.salary_payments.find({"employee_id": emp_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    leaves = await db.leaves.find({"employee_id": emp_id}, {"_id": 0}).to_list(1000)
    deductions = await db.salary_deductions.find({"employee_id": emp_id}, {"_id": 0}).to_list(1000)
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    co_name = company.get("company_name", "Smart Standard Company")
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40)
    elements = []; styles = getSampleStyleSheet()
    title_s = ParagraphStyle('T', parent=styles['Heading1'], fontSize=16, textColor=colors.HexColor('#F5841F'), alignment=1, spaceAfter=5)
    body_s = ParagraphStyle('B', parent=styles['Normal'], fontSize=9, leading=14)
    logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.jpg"
    if not logo_path.exists(): logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.png"
    if logo_path.exists():
        from reportlab.platypus import Image as RLImage
        try:
            logo = RLImage(str(logo_path), width=1.3*inch, height=0.6*inch); logo.hAlign = 'CENTER'; elements.append(logo)
        except: pass
    elements.append(Paragraph(co_name.upper(), title_s))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#F5841F')))
    elements.append(Spacer(1, 0.15*inch))
    elements.append(Paragraph(f"<b>Employee Report - {emp['name']}</b>", ParagraphStyle('H', parent=styles['Heading2'], fontSize=12, alignment=1)))
    elements.append(Spacer(1, 0.1*inch))
    info = [["Name:", emp["name"], "Position:", emp.get("position", "-")], ["Doc ID:", emp.get("document_id", "-"), "Salary:", f"SAR {emp.get('salary', 0):,.2f}"], ["Loan:", f"SAR {emp.get('loan_balance', 0):,.2f}", "Old Balance:", f"SAR {emp.get('old_salary_balance', 0):,.2f}"]]
    it = Table(info, colWidths=[1*inch, 2.2*inch, 1*inch, 2.2*inch])
    it.setStyle(TableStyle([('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'), ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 8), ('BOTTOMPADDING', (0,0), (-1,-1), 6)]))
    elements.append(it); elements.append(Spacer(1, 0.15*inch))
    elements.append(Paragraph("<b>Salary Payments</b>", body_s))
    pay_rows = [["Date", "Type", "Period", "Mode", "Amount"]]
    for p in payments[:30]:
        dt = datetime.fromisoformat(p["date"]).strftime("%d %b %Y") if isinstance(p["date"], str) else p["date"].strftime("%d %b %Y")
        pay_rows.append([dt, p.get("payment_type","salary").replace("_"," ").title(), p.get("period",""), p.get("payment_mode",""), f"SAR {p['amount']:,.2f}"])
    pay_rows.append(["", "", "", "TOTAL", f"SAR {sum(p['amount'] for p in payments):,.2f}"])
    pt = Table(pay_rows, colWidths=[1.1*inch, 1.1*inch, 1.1*inch, 0.8*inch, 1.3*inch])
    pt.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F5841F')), ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke), ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'), ('FONTSIZE', (0,0), (-1,-1), 7), ('GRID', (0,0), (-1,-1), 0.5, colors.grey), ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'), ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#FFF3E0'))]))
    elements.append(pt); elements.append(Spacer(1, 0.15*inch))
    annual_used = sum(l.get("days",0) for l in leaves if l.get("leave_type") == "annual" and l.get("status") == "approved")
    sick_used = sum(l.get("days",0) for l in leaves if l.get("leave_type") == "sick" and l.get("status") == "approved")
    elements.append(Paragraph(f"<b>Leave:</b> Annual: {annual_used}/{emp.get('annual_leave_entitled',30)} used | Sick: {sick_used}/{emp.get('sick_leave_entitled',15)} used", body_s))
    if deductions:
        elements.append(Spacer(1, 0.1*inch))
        elements.append(Paragraph(f"<b>Deductions:</b> Total SAR {sum(d['amount'] for d in deductions):,.2f}", body_s))
    doc.build(elements); buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=employee_report_{emp['name'].replace(' ','_')}.pdf"})

# Salary Acknowledgment
@router.post("/salary-payments/{payment_id}/acknowledge")
async def acknowledge_salary(payment_id: str, current_user: User = Depends(get_current_user)):
    payment = await db.salary_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment: raise HTTPException(status_code=404, detail="Payment not found")
    await db.salary_payments.update_one({"id": payment_id}, {"$set": {"acknowledged": True, "acknowledged_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "Payment acknowledged"}

# Notifications
@router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifs = await db.notifications.find({"user_id": current_user.id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for n in notifs:
        if isinstance(n.get('created_at'), str): n['created_at'] = datetime.fromisoformat(n['created_at'])
    return notifs

@router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": current_user.id, "read": False})
    return {"count": count}

@router.post("/notifications/mark-read")
async def mark_notifications_read(current_user: User = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current_user.id, "read": False}, {"$set": {"read": True}})
    return {"message": "Notifications marked as read"}

# Attendance
@router.post("/attendance/time-in")
async def time_in(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({"employee_id": emp["id"], "date": today}, {"_id": 0})
    if existing and existing.get("time_in"): raise HTTPException(status_code=400, detail="Already timed in today")
    now = datetime.now(timezone.utc)
    if existing:
        await db.attendance.update_one({"id": existing["id"]}, {"$set": {"time_in": now.isoformat()}})
    else:
        att = Attendance(employee_id=emp["id"], employee_name=emp["name"], date=today, time_in=now)
        a_dict = att.model_dump(); a_dict["time_in"] = a_dict["time_in"].isoformat(); a_dict["created_at"] = a_dict["created_at"].isoformat()
        await db.attendance.insert_one(a_dict)
    return {"message": "Timed in", "time": now.isoformat()}

@router.post("/attendance/time-out")
async def time_out(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.attendance.find_one({"employee_id": emp["id"], "date": today}, {"_id": 0})
    if not existing or not existing.get("time_in"): raise HTTPException(status_code=400, detail="Not timed in today")
    if existing.get("time_out"): raise HTTPException(status_code=400, detail="Already timed out today")
    now = datetime.now(timezone.utc)
    await db.attendance.update_one({"id": existing["id"]}, {"$set": {"time_out": now.isoformat()}})
    return {"message": "Timed out", "time": now.isoformat()}

@router.get("/attendance")
async def get_attendance(employee_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if employee_id: query["employee_id"] = employee_id
    return await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(1000)

@router.get("/my/attendance")
async def get_my_attendance(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: return []
    return await db.attendance.find({"employee_id": emp["id"]}, {"_id": 0}).sort("date", -1).to_list(100)

# Employee Documents
@router.get("/employee-documents")
async def get_employee_documents(employee_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if employee_id: query["employee_id"] = employee_id
    docs = await db.employee_documents.find(query, {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    for d in docs:
        exp = d.get("expiry_date")
        if exp:
            if isinstance(exp, str): exp = datetime.fromisoformat(exp)
            if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
            d["days_until_expiry"] = (exp - now).days
    return docs

@router.post("/employee-documents")
async def create_employee_document(data: EmployeeDocumentCreate, current_user: User = Depends(get_current_user)):
    doc = EmployeeDocument(**data.model_dump())
    d_dict = doc.model_dump()
    for f in ['issue_date', 'expiry_date', 'created_at']:
        if d_dict.get(f): d_dict[f] = d_dict[f].isoformat()
    await db.employee_documents.insert_one(d_dict)
    return {k: v for k, v in d_dict.items() if k != '_id'}

@router.delete("/employee-documents/{doc_id}")
async def delete_employee_document(doc_id: str, current_user: User = Depends(get_current_user)):
    await db.employee_documents.delete_one({"id": doc_id})
    return {"message": "Document deleted"}

# Letter Generation
@router.post("/letters/generate")
async def generate_letter(body: dict, current_user: User = Depends(get_current_user)):
    emp_id = body.get("employee_id"); letter_type = body.get("letter_type", "salary_certificate")
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    buffer = BytesIO()
    doc_pdf = SimpleDocTemplate(buffer, pagesize=A4, topMargin=50, bottomMargin=50, leftMargin=60, rightMargin=60)
    elements = []; styles = getSampleStyleSheet()
    title_s = ParagraphStyle('T', parent=styles['Heading1'], fontSize=16, textColor=colors.HexColor('#F5841F'), alignment=1, spaceAfter=5)
    body_s = ParagraphStyle('B', parent=styles['Normal'], fontSize=11, leading=18, spaceAfter=12)
    right_s = ParagraphStyle('R', parent=styles['Normal'], fontSize=10, alignment=2)
    logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.jpg"
    if not logo_path.exists(): logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.png"
    if logo_path.exists():
        from reportlab.platypus import Image as RLImage
        try:
            logo = RLImage(str(logo_path), width=1.5*inch, height=0.7*inch); logo.hAlign = 'CENTER'; elements.append(logo)
        except: pass
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    co_name = company.get("company_name", "Smart Standard Company")
    addr_parts = [company.get("address_line1",""), company.get("address_line2",""), company.get("city",""), company.get("country","")]
    co_addr = ", ".join([p for p in addr_parts if p])
    co_contact = " | ".join([p for p in [company.get("phone",""), company.get("email","")] if p])
    elements.append(Paragraph(co_name.upper(), title_s))
    if co_addr: elements.append(Paragraph(co_addr, ParagraphStyle('Addr', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)))
    if co_contact: elements.append(Paragraph(co_contact, ParagraphStyle('Contact', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1)))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#F5841F')))
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph(f"Date: {datetime.now().strftime('%d %B %Y')}", right_s))
    elements.append(Spacer(1, 0.2*inch))
    name = emp["name"]; doc_id = emp.get("document_id", "N/A"); position = emp.get("position", "N/A")
    if emp.get("job_title_id"):
        jt = await db.job_titles.find_one({"id": emp["job_title_id"]}, {"_id": 0})
        if jt: position = jt["title"]
    salary = emp.get("salary", 0)
    join = emp.get("join_date", "")
    if isinstance(join, str) and join: join = datetime.fromisoformat(join).strftime("%d %B %Y")
    elif hasattr(join, 'strftime'): join = join.strftime("%d %B %Y")
    else: join = "N/A"
    if letter_type == "salary_certificate":
        elements.append(Paragraph("<b>TO WHOM IT MAY CONCERN</b>", ParagraphStyle('C', parent=body_s, alignment=1, fontSize=13, spaceAfter=20)))
        elements.append(Paragraph(f"This is to certify that <b>{name}</b>, holding Document ID <b>{doc_id}</b>, is employed with Smart Standard Company as <b>{position}</b> since <b>{join}</b>.", body_s))
        elements.append(Paragraph(f"His/Her current monthly salary is <b>SAR {salary:,.2f}</b> (inclusive of all allowances).", body_s))
        elements.append(Paragraph("This certificate is issued upon the employee's request for whatever purpose it may serve.", body_s))
    elif letter_type == "employment":
        elements.append(Paragraph("<b>EMPLOYMENT CERTIFICATE</b>", ParagraphStyle('C', parent=body_s, alignment=1, fontSize=13, spaceAfter=20)))
        elements.append(Paragraph(f"This is to certify that <b>{name}</b>, Document ID: <b>{doc_id}</b>, has been employed with Smart Standard Company since <b>{join}</b> as <b>{position}</b>.", body_s))
        elements.append(Paragraph("The employee is currently active and in good standing with the company.", body_s))
        elements.append(Paragraph("This letter is issued upon the employee's request.", body_s))
    elif letter_type == "noc":
        elements.append(Paragraph("<b>NO OBJECTION CERTIFICATE</b>", ParagraphStyle('C', parent=body_s, alignment=1, fontSize=13, spaceAfter=20)))
        elements.append(Paragraph(f"This is to confirm that we have No Objection for our employee <b>{name}</b>, Document ID: <b>{doc_id}</b>, Position: <b>{position}</b>.", body_s))
        elements.append(Paragraph("This NOC is issued upon the employee's request.", body_s))
    elif letter_type == "experience":
        elements.append(Paragraph("<b>EXPERIENCE CERTIFICATE</b>", ParagraphStyle('C', parent=body_s, alignment=1, fontSize=13, spaceAfter=20)))
        elements.append(Paragraph(f"This is to certify that <b>{name}</b>, Document ID: <b>{doc_id}</b>, has worked with Smart Standard Company as <b>{position}</b> from <b>{join}</b>.", body_s))
        elements.append(Paragraph("During the tenure, the employee demonstrated professionalism and dedication. We wish them success in future endeavors.", body_s))
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph("Authorized Signatory", ParagraphStyle('Sig', parent=body_s, fontSize=10)))
    elements.append(Paragraph("_________________________", body_s))
    elements.append(Paragraph("Smart Standard Company", ParagraphStyle('Co', parent=body_s, fontSize=9, textColor=colors.grey)))
    doc_pdf.build(elements); buffer.seek(0)
    fname = f"{letter_type}_{name.replace(' ','_')}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={fname}"})

# Employee Portal
@router.get("/my/employee-profile")
async def get_my_employee_profile(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile linked")
    return emp

@router.get("/my/payments")
async def get_my_payments(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile linked")
    payments = await db.salary_payments.find({"employee_id": emp["id"]}, {"_id": 0}).sort("date", -1).to_list(1000)
    for p in payments:
        for f in ['date', 'created_at', 'acknowledged_at']:
            if isinstance(p.get(f), str): p[f] = datetime.fromisoformat(p[f])
    return payments

@router.get("/my/salary-summary")
async def get_my_salary_summary(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile linked")
    payments = await db.salary_payments.find({"employee_id": emp["id"]}, {"_id": 0}).sort("date", -1).to_list(1000)
    deductions = await db.salary_deductions.find({"employee_id": emp["id"]}, {"_id": 0}).to_list(1000)
    salary = emp.get("salary", 0)
    monthly = {}
    for p in payments:
        period = p.get("period", "Unknown")
        if period not in monthly:
            monthly[period] = {"salary_paid": 0, "advance": 0, "overtime": 0, "bonus": 0, "other": 0, "total": 0, "payment_date": None, "payment_mode": None, "acknowledged": True}
        pt = p.get("payment_type", "salary")
        amount = p.get("amount", 0)
        if pt == "salary":
            monthly[period]["salary_paid"] += amount
        elif pt in monthly[period]:
            monthly[period][pt] += amount
        else:
            monthly[period]["other"] += amount
        monthly[period]["total"] += amount
        if not monthly[period]["payment_date"]:
            monthly[period]["payment_date"] = p.get("date", "")
            monthly[period]["payment_mode"] = p.get("payment_mode", "cash")
        if not p.get("acknowledged", True):
            monthly[period]["acknowledged"] = False
    ded_by_period = {}
    for d in deductions:
        period = d.get("period", "Unknown")
        ded_by_period[period] = ded_by_period.get(period, 0) + d.get("amount", 0)
    summary = []
    for period, data in sorted(monthly.items(), reverse=True):
        ded_amount = ded_by_period.get(period, 0)
        balance = salary - data["salary_paid"]
        status = "paid" if balance <= 0 else ("partial" if data["salary_paid"] > 0 else "unpaid")
        summary.append({
            "period": period,
            "monthly_salary": salary,
            "salary_paid": data["salary_paid"],
            "advance": data["advance"],
            "overtime": data["overtime"],
            "bonus": data["bonus"],
            "deductions": ded_amount,
            "total_received": data["total"],
            "balance": balance,
            "status": status,
            "payment_date": data["payment_date"],
            "payment_mode": data["payment_mode"],
            "acknowledged": data["acknowledged"]
        })
    return {"employee_name": emp.get("name", ""), "salary": salary, "summary": summary}


@router.get("/my/leaves")
async def get_my_leaves(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile linked")
    leaves = await db.leaves.find({"employee_id": emp["id"]}, {"_id": 0}).sort("start_date", -1).to_list(1000)
    for l in leaves:
        for f in ['start_date', 'end_date', 'created_at', 'approved_at']:
            if isinstance(l.get(f), str): l[f] = datetime.fromisoformat(l[f])
    return leaves

@router.post("/my/apply-leave")
async def apply_leave(data: LeaveCreate, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile linked")
    data.employee_id = emp["id"]; data.status = "pending"
    return await create_leave(data, current_user)

# Employee Requests
@router.get("/employee-requests")
async def get_employee_requests(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if status: query["status"] = status
    reqs = await db.employee_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for r in reqs:
        if isinstance(r.get('created_at'), str): r['created_at'] = datetime.fromisoformat(r['created_at'])
    return reqs

@router.post("/my/request")
async def create_employee_request(data: EmployeeRequestCreate, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile linked")
    req = EmployeeRequest(**data.model_dump(), employee_id=emp["id"], employee_name=emp["name"])
    r_dict = req.model_dump(); r_dict["created_at"] = r_dict["created_at"].isoformat()
    await db.employee_requests.insert_one(r_dict)
    admins = await db.users.find({"role": {"$in": ["admin", "manager"]}}, {"_id": 0}).to_list(100)
    for admin in admins:
        n = Notification(user_id=admin["id"], title=f"New Request: {data.request_type.replace('_',' ').title()}", message=f"{emp['name']}: {data.subject}", type="employee_request", related_id=req.id)
        n_dict = n.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
        await db.notifications.insert_one(n_dict)
    return {k: v for k, v in r_dict.items() if k != '_id'}

@router.get("/my/requests")
async def get_my_requests(current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"user_id": current_user.id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="No employee profile linked")
    reqs = await db.employee_requests.find({"employee_id": emp["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for r in reqs:
        if isinstance(r.get('created_at'), str): r['created_at'] = datetime.fromisoformat(r['created_at'])
    return reqs

@router.put("/employee-requests/{req_id}/respond")
async def respond_to_request(req_id: str, body: dict, current_user: User = Depends(get_current_user)):
    req = await db.employee_requests.find_one({"id": req_id}, {"_id": 0})
    if not req: raise HTTPException(status_code=404, detail="Request not found")
    status = body.get("status", "approved"); response = body.get("response", "")
    await db.employee_requests.update_one({"id": req_id}, {"$set": {"status": status, "response": response, "processed_by": current_user.id}})
    emp = await db.employees.find_one({"id": req["employee_id"]}, {"_id": 0})
    if emp and emp.get("user_id"):
        n = Notification(user_id=emp["user_id"], title=f"Request {status.title()}", message=f"Your {req['request_type'].replace('_',' ')} request: {response or status}", type="request_response", related_id=req_id)
        n_dict = n.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
        await db.notifications.insert_one(n_dict)
    return {"message": f"Request {status}"}

# Announcements
@router.post("/announcements/send")
async def send_announcement(body: dict, current_user: User = Depends(get_current_user)):
    title = body.get("title", "Announcement"); message = body.get("message", ""); target = body.get("target", "all")
    if target == "all":
        employees = await db.employees.find({"user_id": {"$exists": True, "$ne": None}}, {"_id": 0}).to_list(1000)
        for emp in employees:
            n = Notification(user_id=emp["user_id"], title=title, message=message, type="announcement")
            n_dict = n.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
            await db.notifications.insert_one(n_dict)
        return {"message": f"Announcement sent to {len(employees)} employees"}
    else:
        emp = await db.employees.find_one({"id": target}, {"_id": 0})
        if emp and emp.get("user_id"):
            n = Notification(user_id=emp["user_id"], title=title, message=message, type="announcement")
            n_dict = n.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
            await db.notifications.insert_one(n_dict)
        return {"message": f"Announcement sent to {emp['name'] if emp else 'unknown'}"}

# Payslip PDF
@router.get("/salary-payments/{payment_id}/payslip")
async def generate_payslip(payment_id: str, current_user: User = Depends(get_current_user)):
    payment = await db.salary_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment: raise HTTPException(status_code=404, detail="Payment not found")
    emp = await db.employees.find_one({"id": payment["employee_id"]}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    period_payments = await db.salary_payments.find({"employee_id": payment["employee_id"], "period": payment["period"]}, {"_id": 0}).to_list(100)
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=40, bottomMargin=40)
    elements = []; styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, textColor=colors.HexColor('#F5841F'), alignment=1, spaceAfter=5)
    sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, textColor=colors.grey, alignment=1, spaceAfter=20)
    logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.jpg"
    if not logo_path.exists(): logo_path = ROOT_DIR / "uploads" / "logos" / "company_logo.png"
    if logo_path.exists():
        from reportlab.platypus import Image as RLImage
        try:
            logo = RLImage(str(logo_path), width=1.5*inch, height=0.7*inch); logo.hAlign = 'CENTER'; elements.append(logo); elements.append(Spacer(1, 0.1*inch))
        except: pass
    company = await db.company_settings.find_one({}, {"_id": 0}) or {}
    co_name = company.get("company_name", "Smart Standard Company")
    addr_parts = [company.get("address_line1",""), company.get("address_line2",""), company.get("city",""), company.get("country","")]
    co_addr = ", ".join([p for p in addr_parts if p])
    elements.append(Paragraph(co_name.upper(), title_style))
    if co_addr: elements.append(Paragraph(co_addr, ParagraphStyle('PAddr', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=1, spaceAfter=3)))
    elements.append(Paragraph("Pay Slip", sub_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#F5841F')))
    elements.append(Spacer(1, 0.2*inch))
    emp_data = [["Employee Name:", emp["name"], "Period:", payment.get("period", "-")], ["Position:", emp.get("position", "-"), "Document ID:", emp.get("document_id", "-")], ["Date:", datetime.fromisoformat(payment["date"]).strftime("%d %b %Y") if isinstance(payment["date"], str) else payment["date"].strftime("%d %b %Y"), "Payment Mode:", payment.get("payment_mode", "-").upper()]]
    emp_table = Table(emp_data, colWidths=[1.2*inch, 2.3*inch, 1.2*inch, 2.3*inch])
    emp_table.setStyle(TableStyle([('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'), ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    elements.append(emp_table); elements.append(Spacer(1, 0.2*inch)); elements.append(HRFlowable(width="100%", thickness=1, color=colors.grey)); elements.append(Spacer(1, 0.15*inch))
    elements.append(Paragraph("Payment Details", ParagraphStyle('H2', parent=styles['Heading2'], fontSize=12, textColor=colors.HexColor('#F5841F'))))
    salary_total = sum(p["amount"] for p in period_payments if p.get("payment_type") == "salary")
    overtime = sum(p["amount"] for p in period_payments if p.get("payment_type") == "overtime")
    advance = sum(p["amount"] for p in period_payments if p.get("payment_type") == "advance")
    loan_repay = sum(p["amount"] for p in period_payments if p.get("payment_type") == "loan_repayment")
    tickets = sum(p["amount"] for p in period_payments if p.get("payment_type") == "tickets")
    id_card = sum(p["amount"] for p in period_payments if p.get("payment_type") == "id_card")
    pay_rows = [["Description", "Amount"], ["Monthly Salary", f"SAR {emp.get('salary', 0):.2f}"]]
    if salary_total > 0: pay_rows.append(["Salary Paid", f"SAR {salary_total:.2f}"])
    if overtime > 0: pay_rows.append(["Overtime", f"SAR {overtime:.2f}"])
    if advance > 0: pay_rows.append(["Advance / Loan", f"SAR {advance:.2f}"])
    if loan_repay > 0: pay_rows.append(["Loan Repayment (Deduction)", f"-${loan_repay:.2f}"])
    if tickets > 0: pay_rows.append(["Tickets", f"SAR {tickets:.2f}"])
    if id_card > 0: pay_rows.append(["ID Card", f"SAR {id_card:.2f}"])
    net = salary_total + overtime - loan_repay; balance = emp.get("salary", 0) - salary_total
    pay_rows.append(["", ""]); pay_rows.append(["Net Payment", f"SAR {net:.2f}"]); pay_rows.append(["Salary Balance", f"SAR {balance:.2f}"])
    pay_table = Table(pay_rows, colWidths=[4.5*inch, 2.5*inch])
    pay_table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F5841F')), ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke), ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 9), ('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('ALIGN', (1, 0), (1, -1), 'RIGHT'), ('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold'), ('BACKGROUND', (0, -2), (-1, -1), colors.HexColor('#F5F3FF'))]))
    elements.append(pay_table); elements.append(Spacer(1, 0.4*inch))
    elements.append(Paragraph("I acknowledge receipt of the above payment.", ParagraphStyle('Ack', parent=styles['Normal'], fontSize=10)))
    elements.append(Spacer(1, 0.3*inch))
    sig_data = [["Employee Signature:", "____________________", "Date:", "____________________"], ["", "", "", ""], ["Authorized By:", "____________________", "Company Stamp:", ""]]
    sig_table = Table(sig_data, colWidths=[1.3*inch, 2.2*inch, 1.3*inch, 2.2*inch])
    sig_table.setStyle(TableStyle([('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'), ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'), ('FONTSIZE', (0, 0), (-1, -1), 9), ('BOTTOMPADDING', (0, 0), (-1, -1), 15)]))
    elements.append(sig_table)
    if payment.get("acknowledged"):
        ack_at = payment.get("acknowledged_at", "")
        if isinstance(ack_at, str) and ack_at: ack_at = datetime.fromisoformat(ack_at).strftime("%d %b %Y %H:%M")
        elements.append(Spacer(1, 0.2*inch))
        elements.append(Paragraph(f"Digitally acknowledged on: {ack_at}", ParagraphStyle('Dig', parent=styles['Normal'], fontSize=8, textColor=colors.green)))
    doc.build(elements); buffer.seek(0)
    fname = f"payslip_{emp['name'].replace(' ', '_')}_{payment.get('period', '').replace(' ', '_')}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={fname}"})

# Salary Deductions
@router.get("/salary-deductions")
async def get_salary_deductions(employee_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    if employee_id: query["employee_id"] = employee_id
    deductions = await db.salary_deductions.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    for d in deductions:
        for k in ['date', 'created_at']:
            if isinstance(d.get(k), str): d[k] = datetime.fromisoformat(d[k])
    return deductions

@router.post("/salary-deductions")
async def create_salary_deduction(data: SalaryDeductionCreate, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    deduction = SalaryDeduction(**data.model_dump(), employee_name=emp["name"], created_by=current_user.id)
    d_dict = deduction.model_dump()
    d_dict["date"] = d_dict["date"].isoformat(); d_dict["created_at"] = d_dict["created_at"].isoformat()
    for k in ['branch_id', 'fine_id']:
        if d_dict.get(k) == '': d_dict[k] = None
    await db.salary_deductions.insert_one(d_dict)
    if emp.get("user_id"):
        type_label = data.deduction_type.replace('_', ' ').title()
        n = Notification(user_id=emp["user_id"], title=f"Salary Deduction: {type_label}", message=f"SAR {data.amount:.2f} deducted from your salary ({data.period}). Reason: {data.reason}", type="salary_deduction", related_id=deduction.id)
        n_dict = n.model_dump(); n_dict["created_at"] = n_dict["created_at"].isoformat()
        await db.notifications.insert_one(n_dict)
    return {k: v for k, v in d_dict.items() if k != '_id'}

@router.delete("/salary-deductions/{ded_id}")
async def delete_salary_deduction(ded_id: str, current_user: User = Depends(get_current_user)):
    await db.salary_deductions.delete_one({"id": ded_id})
    return {"message": "Deduction deleted"}

# Salary History
@router.get("/salary-history/{emp_id}")
async def get_salary_history(emp_id: str, current_user: User = Depends(get_current_user)):
    history = await db.salary_history.find({"employee_id": emp_id}, {"_id": 0}).sort("effective_date", -1).to_list(100)
    for h in history:
        if isinstance(h.get("effective_date"), str): h["effective_date"] = datetime.fromisoformat(h["effective_date"])
    return history

@router.post("/salary-history")
async def add_salary_history(body: dict, current_user: User = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": body["employee_id"]}, {"_id": 0})
    if not emp: raise HTTPException(status_code=404, detail="Employee not found")
    old_salary = emp.get("salary", 0); new_salary = float(body["new_salary"])
    record = SalaryHistory(employee_id=body["employee_id"], old_salary=old_salary, new_salary=new_salary, effective_date=datetime.fromisoformat(body["effective_date"]), reason=body.get("reason", ""))
    r_dict = record.model_dump(); r_dict["effective_date"] = r_dict["effective_date"].isoformat(); r_dict["created_at"] = r_dict["created_at"].isoformat()
    await db.salary_history.insert_one(r_dict)
    await db.employees.update_one({"id": body["employee_id"]}, {"$set": {"salary": new_salary}})
    return {k: v for k, v in r_dict.items() if k != '_id'}

# Employee Pending Summary
@router.get("/employees/pending-summary")
async def get_employees_pending(current_user: User = Depends(get_current_user)):
    employees = await db.employees.find({"active": {"$ne": False}}, {"_id": 0}).to_list(1000)
    payments = await db.salary_payments.find({}, {"_id": 0}).to_list(10000)
    leaves = await db.leaves.find({}, {"_id": 0}).to_list(10000)
    now = datetime.now(timezone.utc); current_period = now.strftime("%b %Y")
    result = []
    for emp in employees:
        eid = emp["id"]
        emp_payments = [p for p in payments if p.get("employee_id") == eid and p.get("period") == current_period]
        salary_paid = sum(p["amount"] for p in emp_payments if p.get("payment_type") == "salary")
        pending = emp.get("salary", 0) - salary_paid
        emp_leaves = [l for l in leaves if l.get("employee_id") == eid]
        annual_used = sum(l.get("days", 0) for l in emp_leaves if l.get("leave_type") == "annual" and l.get("status") == "approved")
        sick_used = sum(l.get("days", 0) for l in emp_leaves if l.get("leave_type") == "sick" and l.get("status") == "approved")
        pending_leaves = sum(1 for l in emp_leaves if l.get("status") == "pending")
        on_leave = None
        for l in emp_leaves:
            if l.get("status") == "approved":
                start = l.get("start_date"); end = l.get("end_date")
                if isinstance(start, str): start = datetime.fromisoformat(start)
                if isinstance(end, str): end = datetime.fromisoformat(end)
                if start and end:
                    if start.tzinfo is None: start = start.replace(tzinfo=timezone.utc)
                    if end.tzinfo is None: end = end.replace(tzinfo=timezone.utc)
                    if start <= now <= end:
                        on_leave = {"from": start.strftime("%d %b"), "to": end.strftime("%d %b %Y"), "type": l.get("leave_type", "")}; break
        result.append({"id": eid, "name": emp["name"], "position": emp.get("position", ""), "branch_id": emp.get("branch_id"), "salary": emp.get("salary", 0), "salary_paid": salary_paid, "pending_salary": max(0, pending), "loan_balance": emp.get("loan_balance", 0), "on_leave": on_leave, "annual_leave_remaining": emp.get("annual_leave_entitled", 30) - annual_used, "sick_leave_remaining": emp.get("sick_leave_entitled", 15) - sick_used, "pending_leave_requests": pending_leaves})
    branch_map = {b["id"]: b["name"] for b in await db.branches.find({}, {"_id": 0}).to_list(100)}
    branch_summary = {}
    for emp in result:
        bid = emp.get("branch_id"); bname = branch_map.get(bid, "No Branch") if bid else "No Branch"
        if bname not in branch_summary: branch_summary[bname] = {"total_salary": 0, "total_paid": 0, "total_pending": 0, "count": 0}
        branch_summary[bname]["total_salary"] += emp["salary"]; branch_summary[bname]["total_paid"] += emp["salary_paid"]
        branch_summary[bname]["total_pending"] += emp["pending_salary"]; branch_summary[bname]["count"] += 1
    total_salary = sum(e["salary"] for e in result); total_paid = sum(e["salary_paid"] for e in result); total_pending = sum(e["pending_salary"] for e in result)
    return {"employees": result, "branch_summary": branch_summary, "totals": {"total_salary": total_salary, "total_paid": total_paid, "total_pending": total_pending, "employee_count": len(result)}, "period": current_period}

# =====================================================
# BULK SALARY PAYMENTS
# =====================================================

@router.post("/salary-payments/bulk")
async def create_bulk_salary_payments(body: dict, current_user: User = Depends(get_current_user)):
    """Pay salaries to all employees or selected branch in one action"""
    branch_id = body.get("branch_id")  # Optional - filter by branch
    period = body.get("period")  # Required - e.g., "Dec 2025"
    payment_mode = body.get("payment_mode", "bank")
    notes = body.get("notes", "Bulk salary payment")
    pay_date = body.get("date", datetime.now(timezone.utc).isoformat())
    employee_ids = body.get("employee_ids")  # Optional - specific employees
    
    if not period:
        raise HTTPException(status_code=400, detail="Period is required")
    
    # Get active employees
    query = {"active": {"$ne": False}, "status": {"$in": ["active", None]}}
    if branch_id:
        query["branch_id"] = branch_id
    if employee_ids:
        query["id"] = {"$in": employee_ids}
    
    employees = await db.employees.find(query, {"_id": 0}).to_list(1000)
    
    if not employees:
        raise HTTPException(status_code=404, detail="No active employees found")
    
    # Check which employees haven't been paid for this period
    results = {"paid": [], "skipped": [], "failed": []}
    total_paid = 0
    
    for emp in employees:
        # Check if already paid
        existing = await db.salary_payments.find_one({
            "employee_id": emp["id"], 
            "period": period, 
            "payment_type": "salary"
        }, {"_id": 0})
        
        if existing:
            results["skipped"].append({
                "id": emp["id"],
                "name": emp["name"],
                "reason": f"Already paid for {period}"
            })
            continue
        
        salary = emp.get("salary", 0)
        if salary <= 0:
            results["skipped"].append({
                "id": emp["id"],
                "name": emp["name"],
                "reason": "No salary defined"
            })
            continue
        
        try:
            # Create payment
            payment = SalaryPayment(
                employee_id=emp["id"],
                employee_name=emp["name"],
                payment_type="salary",
                amount=salary,
                payment_mode=payment_mode,
                branch_id=emp.get("branch_id"),
                period=period,
                date=datetime.fromisoformat(pay_date.replace("Z", "+00:00")),
                notes=notes,
                created_by=current_user.id
            )
            p_dict = payment.model_dump()
            p_dict["date"] = p_dict["date"].isoformat()
            p_dict["created_at"] = p_dict["created_at"].isoformat()
            await db.salary_payments.insert_one(p_dict)
            
            # Create corresponding expense
            expense = Expense(
                category="salary",
                description=f"Salary - {emp['name']} - {period}",
                amount=salary,
                payment_mode=payment_mode,
                branch_id=emp.get("branch_id"),
                date=datetime.fromisoformat(pay_date.replace("Z", "+00:00")),
                notes=notes,
                created_by=current_user.id
            )
            e_dict = expense.model_dump()
            e_dict["date"] = e_dict["date"].isoformat()
            e_dict["created_at"] = e_dict["created_at"].isoformat()
            await db.expenses.insert_one(e_dict)
            
            # Send notification if user linked
            if emp.get("user_id"):
                notif = Notification(
                    user_id=emp["user_id"],
                    title="Salary Payment Received",
                    message=f"SAR {salary:.2f} salary for {period} via {payment_mode}. Please acknowledge receipt.",
                    type="salary_paid",
                    related_id=payment.id
                )
                n_dict = notif.model_dump()
                n_dict["created_at"] = n_dict["created_at"].isoformat()
                await db.notifications.insert_one(n_dict)
            
            results["paid"].append({
                "id": emp["id"],
                "name": emp["name"],
                "amount": salary,
                "branch_id": emp.get("branch_id")
            })
            total_paid += salary
            
        except Exception as e:
            results["failed"].append({
                "id": emp["id"],
                "name": emp["name"],
                "error": str(e)
            })
    
    # Get branch names for response
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    
    # Group paid by branch
    branch_totals = {}
    for emp in results["paid"]:
        bid = emp.get("branch_id")
        bname = branch_map.get(bid, "No Branch") if bid else "No Branch"
        if bname not in branch_totals:
            branch_totals[bname] = {"count": 0, "amount": 0}
        branch_totals[bname]["count"] += 1
        branch_totals[bname]["amount"] += emp["amount"]
    
    return {
        "success": True,
        "period": period,
        "payment_mode": payment_mode,
        "summary": {
            "total_paid": len(results["paid"]),
            "total_amount": round(total_paid, 2),
            "skipped": len(results["skipped"]),
            "failed": len(results["failed"])
        },
        "branch_totals": branch_totals,
        "details": results
    }


@router.get("/salary-payments/bulk-preview")
async def preview_bulk_salary(
    period: str,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Preview bulk salary payment before executing"""
    query = {"active": {"$ne": False}, "status": {"$in": ["active", None]}}
    if branch_id:
        query["branch_id"] = branch_id
    
    employees = await db.employees.find(query, {"_id": 0}).to_list(1000)
    
    # Check payment status for each
    to_pay = []
    already_paid = []
    no_salary = []
    
    for emp in employees:
        existing = await db.salary_payments.find_one({
            "employee_id": emp["id"],
            "period": period,
            "payment_type": "salary"
        }, {"_id": 0})
        
        if existing:
            already_paid.append({"id": emp["id"], "name": emp["name"], "salary": emp.get("salary", 0)})
        elif emp.get("salary", 0) <= 0:
            no_salary.append({"id": emp["id"], "name": emp["name"]})
        else:
            to_pay.append({"id": emp["id"], "name": emp["name"], "salary": emp.get("salary", 0), "branch_id": emp.get("branch_id")})
    
    # Get branch names
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    branch_map = {b["id"]: b["name"] for b in branches}
    
    for emp in to_pay:
        emp["branch_name"] = branch_map.get(emp.get("branch_id"), "No Branch") if emp.get("branch_id") else "No Branch"
    
    total_to_pay = sum(e["salary"] for e in to_pay)
    
    return {
        "period": period,
        "total_employees": len(employees),
        "to_pay": to_pay,
        "to_pay_count": len(to_pay),
        "to_pay_total": round(total_to_pay, 2),
        "already_paid": already_paid,
        "already_paid_count": len(already_paid),
        "no_salary": no_salary,
        "no_salary_count": len(no_salary)
    }


# Items Master
@router.get("/items")
async def get_items(current_user: User = Depends(get_current_user)):
    return await db.items.find({}, {"_id": 0}).to_list(1000)

@router.post("/items")
async def create_item(data: dict, current_user: User = Depends(get_current_user)):
    from models import Item, ItemCreate
    item_data = ItemCreate(**data) if isinstance(data, dict) else data
    item = Item(**item_data.model_dump())
    i_dict = item.model_dump(); i_dict["created_at"] = i_dict["created_at"].isoformat()
    await db.items.insert_one(i_dict)
    return {k: v for k, v in i_dict.items() if k != '_id'}

@router.put("/items/{item_id}")
async def update_item(item_id: str, data: dict, current_user: User = Depends(get_current_user)):
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.items.update_one({"id": item_id}, {"$set": data})
    return await db.items.find_one({"id": item_id}, {"_id": 0})

@router.delete("/items/{item_id}")
async def delete_item(item_id: str, current_user: User = Depends(get_current_user)):
    await db.items.delete_one({"id": item_id})
    return {"message": "Item deleted"}


# =====================================================
# AI SHIFT SCHEDULING
# =====================================================

from services.shift_scheduler import ShiftScheduler

@router.post("/schedules/generate")
async def generate_ai_schedule(body: dict, current_user: User = Depends(get_current_user)):
    """Generate AI-optimized shift schedule based on peak hours and availability"""
    require_permission(current_user, "employees", "write")
    
    scheduler = ShiftScheduler(db)
    result = await scheduler.generate_schedule(
        branch_id=body.get("branch_id"),
        start_date=body.get("start_date"),
        days=body.get("days", 7),
        shift_duration=body.get("shift_duration", 8),
        min_staff_per_shift=body.get("min_staff", 2),
        max_staff_per_shift=body.get("max_staff", 5)
    )
    
    if result.get("success"):
        # Auto-save the generated schedule
        schedule_id = await scheduler.save_schedule(result, current_user.id)
        result["schedule_id"] = schedule_id
    
    return result

@router.get("/schedules")
async def get_schedules(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all saved schedules"""
    require_permission(current_user, "employees", "read")
    
    query = {}
    if status:
        query["status"] = status
    
    schedules = await db.shift_schedules.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return schedules

@router.get("/schedules/{schedule_id}")
async def get_schedule(schedule_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific schedule"""
    require_permission(current_user, "employees", "read")
    
    scheduler = ShiftScheduler(db)
    schedule = await scheduler.get_schedule(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule

@router.post("/schedules/{schedule_id}/publish")
async def publish_schedule(schedule_id: str, current_user: User = Depends(get_current_user)):
    """Publish a schedule (make it active)"""
    require_permission(current_user, "employees", "write")
    
    scheduler = ShiftScheduler(db)
    success = await scheduler.publish_schedule(schedule_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found or already published")
    return {"message": "Schedule published successfully"}

@router.get("/schedules/peak-hours/analysis")
async def get_peak_hours_analysis(
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """Get peak hours analysis for scheduling decisions"""
    require_permission(current_user, "employees", "read")
    
    scheduler = ShiftScheduler(db)
    peak_hours = await scheduler.get_peak_hours_data(days)
    
    # Format for frontend
    hourly_data = [
        {"hour": h, "label": f"{h:02d}:00", "score": round(score, 3)}
        for h, score in sorted(peak_hours.items())
    ]
    
    busiest = sorted(peak_hours.items(), key=lambda x: x[1], reverse=True)[:5]
    slowest = sorted(peak_hours.items(), key=lambda x: x[1])[:5]
    
    return {
        "hourly_data": hourly_data,
        "busiest_hours": [{"hour": h, "label": f"{h:02d}:00", "score": round(s, 3)} for h, s in busiest],
        "slowest_hours": [{"hour": h, "label": f"{h:02d}:00", "score": round(s, 3)} for h, s in slowest],
        "analysis_period_days": days
    }
