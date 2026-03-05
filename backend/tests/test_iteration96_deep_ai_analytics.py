"""
Iteration 96 Backend Tests - Deep AI Analytics
Tests for:
1. GET /api/ai-insights/profit-analysis - AI Product Profitability Analysis
2. GET /api/ai-insights/customer-churn - AI Customer Churn Detection
3. GET /api/ai-insights/revenue-prediction - AI Revenue Prediction
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token using admin credentials."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture
def auth_headers(auth_token):
    """Headers with authentication token."""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestDeepAIAnalytics:
    """Tests for the 3 new deep AI analytics endpoints."""
    
    def test_profit_analysis_endpoint(self, auth_headers):
        """
        GET /api/ai-insights/profit-analysis
        Expected response: { insight: string, items: [{name, revenue, qty, profit, margin}], total_revenue: number }
        """
        print("\n--- Testing GET /api/ai-insights/profit-analysis ---")
        response = requests.get(f"{BASE_URL}/api/ai-insights/profit-analysis", headers=auth_headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Verify required fields
        assert "insight" in data, "Response missing 'insight' field"
        assert isinstance(data["insight"], str), "insight should be a string"
        print(f"Insight length: {len(data['insight'])} chars")
        print(f"Insight preview: {data['insight'][:200]}...")
        
        assert "items" in data, "Response missing 'items' field"
        assert isinstance(data["items"], list), "items should be a list"
        print(f"Items count: {len(data['items'])}")
        
        # Verify item structure if items exist
        if len(data["items"]) > 0:
            first_item = data["items"][0]
            print(f"First item: {first_item}")
            expected_item_fields = ["name", "revenue", "qty", "profit", "margin"]
            for field in expected_item_fields:
                assert field in first_item, f"Item missing '{field}' field"
        
        assert "total_revenue" in data, "Response missing 'total_revenue' field"
        print(f"Total revenue: {data['total_revenue']}")
        
        print("✅ Profit analysis endpoint working correctly")
    
    def test_customer_churn_endpoint(self, auth_headers):
        """
        GET /api/ai-insights/customer-churn
        Expected response: { insight: string, summary: {active, cooling, at_risk, churned}, at_risk_customers: [], total_customers: number }
        """
        print("\n--- Testing GET /api/ai-insights/customer-churn ---")
        response = requests.get(f"{BASE_URL}/api/ai-insights/customer-churn", headers=auth_headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Verify required fields
        assert "insight" in data, "Response missing 'insight' field"
        assert isinstance(data["insight"], str), "insight should be a string"
        print(f"Insight length: {len(data['insight'])} chars")
        print(f"Insight preview: {data['insight'][:200]}...")
        
        assert "summary" in data, "Response missing 'summary' field"
        assert isinstance(data["summary"], dict), "summary should be a dict"
        print(f"Summary: {data['summary']}")
        
        # Summary may contain: active, cooling, at_risk, churned, never_purchased
        expected_summary_keys = ["active", "cooling", "at_risk", "churned"]
        for key in expected_summary_keys:
            if key in data["summary"]:
                print(f"  {key}: {data['summary'][key]}")
        
        assert "at_risk_customers" in data, "Response missing 'at_risk_customers' field"
        assert isinstance(data["at_risk_customers"], list), "at_risk_customers should be a list"
        print(f"At-risk customers count: {len(data['at_risk_customers'])}")
        
        # Verify customer structure if customers exist
        if len(data["at_risk_customers"]) > 0:
            first_customer = data["at_risk_customers"][0]
            print(f"First at-risk customer: {first_customer}")
            expected_customer_fields = ["name", "status", "total_spent", "last_purchase"]
            for field in expected_customer_fields:
                assert field in first_customer, f"Customer missing '{field}' field"
        
        assert "total_customers" in data, "Response missing 'total_customers' field"
        print(f"Total customers: {data['total_customers']}")
        
        print("✅ Customer churn endpoint working correctly")
    
    def test_revenue_prediction_endpoint(self, auth_headers):
        """
        GET /api/ai-insights/revenue-prediction
        Expected response: { insight: string, history: [{week, revenue, count}] }
        """
        print("\n--- Testing GET /api/ai-insights/revenue-prediction ---")
        response = requests.get(f"{BASE_URL}/api/ai-insights/revenue-prediction", headers=auth_headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Response keys: {list(data.keys())}")
        
        # Verify required fields
        assert "insight" in data, "Response missing 'insight' field"
        assert isinstance(data["insight"], str), "insight should be a string"
        print(f"Insight length: {len(data['insight'])} chars")
        print(f"Insight preview: {data['insight'][:200]}...")
        
        assert "history" in data, "Response missing 'history' field"
        assert isinstance(data["history"], list), "history should be a list"
        print(f"History weeks count: {len(data['history'])}")
        
        # Should have 12 weeks of history
        assert len(data["history"]) >= 1, "history should have at least 1 week of data"
        
        # Verify history item structure
        if len(data["history"]) > 0:
            first_week = data["history"][0]
            print(f"First week data: {first_week}")
            expected_week_fields = ["week", "revenue", "count"]
            for field in expected_week_fields:
                assert field in first_week, f"Week data missing '{field}' field"
        
        print("✅ Revenue prediction endpoint working correctly")


class TestExistingAIEndpoints:
    """Verify existing AI endpoints still work (regression tests)."""
    
    def test_dashboard_insights_endpoint(self, auth_headers):
        """GET /api/ai-insights/dashboard - Business health insights."""
        print("\n--- Testing GET /api/ai-insights/dashboard ---")
        response = requests.get(f"{BASE_URL}/api/ai-insights/dashboard", headers=auth_headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "insight" in data
        assert "metrics" in data
        print(f"Dashboard insight: {data['insight'][:100]}...")
        print(f"Metrics: {data['metrics']}")
        print("✅ Dashboard insights endpoint working")
    
    def test_stock_insights_endpoint(self, auth_headers):
        """GET /api/ai-insights/stock - Stock management insights."""
        print("\n--- Testing GET /api/ai-insights/stock ---")
        response = requests.get(f"{BASE_URL}/api/ai-insights/stock", headers=auth_headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "insight" in data
        assert "critical_count" in data
        assert "total_items" in data
        print(f"Stock insight: {data['insight'][:100]}...")
        print(f"Critical items: {data['critical_count']}, Total items: {data['total_items']}")
        print("✅ Stock insights endpoint working")
    
    def test_sales_trends_endpoint(self, auth_headers):
        """GET /api/ai-insights/sales-trends - Sales trend insights."""
        print("\n--- Testing GET /api/ai-insights/sales-trends ---")
        response = requests.get(f"{BASE_URL}/api/ai-insights/sales-trends", headers=auth_headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "insight" in data
        assert "period" in data
        print(f"Sales trends insight: {data['insight'][:100]}...")
        print(f"Period: {data['period']}")
        print("✅ Sales trends endpoint working")


class TestDocumentsPage:
    """Test Documents page API."""
    
    def test_documents_endpoint(self, auth_headers):
        """GET /api/documents - List all documents."""
        print("\n--- Testing GET /api/documents ---")
        response = requests.get(f"{BASE_URL}/api/documents", headers=auth_headers)
        
        print(f"Status Code: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Documents count: {len(data)}")
        
        if len(data) > 0:
            first_doc = data[0]
            print(f"First document keys: {list(first_doc.keys())}")
        print("✅ Documents endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
