"""
Iteration 6 Backend Tests
Features tested:
- loan_balance tracking: advance increases loan, loan_repayment decreases
- Leave management: CRUD operations
- Employee summary enhanced with loan and leave data
- loan_repayment payment type
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@example.com"
        print(f"✓ Login successful, user role: {data['user']['role']}")


@pytest.fixture
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture
def test_employee(auth_headers):
    """Create a test employee for loan/leave testing"""
    emp_data = {
        "name": "TEST_LoanLeaveEmployee",
        "document_id": "TEST123",
        "position": "Tester",
        "salary": 5000,
        "pay_frequency": "monthly",
        "annual_leave_entitled": 30,
        "sick_leave_entitled": 15
    }
    response = requests.post(f"{BASE_URL}/api/employees", json=emp_data, headers=auth_headers)
    assert response.status_code == 200
    emp = response.json()
    print(f"✓ Created test employee: {emp['name']} (ID: {emp['id']})")
    yield emp
    # Cleanup
    requests.delete(f"{BASE_URL}/api/employees/{emp['id']}", headers=auth_headers)
    print(f"✓ Cleaned up test employee: {emp['name']}")


class TestLoanBalance:
    """Test loan/advance tracking"""
    
    def test_advance_payment_increases_loan_balance(self, auth_headers, test_employee):
        """POST /api/salary-payments with payment_type=advance should increase loan_balance"""
        emp_id = test_employee['id']
        initial_loan = test_employee.get('loan_balance', 0)
        
        # Record advance payment
        payment_data = {
            "employee_id": emp_id,
            "payment_type": "advance",
            "amount": 1000,
            "payment_mode": "cash",
            "period": "Jan 2026",
            "date": datetime.now().isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/salary-payments", json=payment_data, headers=auth_headers)
        assert response.status_code == 200
        payment = response.json()
        assert payment["payment_type"] == "advance"
        print(f"✓ Advance payment created: ${payment['amount']}")
        
        # Verify employee loan_balance increased
        emp_response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        employees = emp_response.json()
        updated_emp = next((e for e in employees if e['id'] == emp_id), None)
        assert updated_emp is not None
        expected_loan = initial_loan + 1000
        assert updated_emp['loan_balance'] == expected_loan, f"Expected loan_balance={expected_loan}, got {updated_emp['loan_balance']}"
        print(f"✓ Loan balance increased: ${initial_loan} -> ${updated_emp['loan_balance']}")
    
    def test_loan_repayment_decreases_loan_balance(self, auth_headers, test_employee):
        """POST /api/salary-payments with payment_type=loan_repayment should decrease loan_balance"""
        emp_id = test_employee['id']
        
        # First give advance to create loan
        advance_data = {
            "employee_id": emp_id,
            "payment_type": "advance",
            "amount": 2000,
            "payment_mode": "cash",
            "period": "Jan 2026",
            "date": datetime.now().isoformat()
        }
        requests.post(f"{BASE_URL}/api/salary-payments", json=advance_data, headers=auth_headers)
        
        # Check loan balance after advance
        emp_response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        employees = emp_response.json()
        emp_after_advance = next((e for e in employees if e['id'] == emp_id), None)
        loan_after_advance = emp_after_advance['loan_balance']
        print(f"✓ Loan balance after advance: ${loan_after_advance}")
        
        # Now make loan repayment
        repay_data = {
            "employee_id": emp_id,
            "payment_type": "loan_repayment",
            "amount": 500,
            "payment_mode": "cash",
            "period": "Jan 2026",
            "date": datetime.now().isoformat()
        }
        response = requests.post(f"{BASE_URL}/api/salary-payments", json=repay_data, headers=auth_headers)
        assert response.status_code == 200
        payment = response.json()
        assert payment["payment_type"] == "loan_repayment"
        print(f"✓ Loan repayment recorded: ${payment['amount']}")
        
        # Verify loan_balance decreased
        emp_response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        employees = emp_response.json()
        emp_after_repay = next((e for e in employees if e['id'] == emp_id), None)
        expected_loan = loan_after_advance - 500
        assert emp_after_repay['loan_balance'] == expected_loan, f"Expected {expected_loan}, got {emp_after_repay['loan_balance']}"
        print(f"✓ Loan balance decreased: ${loan_after_advance} -> ${emp_after_repay['loan_balance']}")
    
    def test_employee_summary_includes_loan_data(self, auth_headers, test_employee):
        """GET /api/employees/{id}/summary should return loan (total_advance, total_repaid, balance)"""
        emp_id = test_employee['id']
        
        # Add advance and repayment
        requests.post(f"{BASE_URL}/api/salary-payments", json={
            "employee_id": emp_id,
            "payment_type": "advance",
            "amount": 1500,
            "payment_mode": "cash",
            "period": "Feb 2026",
            "date": datetime.now().isoformat()
        }, headers=auth_headers)
        
        requests.post(f"{BASE_URL}/api/salary-payments", json={
            "employee_id": emp_id,
            "payment_type": "loan_repayment",
            "amount": 300,
            "payment_mode": "cash",
            "period": "Feb 2026",
            "date": datetime.now().isoformat()
        }, headers=auth_headers)
        
        # Get summary
        response = requests.get(f"{BASE_URL}/api/employees/{emp_id}/summary", headers=auth_headers)
        assert response.status_code == 200
        summary = response.json()
        
        # Verify loan data
        assert "loan" in summary, "Summary should have 'loan' field"
        loan = summary["loan"]
        assert "total_advance" in loan
        assert "total_repaid" in loan
        assert "balance" in loan
        assert loan["total_advance"] >= 1500, f"total_advance should be at least 1500, got {loan['total_advance']}"
        assert loan["total_repaid"] >= 300, f"total_repaid should be at least 300, got {loan['total_repaid']}"
        print(f"✓ Loan summary: advance=${loan['total_advance']}, repaid=${loan['total_repaid']}, balance=${loan['balance']}")
    
    def test_monthly_summary_includes_loan_repayment(self, auth_headers, test_employee):
        """GET /api/employees/{id}/summary monthly_summary should include loan_repayment field"""
        emp_id = test_employee['id']
        
        # Add loan repayment
        requests.post(f"{BASE_URL}/api/salary-payments", json={
            "employee_id": emp_id,
            "payment_type": "loan_repayment",
            "amount": 200,
            "payment_mode": "cash",
            "period": "Mar 2026",
            "date": datetime.now().isoformat()
        }, headers=auth_headers)
        
        response = requests.get(f"{BASE_URL}/api/employees/{emp_id}/summary", headers=auth_headers)
        assert response.status_code == 200
        summary = response.json()
        
        assert "monthly_summary" in summary
        mar_period = next((m for m in summary["monthly_summary"] if "Mar" in m["period"]), None)
        assert mar_period is not None, "Should have Mar 2026 period"
        assert "loan_repayment" in mar_period, "Monthly summary should have loan_repayment field"
        assert mar_period["loan_repayment"] >= 200
        print(f"✓ Monthly summary loan_repayment: ${mar_period['loan_repayment']}")


class TestLeaveManagement:
    """Test leave CRUD operations"""
    
    def test_create_leave(self, auth_headers, test_employee):
        """POST /api/leaves creates leave record"""
        emp_id = test_employee['id']
        leave_data = {
            "employee_id": emp_id,
            "leave_type": "annual",
            "start_date": "2026-02-01T00:00:00",
            "end_date": "2026-02-05T00:00:00",
            "days": 5,
            "reason": "Vacation"
        }
        response = requests.post(f"{BASE_URL}/api/leaves", json=leave_data, headers=auth_headers)
        assert response.status_code == 200
        leave = response.json()
        assert leave["employee_id"] == emp_id
        assert leave["leave_type"] == "annual"
        assert leave["days"] == 5
        print(f"✓ Leave created: {leave['leave_type']} - {leave['days']} days")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/leaves/{leave['id']}", headers=auth_headers)
    
    def test_get_leaves(self, auth_headers, test_employee):
        """GET /api/leaves returns leave list"""
        emp_id = test_employee['id']
        
        # Create a leave first
        leave_data = {
            "employee_id": emp_id,
            "leave_type": "sick",
            "start_date": "2026-03-01T00:00:00",
            "end_date": "2026-03-02T00:00:00",
            "days": 2,
            "reason": "Doctor visit"
        }
        create_resp = requests.post(f"{BASE_URL}/api/leaves", json=leave_data, headers=auth_headers)
        leave_id = create_resp.json()["id"]
        
        # Get all leaves
        response = requests.get(f"{BASE_URL}/api/leaves", headers=auth_headers)
        assert response.status_code == 200
        leaves = response.json()
        assert isinstance(leaves, list)
        print(f"✓ Got {len(leaves)} leaves")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/leaves/{leave_id}", headers=auth_headers)
    
    def test_get_leaves_filter_by_employee(self, auth_headers, test_employee):
        """GET /api/leaves?employee_id=X filters by employee"""
        emp_id = test_employee['id']
        
        # Create leave for test employee
        leave_data = {
            "employee_id": emp_id,
            "leave_type": "unpaid",
            "start_date": "2026-04-01T00:00:00",
            "end_date": "2026-04-03T00:00:00",
            "days": 3,
            "reason": "Personal"
        }
        create_resp = requests.post(f"{BASE_URL}/api/leaves", json=leave_data, headers=auth_headers)
        leave_id = create_resp.json()["id"]
        
        # Get filtered leaves
        response = requests.get(f"{BASE_URL}/api/leaves?employee_id={emp_id}", headers=auth_headers)
        assert response.status_code == 200
        leaves = response.json()
        assert all(l["employee_id"] == emp_id for l in leaves), "All leaves should be for the filtered employee"
        print(f"✓ Filtered leaves for employee: {len(leaves)} records")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/leaves/{leave_id}", headers=auth_headers)
    
    def test_delete_leave(self, auth_headers, test_employee):
        """DELETE /api/leaves/{id} works"""
        emp_id = test_employee['id']
        
        # Create leave first
        leave_data = {
            "employee_id": emp_id,
            "leave_type": "other",
            "start_date": "2026-05-01T00:00:00",
            "end_date": "2026-05-01T00:00:00",
            "days": 1,
            "reason": "Appointment"
        }
        create_resp = requests.post(f"{BASE_URL}/api/leaves", json=leave_data, headers=auth_headers)
        leave_id = create_resp.json()["id"]
        
        # Delete the leave
        response = requests.delete(f"{BASE_URL}/api/leaves/{leave_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ Leave deleted: {leave_id}")
        
        # Verify deletion
        all_leaves = requests.get(f"{BASE_URL}/api/leaves", headers=auth_headers).json()
        assert not any(l["id"] == leave_id for l in all_leaves), "Deleted leave should not exist"
        print(f"✓ Verified leave deletion")
    
    def test_employee_summary_includes_leave_data(self, auth_headers, test_employee):
        """GET /api/employees/{id}/summary returns leave (annual_used, annual_remaining, sick_used, sick_remaining, unpaid_used)"""
        emp_id = test_employee['id']
        
        # Create different types of leaves
        annual_leave = {
            "employee_id": emp_id,
            "leave_type": "annual",
            "start_date": "2026-01-10T00:00:00",
            "end_date": "2026-01-14T00:00:00",
            "days": 5,
            "reason": "Holiday"
        }
        sick_leave = {
            "employee_id": emp_id,
            "leave_type": "sick",
            "start_date": "2026-01-20T00:00:00",
            "end_date": "2026-01-21T00:00:00",
            "days": 2,
            "reason": "Flu"
        }
        unpaid_leave = {
            "employee_id": emp_id,
            "leave_type": "unpaid",
            "start_date": "2026-01-25T00:00:00",
            "end_date": "2026-01-25T00:00:00",
            "days": 1,
            "reason": "Personal"
        }
        
        leave_ids = []
        for leave_data in [annual_leave, sick_leave, unpaid_leave]:
            resp = requests.post(f"{BASE_URL}/api/leaves", json=leave_data, headers=auth_headers)
            leave_ids.append(resp.json()["id"])
        
        # Get summary
        response = requests.get(f"{BASE_URL}/api/employees/{emp_id}/summary", headers=auth_headers)
        assert response.status_code == 200
        summary = response.json()
        
        # Verify leave data
        assert "leave" in summary, "Summary should have 'leave' field"
        leave = summary["leave"]
        
        expected_fields = ["annual_used", "annual_remaining", "sick_used", "sick_remaining", "unpaid_used"]
        for field in expected_fields:
            assert field in leave, f"leave should have '{field}' field"
        
        assert leave["annual_used"] >= 5, f"annual_used should be at least 5, got {leave['annual_used']}"
        assert leave["sick_used"] >= 2, f"sick_used should be at least 2, got {leave['sick_used']}"
        assert leave["unpaid_used"] >= 1, f"unpaid_used should be at least 1, got {leave['unpaid_used']}"
        
        # Verify remaining calculation (entitled - used)
        emp_annual_entitled = test_employee.get("annual_leave_entitled", 30)
        emp_sick_entitled = test_employee.get("sick_leave_entitled", 15)
        assert leave["annual_remaining"] == emp_annual_entitled - leave["annual_used"]
        assert leave["sick_remaining"] == emp_sick_entitled - leave["sick_used"]
        
        print(f"✓ Leave summary: annual={leave['annual_used']}/{emp_annual_entitled}, sick={leave['sick_used']}/{emp_sick_entitled}, unpaid={leave['unpaid_used']}")
        
        # Cleanup
        for lid in leave_ids:
            requests.delete(f"{BASE_URL}/api/leaves/{lid}", headers=auth_headers)


class TestEmployeeWithLoanBalance:
    """Test employee model loan_balance field"""
    
    def test_employee_has_loan_balance_field(self, auth_headers):
        """GET /api/employees returns employees with loan_balance field"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        if employees:
            emp = employees[0]
            assert "loan_balance" in emp, "Employee should have loan_balance field"
            print(f"✓ Employee has loan_balance field: {emp['name']} - ${emp.get('loan_balance', 0)}")
        else:
            print("✓ No employees to test, but endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
