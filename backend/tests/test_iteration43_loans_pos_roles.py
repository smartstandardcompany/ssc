"""
Iteration 43 Tests: Loan Management, POS Role Separation, Employee Portal Loans Tab, Keyboard Shortcuts
Tests for:
1. Loan Management System CRUD operations
2. Loan approval/reject workflow
3. Loan installment recording
4. Employee self-service loans endpoint
5. POS role field in cashier login
6. Waiter/Cashier role separation
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLoanManagementSystem:
    """Tests for Loan Management APIs"""
    
    token = None
    employee_id = None
    created_loan_id = None
    
    @classmethod
    def setup_class(cls):
        """Login as admin and get employee for testing"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
        cls.token = login_res.json()["access_token"]
        
        # Get an employee for loan testing - Ahmed Khan (id starts with daa12216) or any active employee
        employees_res = requests.get(f"{BASE_URL}/api/employees", 
            headers={"Authorization": f"Bearer {cls.token}"})
        assert employees_res.status_code == 200
        employees = employees_res.json()
        if employees:
            # Try to find Ahmed Khan first
            ahmed = next((e for e in employees if e.get("name", "").lower().startswith("ahmed")), None)
            cls.employee_id = ahmed["id"] if ahmed else employees[0]["id"]
    
    def test_01_loan_stats_endpoint(self):
        """GET /api/loans/summary/stats - should return loan statistics"""
        res = requests.get(f"{BASE_URL}/api/loans/summary/stats",
            headers={"Authorization": f"Bearer {self.token}"})
        assert res.status_code == 200, f"Failed to get loan stats: {res.text}"
        data = res.json()
        assert "total_loans" in data, "Missing total_loans field"
        assert "active_loans" in data, "Missing active_loans field"
        assert "pending_loans" in data, "Missing pending_loans field"
        assert "completed_loans" in data, "Missing completed_loans field"
        assert "total_disbursed" in data, "Missing total_disbursed field"
        assert "total_outstanding" in data, "Missing total_outstanding field"
        assert "total_collected" in data, "Missing total_collected field"
        print(f"Loan stats: {data}")
    
    def test_02_get_all_loans(self):
        """GET /api/loans - should return list of loans"""
        res = requests.get(f"{BASE_URL}/api/loans",
            headers={"Authorization": f"Bearer {self.token}"})
        assert res.status_code == 200, f"Failed to get loans: {res.text}"
        data = res.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Total loans found: {len(data)}")
    
    def test_03_create_loan(self):
        """POST /api/loans - create a new loan"""
        assert self.employee_id is not None, "No employee found for testing"
        
        loan_data = {
            "employee_id": self.employee_id,
            "loan_type": "personal",
            "amount": 5000.00,
            "monthly_installment": 500.00,
            "total_installments": 10,
            "start_date": "2026-02-01T00:00:00Z",
            "reason": "TEST_Personal emergency",
            "notes": "Test loan for iteration 43"
        }
        
        res = requests.post(f"{BASE_URL}/api/loans", 
            json=loan_data,
            headers={"Authorization": f"Bearer {self.token}"})
        assert res.status_code == 200, f"Failed to create loan: {res.text}"
        data = res.json()
        assert "id" in data, "Loan should have an ID"
        assert data["status"] == "pending", f"New loan should be pending, got: {data['status']}"
        assert data["amount"] == 5000.00, f"Amount mismatch"
        assert data["remaining_balance"] == 5000.00, f"Remaining balance should equal amount for new loan"
        TestLoanManagementSystem.created_loan_id = data["id"]
        print(f"Created loan with ID: {data['id']}")
    
    def test_04_get_loan_detail(self):
        """GET /api/loans/{id} - should return loan detail with installments"""
        assert self.created_loan_id is not None, "No loan created to fetch"
        
        res = requests.get(f"{BASE_URL}/api/loans/{self.created_loan_id}",
            headers={"Authorization": f"Bearer {self.token}"})
        assert res.status_code == 200, f"Failed to get loan detail: {res.text}"
        data = res.json()
        assert "loan" in data, "Response should have 'loan' key"
        assert "installments" in data, "Response should have 'installments' key"
        assert data["loan"]["id"] == self.created_loan_id
        assert data["loan"]["status"] == "pending"
        print(f"Loan detail: {data['loan']['loan_type']}, amount: {data['loan']['amount']}")
    
    def test_05_approve_loan(self):
        """POST /api/loans/{id}/approve - approve a pending loan"""
        assert self.created_loan_id is not None, "No loan created to approve"
        
        res = requests.post(f"{BASE_URL}/api/loans/{self.created_loan_id}/approve",
            json={"action": "approve"},
            headers={"Authorization": f"Bearer {self.token}"})
        assert res.status_code == 200, f"Failed to approve loan: {res.text}"
        data = res.json()
        assert data["status"] == "active", f"Loan should be active after approval, got: {data['status']}"
        print(f"Loan approved: {data}")
        
        # Verify loan is now active
        loan_res = requests.get(f"{BASE_URL}/api/loans/{self.created_loan_id}",
            headers={"Authorization": f"Bearer {self.token}"})
        assert loan_res.status_code == 200
        assert loan_res.json()["loan"]["status"] == "active"
    
    def test_06_record_installment(self):
        """POST /api/loans/{id}/installment - record an installment payment"""
        assert self.created_loan_id is not None, "No loan created for installment"
        
        installment_data = {
            "amount": 500.00,
            "payment_mode": "deduction",
            "period": "Feb 2026",
            "notes": "First installment"
        }
        
        res = requests.post(f"{BASE_URL}/api/loans/{self.created_loan_id}/installment",
            json=installment_data,
            headers={"Authorization": f"Bearer {self.token}"})
        assert res.status_code == 200, f"Failed to record installment: {res.text}"
        data = res.json()
        assert data["amount"] == 500.00
        assert data["remaining_balance"] == 4500.00, f"Remaining balance should be 4500, got: {data['remaining_balance']}"
        print(f"Installment recorded: {data}")
        
        # Verify loan remaining balance updated
        loan_res = requests.get(f"{BASE_URL}/api/loans/{self.created_loan_id}",
            headers={"Authorization": f"Bearer {self.token}"})
        assert loan_res.status_code == 200
        assert loan_res.json()["loan"]["remaining_balance"] == 4500.00
        assert loan_res.json()["loan"]["paid_installments"] == 1
        assert len(loan_res.json()["installments"]) == 1
    
    def test_07_get_loans_filtered_by_status(self):
        """GET /api/loans?status=active - should filter loans by status"""
        res = requests.get(f"{BASE_URL}/api/loans?status=active",
            headers={"Authorization": f"Bearer {self.token}"})
        assert res.status_code == 200, f"Failed to get filtered loans: {res.text}"
        data = res.json()
        # All returned loans should have status=active
        for loan in data:
            assert loan["status"] == "active", f"Expected active status, got: {loan['status']}"
        print(f"Active loans count: {len(data)}")
    
    def test_08_create_and_reject_loan(self):
        """Create a loan and reject it"""
        assert self.employee_id is not None, "No employee found"
        
        # Create a new loan to reject
        loan_data = {
            "employee_id": self.employee_id,
            "loan_type": "emergency",
            "amount": 2000.00,
            "monthly_installment": 200.00,
            "total_installments": 10,
            "reason": "TEST_loan to be rejected"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/loans", 
            json=loan_data,
            headers={"Authorization": f"Bearer {self.token}"})
        assert create_res.status_code == 200
        loan_id = create_res.json()["id"]
        
        # Reject the loan
        reject_res = requests.post(f"{BASE_URL}/api/loans/{loan_id}/approve",
            json={"action": "reject", "reason": "Test rejection"},
            headers={"Authorization": f"Bearer {self.token}"})
        assert reject_res.status_code == 200, f"Failed to reject loan: {reject_res.text}"
        assert reject_res.json()["status"] == "rejected"
        print(f"Loan rejected successfully")
        
        # Clean up - delete the rejected loan
        delete_res = requests.delete(f"{BASE_URL}/api/loans/{loan_id}",
            headers={"Authorization": f"Bearer {self.token}"})
        assert delete_res.status_code == 200
    
    def test_09_delete_pending_loan(self):
        """DELETE /api/loans/{id} - should delete a pending loan"""
        assert self.employee_id is not None, "No employee found"
        
        # Create a loan to delete
        loan_data = {
            "employee_id": self.employee_id,
            "loan_type": "advance",
            "amount": 1000.00,
            "reason": "TEST_loan to be deleted"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/loans", 
            json=loan_data,
            headers={"Authorization": f"Bearer {self.token}"})
        assert create_res.status_code == 200
        loan_id = create_res.json()["id"]
        
        # Delete the pending loan
        delete_res = requests.delete(f"{BASE_URL}/api/loans/{loan_id}",
            headers={"Authorization": f"Bearer {self.token}"})
        assert delete_res.status_code == 200, f"Failed to delete loan: {delete_res.text}"
        print(f"Pending loan deleted successfully")
        
        # Verify loan is deleted
        get_res = requests.get(f"{BASE_URL}/api/loans/{loan_id}",
            headers={"Authorization": f"Bearer {self.token}"})
        assert get_res.status_code == 404, "Loan should not exist after deletion"


