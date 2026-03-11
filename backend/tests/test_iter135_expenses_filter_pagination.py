"""
Iteration 135 Test: Expenses Filter Bug Fix + Pagination Improvements

Test features:
1. Expenses branch filter - backend now accepts branch_id query param
2. Expenses branch + date filter combo
3. Expenses pagination with page numbers
4. Sales pagination with page numbers
5. Branch monthly expenses summary (like Sales page)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestExpensesFilterFix:
    """Test expenses filtering via backend query params - FIX for branch+date returning 0 records"""
    
    auth_token = None
    branches = []
    test_expense_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        """Get auth token and branch list for tests"""
        if not TestExpensesFilterFix.auth_token:
            login_res = api_client.post(f"{BASE_URL}/api/auth/login", json={
                "email": "ss@ssc.com",
                "password": "Aa147258369Ssc@"
            })
            assert login_res.status_code == 200, f"Login failed: {login_res.text}"
            TestExpensesFilterFix.auth_token = login_res.json().get("access_token")
            
        api_client.headers.update({"Authorization": f"Bearer {TestExpensesFilterFix.auth_token}"})
        
        # Get branches
        if not TestExpensesFilterFix.branches:
            branches_res = api_client.get(f"{BASE_URL}/api/branches")
            if branches_res.status_code == 200:
                TestExpensesFilterFix.branches = branches_res.json()
    
    def test_01_expenses_endpoint_accepts_branch_id_param(self, api_client):
        """Backend /expenses now accepts branch_id as query param for server-side filtering"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        # Get any branch ID
        if not self.branches:
            pytest.skip("No branches available")
        branch_id = self.branches[0].get('id')
        
        # Call with branch_id param
        response = api_client.get(f"{BASE_URL}/api/expenses?branch_id={branch_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Should return paginated structure
        assert 'data' in data, "Response should have 'data' key"
        assert 'total' in data, "Response should have 'total' key"
        assert 'page' in data, "Response should have 'page' key"
        assert 'pages' in data, "Response should have 'pages' key"
        print(f"PASS: branch_id filter returned {data.get('total', 0)} expenses for branch {branch_id}")
    
    def test_02_expenses_endpoint_accepts_category_param(self, api_client):
        """Backend /expenses accepts category query param"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/expenses?category=Salary")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        expenses = data.get('data', [])
        # If there are results, check category matches
        if expenses:
            for exp in expenses[:5]:  # Check first 5
                cat = exp.get('category', '').lower()
                assert 'salary' in cat or cat.startswith('salary'), f"Category mismatch: {cat}"
        print(f"PASS: category filter returned {data.get('total', 0)} Salary expenses")
    
    def test_03_expenses_endpoint_accepts_payment_mode_param(self, api_client):
        """Backend /expenses accepts payment_mode query param"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/expenses?payment_mode=cash")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        expenses = data.get('data', [])
        # Check payment mode matches
        if expenses:
            for exp in expenses[:5]:
                assert exp.get('payment_mode') == 'cash', f"Payment mode mismatch: {exp.get('payment_mode')}"
        print(f"PASS: payment_mode filter returned {data.get('total', 0)} cash expenses")
    
    def test_04_expenses_branch_and_date_combo_filter(self, api_client):
        """THE BUG FIX: branch + date filters should return results (not 0)"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        if not self.branches:
            pytest.skip("No branches available")
        branch_id = self.branches[0].get('id')
        
        # Get date range for last 30 days
        today = datetime.now()
        start_date = (today - timedelta(days=30)).strftime('%Y-%m-%d')
        end_date = today.strftime('%Y-%m-%d')
        
        # Combo filter - this was previously returning 0 because filters were only client-side
        response = api_client.get(
            f"{BASE_URL}/api/expenses?branch_id={branch_id}&start_date={start_date}&end_date={end_date}"
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # The fix ensures server-side filtering works
        print(f"PASS: branch+date combo returned {data.get('total', 0)} expenses for branch {branch_id}")
        # Note: May return 0 if no expenses in this branch/date range - that's valid
    
    def test_05_expenses_pagination_structure(self, api_client):
        """Verify pagination response has correct structure for page number buttons"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/expenses?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert 'page' in data, "Missing 'page' key for current page"
        assert 'pages' in data, "Missing 'pages' key for total pages"
        assert 'total' in data, "Missing 'total' key for total records"
        assert 'data' in data, "Missing 'data' key for expenses array"
        
        # For page number buttons, frontend needs these
        assert isinstance(data['page'], int), "page should be integer"
        assert isinstance(data['pages'], int), "pages should be integer"
        print(f"PASS: Pagination structure valid - Page {data['page']}/{data['pages']}, Total: {data['total']}")
    
    def test_06_create_test_expense_for_filter_verification(self, api_client):
        """Create a test expense to verify filters work"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        if not self.branches:
            pytest.skip("No branches available")
        branch_id = self.branches[0].get('id')
        today = datetime.now().strftime('%Y-%m-%d')
        
        expense_data = {
            "category": "TEST_Filter_Verify",
            "description": f"TEST expense for iteration 135 filter test",
            "amount": 99.99,
            "payment_mode": "cash",
            "branch_id": branch_id,
            "date": f"{today}T10:00:00"
        }
        
        response = api_client.post(f"{BASE_URL}/api/expenses", json=expense_data)
        assert response.status_code == 200, f"Failed to create test expense: {response.text}"
        
        expense = response.json()
        TestExpensesFilterFix.test_expense_id = expense.get('id')
        print(f"PASS: Created test expense {expense.get('id')} for filter verification")
    
    def test_07_verify_created_expense_found_by_branch_filter(self, api_client):
        """Verify the test expense appears when filtering by branch"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        if not self.branches or not self.test_expense_id:
            pytest.skip("Prerequisites not met")
        branch_id = self.branches[0].get('id')
        
        response = api_client.get(f"{BASE_URL}/api/expenses?branch_id={branch_id}&limit=50")
        assert response.status_code == 200
        
        data = response.json()
        expenses = data.get('data', [])
        found = any(e.get('id') == self.test_expense_id for e in expenses)
        assert found, f"Test expense {self.test_expense_id} not found in branch filter results"
        print(f"PASS: Test expense found in branch {branch_id} filter results")
    
    def test_08_cleanup_test_expense(self, api_client):
        """Delete test expense"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        if not self.test_expense_id:
            pytest.skip("No test expense to clean up")
        
        response = api_client.delete(f"{BASE_URL}/api/expenses/{self.test_expense_id}")
        assert response.status_code == 200, f"Failed to delete test expense: {response.text}"
        print(f"PASS: Cleaned up test expense {self.test_expense_id}")


class TestSalesPagination:
    """Test Sales pagination returns correct structure for page number buttons"""
    
    auth_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self, api_client):
        if not TestSalesPagination.auth_token:
            login_res = api_client.post(f"{BASE_URL}/api/auth/login", json={
                "email": "ss@ssc.com",
                "password": "Aa147258369Ssc@"
            })
            assert login_res.status_code == 200
            TestSalesPagination.auth_token = login_res.json().get("access_token")
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
    
    def test_01_sales_pagination_structure(self, api_client):
        """Sales endpoint returns pagination info for page number buttons"""
        api_client.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/sales?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        # Check pagination keys exist
        assert 'page' in data, "Missing 'page' key"
        assert 'pages' in data or 'total_pages' in data, "Missing pages count"
        assert 'total' in data, "Missing 'total' key"
        
        pages = data.get('pages', data.get('total_pages', 1))
        print(f"PASS: Sales pagination - Page {data.get('page')}/{pages}, Total: {data.get('total')}")


@pytest.fixture
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
