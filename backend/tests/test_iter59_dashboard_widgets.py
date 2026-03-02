"""
Test iteration 59 - Dashboard AI Predictive Widgets, Order Status, HR Portal, Mobile POS
Tests cover:
1. Dashboard predictive widgets API endpoints
2. Order Status Page API endpoint
3. HR Employee Portal functionality
4. Leave Approvals functionality
5. Cashier POS endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from requirements
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
CASHIER_PIN = "1234"


def get_auth_token():
    """Helper to get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        # API returns access_token, not token
        return data.get("access_token") or data.get("token")
    return None


def get_auth_headers():
    """Helper to get auth headers"""
    token = get_auth_token()
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}


class TestAuthentication:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data or "token" in data, f"No token in response: {data}"
        print("PASS: Admin login successful")


class TestPredictiveAnalyticsWidgets:
    """Test AI Predictive Analytics API endpoints for dashboard widgets"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        headers = get_auth_headers()
        if not headers:
            pytest.skip("Authentication failed")
        return headers
    
    def test_inventory_demand_forecast(self, auth_headers):
        """Test AI: Low Stock Alerts widget endpoint"""
        response = requests.get(f"{BASE_URL}/api/predictions/inventory-demand", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "items_at_risk" in data
        assert "items" in data or "forecasts" in data
        print(f"PASS: Inventory demand - Items at risk: {data.get('items_at_risk', 0)}")
    
    def test_peak_hours_analysis(self, auth_headers):
        """Test AI: Peak Hours widget endpoint"""
        response = requests.get(f"{BASE_URL}/api/predictions/peak-hours", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "peak_hours" in data
        assert "total_transactions_analyzed" in data
        print(f"PASS: Peak hours - Transactions analyzed: {data.get('total_transactions_analyzed', 0)}")
    
    def test_customer_clv(self, auth_headers):
        """Test AI: Customer CLV widget endpoint"""
        response = requests.get(f"{BASE_URL}/api/predictions/customer-clv", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Check response has expected fields
        assert "customers" in data or "high_value_customers" in data
        assert "total_projected_revenue" in data
        print(f"PASS: Customer CLV - Projected revenue: {data.get('total_projected_revenue', 0)}")
    
    def test_profit_decomposition(self, auth_headers):
        """Test AI: Profit Analysis widget endpoint"""
        response = requests.get(f"{BASE_URL}/api/predictions/profit-decomposition", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "summary" in data
        assert "daily_breakdown" in data or "daily" in data
        summary = data.get("summary", {})
        print(f"PASS: Profit decomposition - Trend: {summary.get('profit_trend', 'N/A')}")


class TestOrderStatusPage:
    """Test Order Status Display endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        headers = get_auth_headers()
        if not headers:
            pytest.skip("Authentication failed")
        return headers
    
    def test_active_orders_endpoint(self, auth_headers):
        """Test /order-status/active endpoint for customer order display"""
        response = requests.get(f"{BASE_URL}/api/order-status/active", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Should have preparing and ready lists
        assert "preparing" in data or isinstance(data, list)
        assert "ready" in data or isinstance(data, list)
        print(f"PASS: Order status - Preparing: {len(data.get('preparing', []))}, Ready: {len(data.get('ready', []))}")


class TestHREmployeePortal:
    """Test HR Employee Portal endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        headers = get_auth_headers()
        if not headers:
            pytest.skip("Authentication failed")
        return headers
    
    def test_employees_list(self, auth_headers):
        """Test employees list endpoint"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Employees list - Count: {len(data)}")
    
    def test_pending_salary_summary(self, auth_headers):
        """Test pending salary summary endpoint"""
        response = requests.get(f"{BASE_URL}/api/employees/pending-summary", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, dict)
        print(f"PASS: Pending salary summary loaded")


class TestCashierPOS:
    """Test Cashier POS endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        headers = get_auth_headers()
        if not headers:
            pytest.skip("Authentication failed")
        return headers
    
    def test_cashier_categories(self, auth_headers):
        """Test cashier categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/cashier/categories", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Cashier categories - Count: {len(data)}")
    
    def test_cashier_menu(self, auth_headers):
        """Test cashier menu endpoint"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Cashier menu items - Count: {len(data)}")
    
    def test_cashier_customers(self, auth_headers):
        """Test cashier customers endpoint"""
        response = requests.get(f"{BASE_URL}/api/cashier/customers", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"PASS: Cashier customers - Count: {len(data)}")
    
    def test_cashier_stats(self, auth_headers):
        """Test cashier stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/cashier/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, dict)
        print(f"PASS: Cashier stats loaded")


class TestDashboardStats:
    """Test Dashboard stats endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        headers = get_auth_headers()
        if not headers:
            pytest.skip("Authentication failed")
        return headers
    
    def test_dashboard_stats(self, auth_headers):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, dict)
        print(f"PASS: Dashboard stats loaded")
    
    def test_dashboard_layout(self, auth_headers):
        """Test dashboard layout preferences endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/layout", headers=auth_headers)
        # May return 200 or 404 if no saved layout
        assert response.status_code in [200, 404], f"Failed: {response.text}"
        print(f"PASS: Dashboard layout endpoint accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
