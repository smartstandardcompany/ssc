"""
Iteration 76 Tests - SSC Track ERP
Testing 4 critical fixes:
1. Dashboard stats performance (GET /api/dashboard/stats returns 200, no 500 error)
2. Supplier module total_purchases using aggregation (performance)
3. Supplier Payments page - Add Bill and Pay Credit functionality
4. Users page - branch field optional for Manager/Operator roles
Plus:
- Performance checks for /api/suppliers and /api/dashboard/stats
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and get token"""
    res = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    data = res.json()
    assert "access_token" in data, "No access_token in login response"
    return data["access_token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# =============================================================================
# Fix #1: Dashboard Stats - Fixed NameError for expenses/supplier_payments
# =============================================================================
class TestDashboardStatsFix:
    """Test dashboard stats endpoint is working (was returning 500 before fix)"""
    
    def test_dashboard_stats_returns_200(self, headers):
        """Dashboard stats should return 200, not 500"""
        res = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert res.status_code == 200, f"Dashboard stats failed: {res.status_code} - {res.text}"
        
    def test_dashboard_stats_has_required_fields(self, headers):
        """Dashboard stats should have all required fields including online_sales"""
        res = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        # Core fields
        required_fields = [
            "total_sales", "total_expenses", "total_supplier_payments",
            "net_profit", "pending_credits", "cash_sales", "bank_sales",
            "online_sales",  # This is the new field
            "cash_in_hand", "bank_in_hand",
            "expense_by_category", "supplier_dues"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
            
    def test_dashboard_stats_online_sales_present(self, headers):
        """Dashboard stats should include online_sales field (was missing before)"""
        res = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert "online_sales" in data, "online_sales field should be present"
        assert isinstance(data["online_sales"], (int, float)), "online_sales should be a number"


# =============================================================================
# Fix #2: Supplier Module - Uses Aggregation Pipeline for Performance
# =============================================================================
class TestSupplierAggregationPerformance:
    """Test supplier list uses aggregation for total_purchases (performance)"""
    
    def test_suppliers_list_has_total_purchases(self, headers):
        """Supplier list should include total_purchases field from aggregation"""
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert res.status_code == 200
        suppliers = res.json()
        
        if len(suppliers) > 0:
            supplier = suppliers[0]
            assert "total_purchases" in supplier, "Supplier should have total_purchases field"
            assert isinstance(supplier["total_purchases"], (int, float)), "total_purchases should be a number"
            
    def test_suppliers_performance_under_500ms(self, headers):
        """GET /api/suppliers should respond under 500ms"""
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        elapsed = (time.time() - start) * 1000  # Convert to ms
        
        assert res.status_code == 200
        assert elapsed < 500, f"Suppliers endpoint took {elapsed:.0f}ms (should be <500ms)"
        print(f"[PERF] /api/suppliers responded in {elapsed:.0f}ms")


# =============================================================================
# Fix #3: Supplier Payments Page - Add Bill and Pay Credit Functionality
# =============================================================================
class TestSupplierPaymentsPage:
    """Test Supplier Payments page endpoints - Add Bill and Pay Credit"""
    
    def test_supplier_payments_list(self, headers):
        """GET /api/supplier-payments should return list"""
        res = requests.get(f"{BASE_URL}/api/supplier-payments", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list), "Supplier payments should be a list"
        
    def test_add_bill_creates_expense(self, headers):
        """Add Bill creates an expense with supplier_id (for tracking in expenses module)"""
        # First get a supplier
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert res.status_code == 200
        suppliers = res.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers available for testing")
            
        supplier = suppliers[0]
        supplier_id = supplier["id"]
        
        # Get branches for branch selector
        res = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        branches = res.json() if res.status_code == 200 else []
        branch_id = branches[0]["id"] if branches else ""
        
        # Add Bill (creates expense)
        bill_payload = {
            "amount": 100.00,
            "category": "Supplier Purchase",
            "description": f"TEST_iter76_bill_{uuid.uuid4().hex[:8]}",
            "payment_mode": "credit",  # Credit mode adds to supplier balance
            "supplier_id": supplier_id,
            "branch_id": branch_id,
            "date": "2025-01-10T12:00:00"
        }
        
        res = requests.post(f"{BASE_URL}/api/expenses", headers=headers, json=bill_payload)
        assert res.status_code in [200, 201], f"Add Bill (expense) failed: {res.text}"
        
        expense = res.json()
        assert expense["supplier_id"] == supplier_id, "Expense should have supplier_id"
        assert expense["payment_mode"] == "credit", "Payment mode should be credit"
        
    def test_pay_credit_creates_supplier_payment(self, headers):
        """Pay Credit creates a supplier payment and reduces supplier balance"""
        # Get supplier with credit balance
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        suppliers = res.json()
        
        # Find supplier with current_credit > 0
        supplier_with_credit = None
        for s in suppliers:
            if s.get("current_credit", 0) > 0:
                supplier_with_credit = s
                break
                
        if not supplier_with_credit:
            pytest.skip("No supplier with credit balance available")
            
        supplier_id = supplier_with_credit["id"]
        current_credit = supplier_with_credit["current_credit"]
        
        # Pay a small amount
        payment_amount = min(10.00, current_credit)
        
        res = requests.post(f"{BASE_URL}/api/suppliers/{supplier_id}/pay-credit", 
            headers=headers, json={
                "amount": payment_amount,
                "payment_mode": "cash",
                "branch_id": ""
            })
        assert res.status_code == 200, f"Pay credit failed: {res.text}"
        
        data = res.json()
        assert "remaining_credit" in data, "Should return remaining credit"
        assert data["remaining_credit"] < current_credit, "Credit should be reduced"


# =============================================================================
# Fix #4: Users Page - Branch Field Optional for Manager/Operator
# =============================================================================
class TestUsersBranchOptional:
    """Test that branch field is optional when creating/updating users"""
    
    def test_create_user_without_branch(self, headers):
        """Creating user without branch_id should work (All Branches access)"""
        unique_email = f"test_iter76_{uuid.uuid4().hex[:8]}@ssc.com"
        
        user_payload = {
            "name": "TEST_Iter76_User",
            "email": unique_email,
            "password": "TestPass123!",
            "role": "operator",
            "branch_id": "",  # Empty = All Branches
            "permissions": {"sales": "write", "expenses": "read"}
        }
        
        res = requests.post(f"{BASE_URL}/api/users", headers=headers, json=user_payload)
        assert res.status_code in [200, 201], f"Create user without branch failed: {res.text}"
        
        user = res.json()
        # branch_id should be empty or None
        assert user.get("branch_id", "") in ["", None], "User should have no branch (All Branches)"
        
        # Cleanup - delete the test user
        if "id" in user:
            requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=headers)
            
    def test_update_user_without_branch(self, headers):
        """Updating user without branch_id should work"""
        # First create a user with a branch
        res = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        branches = res.json() if res.status_code == 200 else []
        
        unique_email = f"test_iter76_upd_{uuid.uuid4().hex[:8]}@ssc.com"
        
        user_payload = {
            "name": "TEST_Iter76_Update_User",
            "email": unique_email,
            "password": "TestPass123!",
            "role": "manager",
            "branch_id": branches[0]["id"] if branches else "",
            "permissions": {"sales": "write"}
        }
        
        res = requests.post(f"{BASE_URL}/api/users", headers=headers, json=user_payload)
        if res.status_code not in [200, 201]:
            pytest.skip("Could not create test user")
            
        user = res.json()
        user_id = user["id"]
        
        # Now update to remove branch (All Branches access)
        update_payload = {
            "name": "TEST_Iter76_Updated_Name",
            "role": "manager",
            "branch_id": "",  # Remove branch = All Branches
            "permissions": {"sales": "write"}
        }
        
        res = requests.put(f"{BASE_URL}/api/users/{user_id}", headers=headers, json=update_payload)
        assert res.status_code == 200, f"Update user without branch failed: {res.text}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=headers)
        
    def test_users_list(self, headers):
        """GET /api/users should return list with branch info"""
        res = requests.get(f"{BASE_URL}/api/users", headers=headers)
        assert res.status_code == 200
        users = res.json()
        
        assert isinstance(users, list), "Users should be a list"
        if len(users) > 0:
            user = users[0]
            assert "id" in user
            assert "name" in user
            assert "email" in user
            assert "role" in user


# =============================================================================
# Performance Tests
# =============================================================================
class TestPerformance:
    """Test performance of critical endpoints"""
    
    def test_dashboard_stats_performance(self, headers):
        """GET /api/dashboard/stats should respond under 500ms"""
        start = time.time()
        res = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        elapsed = (time.time() - start) * 1000
        
        assert res.status_code == 200
        assert elapsed < 500, f"Dashboard stats took {elapsed:.0f}ms (should be <500ms)"
        print(f"[PERF] /api/dashboard/stats responded in {elapsed:.0f}ms")


# =============================================================================
# Branches Endpoint - For Add Bill Branch Selector
# =============================================================================
class TestBranchesForAddBill:
    """Test branches endpoint returns data for branch selector"""
    
    def test_branches_list(self, headers):
        """Branches should return list with id and name"""
        res = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        assert res.status_code == 200
        branches = res.json()
        
        assert isinstance(branches, list)
        if len(branches) > 0:
            branch = branches[0]
            assert "id" in branch
            assert "name" in branch
            print(f"[INFO] Found {len(branches)} branches for selector")


# =============================================================================
# Suppliers Page - Branch in Add Supplier Form
# =============================================================================
class TestSuppliersPageBranchSelector:
    """Test suppliers page branch selector functionality"""
    
    def test_create_supplier_with_branch(self, headers):
        """Create supplier with branch_id"""
        res = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        branches = res.json() if res.status_code == 200 else []
        
        supplier_payload = {
            "name": f"TEST_Supplier_Iter76_{uuid.uuid4().hex[:8]}",
            "category": "",
            "sub_category": "",
            "branch_id": branches[0]["id"] if branches else "",
            "phone": "+966512345678",
            "email": "test@example.com",
            "credit_limit": 5000
        }
        
        res = requests.post(f"{BASE_URL}/api/suppliers", headers=headers, json=supplier_payload)
        assert res.status_code in [200, 201], f"Create supplier with branch failed: {res.text}"
        
        supplier = res.json()
        if branches:
            assert supplier["branch_id"] == branches[0]["id"]
            
        # Cleanup
        if "id" in supplier:
            requests.delete(f"{BASE_URL}/api/suppliers/{supplier['id']}", headers=headers)
            
    def test_create_supplier_without_branch(self, headers):
        """Create supplier without branch (All Branches)"""
        supplier_payload = {
            "name": f"TEST_Supplier_NoBranch_{uuid.uuid4().hex[:8]}",
            "category": "",
            "branch_id": "",  # Empty = All Branches
            "phone": "",
            "credit_limit": 0
        }
        
        res = requests.post(f"{BASE_URL}/api/suppliers", headers=headers, json=supplier_payload)
        assert res.status_code in [200, 201], f"Create supplier without branch failed: {res.text}"
        
        supplier = res.json()
        # branch_id should be empty or None
        assert supplier.get("branch_id", "") in ["", None]
        
        # Cleanup
        if "id" in supplier:
            requests.delete(f"{BASE_URL}/api/suppliers/{supplier['id']}", headers=headers)
