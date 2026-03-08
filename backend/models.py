from pydantic import BaseModel, Field, ConfigDict, EmailStr, field_validator
from typing import List, Optional, Union, Dict, Any
from datetime import datetime, timezone
import uuid


def normalize_permissions(v):
    """Convert list permissions to dict format."""
    if isinstance(v, list):
        return {p: "write" for p in v}
    if isinstance(v, dict):
        return v
    return {}


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "operator"
    branch_id: Optional[str] = None
    permissions: Dict[str, str] = {}  # {"sales": "write", "expenses": "read", ...}
    must_change_password: bool = False  # Force password change on next login
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator('permissions', mode='before')
    @classmethod
    def normalize_perms(cls, v):
        return normalize_permissions(v)

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[str] = "operator"
    branch_id: Optional[str] = None
    permissions: Optional[dict] = {}
    must_change_password: Optional[bool] = False

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    branch_id: Optional[str] = None
    permissions: Optional[dict] = None
    must_change_password: Optional[bool] = None

class PasswordReset(BaseModel):
    new_password: str
    must_change_on_login: bool = True

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordWithToken(BaseModel):
    token: str
    new_password: str

class ChangePassword(BaseModel):
    current_password: Optional[str] = None  # Optional for forced change
    new_password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User
    must_change_password: bool = False

class Branch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BranchCreate(BaseModel):
    name: str
    location: Optional[str] = None

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_type: str
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    platform_id: Optional[str] = None  # For online delivery platform sales
    payment_mode: Optional[str] = None  # cash, card, online_platform, etc.
    amount: float
    discount: float = 0
    final_amount: float = 0
    payment_details: Optional[List[dict]] = []
    credit_amount: float = 0
    credit_received: float = 0
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    platform_status: Optional[str] = None  # pending/settled - for tracking platform payment status
    payment_status: Optional[str] = None
    received_mode: Optional[str] = None
    updated_at: Optional[str] = None

class SaleCreate(BaseModel):
    sale_type: str
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    platform_id: Optional[str] = None  # For online delivery platform sales
    payment_mode: Optional[str] = None  # cash, card, online_platform, etc.
    amount: float
    discount: Optional[float] = 0
    payment_details: List[dict]
    date: datetime
    notes: Optional[str] = None
    platform_status: Optional[str] = None  # pending/settled

class SalePayment(BaseModel):
    payment_mode: str
    amount: float
    discount: Optional[float] = 0

