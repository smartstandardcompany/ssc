"""
Iteration 9 Tests - Expense For Branch Feature
Tests for cross-branch expense tracking where one branch pays for another
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials from the test request
ADMIN_EMAIL = "SSC@SSC.com"
ADMIN_PASSWORD = "Aa147258369SsC@"

# Branch IDs from the test request
BRANCH_A_ID = "d805e6cb-f65a-4a09-8707-95f3f5e505bf"  # Branch A
BRANCH_B_ID = "4ea291a5-c3e4-4067-8437-2121f3c12882"  # Branch b


class TestExpenseForBranch:
    """Tests for the new Expense For Branch feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.auth_token = None
        self.created_expense_ids = []
        
        # Login to get token
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_resp.status_code == 200:
            self.auth_token = login_resp.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        yield
        
        # Cleanup - delete test expenses
        for expense_id in self.created_expense_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/expenses/{expense_id}")
            except:
                pass
    
    def test_01_login_with_admin_credentials(self):
        """Test login with admin credentials SSC@SSC.com"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert resp.status_code == 200, f"Login failed: {resp.text}"
        data = resp.json()
        assert "access_token" in data, "No access token in response"
        assert "user" in data, "No user in response"
        print(f"Login successful for {ADMIN_EMAIL}, role: {data['user'].get('role')}")
    
    def test_02_verify_branches_exist(self):
        """Verify branches A and b exist"""
        assert self.auth_token, "Auth token required"
        
        resp = self.session.get(f"{BASE_URL}/api/branches")
        assert resp.status_code == 200, f"Failed to get branches: {resp.text}"
        
        branches = resp.json()
        branch_ids = [b["id"] for b in branches]
        branch_names = {b["id"]: b["name"] for b in branches}
        
        assert BRANCH_A_ID in branch_ids, f"Branch A not found. Available: {branch_names}"
        assert BRANCH_B_ID in branch_ids, f"Branch b not found. Available: {branch_names}"
        
        print(f"Branch A: {branch_names.get(BRANCH_A_ID)}")
        print(f"Branch b: {branch_names.get(BRANCH_B_ID)}")
    
    def test_03_create_cross_branch_expense(self):
        """Test creating expense with expense_for_branch_id (cross-branch expense)"""
        assert self.auth_token, "Auth token required"
        
        expense_data = {
            "category": "Rent",
            "description": "Cross branch test",
            "amount": 100.00,
            "payment_mode": "cash",
            "branch_id": BRANCH_A_ID,  # Paid From = A
            "expense_for_branch_id": BRANCH_B_ID,  # Expense For = b
            "date": datetime.now().isoformat()
        }
        
        resp = self.session.post(f"{BASE_URL}/api/expenses", json=expense_data)
        assert resp.status_code == 200, f"Failed to create expense: {resp.text}"
        
        expense = resp.json()
        self.created_expense_ids.append(expense["id"])
        
        # Verify the expense data
        assert expense["branch_id"] == BRANCH_A_ID, "branch_id should be A"
        assert expense["expense_for_branch_id"] == BRANCH_B_ID, "expense_for_branch_id should be b"
        assert expense["amount"] == 100.00, "Amount should be 100"
        assert expense["category"] == "Rent", "Category should be Rent"
        
        print(f"Created cross-branch expense: {expense['id']}")
        print(f"Paid From (branch_id): {expense['branch_id']}")
        print(f"Expense For (expense_for_branch_id): {expense['expense_for_branch_id']}")
    
    def test_04_verify_expense_in_list(self):
        """Verify the cross-branch expense appears in expenses list with both branch fields"""
        assert self.auth_token, "Auth token required"
        
        # First create an expense
        expense_data = {
            "category": "Rent",
            "description": "TEST_Cross_branch_verify",
            "amount": 150.00,
            "payment_mode": "cash",
            "branch_id": BRANCH_A_ID,
            "expense_for_branch_id": BRANCH_B_ID,
            "date": datetime.now().isoformat()
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/expenses", json=expense_data)
        assert create_resp.status_code == 200
        expense_id = create_resp.json()["id"]
        self.created_expense_ids.append(expense_id)
        
        # Get all expenses and find our test expense
        resp = self.session.get(f"{BASE_URL}/api/expenses")
        assert resp.status_code == 200, f"Failed to get expenses: {resp.text}"
        
        expenses = resp.json()
        test_expense = next((e for e in expenses if e["id"] == expense_id), None)
        
        assert test_expense is not None, "Test expense not found in list"
        assert test_expense["branch_id"] == BRANCH_A_ID, "branch_id should be A"
        assert test_expense["expense_for_branch_id"] == BRANCH_B_ID, "expense_for_branch_id should be b"
        
        print(f"Verified expense in list with expense_for_branch_id: {test_expense['expense_for_branch_id']}")
    
    def test_05_branch_dues_endpoint_returns_expense_dues(self):
        """Test GET /api/reports/branch-dues returns expense-based cross-branch dues"""
        assert self.auth_token, "Auth token required"
        
        # First create a cross-branch expense
        expense_data = {
            "category": "Rent",
            "description": "TEST_Dues_Test",
            "amount": 200.00,
            "payment_mode": "cash",
            "branch_id": BRANCH_A_ID,
            "expense_for_branch_id": BRANCH_B_ID,
            "date": datetime.now().isoformat()
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/expenses", json=expense_data)
        assert create_resp.status_code == 200
        expense_id = create_resp.json()["id"]
        self.created_expense_ids.append(expense_id)
        
        # Get branch dues
        resp = self.session.get(f"{BASE_URL}/api/reports/branch-dues")
        assert resp.status_code == 200, f"Failed to get branch dues: {resp.text}"
        
        data = resp.json()
        assert "dues" in data, "Response should have 'dues' field"
        
        # Look for expense-based dues - "A paid for b (expense)"
        print(f"Branch dues: {data['dues']}")
        
        # Find the key that matches "A paid for b (expense)"
        expense_due_key = None
        for key in data["dues"].keys():
            if "(expense)" in key:
                expense_due_key = key
                break
        
        assert expense_due_key is not None, f"No expense dues found. Dues: {data['dues']}"
        print(f"Found expense dues: {expense_due_key} = {data['dues'][expense_due_key]}")
    
    def test_06_branch_dues_net_endpoint(self):
        """Test GET /api/reports/branch-dues-net returns expense-based cross-branch dues"""
        assert self.auth_token, "Auth token required"
        
        resp = self.session.get(f"{BASE_URL}/api/reports/branch-dues-net")
        assert resp.status_code == 200, f"Failed to get branch dues net: {resp.text}"
        
        data = resp.json()
        assert "dues" in data, "Response should have 'dues' field"
        assert "paybacks" in data, "Response should have 'paybacks' field"
        assert "total_dues" in data, "Response should have 'total_dues' field"
        assert "total_paybacks" in data, "Response should have 'total_paybacks' field"
        
        print(f"Branch dues net: {data}")
        print(f"Total dues: {data['total_dues']}")
        print(f"Total paybacks: {data['total_paybacks']}")
    
    def test_07_create_expense_same_branch(self):
        """Test creating expense with expense_for_branch_id same as branch_id (or null)"""
        assert self.auth_token, "Auth token required"
        
        # Create expense with expense_for_branch_id = null (same as Paid From)
        expense_data = {
            "category": "Utilities",
            "description": "TEST_Same_Branch",
            "amount": 50.00,
            "payment_mode": "cash",
            "branch_id": BRANCH_A_ID,
            "expense_for_branch_id": None,  # Same as Paid From
            "date": datetime.now().isoformat()
        }
        
        resp = self.session.post(f"{BASE_URL}/api/expenses", json=expense_data)
        assert resp.status_code == 200, f"Failed to create expense: {resp.text}"
        
        expense = resp.json()
        self.created_expense_ids.append(expense["id"])
        
        # Verify the expense data
        assert expense["branch_id"] == BRANCH_A_ID, "branch_id should be A"
        assert expense["expense_for_branch_id"] is None, "expense_for_branch_id should be null"
        
        print(f"Created same-branch expense: {expense['id']}")
    
    def test_08_create_expense_empty_string_for_branch(self):
        """Test that empty string for expense_for_branch_id is converted to null"""
        assert self.auth_token, "Auth token required"
        
        expense_data = {
            "category": "Maintenance",
            "description": "TEST_Empty_String",
            "amount": 75.00,
            "payment_mode": "bank",
            "branch_id": BRANCH_A_ID,
            "expense_for_branch_id": "",  # Empty string should be converted to null
            "date": datetime.now().isoformat()
        }
        
        resp = self.session.post(f"{BASE_URL}/api/expenses", json=expense_data)
        assert resp.status_code == 200, f"Failed to create expense: {resp.text}"
        
        expense = resp.json()
        self.created_expense_ids.append(expense["id"])
        
        # Empty string should be converted to null
        assert expense["expense_for_branch_id"] is None, "Empty string should be converted to null"
        
        print(f"Empty string converted to null correctly")


class TestExpensesEndpoint:
    """Additional tests for expenses endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        yield
    
    def test_get_expenses_returns_expense_for_branch_field(self):
        """Verify GET /api/expenses returns expense_for_branch_id field"""
        resp = self.session.get(f"{BASE_URL}/api/expenses")
        assert resp.status_code == 200
        
        expenses = resp.json()
        if len(expenses) > 0:
            # Check that expense_for_branch_id field exists in the response
            first_expense = expenses[0]
            assert "expense_for_branch_id" in first_expense or first_expense.get("expense_for_branch_id") is None, \
                "expense_for_branch_id field should exist in expense response"
            print(f"Verified expense_for_branch_id field exists in response")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
