"""
Backend API Tests - Iteration 5
Tests: Payment types (salary/advance/overtime/tickets/id_card), 
       Expense creation for tickets/id_card payments,
       Employee payment summary endpoint with monthly breakdown
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Test login authentication"""
    
    def test_login_with_test_credentials(self):
        """Test login with test@example.com / password123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@example.com"
        print(f"✓ Login successful for test@example.com, role: {data['user']['role']}")


class TestSalaryPaymentTypes:
    """Tests for salary payments with different payment_type values"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        self.headers = {
            "Authorization": f"Bearer {data['access_token']}",
            "Content-Type": "application/json"
        }
        self.created_employee_ids = []
        self.created_payment_ids = []
        self.created_expense_ids = []
    
    def teardown_method(self, method):
        # Cleanup: delete payments first, then employees
        for pay_id in self.created_payment_ids:
            requests.delete(f"{BASE_URL}/api/salary-payments/{pay_id}", headers=self.headers)
        for emp_id in self.created_employee_ids:
            requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=self.headers)
        # Note: Expenses created by tickets/id_card payments need manual cleanup if needed
    
    def create_test_employee(self, name_prefix="TEST_Emp"):
        """Helper: Create test employee and return id"""
        emp_name = f"{name_prefix}_{uuid.uuid4().hex[:6]}"
        emp_res = requests.post(f"{BASE_URL}/api/employees", headers=self.headers, json={
            "name": emp_name,
            "salary": 5000.00,
            "position": "Test Position"
        })
        assert emp_res.status_code == 200, f"Failed to create employee: {emp_res.text}"
        emp_id = emp_res.json()["id"]
        self.created_employee_ids.append(emp_id)
        return emp_id, emp_name
    
    def test_salary_payment_type_salary(self):
        """POST /api/salary-payments with payment_type=salary"""
        emp_id, emp_name = self.create_test_employee("TEST_SalaryType")
        
        payload = {
            "employee_id": emp_id,
            "payment_type": "salary",
            "amount": 5000.00,
            "payment_mode": "cash",
            "period": "Feb 2026",
            "date": datetime.now().isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["payment_type"] == "salary"
        assert data["amount"] == 5000.00
        assert data["employee_name"] == emp_name
        self.created_payment_ids.append(data["id"])
        print(f"✓ Created salary payment with payment_type='salary': {data['id']}")
    
    def test_salary_payment_type_advance(self):
        """POST /api/salary-payments with payment_type=advance"""
        emp_id, _ = self.create_test_employee("TEST_AdvanceType")
        
        payload = {
            "employee_id": emp_id,
            "payment_type": "advance",
            "amount": 1000.00,
            "payment_mode": "cash",
            "period": "Feb 2026",
            "date": datetime.now().isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["payment_type"] == "advance"
        assert data["amount"] == 1000.00
        self.created_payment_ids.append(data["id"])
        print(f"✓ Created salary payment with payment_type='advance': {data['id']}")
    
    def test_salary_payment_type_overtime(self):
        """POST /api/salary-payments with payment_type=overtime"""
        emp_id, _ = self.create_test_employee("TEST_OvertimeType")
        
        payload = {
            "employee_id": emp_id,
            "payment_type": "overtime",
            "amount": 500.00,
            "payment_mode": "bank",
            "period": "Feb 2026",
            "date": datetime.now().isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["payment_type"] == "overtime"
        assert data["amount"] == 500.00
        self.created_payment_ids.append(data["id"])
        print(f"✓ Created salary payment with payment_type='overtime': {data['id']}")
    
    def test_salary_payment_type_tickets_creates_expense(self):
        """POST /api/salary-payments with payment_type=tickets creates payment AND expense"""
        emp_id, emp_name = self.create_test_employee("TEST_TicketsType")
        
        # Get expenses before
        expenses_before = requests.get(f"{BASE_URL}/api/expenses", headers=self.headers).json()
        expenses_count_before = len(expenses_before)
        
        payload = {
            "employee_id": emp_id,
            "payment_type": "tickets",
            "amount": 800.00,
            "payment_mode": "cash",
            "period": "Feb 2026",
            "date": datetime.now().isoformat(),
            "notes": "Flight tickets for employee"
        }
        response = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["payment_type"] == "tickets"
        assert data["amount"] == 800.00
        self.created_payment_ids.append(data["id"])
        
        # Check that expense was also created
        expenses_after = requests.get(f"{BASE_URL}/api/expenses", headers=self.headers).json()
        expenses_count_after = len(expenses_after)
        
        assert expenses_count_after > expenses_count_before, "Expense should be created for tickets payment"
        
        # Find the new expense
        new_expenses = [e for e in expenses_after if emp_name in e.get("description", "")]
        assert len(new_expenses) > 0, f"Expense with employee name '{emp_name}' not found"
        
        ticket_expense = new_expenses[-1]
        assert ticket_expense["amount"] == 800.00
        assert "tickets" in ticket_expense["category"].lower() or "ticket" in ticket_expense["category"].lower()
        print(f"✓ Created tickets payment AND expense: payment_id={data['id']}, expense with description contains '{emp_name}'")
    
    def test_salary_payment_type_id_card_creates_expense(self):
        """POST /api/salary-payments with payment_type=id_card creates payment AND expense"""
        emp_id, emp_name = self.create_test_employee("TEST_IDCardType")
        
        # Get expenses before
        expenses_before = requests.get(f"{BASE_URL}/api/expenses", headers=self.headers).json()
        expenses_count_before = len(expenses_before)
        
        payload = {
            "employee_id": emp_id,
            "payment_type": "id_card",
            "amount": 200.00,
            "payment_mode": "bank",
            "period": "Feb 2026",
            "date": datetime.now().isoformat(),
            "notes": "Emirates ID renewal"
        }
        response = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["payment_type"] == "id_card"
        assert data["amount"] == 200.00
        self.created_payment_ids.append(data["id"])
        
        # Check that expense was also created
        expenses_after = requests.get(f"{BASE_URL}/api/expenses", headers=self.headers).json()
        expenses_count_after = len(expenses_after)
        
        assert expenses_count_after > expenses_count_before, "Expense should be created for id_card payment"
        
        # Find the new expense
        new_expenses = [e for e in expenses_after if emp_name in e.get("description", "")]
        assert len(new_expenses) > 0, f"Expense with employee name '{emp_name}' not found"
        
        id_expense = new_expenses[-1]
        assert id_expense["amount"] == 200.00
        assert "id" in id_expense["category"].lower() or "card" in id_expense["category"].lower()
        print(f"✓ Created id_card payment AND expense: payment_id={data['id']}, expense created for '{emp_name}'")
    
    def test_salary_payment_no_expense_for_regular_salary(self):
        """POST /api/salary-payments with payment_type=salary should NOT create expense"""
        emp_id, emp_name = self.create_test_employee("TEST_NoExpense")
        
        # Get expenses before
        expenses_before = requests.get(f"{BASE_URL}/api/expenses", headers=self.headers).json()
        descriptions_before = [e.get("description", "") for e in expenses_before]
        
        payload = {
            "employee_id": emp_id,
            "payment_type": "salary",
            "amount": 5000.00,
            "payment_mode": "cash",
            "period": "Feb 2026",
            "date": datetime.now().isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json=payload)
        assert response.status_code == 200
        self.created_payment_ids.append(response.json()["id"])
        
        # Check no new expense with this employee name was created
        expenses_after = requests.get(f"{BASE_URL}/api/expenses", headers=self.headers).json()
        new_expenses_with_emp = [e for e in expenses_after if emp_name in e.get("description", "") and e.get("description", "") not in descriptions_before]
        
        assert len(new_expenses_with_emp) == 0, "Regular salary payment should NOT create expense"
        print(f"✓ Regular salary payment did NOT create expense (correct behavior)")


class TestEmployeeSummaryEndpoint:
    """Tests for GET /api/employees/{id}/summary endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        self.headers = {
            "Authorization": f"Bearer {data['access_token']}",
            "Content-Type": "application/json"
        }
        self.created_employee_ids = []
        self.created_payment_ids = []
    
    def teardown_method(self, method):
        for pay_id in self.created_payment_ids:
            requests.delete(f"{BASE_URL}/api/salary-payments/{pay_id}", headers=self.headers)
        for emp_id in self.created_employee_ids:
            requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=self.headers)
    
    def test_employee_summary_returns_correct_structure(self):
        """GET /api/employees/{id}/summary returns correct structure"""
        # Create employee
        emp_name = f"TEST_Summary_{uuid.uuid4().hex[:6]}"
        emp_res = requests.post(f"{BASE_URL}/api/employees", headers=self.headers, json={
            "name": emp_name,
            "salary": 4000.00,
            "position": "Developer"
        })
        assert emp_res.status_code == 200
        emp_id = emp_res.json()["id"]
        self.created_employee_ids.append(emp_id)
        
        # Get summary
        summary_res = requests.get(f"{BASE_URL}/api/employees/{emp_id}/summary", headers=self.headers)
        assert summary_res.status_code == 200, f"Failed: {summary_res.text}"
        data = summary_res.json()
        
        # Check structure
        assert "employee" in data
        assert "monthly_summary" in data
        assert "total_all_time" in data
        
        # Check employee data
        assert data["employee"]["id"] == emp_id
        assert data["employee"]["name"] == emp_name
        assert data["employee"]["salary"] == 4000.00
        
        print(f"✓ Employee summary has correct structure: employee, monthly_summary, total_all_time")
    
    def test_employee_summary_monthly_breakdown(self):
        """GET /api/employees/{id}/summary returns monthly breakdown with all payment types"""
        # Create employee
        emp_name = f"TEST_MonthlyBD_{uuid.uuid4().hex[:6]}"
        emp_res = requests.post(f"{BASE_URL}/api/employees", headers=self.headers, json={
            "name": emp_name,
            "salary": 5000.00,
            "position": "Manager"
        })
        assert emp_res.status_code == 200
        emp_id = emp_res.json()["id"]
        self.created_employee_ids.append(emp_id)
        
        # Create multiple payments for Feb 2026
        payments_to_create = [
            {"payment_type": "salary", "amount": 3000.00, "period": "Feb 2026"},
            {"payment_type": "advance", "amount": 500.00, "period": "Feb 2026"},
            {"payment_type": "overtime", "amount": 200.00, "period": "Feb 2026"},
            {"payment_type": "tickets", "amount": 1000.00, "period": "Feb 2026"},
            {"payment_type": "id_card", "amount": 150.00, "period": "Feb 2026"},
        ]
        
        for payment in payments_to_create:
            pay_res = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json={
                "employee_id": emp_id,
                "payment_type": payment["payment_type"],
                "amount": payment["amount"],
                "payment_mode": "cash",
                "period": payment["period"],
                "date": datetime.now().isoformat()
            })
            assert pay_res.status_code == 200, f"Failed to create {payment['payment_type']} payment"
            self.created_payment_ids.append(pay_res.json()["id"])
        
        # Get summary
        summary_res = requests.get(f"{BASE_URL}/api/employees/{emp_id}/summary", headers=self.headers)
        assert summary_res.status_code == 200
        data = summary_res.json()
        
        # Find Feb 2026 breakdown
        feb_summary = next((m for m in data["monthly_summary"] if m["period"] == "Feb 2026"), None)
        assert feb_summary is not None, "Feb 2026 should be in monthly_summary"
        
        # Verify all fields present
        assert "salary_paid" in feb_summary
        assert "advance" in feb_summary
        assert "overtime" in feb_summary
        assert "tickets" in feb_summary
        assert "id_card" in feb_summary
        assert "balance" in feb_summary
        assert "monthly_salary" in feb_summary
        assert "total_paid" in feb_summary
        
        # Verify values
        assert feb_summary["salary_paid"] == 3000.00
        assert feb_summary["advance"] == 500.00
        assert feb_summary["overtime"] == 200.00
        assert feb_summary["tickets"] == 1000.00
        assert feb_summary["id_card"] == 150.00
        assert feb_summary["total_paid"] == 4850.00  # Sum of all
        assert feb_summary["balance"] == 2000.00  # 5000 - 3000 salary_paid
        
        print(f"✓ Monthly breakdown correct: salary_paid=3000, advance=500, overtime=200, tickets=1000, id_card=150, balance=2000")
    
    def test_employee_summary_balance_calculation(self):
        """GET /api/employees/{id}/summary returns correct balance per period"""
        # Create employee with $6000 salary
        emp_name = f"TEST_Balance_{uuid.uuid4().hex[:6]}"
        emp_res = requests.post(f"{BASE_URL}/api/employees", headers=self.headers, json={
            "name": emp_name,
            "salary": 6000.00
        })
        assert emp_res.status_code == 200
        emp_id = emp_res.json()["id"]
        self.created_employee_ids.append(emp_id)
        
        # Pay partial salary for Jan 2026
        pay_res = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json={
            "employee_id": emp_id,
            "payment_type": "salary",
            "amount": 4000.00,
            "payment_mode": "cash",
            "period": "Jan 2026",
            "date": datetime.now().isoformat()
        })
        assert pay_res.status_code == 200
        self.created_payment_ids.append(pay_res.json()["id"])
        
        # Get summary
        summary_res = requests.get(f"{BASE_URL}/api/employees/{emp_id}/summary", headers=self.headers)
        data = summary_res.json()
        
        jan_summary = next((m for m in data["monthly_summary"] if m["period"] == "Jan 2026"), None)
        assert jan_summary is not None
        
        # Balance = monthly_salary - salary_paid = 6000 - 4000 = 2000
        assert jan_summary["monthly_salary"] == 6000.00
        assert jan_summary["salary_paid"] == 4000.00
        assert jan_summary["balance"] == 2000.00
        
        print(f"✓ Balance correctly calculated: salary=6000, paid=4000, balance=2000")
    
    def test_employee_summary_404_for_invalid_id(self):
        """GET /api/employees/{invalid_id}/summary returns 404"""
        invalid_id = "nonexistent-" + uuid.uuid4().hex[:8]
        response = requests.get(f"{BASE_URL}/api/employees/{invalid_id}/summary", headers=self.headers)
        assert response.status_code == 404
        print(f"✓ Summary endpoint returns 404 for invalid employee ID")


class TestPaymentModes:
    """Tests for payment modes (cash/bank) on salary payments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        self.headers = {
            "Authorization": f"Bearer {data['access_token']}",
            "Content-Type": "application/json"
        }
        self.created_employee_ids = []
        self.created_payment_ids = []
    
    def teardown_method(self, method):
        for pay_id in self.created_payment_ids:
            requests.delete(f"{BASE_URL}/api/salary-payments/{pay_id}", headers=self.headers)
        for emp_id in self.created_employee_ids:
            requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=self.headers)
    
    def test_payment_mode_cash(self):
        """POST /api/salary-payments with payment_mode=cash"""
        emp_name = f"TEST_CashMode_{uuid.uuid4().hex[:6]}"
        emp_res = requests.post(f"{BASE_URL}/api/employees", headers=self.headers, json={
            "name": emp_name, "salary": 3000.00
        })
        emp_id = emp_res.json()["id"]
        self.created_employee_ids.append(emp_id)
        
        pay_res = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json={
            "employee_id": emp_id,
            "payment_type": "salary",
            "amount": 3000.00,
            "payment_mode": "cash",
            "period": "Feb 2026",
            "date": datetime.now().isoformat()
        })
        assert pay_res.status_code == 200
        assert pay_res.json()["payment_mode"] == "cash"
        self.created_payment_ids.append(pay_res.json()["id"])
        print(f"✓ Payment with mode='cash' works")
    
    def test_payment_mode_bank(self):
        """POST /api/salary-payments with payment_mode=bank"""
        emp_name = f"TEST_BankMode_{uuid.uuid4().hex[:6]}"
        emp_res = requests.post(f"{BASE_URL}/api/employees", headers=self.headers, json={
            "name": emp_name, "salary": 3000.00
        })
        emp_id = emp_res.json()["id"]
        self.created_employee_ids.append(emp_id)
        
        pay_res = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json={
            "employee_id": emp_id,
            "payment_type": "salary",
            "amount": 3000.00,
            "payment_mode": "bank",
            "period": "Feb 2026",
            "date": datetime.now().isoformat()
        })
        assert pay_res.status_code == 200
        assert pay_res.json()["payment_mode"] == "bank"
        self.created_payment_ids.append(pay_res.json()["id"])
        print(f"✓ Payment with mode='bank' works")