class Supplier(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: Optional[str] = None
    sub_category: Optional[str] = None
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    account_number: Optional[str] = None
    # Multiple bank accounts support
    bank_accounts: Optional[List[dict]] = []  # [{bank_name, account_number, iban, swift_code}]
    credit_limit: Optional[float] = 0
    current_credit: Optional[float] = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[str] = None

class SupplierCreate(BaseModel):
    name: str
    category: Optional[str] = None
    sub_category: Optional[str] = None
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    account_number: Optional[str] = None
    bank_accounts: Optional[List[dict]] = []
    credit_limit: Optional[float] = 0

class SupplierPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    supplier_name: str
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    expense_for_branch_id: Optional[str] = None
    date: datetime
    notes: Optional[str] = None
    bill_image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SupplierPaymentCreate(BaseModel):
    supplier_id: str
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    expense_for_branch_id: Optional[str] = None
    date: datetime
    notes: Optional[str] = None
    bill_image_url: Optional[str] = None

class SupplierCreditPayment(BaseModel):
    payment_mode: str
    amount: float
    branch_id: Optional[str] = None

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str
    sub_category: Optional[str] = None
    description: str
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    expense_for_branch_id: Optional[str] = None
    supplier_id: Optional[str] = None
    date: datetime
    notes: Optional[str] = None
    bill_image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class ExpenseCreate(BaseModel):
    category: str
    sub_category: Optional[str] = None
    description: str
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    expense_for_branch_id: Optional[str] = None
    supplier_id: Optional[str] = None
    date: datetime
    notes: Optional[str] = None
    bill_image_url: Optional[str] = None

class DashboardStats(BaseModel):
    total_sales: float
    total_expenses: float
    total_supplier_payments: float
    net_profit: float
    pending_credits: float
    cash_sales: float
    bank_sales: float
    credit_sales: float

class WhatsAppSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    phone_number: str
    enabled: bool = True
    notification_time: str = "09:00"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WhatsAppSettingsCreate(BaseModel):
    phone_number: str
    enabled: bool = True
    notification_time: str = "09:00"

class ExportRequest(BaseModel):
    format: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    branch_id: Optional[str] = None

class Category(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CategoryCreate(BaseModel):
    name: str
    type: str
    parent_id: Optional[str] = None
    description: Optional[str] = None

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    job_title_id: Optional[str] = None
    branch_id: Optional[str] = None
    user_id: Optional[str] = None
    salary: float = 0
    pay_frequency: str = "monthly"
    join_date: Optional[datetime] = None
    document_expiry: Optional[datetime] = None
    loan_balance: float = 0
    old_salary_balance: float = 0
    annual_leave_entitled: int = 30
    sick_leave_entitled: int = 15
    ticket_entitled: int = 1
    ticket_years: int = 2
    ticket_used: int = 0
    notes: Optional[str] = None
    active: bool = True
    status: str = "active"
    pos_role: Optional[str] = None  # "cashier", "waiter", "both", or None
    cashier_pin: Optional[str] = None
    resignation_date: Optional[str] = None
    last_working_day: Optional[str] = None
    notice_period_days: int = 30
    termination_reason: Optional[str] = None
    final_settlement_amount: Optional[float] = None
    final_settlement_paid: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeCreate(BaseModel):
    name: str
    document_id: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    job_title_id: Optional[str] = None
    branch_id: Optional[str] = None
    salary: float = 0
    pay_frequency: Optional[str] = "monthly"
    join_date: Optional[datetime] = None
    document_expiry: Optional[datetime] = None
    annual_leave_entitled: Optional[int] = 30
    sick_leave_entitled: Optional[int] = 15
    ticket_entitled: Optional[int] = 1
    ticket_years: Optional[int] = 2
    pos_role: Optional[str] = None
    notes: Optional[str] = None

class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    document_type: str
    document_number: Optional[str] = None
    related_to: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: datetime
    alert_days: int = 30
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    notes: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentCreate(BaseModel):
    name: str
    document_type: str
    document_number: Optional[str] = None
    related_to: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: datetime
    alert_days: Optional[int] = 30
    notes: Optional[str] = None

class SalaryPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    payment_type: str = "salary"
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    period: str
    date: datetime
    notes: Optional[str] = None
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SalaryPaymentCreate(BaseModel):
    employee_id: str
    payment_type: Optional[str] = "salary"
    amount: float
    payment_mode: str
    branch_id: Optional[str] = None
    period: str
    date: datetime
    notes: Optional[str] = None

class Leave(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    leave_type: str
    start_date: datetime
    end_date: datetime
    days: int
    with_ticket: bool = False
    reason: Optional[str] = None
    status: str = "pending"
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeaveCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: datetime
    end_date: datetime
    days: int
    with_ticket: Optional[bool] = False
    reason: Optional[str] = None
    status: Optional[str] = "pending"

class EmployeeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    request_type: str
    subject: str
    details: Optional[str] = None
    amount: Optional[float] = None
    status: str = "pending"
    response: Optional[str] = None
    processed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeRequestCreate(BaseModel):
    request_type: str
    subject: str
    details: Optional[str] = None
    amount: Optional[float] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    message: str
    type: str
    read: bool = False
    related_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CashTransfer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_branch_id: Optional[str] = None
    to_branch_id: Optional[str] = None
    from_branch_name: Optional[str] = None
    to_branch_name: Optional[str] = None
    amount: float
    transfer_mode: str = "cash"
    sender_name: str
    receiver_name: str
    date: datetime
    notes: Optional[str] = None
    status: str = "completed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class CashTransferCreate(BaseModel):
    from_branch_id: Optional[str] = None
    to_branch_id: Optional[str] = None
    amount: float
    transfer_mode: Optional[str] = "cash"
    sender_name: str
    receiver_name: str
    date: datetime
    notes: Optional[str] = None

class InvoiceItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float
    total: float = 0

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    items: List[dict] = []
    subtotal: float = 0
    discount: float = 0
    vat_rate: float = 15.0
    vat_amount: float = 0
    total: float = 0
    total_with_vat: float = 0
    payment_mode: str = "cash"
    payment_details: List[dict] = []
    sale_id: Optional[str] = None
    image_url: Optional[str] = None
    date: datetime
    notes: Optional[str] = None
    status: str = "paid"
    buyer_vat_number: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class InvoiceCreate(BaseModel):
    branch_id: Optional[str] = None
    customer_id: Optional[str] = None
    items: List[dict]
    discount: Optional[float] = 0
    payment_mode: str = "cash"
    payment_details: Optional[List[dict]] = None
    date: datetime
    notes: Optional[str] = None
    buyer_vat_number: Optional[str] = None

class Item(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    unit_price: float = 0
    cost_price: float = 0
    category: Optional[str] = None
    unit: Optional[str] = "piece"
    min_stock_level: float = 0
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    unit_price: float = 0
    cost_price: float = 0
    category: Optional[str] = None
    unit: Optional[str] = "piece"
    min_stock_level: float = 0

class StockEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    item_name: str
    branch_id: str
    quantity: float
    unit_cost: float = 0
    supplier_id: Optional[str] = None
    source: str = "manual"
    notes: Optional[str] = None
    date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class StockUsage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    item_name: str
    branch_id: str
    quantity: float
    used_by: str
    notes: Optional[str] = None
    date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class StockTransfer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_branch_id: str
    to_branch_id: str
    items: List[dict] = []
    reason: Optional[str] = None
    status: str = "pending"
    requested_by: str
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    completed_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class RecurringExpense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    amount: float
    frequency: str = "monthly"
    branch_id: Optional[str] = None
    next_due_date: datetime
    alert_days: int = 7
    notes: Optional[str] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class JobTitle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    department: Optional[str] = None
    min_salary: float = 0
    max_salary: float = 0
    description: Optional[str] = None
    permissions: List[str] = []
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RecurringExpenseCreate(BaseModel):
    name: str
    category: str
    amount: float
    frequency: Optional[str] = "monthly"
    branch_id: Optional[str] = None
    next_due_date: datetime
    alert_days: Optional[int] = 7
    notes: Optional[str] = None

class Attendance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    date: str
    time_in: Optional[datetime] = None
    time_out: Optional[datetime] = None
    status: str = "present"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    document_type: str
    document_number: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EmployeeDocumentCreate(BaseModel):
    employee_id: str
    document_type: str
    document_number: Optional[str] = None
    issue_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    notes: Optional[str] = None

class Fine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fine_type: str
    department: str
    description: str
    amount: float
    branch_id: Optional[str] = None
    employee_id: Optional[str] = None
    payment_status: str = "unpaid"
    paid_amount: float = 0
    payment_mode: Optional[str] = None
    fine_date: datetime
    due_date: Optional[datetime] = None
    paid_date: Optional[datetime] = None
    deduct_from_salary: bool = False
    monthly_deduction: float = 0
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FineCreate(BaseModel):
    fine_type: str
    department: str
    description: str
    amount: float
    branch_id: Optional[str] = None
    employee_id: Optional[str] = None
    fine_date: datetime
    due_date: Optional[datetime] = None
    deduct_from_salary: Optional[bool] = False
    monthly_deduction: Optional[float] = 0
    notes: Optional[str] = None

class SalaryDeduction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    deduction_type: str
    amount: float
    period: str
    reason: str
    fine_id: Optional[str] = None
    branch_id: Optional[str] = None
    date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class SalaryDeductionCreate(BaseModel):
    employee_id: str
    deduction_type: str
    amount: float
    period: str
    reason: str
    fine_id: Optional[str] = None
    branch_id: Optional[str] = None
    date: datetime

class SalaryHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    old_salary: float
    new_salary: float
    effective_date: datetime
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BranchPayback(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_branch_id: str
    to_branch_id: str
    from_branch_name: str
    to_branch_name: str
    amount: float
    payment_mode: str = "cash"
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class Partner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    share_percentage: float = 0
    salary: float = 0
    loan_balance: float = 0
    salary_due: float = 0
    notes: Optional[str] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PartnerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    share_percentage: Optional[float] = 0
    salary: Optional[float] = 0
    notes: Optional[str] = None

class CompanyLoan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lender: str
    loan_type: str
    total_amount: float
    paid_amount: float = 0
    monthly_payment: float = 0
    interest_rate: float = 0
    branch_id: Optional[str] = None
    start_date: datetime
    notes: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CompanyLoanPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    loan_id: str
    amount: float
    payment_mode: str = "bank"
    branch_id: Optional[str] = None
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PartnerTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    partner_id: str
    partner_name: str
    transaction_type: str
    amount: float
    payment_mode: str = "cash"
    branch_id: Optional[str] = None
    description: Optional[str] = None
    date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str

class PartnerTransactionCreate(BaseModel):
    partner_id: str
    transaction_type: str
    amount: float
    payment_mode: Optional[str] = "cash"
    branch_id: Optional[str] = None
    description: Optional[str] = None
    date: datetime

# Shift/Schedule Models
class Shift(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    branch_id: str
    start_time: str  # "08:00"
    end_time: str  # "16:00"
    break_minutes: int = 60
    days: List[str] = []  # ["Mon", "Tue", "Wed", "Thu", "Fri"]
    color: Optional[str] = None
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ShiftAssignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    shift_id: str
    shift_name: str
    branch_id: str
    week_start: str  # "2026-02-23"
    date: str  # specific date "2026-02-24"
    actual_in: Optional[str] = None  # "08:05"
    actual_out: Optional[str] = None  # "16:10"
    status: str = "scheduled"  # "scheduled", "present", "late", "absent", "day_off"
    overtime_hours: float = 0
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



# =====================================================
# RESTAURANT POS MODELS
# =====================================================

class MenuItemModifier(BaseModel):
    """Modifier option for a menu item (e.g., Size, Spice Level)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Size", "Spice Level", "Add-ons"
    options: List[dict] = []  # [{"name": "Small", "price": 0}, {"name": "Large", "price": 5}]
    required: bool = False
    multiple: bool = False  # Can select multiple options?

class MenuItem(BaseModel):
    """Menu item for restaurant POS"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    name_ar: Optional[str] = None  # Arabic name
    description: Optional[str] = None
    category: str = "main"  # main, appetizer, beverage, dessert, sides
    price: float
    cost_price: float = 0
    image_url: Optional[str] = None
    modifiers: List[dict] = []  # List of modifier groups
    is_available: bool = True
    branch_id: Optional[str] = None  # Deprecated - use branch_ids
    branch_ids: List[str] = []  # Empty = all branches
    platform_ids: List[str] = []  # Which platforms this item is listed on
    platform_prices: dict = {}  # Platform-specific prices {platform_id: price}
    preparation_time: int = 10  # minutes
    calories: Optional[int] = None
    tags: List[str] = []  # vegetarian, spicy, popular, new
    display_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MenuItemCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    category: str = "main"
    price: float
    cost_price: float = 0
    image_url: Optional[str] = None
    modifiers: Optional[List[dict]] = []
    is_available: bool = True
    branch_id: Optional[str] = None
    branch_ids: Optional[List[str]] = []
    platform_ids: Optional[List[str]] = []
    platform_prices: Optional[dict] = {}
    preparation_time: int = 10
    calories: Optional[int] = None
    tags: Optional[List[str]] = []
    display_order: int = 0

class POSOrder(BaseModel):
    """POS order for restaurant"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: int  # Daily order number
    branch_id: str
    cashier_id: str
    cashier_name: str
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    items: List[dict] = []  # [{item_id, name, quantity, unit_price, modifiers, subtotal}]
    subtotal: float = 0
    discount: float = 0
    discount_type: str = "amount"  # amount or percent
    tax: float = 0
    tax_rate: float = 0.15  # 15% VAT
    total: float = 0
    payment_method: str = "cash"  # cash, card, online, split, credit
    payment_details: List[dict] = []  # For split payments
    status: str = "pending"  # pending, preparing, ready, completed, cancelled
    order_type: str = "dine_in"  # dine_in, takeaway, delivery
    table_number: Optional[str] = None
    notes: Optional[str] = None
    kitchen_notes: Optional[str] = None
    sent_to_kitchen: bool = False
    kitchen_sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class POSOrderCreate(BaseModel):
    branch_id: str
    customer_id: Optional[str] = None
    items: List[dict]
    discount: float = 0
    discount_type: str = "amount"
    payment_method: str = "cash"
    payment_details: Optional[List[dict]] = []
    order_type: str = "dine_in"
    table_number: Optional[str] = None
    notes: Optional[str] = None
    kitchen_notes: Optional[str] = None

class MenuCategory(BaseModel):
    """Menu category for organizing items"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    name_ar: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class Loan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str
    employee_name: str
    loan_type: str = "personal"  # personal, advance, emergency, housing
    amount: float
    monthly_installment: float = 0
    total_installments: int = 0
    paid_installments: int = 0
    remaining_balance: float = 0
    status: str = "pending"  # pending, approved, active, completed, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    start_date: Optional[datetime] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LoanCreate(BaseModel):
    employee_id: str
    loan_type: str = "personal"
    amount: float
    monthly_installment: float = 0
    total_installments: int = 0
    start_date: Optional[datetime] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class LoanInstallment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    loan_id: str
    employee_id: str
    employee_name: str
    amount: float
    payment_mode: str = "deduction"
    period: str = ""
    remaining_balance: float = 0
    notes: Optional[str] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""
