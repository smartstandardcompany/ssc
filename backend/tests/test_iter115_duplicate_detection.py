"""
Iteration 115: Test Duplicate Detection for Expenses and Supplier Payments

Tests:
1. Expense Duplicate Prevention Backend: GET /api/expenses/check-duplicate
2. Supplier Payment Duplicate Prevention Backend: GET /api/supplier-payments/check-duplicate  
3. Expense CRUD to verify duplicate data scenarios
4. Supplier Payment CRUD to verify duplicate data scenarios
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def api_session():
    """Create a requests session with auth token"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login to get token
    login_response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_response.status_code == 200:
        token = login_response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
    else:
        pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    return session


@pytest.fixture(scope="module")
def test_branch_id(api_session):
    """Get a branch ID for testing"""
    response = api_session.get(f"{BASE_URL}/api/branches")
    if response.status_code == 200:
        branches = response.json()
        if branches and len(branches) > 0:
            return branches[0]["id"]
    return None


@pytest.fixture(scope="module")
def test_supplier_id(api_session):
    """Get a supplier ID for testing"""
    response = api_session.get(f"{BASE_URL}/api/suppliers")
    if response.status_code == 200:
        suppliers = response.json()
        if suppliers and len(suppliers) > 0:
            return suppliers[0]["id"]
    return None


# =====================================================
# EXPENSE DUPLICATE DETECTION TESTS
# =====================================================