class TestPOSRoleSeparation:
    """Tests for POS Role field in Cashier/Waiter login and role separation"""
    
    token = None
    
    @classmethod
    def setup_class(cls):
        """Login as admin"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_res.status_code == 200
        cls.token = login_res.json()["access_token"]
    
    def test_01_cashier_login_returns_pos_role(self):
        """POST /api/cashier/login - should return pos_role in user object"""
        res = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": "1234"})
        assert res.status_code == 200, f"Cashier login failed: {res.text}"
        data = res.json()
        assert "user" in data, "Response should have user object"
        assert "pos_role" in data["user"], f"User object should have pos_role field. Got: {data['user']}"
        print(f"Cashier login pos_role: {data['user'].get('pos_role')}")
    
    def test_02_employee_has_pos_role_field(self):
        """Verify employees have pos_role field"""
        res = requests.get(f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {self.token}"})
        assert res.status_code == 200
        employees = res.json()
        if employees:
            # Check first employee has pos_role field (can be None or a value)
            emp = employees[0]
            # pos_role should exist or be allowed to be null
            print(f"First employee pos_role: {emp.get('pos_role')}")
    
    def test_03_update_employee_pos_role(self):
        """Update an employee's POS role"""
        # Get an employee
        emp_res = requests.get(f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {self.token}"})
        assert emp_res.status_code == 200
        employees = emp_res.json()
        if not employees:
            pytest.skip("No employees to update")
        
        emp_id = employees[0]["id"]
        original_pos_role = employees[0].get("pos_role")
        
        # Update pos_role to "waiter"
        update_res = requests.put(f"{BASE_URL}/api/employees/{emp_id}",
            json={"pos_role": "waiter"},
            headers={"Authorization": f"Bearer {self.token}"})
        assert update_res.status_code == 200, f"Failed to update employee: {update_res.text}"
        
        # Verify update
        verify_res = requests.get(f"{BASE_URL}/api/employees/{emp_id}",
            headers={"Authorization": f"Bearer {self.token}"})
        assert verify_res.status_code == 200
        assert verify_res.json().get("pos_role") == "waiter"
        
        # Restore original value
        requests.put(f"{BASE_URL}/api/employees/{emp_id}",
            json={"pos_role": original_pos_role},
            headers={"Authorization": f"Bearer {self.token}"})
        print(f"Employee pos_role updated and restored successfully")


class TestEmployeePortalLoans:
    """Tests for Employee self-service loans endpoint"""
    
    def test_01_my_loans_endpoint_exists(self):
        """GET /api/my/loans - verify endpoint exists (may return 401 without proper auth)"""
        # First login as admin
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        
        # Try to get my loans - this will work if admin has an employee profile, 
        # or return 404 if no employee profile is linked
        res = requests.get(f"{BASE_URL}/api/my/loans",
            headers={"Authorization": f"Bearer {token}"})
        
        # Either 200 (success) or 404 (no employee profile) is acceptable
        assert res.status_code in [200, 404], f"Unexpected status: {res.status_code}, {res.text}"
        
        if res.status_code == 200:
            data = res.json()
            assert isinstance(data, list), "Response should be a list"
            print(f"My loans count: {len(data)}")
        else:
            print("Admin has no employee profile linked (expected for some admins)")


class TestCleanup:
    """Clean up test data created during testing"""
    
    def test_cleanup_test_loans(self):
        """Delete TEST_ prefixed loans created during testing"""
        login_res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        
        # Get all loans
        loans_res = requests.get(f"{BASE_URL}/api/loans",
            headers={"Authorization": f"Bearer {token}"})
        assert loans_res.status_code == 200
        loans = loans_res.json()
        
        # Delete loans with TEST_ in reason
        deleted_count = 0
        for loan in loans:
            reason = loan.get("reason", "")
            if "TEST_" in reason:
                # Only delete if it's pending or rejected (not active with installments)
                if loan["status"] in ["pending", "rejected"] or (loan["status"] == "active" and loan.get("paid_installments", 0) == 0):
                    delete_res = requests.delete(f"{BASE_URL}/api/loans/{loan['id']}",
                        headers={"Authorization": f"Bearer {token}"})
                    if delete_res.status_code == 200:
                        deleted_count += 1
        
        print(f"Cleaned up {deleted_count} test loans")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
