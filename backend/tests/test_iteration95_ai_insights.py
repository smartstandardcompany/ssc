"""
Iteration 95 - Testing AI Insights, Customer Pagination, and Mobile Responsive improvements
Features tested:
1. AI Insights endpoints: /api/ai-insights/dashboard, /api/ai-insights/stock, /api/ai-insights/sales-trends
2. Customer pagination: GET /api/customers returns paginated format {data, total, page, limit, pages}
3. Frontend pages consuming customers: Sales, Invoices, POS, Customers pages
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture
def auth_headers(auth_token):
    """Headers with authentication token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestCustomerPagination:
    """Test customer pagination endpoint"""

    def test_customers_returns_paginated_format(self, auth_headers):
        """GET /api/customers should return paginated format with data, total, page, limit, pages"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify paginated format
        assert "data" in data, "Response should contain 'data' field"
        assert "total" in data, "Response should contain 'total' field"
        assert "page" in data, "Response should contain 'page' field"
        assert "limit" in data, "Response should contain 'limit' field"
        assert "pages" in data, "Response should contain 'pages' field"
        
        # Verify data types
        assert isinstance(data["data"], list), "data field should be a list"
        assert isinstance(data["total"], int), "total field should be an integer"
        assert isinstance(data["page"], int), "page field should be an integer"
        assert isinstance(data["limit"], int), "limit field should be an integer"
        assert isinstance(data["pages"], int), "pages field should be an integer"
        
        print(f"Customers endpoint returned paginated format with {data['total']} total customers")

    def test_customers_pagination_params(self, auth_headers):
        """Test pagination parameters work correctly"""
        # Test with page=1 and limit=10
        response = requests.get(f"{BASE_URL}/api/customers?page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10
        assert len(data["data"]) <= 10
        
        print(f"Pagination params work: page={data['page']}, limit={data['limit']}, returned {len(data['data'])} customers")

    def test_customers_balance_endpoint(self, auth_headers):
        """Test customers-balance endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/customers-balance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "customers-balance should return a list"
        print(f"Customers-balance endpoint returned {len(data)} customer balances")


class TestAIInsightsEndpoints:
    """Test AI Insights endpoints"""

    def test_dashboard_insights_endpoint(self, auth_headers):
        """GET /api/ai-insights/dashboard should return AI-generated business insights"""
        response = requests.get(f"{BASE_URL}/api/ai-insights/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check response structure
        assert "insight" in data, "Response should contain 'insight' field"
        assert "metrics" in data, "Response should contain 'metrics' field"
        
        # Check metrics structure
        metrics = data["metrics"]
        expected_metric_fields = ["this_week_revenue", "last_week_revenue", "growth_pct", "expenses", "profit", "outstanding_credit"]
        for field in expected_metric_fields:
            assert field in metrics, f"Metrics should contain '{field}' field"
        
        print(f"Dashboard insights returned: {data['insight'][:100]}...")
        print(f"Metrics: revenue={metrics['this_week_revenue']}, growth={metrics['growth_pct']}%")

    def test_stock_insights_endpoint(self, auth_headers):
        """GET /api/ai-insights/stock should return AI stock analysis"""
        response = requests.get(f"{BASE_URL}/api/ai-insights/stock", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check response structure
        assert "insight" in data, "Response should contain 'insight' field"
        assert "critical_count" in data, "Response should contain 'critical_count' field"
        assert "total_items" in data, "Response should contain 'total_items' field"
        
        print(f"Stock insights: critical_count={data['critical_count']}, total_items={data['total_items']}")
        print(f"Insight: {data['insight'][:100]}...")

    def test_sales_trends_insights_endpoint(self, auth_headers):
        """GET /api/ai-insights/sales-trends should return AI sales trend analysis"""
        response = requests.get(f"{BASE_URL}/api/ai-insights/sales-trends", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check response structure
        assert "insight" in data, "Response should contain 'insight' field"
        assert "period" in data, "Response should contain 'period' field"
        
        assert data["period"] == "30 days", f"Period should be '30 days', got {data['period']}"
        
        print(f"Sales trends: period={data['period']}")
        print(f"Insight: {data['insight'][:100]}...")

    def test_ai_insights_require_authentication(self):
        """AI insights endpoints should require authentication"""
        endpoints = [
            "/api/ai-insights/dashboard",
            "/api/ai-insights/stock",
            "/api/ai-insights/sales-trends"
        ]
        for endpoint in endpoints:
            response = requests.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], f"{endpoint} should require auth, got {response.status_code}"
        print("All AI insights endpoints correctly require authentication")


class TestPagesWithCustomerData:
    """Test pages that consume customer data work with new pagination format"""

    def test_sales_endpoint(self, auth_headers):
        """Sales endpoint should work"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200, f"Sales endpoint failed: {response.status_code}"
        data = response.json()
        # Sales can return either list or paginated format
        if isinstance(data, dict) and "data" in data:
            print(f"Sales endpoint returned paginated format with {len(data['data'])} sales")
        else:
            print(f"Sales endpoint returned {len(data)} sales")

    def test_invoices_endpoint(self, auth_headers):
        """Invoices endpoint should work with pagination"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200, f"Invoices endpoint failed: {response.status_code}"
        data = response.json()
        # Check if paginated format
        if isinstance(data, dict) and "data" in data:
            print(f"Invoices endpoint returned paginated format with {data['total']} total invoices")
        else:
            print(f"Invoices endpoint returned {len(data)} invoices")

    def test_platforms_endpoint(self, auth_headers):
        """Platforms endpoint should work (for POS page)"""
        response = requests.get(f"{BASE_URL}/api/platforms", headers=auth_headers)
        assert response.status_code == 200, f"Platforms endpoint failed: {response.status_code}"
        data = response.json()
        print(f"Platforms endpoint returned {len(data)} platforms")


class TestActivityLogs:
    """Test Activity Logs endpoint for responsive columns"""

    def test_activity_logs_endpoint(self, auth_headers):
        """Activity logs endpoint should work"""
        response = requests.get(f"{BASE_URL}/api/activity-logs?limit=10", headers=auth_headers)
        assert response.status_code == 200, f"Activity logs failed: {response.status_code}"
        data = response.json()
        assert "logs" in data, "Response should contain 'logs' field"
        assert "total" in data, "Response should contain 'total' field"
        
        # Check log entry structure
        if len(data["logs"]) > 0:
            log = data["logs"][0]
            expected_fields = ["id", "timestamp", "user_email", "action", "resource"]
            for field in expected_fields:
                assert field in log, f"Log entry should contain '{field}' field"
        
        print(f"Activity logs endpoint returned {len(data['logs'])} logs out of {data['total']} total")


class TestDashboardEndpoint:
    """Test dashboard endpoint works (for AI Insights widget)"""

    def test_dashboard_stats(self, auth_headers):
        """Dashboard stats endpoint should work"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.status_code}"
        data = response.json()
        
        expected_fields = ["total_sales", "total_expenses", "net_profit"]
        for field in expected_fields:
            assert field in data, f"Dashboard stats should contain '{field}' field"
        
        print(f"Dashboard stats: sales={data['total_sales']}, expenses={data['total_expenses']}, profit={data['net_profit']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