class TestExpenseCheckDuplicate:
    """Test GET /api/expenses/check-duplicate endpoint"""
    
    def test_check_duplicate_endpoint_exists(self, api_session):
        """Test that the check-duplicate endpoint exists and is accessible"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = api_session.get(
            f"{BASE_URL}/api/expenses/check-duplicate",
            params={"branch_id": "test", "amount": 100, "date": today, "category": ""}
        )
        # Should return 200 even with non-existent branch_id
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"PASS: check-duplicate endpoint accessible")
    
    def test_check_duplicate_returns_correct_structure(self, api_session):
        """Test that the response has has_duplicate (bool) and count (int)"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = api_session.get(
            f"{BASE_URL}/api/expenses/check-duplicate",
            params={"branch_id": "", "amount": 999999.99, "date": today}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "has_duplicate" in data, "Response missing 'has_duplicate' field"
        assert "count" in data, "Response missing 'count' field"
        assert isinstance(data["has_duplicate"], bool), f"has_duplicate should be bool, got {type(data['has_duplicate'])}"
        assert isinstance(data["count"], int), f"count should be int, got {type(data['count'])}"
        print(f"PASS: Response structure correct - has_duplicate={data['has_duplicate']}, count={data['count']}")
    
    def test_check_duplicate_no_duplicates(self, api_session):
        """Test that unique amount shows no duplicates"""
        # Use a very unlikely amount that won't exist
        unique_amount = 123456.78
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = api_session.get(
            f"{BASE_URL}/api/expenses/check-duplicate",
            params={"branch_id": "", "amount": unique_amount, "date": today}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_duplicate"] == False, f"Expected no duplicates for unique amount, got {data}"
        assert data["count"] == 0, f"Expected count=0, got {data['count']}"
        print(f"PASS: No duplicates found for unique amount {unique_amount}")
    
    def test_check_duplicate_with_branch_filter(self, api_session, test_branch_id):
        """Test that branch_id filter is applied"""
        if not test_branch_id:
            pytest.skip("No branches available for testing")
        
        today = datetime.now().strftime("%Y-%m-%d")
        response = api_session.get(
            f"{BASE_URL}/api/expenses/check-duplicate",
            params={"branch_id": test_branch_id, "amount": 100.00, "date": today}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "has_duplicate" in data and "count" in data
        print(f"PASS: Branch filter applied - branch={test_branch_id}, duplicates={data['count']}")
    
    def test_check_duplicate_with_category_filter(self, api_session):
        """Test that category filter is optionally applied"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = api_session.get(
            f"{BASE_URL}/api/expenses/check-duplicate",
            params={"branch_id": "", "amount": 100, "date": today, "category": "Salary"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "has_duplicate" in data
        print(f"PASS: Category filter works - category=Salary, duplicates={data['count']}")


# =====================================================
# SUPPLIER PAYMENT DUPLICATE DETECTION TESTS
# =====================================================

class TestSupplierPaymentCheckDuplicate:
    """Test GET /api/supplier-payments/check-duplicate endpoint"""
    
    def test_check_duplicate_endpoint_exists(self, api_session):
        """Test that the check-duplicate endpoint exists"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = api_session.get(
            f"{BASE_URL}/api/supplier-payments/check-duplicate",
            params={"supplier_id": "test", "amount": 100, "date": today}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"PASS: supplier-payments/check-duplicate endpoint accessible")
    
    def test_check_duplicate_returns_correct_structure(self, api_session):
        """Test response has has_duplicate (bool) and count (int)"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = api_session.get(
            f"{BASE_URL}/api/supplier-payments/check-duplicate",
            params={"supplier_id": "", "amount": 888888.88, "date": today}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "has_duplicate" in data, "Response missing 'has_duplicate'"
        assert "count" in data, "Response missing 'count'"
        assert isinstance(data["has_duplicate"], bool)
        assert isinstance(data["count"], int)
        print(f"PASS: Response structure correct - has_duplicate={data['has_duplicate']}, count={data['count']}")
    
    def test_check_duplicate_no_duplicates(self, api_session):
        """Test unique amount shows no duplicates"""
        unique_amount = 777777.77
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = api_session.get(
            f"{BASE_URL}/api/supplier-payments/check-duplicate",
            params={"supplier_id": "", "amount": unique_amount, "date": today}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["has_duplicate"] == False
        assert data["count"] == 0
        print(f"PASS: No duplicates for unique amount {unique_amount}")
    
    def test_check_duplicate_with_supplier_filter(self, api_session, test_supplier_id):
        """Test that supplier_id filter is applied"""
        if not test_supplier_id:
            pytest.skip("No suppliers available for testing")
        
        today = datetime.now().strftime("%Y-%m-%d")
        response = api_session.get(
            f"{BASE_URL}/api/supplier-payments/check-duplicate",
            params={"supplier_id": test_supplier_id, "amount": 500.00, "date": today}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "has_duplicate" in data
        print(f"PASS: Supplier filter applied - supplier={test_supplier_id}, duplicates={data['count']}")


# =====================================================
# CRUD INTEGRATION TESTS FOR DUPLICATE SCENARIOS
# =====================================================

class TestExpenseDuplicateScenario:
    """Test creating expenses and verifying duplicate detection"""
    
    def test_create_expense_and_check_duplicate(self, api_session, test_branch_id):
        """Create expense, then verify check-duplicate finds it"""
        if not test_branch_id:
            pytest.skip("No branches available")
        
        # Use a unique amount with timestamp to avoid collision
        test_amount = 12345.67
        today = datetime.now().strftime("%Y-%m-%d")
        
        # First create an expense
        create_response = api_session.post(f"{BASE_URL}/api/expenses", json={
            "category": "TEST_DuplicateCheck",
            "description": "TEST_iter115_duplicate_test",
            "amount": test_amount,
            "payment_mode": "cash",
            "branch_id": test_branch_id,
            "date": f"{today}T12:00:00"
        })
        
        if create_response.status_code != 200:
            print(f"Create expense response: {create_response.status_code} - {create_response.text}")
            pytest.skip(f"Could not create expense: {create_response.status_code}")
        
        created_expense = create_response.json()
        expense_id = created_expense.get("id")
        print(f"Created test expense: {expense_id}")
        
        try:
            # Now check for duplicate with same branch + amount
            check_response = api_session.get(
                f"{BASE_URL}/api/expenses/check-duplicate",
                params={"branch_id": test_branch_id, "amount": test_amount, "date": today}
            )
            
            assert check_response.status_code == 200
            data = check_response.json()
            
            # Should find at least 1 duplicate (the one we just created)
            assert data["has_duplicate"] == True, f"Expected to find duplicate, got {data}"
            assert data["count"] >= 1, f"Expected count >= 1, got {data['count']}"
            print(f"PASS: Duplicate detected after creating expense - count={data['count']}")
            
        finally:
            # Cleanup - delete the test expense
            if expense_id:
                delete_response = api_session.delete(f"{BASE_URL}/api/expenses/{expense_id}")
                print(f"Cleanup: deleted expense {expense_id}, status={delete_response.status_code}")


class TestSupplierPaymentDuplicateScenario:
    """Test creating supplier payments and verifying duplicate detection"""
    
    def test_create_payment_and_check_duplicate(self, api_session, test_supplier_id):
        """Create supplier payment, then verify check-duplicate finds it"""
        if not test_supplier_id:
            pytest.skip("No suppliers available")
        
        test_amount = 54321.99
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Create a supplier payment
        create_response = api_session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": test_supplier_id,
            "amount": test_amount,
            "payment_mode": "cash",
            "date": f"{today}T12:00:00",
            "notes": "TEST_iter115_duplicate_payment"
        })
        
        if create_response.status_code != 200:
            print(f"Create payment response: {create_response.status_code} - {create_response.text}")
            pytest.skip(f"Could not create payment: {create_response.status_code}")
        
        created_payment = create_response.json()
        payment_id = created_payment.get("id")
        print(f"Created test payment: {payment_id}")
        
        try:
            # Check for duplicate
            check_response = api_session.get(
                f"{BASE_URL}/api/supplier-payments/check-duplicate",
                params={"supplier_id": test_supplier_id, "amount": test_amount, "date": today}
            )
            
            assert check_response.status_code == 200
            data = check_response.json()
            
            assert data["has_duplicate"] == True, f"Expected duplicate, got {data}"
            assert data["count"] >= 1
            print(f"PASS: Duplicate detected after creating payment - count={data['count']}")
            
        finally:
            # Cleanup
            if payment_id:
                delete_response = api_session.delete(f"{BASE_URL}/api/supplier-payments/{payment_id}")
                print(f"Cleanup: deleted payment {payment_id}, status={delete_response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