class TestSummaryPaymentsDetail:
    """Tests for payments detail in summary response"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        self.headers = {
            "Authorization": f"Bearer {data['access_token']}",
            "Content-Type": "application/json"
        }
        self.created_employee_ids = []
        self.created_payment_ids = []
    
    def teardown_method(self, method):
        for pay_id in self.created_payment_ids:
            requests.delete(f"{BASE_URL}/api/salary-payments/{pay_id}", headers=self.headers)
        for emp_id in self.created_employee_ids:
            requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=self.headers)
    
    def test_summary_includes_payments_array(self):
        """Summary monthly breakdown should include payments array with details"""
        emp_name = f"TEST_PayArray_{uuid.uuid4().hex[:6]}"
        emp_res = requests.post(f"{BASE_URL}/api/employees", headers=self.headers, json={
            "name": emp_name, "salary": 4000.00
        })
        emp_id = emp_res.json()["id"]
        self.created_employee_ids.append(emp_id)
        
        # Create a payment
        pay_res = requests.post(f"{BASE_URL}/api/salary-payments", headers=self.headers, json={
            "employee_id": emp_id,
            "payment_type": "advance",
            "amount": 500.00,
            "payment_mode": "cash",
            "period": "Feb 2026",
            "date": datetime.now().isoformat(),
            "notes": "Test advance note"
        })
        assert pay_res.status_code == 200
        pay_id = pay_res.json()["id"]
        self.created_payment_ids.append(pay_id)
        
        # Get summary
        summary_res = requests.get(f"{BASE_URL}/api/employees/{emp_id}/summary", headers=self.headers)
        data = summary_res.json()
        
        feb_summary = next((m for m in data["monthly_summary"] if m["period"] == "Feb 2026"), None)
        assert feb_summary is not None
        assert "payments" in feb_summary
        assert len(feb_summary["payments"]) > 0
        
        # Check payment detail
        payment = feb_summary["payments"][0]
        assert "id" in payment
        assert "payment_type" in payment
        assert "amount" in payment
        assert "payment_mode" in payment
        assert "date" in payment
        
        print(f"✓ Summary includes payments array with full details (id, payment_type, amount, mode, date)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
