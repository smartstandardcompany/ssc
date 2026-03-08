"""
Test iteration 106: Daily Grouped Views + Pagination for Sales & Expenses
Features tested:
1. Sales API returns paginated data with {data, total, page, limit, pages}
2. Expenses API returns paginated data with {data, total, page, limit, pages}  
3. Sales API supports page and limit query parameters
4. Expenses API supports page and limit query parameters
5. Both APIs return correct total count and calculated pages
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSalesAndExpensesPagination:
    """Test pagination features for Sales and Expenses APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Authenticate and set up test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield

    # ===========================================
    # SALES API PAGINATION TESTS
    # ===========================================
    
    def test_sales_api_returns_paginated_structure(self):
        """Sales API returns {data, total, page, limit, pages}"""
        response = self.session.get(f"{BASE_URL}/api/sales?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required pagination fields
        assert "data" in data, "Missing 'data' field in response"
        assert "total" in data, "Missing 'total' field in response"
        assert "page" in data, "Missing 'page' field in response"
        assert "limit" in data, "Missing 'limit' field in response"
        assert "pages" in data, "Missing 'pages' field in response"
        
        # Verify data types
        assert isinstance(data["data"], list), "'data' should be a list"
        assert isinstance(data["total"], int), "'total' should be an integer"
        assert isinstance(data["page"], int), "'page' should be an integer"
        assert isinstance(data["limit"], int), "'limit' should be an integer"
        assert isinstance(data["pages"], int), "'pages' should be an integer"
    
    def test_sales_api_respects_page_parameter(self):
        """Sales API correctly handles page parameter"""
        # Get page 1
        response1 = self.session.get(f"{BASE_URL}/api/sales?page=1&limit=5")
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["page"] == 1
        assert data1["limit"] == 5
        
        # Get page 2 if there's more data
        if data1["pages"] >= 2:
            response2 = self.session.get(f"{BASE_URL}/api/sales?page=2&limit=5")
            assert response2.status_code == 200
            data2 = response2.json()
            assert data2["page"] == 2
            
            # Data should be different between pages
            if len(data1["data"]) > 0 and len(data2["data"]) > 0:
                assert data1["data"][0].get("id") != data2["data"][0].get("id"), "Page 1 and 2 should have different data"
    
    def test_sales_api_respects_limit_parameter(self):
        """Sales API correctly handles limit parameter"""
        # Request with limit=3
        response = self.session.get(f"{BASE_URL}/api/sales?page=1&limit=3")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["data"]) <= 3, "Should return at most 3 items"
        assert data["limit"] == 3
        
        # Request with limit=10
        response2 = self.session.get(f"{BASE_URL}/api/sales?page=1&limit=10")
        assert response2.status_code == 200
        data2 = response2.json()
        assert len(data2["data"]) <= 10, "Should return at most 10 items"
        assert data2["limit"] == 10
    
    def test_sales_api_calculates_pages_correctly(self):
        """Sales API correctly calculates total pages"""
        response = self.session.get(f"{BASE_URL}/api/sales?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        total = data["total"]
        limit = data["limit"]
        expected_pages = (total + limit - 1) // limit if total > 0 else 1
        
        assert data["pages"] == expected_pages, f"Expected {expected_pages} pages but got {data['pages']}"

    def test_sales_data_has_required_fields(self):
        """Sales data items have required fields for daily grouping"""
        response = self.session.get(f"{BASE_URL}/api/sales?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0:
            sale = data["data"][0]
            # Fields needed for daily grouping
            assert "date" in sale, "Sale missing 'date' field"
            assert "amount" in sale or "final_amount" in sale, "Sale missing amount field"
            assert "payment_details" in sale, "Sale missing 'payment_details' field"
            assert "branch_id" in sale, "Sale missing 'branch_id' field"

    # ===========================================
    # EXPENSES API PAGINATION TESTS
    # ===========================================
    
    def test_expenses_api_returns_paginated_structure(self):
        """Expenses API returns {data, total, page, limit, pages}"""
        response = self.session.get(f"{BASE_URL}/api/expenses?page=1&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required pagination fields
        assert "data" in data, "Missing 'data' field in response"
        assert "total" in data, "Missing 'total' field in response"
        assert "page" in data, "Missing 'page' field in response"
        assert "limit" in data, "Missing 'limit' field in response"
        assert "pages" in data, "Missing 'pages' field in response"
        
        # Verify data types
        assert isinstance(data["data"], list), "'data' should be a list"
        assert isinstance(data["total"], int), "'total' should be an integer"
        assert isinstance(data["page"], int), "'page' should be an integer"
        assert isinstance(data["limit"], int), "'limit' should be an integer"
        assert isinstance(data["pages"], int), "'pages' should be an integer"
    
    def test_expenses_api_respects_page_parameter(self):
        """Expenses API correctly handles page parameter"""
        # Get page 1
        response1 = self.session.get(f"{BASE_URL}/api/expenses?page=1&limit=5")
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["page"] == 1
        assert data1["limit"] == 5
        
        # Get page 2 if there's more data
        if data1["pages"] >= 2:
            response2 = self.session.get(f"{BASE_URL}/api/expenses?page=2&limit=5")
            assert response2.status_code == 200
            data2 = response2.json()
            assert data2["page"] == 2
            
            # Data should be different between pages
            if len(data1["data"]) > 0 and len(data2["data"]) > 0:
                assert data1["data"][0].get("id") != data2["data"][0].get("id"), "Page 1 and 2 should have different data"
    
    def test_expenses_api_respects_limit_parameter(self):
        """Expenses API correctly handles limit parameter"""
        # Request with limit=3
        response = self.session.get(f"{BASE_URL}/api/expenses?page=1&limit=3")
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["data"]) <= 3, "Should return at most 3 items"
        assert data["limit"] == 3
        
        # Request with limit=10
        response2 = self.session.get(f"{BASE_URL}/api/expenses?page=1&limit=10")
        assert response2.status_code == 200
        data2 = response2.json()
        assert len(data2["data"]) <= 10, "Should return at most 10 items"
        assert data2["limit"] == 10
    
    def test_expenses_api_calculates_pages_correctly(self):
        """Expenses API correctly calculates total pages"""
        response = self.session.get(f"{BASE_URL}/api/expenses?page=1&limit=10")
        assert response.status_code == 200
        data = response.json()
        
        total = data["total"]
        limit = data["limit"]
        expected_pages = (total + limit - 1) // limit if total > 0 else 1
        
        assert data["pages"] == expected_pages, f"Expected {expected_pages} pages but got {data['pages']}"

    def test_expenses_data_has_required_fields(self):
        """Expenses data items have required fields for daily grouping"""
        response = self.session.get(f"{BASE_URL}/api/expenses?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0:
            expense = data["data"][0]
            # Fields needed for daily grouping
            assert "date" in expense, "Expense missing 'date' field"
            assert "amount" in expense, "Expense missing 'amount' field"
            assert "payment_mode" in expense, "Expense missing 'payment_mode' field"
            assert "category" in expense, "Expense missing 'category' field"
            assert "branch_id" in expense, "Expense missing 'branch_id' field"

    # ===========================================
    # EDGE CASES
    # ===========================================
    
    def test_sales_api_default_pagination(self):
        """Sales API works without explicit pagination params (uses defaults)"""
        response = self.session.get(f"{BASE_URL}/api/sales")
        assert response.status_code == 200
        data = response.json()
        
        # Should still return pagination structure
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
    
    def test_expenses_api_default_pagination(self):
        """Expenses API works without explicit pagination params (uses defaults)"""
        response = self.session.get(f"{BASE_URL}/api/expenses")
        assert response.status_code == 200
        data = response.json()
        
        # Should still return pagination structure
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data

    def test_sales_api_page_beyond_total(self):
        """Sales API handles requesting page beyond total pages"""
        response = self.session.get(f"{BASE_URL}/api/sales?page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        
        # Request page way beyond total
        response2 = self.session.get(f"{BASE_URL}/api/sales?page=9999&limit=5")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Should return empty data array, not error
        assert isinstance(data2["data"], list)
    
    def test_expenses_api_page_beyond_total(self):
        """Expenses API handles requesting page beyond total pages"""
        response = self.session.get(f"{BASE_URL}/api/expenses?page=9999&limit=5")
        assert response.status_code == 200
        data = response.json()
        
        # Should return empty data array, not error
        assert isinstance(data["data"], list)
