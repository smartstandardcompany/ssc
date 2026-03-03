"""
Iteration 75 Tests - SSC Track ERP
Tests for:
1. Share statement endpoint POST /api/suppliers/{id}/share-statement
2. Sales API pagination: GET /api/sales?page=1&limit=5
3. Expenses API pagination: GET /api/expenses?page=1&limit=5
4. Zustand auth store integration (login flow)
"""

import pytest
import requests
import os

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
    assert "user" in data, "No user in login response"
    return data["access_token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestLoginAndZustandIntegration:
    """Test login endpoint returns correct structure for Zustand auth store"""
    
    def test_login_returns_correct_structure(self):
        """Login response should have access_token and user for Zustand store"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert res.status_code == 200
        data = res.json()
        
        # Zustand auth store expects these fields
        assert "access_token" in data, "Missing access_token for Zustand auth store"
        assert "user" in data, "Missing user object for Zustand auth store"
        assert isinstance(data["user"], dict), "user should be a dict"
        
        # User object should have required fields
        user = data["user"]
        assert "id" in user, "User should have id"
        assert "email" in user, "User should have email"
        assert "name" in user, "User should have name"
        assert "role" in user, "User should have role"
        
    def test_login_invalid_credentials(self):
        """Invalid credentials should return 401"""
        res = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert res.status_code == 401 or res.status_code == 400


class TestSalesPagination:
    """Test paginated GET /api/sales endpoint"""
    
    def test_sales_default_pagination(self, headers):
        """Sales endpoint returns paginated structure"""
        res = requests.get(f"{BASE_URL}/api/sales", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        # Should have paginated response structure
        assert "data" in data, "Paginated response should have 'data' field"
        assert "total" in data, "Paginated response should have 'total' field"
        assert "page" in data, "Paginated response should have 'page' field"
        assert "limit" in data, "Paginated response should have 'limit' field"
        assert "pages" in data, "Paginated response should have 'pages' field"
        
        assert isinstance(data["data"], list), "'data' should be a list"
        assert isinstance(data["total"], int), "'total' should be an int"
        assert data["page"] == 1, "Default page should be 1"
        assert data["limit"] == 100, "Default limit should be 100"
        
    def test_sales_custom_pagination(self, headers):
        """Sales endpoint respects page and limit params"""
        res = requests.get(f"{BASE_URL}/api/sales?page=1&limit=5", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert data["page"] == 1
        assert data["limit"] == 5
        assert "pages" in data
        assert len(data["data"]) <= 5, "Should return at most 5 items"
        
    def test_sales_page_2(self, headers):
        """Test pagination page 2"""
        res = requests.get(f"{BASE_URL}/api/sales?page=2&limit=5", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert data["page"] == 2
        assert data["limit"] == 5
        
    def test_sales_date_filter_with_pagination(self, headers):
        """Sales endpoint with date filters and pagination"""
        res = requests.get(f"{BASE_URL}/api/sales?page=1&limit=10&start_date=2024-01-01&end_date=2025-12-31", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert "data" in data
        assert "total" in data


class TestExpensesPagination:
    """Test paginated GET /api/expenses endpoint"""
    
    def test_expenses_default_pagination(self, headers):
        """Expenses endpoint returns paginated structure"""
        res = requests.get(f"{BASE_URL}/api/expenses", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        # Should have paginated response structure
        assert "data" in data, "Paginated response should have 'data' field"
        assert "total" in data, "Paginated response should have 'total' field"
        assert "page" in data, "Paginated response should have 'page' field"
        assert "limit" in data, "Paginated response should have 'limit' field"
        assert "pages" in data, "Paginated response should have 'pages' field"
        
        assert isinstance(data["data"], list), "'data' should be a list"
        assert data["page"] == 1, "Default page should be 1"
        assert data["limit"] == 100, "Default limit should be 100"
        
    def test_expenses_custom_pagination(self, headers):
        """Expenses endpoint respects page and limit params"""
        res = requests.get(f"{BASE_URL}/api/expenses?page=1&limit=5", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert data["page"] == 1
        assert data["limit"] == 5
        assert len(data["data"]) <= 5
        
    def test_expenses_date_filter_with_pagination(self, headers):
        """Expenses endpoint with date filters and pagination"""
        res = requests.get(f"{BASE_URL}/api/expenses?page=1&limit=10&start_date=2024-01-01&end_date=2025-12-31", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert "data" in data
        assert "total" in data


class TestSupplierShareStatement:
    """Test supplier statement sharing endpoint"""
    
    def test_share_statement_requires_channel(self, headers):
        """Share statement should require at least one channel"""
        # First get a supplier
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert res.status_code == 200
        suppliers = res.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers available for testing")
            
        supplier_id = suppliers[0]["id"]
        
        # Test with empty channels
        res = requests.post(f"{BASE_URL}/api/suppliers/{supplier_id}/share-statement", 
            headers=headers, json={"channels": []})
        assert res.status_code == 400
        
    def test_share_statement_email_channel(self, headers):
        """Share statement via email channel"""
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert res.status_code == 200
        suppliers = res.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers available for testing")
            
        supplier_id = suppliers[0]["id"]
        supplier_email = suppliers[0].get("email", "test@example.com")
        
        # Test email channel (will likely fail without SMTP config, but endpoint should work)
        res = requests.post(f"{BASE_URL}/api/suppliers/{supplier_id}/share-statement", 
            headers=headers, json={
                "channels": ["email"],
                "email": supplier_email
            })
        assert res.status_code == 200
        data = res.json()
        
        assert "results" in data
        assert "email" in data["results"]
        # Email may succeed or fail depending on config, but structure should be correct
        
    def test_share_statement_whatsapp_channel(self, headers):
        """Share statement via WhatsApp channel"""
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert res.status_code == 200
        suppliers = res.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers available for testing")
            
        supplier_id = suppliers[0]["id"]
        
        # Test whatsapp channel (will likely fail without Twilio config)
        res = requests.post(f"{BASE_URL}/api/suppliers/{supplier_id}/share-statement", 
            headers=headers, json={
                "channels": ["whatsapp"],
                "phone": "+966512345678"
            })
        assert res.status_code == 200
        data = res.json()
        
        assert "results" in data
        assert "whatsapp" in data["results"]
        
    def test_share_statement_both_channels(self, headers):
        """Share statement via both email and WhatsApp channels"""
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert res.status_code == 200
        suppliers = res.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers available for testing")
            
        supplier_id = suppliers[0]["id"]
        
        res = requests.post(f"{BASE_URL}/api/suppliers/{supplier_id}/share-statement", 
            headers=headers, json={
                "channels": ["email", "whatsapp"],
                "email": "test@example.com",
                "phone": "+966512345678"
            })
        assert res.status_code == 200
        data = res.json()
        
        assert "results" in data
        assert "email" in data["results"]
        assert "whatsapp" in data["results"]
        assert "supplier" in data


class TestDashboardStatsOnlineSales:
    """Test dashboard stats endpoint returns online_sales"""
    
    def test_dashboard_stats_has_online_sales(self, headers):
        """Dashboard stats should include online_sales field"""
        res = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert "online_sales" in data, "Dashboard stats should have 'online_sales' field"
        assert isinstance(data["online_sales"], (int, float)), "online_sales should be a number"


class TestSupplierLedger:
    """Test supplier ledger endpoint for Add Bill dialog context"""
    
    def test_supplier_ledger_returns_data(self, headers):
        """Supplier ledger should return proper structure"""
        res = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert res.status_code == 200
        suppliers = res.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers available")
            
        supplier_id = suppliers[0]["id"]
        
        res = requests.get(f"{BASE_URL}/api/suppliers/{supplier_id}/ledger", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert "supplier" in data
        assert "summary" in data
        assert "entries" in data
        assert isinstance(data["entries"], list)


class TestBranches:
    """Test branches endpoint for Add Bill dialog branch selector"""
    
    def test_branches_list(self, headers):
        """Branches endpoint should return list of branches"""
        res = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert isinstance(data, list), "Branches should be a list"
        if len(data) > 0:
            branch = data[0]
            assert "id" in branch
            assert "name" in branch


class TestSupplierNames:
    """Test supplier names endpoint for Add Bill dialog supplier selector"""
    
    def test_supplier_names(self, headers):
        """Supplier names endpoint should return id and name for dropdowns"""
        res = requests.get(f"{BASE_URL}/api/suppliers/names", headers=headers)
        assert res.status_code == 200
        data = res.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            supplier = data[0]
            assert "id" in supplier
            assert "name" in supplier
