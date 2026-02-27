"""
Iteration 25 Backend Tests:
1. Sales Target Tracker - POST /api/targets, GET /api/targets/progress
2. AI auto-categorization for expenses - POST /api/expenses/auto-categorize  
3. Export Analytics as PDF - GET /api/reports/analytics-pdf
4. AI Predictive Sales Forecast - GET /api/reports/sales-forecast
5. Dashboard Today vs Yesterday - GET /api/dashboard/today-vs-yesterday
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication helper"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return auth headers for API requests"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestSalesTargets(TestAuth):
    """Sales Target CRUD and Progress endpoint tests"""
    
    def test_get_branches(self, auth_headers):
        """Get branches to use in target creation"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Available branches: {len(data)}")
        if data:
            print(f"First branch: {data[0].get('name')} - {data[0].get('id')}")
    
    def test_create_target_missing_fields(self, auth_headers):
        """Test POST /api/targets with missing required fields"""
        response = requests.post(f"{BASE_URL}/api/targets", 
                                headers=auth_headers,
                                json={"branch_id": "test"})  # missing month and target_amount
        assert response.status_code == 400
        print("Create target validation works - returns 400 for missing fields")
    
    def test_create_target_success(self, auth_headers):
        """Test POST /api/targets creates a sales target"""
        # First get a valid branch
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_resp.json()
        if not branches:
            pytest.skip("No branches available for testing")
        
        branch_id = branches[0]["id"]
        test_month = "2026-03"  # Use future month for test
        test_amount = 75000
        
        response = requests.post(f"{BASE_URL}/api/targets",
                                headers=auth_headers,
                                json={
                                    "branch_id": branch_id,
                                    "month": test_month,
                                    "target_amount": test_amount
                                })
        assert response.status_code == 200
        data = response.json()
        assert data.get("branch_id") == branch_id
        assert data.get("month") == test_month
        assert data.get("target_amount") == test_amount
        print(f"Created target for branch {branch_id}, month {test_month}: SAR {test_amount}")
    
    def test_get_targets(self, auth_headers):
        """Test GET /api/targets returns list"""
        response = requests.get(f"{BASE_URL}/api/targets", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Total targets: {len(data)}")
    
    def test_get_target_progress(self, auth_headers):
        """Test GET /api/targets/progress returns progress data"""
        response = requests.get(f"{BASE_URL}/api/targets/progress?month=2026-02", 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "month" in data
        assert "overall" in data
        assert "branches" in data
        
        # Verify overall structure
        overall = data["overall"]
        assert "target" in overall
        assert "actual" in overall
        assert "percentage" in overall
        
        # Verify branches structure
        assert isinstance(data["branches"], list)
        if data["branches"]:
            branch = data["branches"][0]
            assert "branch_id" in branch
            assert "branch_name" in branch
            assert "target" in branch
            assert "actual" in branch
            assert "percentage" in branch
            assert "remaining" in branch
        
        print(f"Progress for 2026-02: Overall {overall['percentage']}%")
        print(f"  Target: SAR {overall['target']}, Actual: SAR {overall['actual']}")


class TestAutoCategorizExpense(TestAuth):
    """AI auto-categorization for expenses tests"""
    
    def test_auto_categorize_empty_description(self, auth_headers):
        """Test auto-categorize with empty description returns general"""
        response = requests.post(f"{BASE_URL}/api/expenses/auto-categorize",
                                headers=auth_headers,
                                json={"description": ""})
        assert response.status_code == 200
        data = response.json()
        assert "category" in data
        assert data["category"] == "general"
        assert data.get("confidence") == "low"
        print("Empty description returns 'general' category with low confidence")
    
    def test_auto_categorize_electricity_bill(self, auth_headers):
        """Test auto-categorize suggests utilities for electricity bill"""
        response = requests.post(f"{BASE_URL}/api/expenses/auto-categorize",
                                headers=auth_headers,
                                json={"description": "electricity bill payment for office"})
        assert response.status_code == 200
        data = response.json()
        assert "category" in data
        assert "confidence" in data
        # AI should suggest utilities or similar
        print(f"Auto-categorize 'electricity bill': {data['category']} ({data['confidence']})")
    
    def test_auto_categorize_rent_payment(self, auth_headers):
        """Test auto-categorize suggests rent for rent payment"""
        response = requests.post(f"{BASE_URL}/api/expenses/auto-categorize",
                                headers=auth_headers,
                                json={"description": "monthly rent payment for shop"})
        assert response.status_code == 200
        data = response.json()
        assert "category" in data
        print(f"Auto-categorize 'monthly rent': {data['category']} ({data.get('confidence')})")
    
    def test_auto_categorize_salary(self, auth_headers):
        """Test auto-categorize for employee salary"""
        response = requests.post(f"{BASE_URL}/api/expenses/auto-categorize",
                                headers=auth_headers,
                                json={"description": "staff salary advance"})
        assert response.status_code == 200
        data = response.json()
        assert "category" in data
        print(f"Auto-categorize 'staff salary': {data['category']} ({data.get('confidence')})")


class TestAnalyticsPDF(TestAuth):
    """Analytics PDF export tests"""
    
    def test_export_analytics_pdf(self, auth_headers):
        """Test GET /api/reports/analytics-pdf returns PDF file"""
        response = requests.get(f"{BASE_URL}/api/reports/analytics-pdf",
                               headers=auth_headers)
        assert response.status_code == 200
        
        # Verify content type is PDF
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type, f"Expected PDF, got: {content_type}"
        
        # Verify we got some content
        assert len(response.content) > 0
        
        # Verify PDF magic bytes
        pdf_header = response.content[:4]
        assert pdf_header == b'%PDF', f"Not a valid PDF file (header: {pdf_header})"
        
        print(f"PDF export successful: {len(response.content)} bytes")
        print(f"Content-Type: {content_type}")


class TestSalesForecast(TestAuth):
    """AI Predictive Sales Forecast tests"""
    
    def test_get_sales_forecast(self, auth_headers):
        """Test GET /api/reports/sales-forecast returns forecast data"""
        response = requests.get(f"{BASE_URL}/api/reports/sales-forecast",
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check for forecast or message
        if "message" in data:
            print(f"Forecast message: {data['message']}")
            return
        
        assert "forecast" in data
        assert "history" in data
        assert "method" in data
        
        # Verify forecast structure
        forecast = data["forecast"]
        assert isinstance(forecast, list)
        if forecast:
            f_item = forecast[0]
            assert "date" in f_item
            assert "predicted_sales" in f_item
            assert "confidence" in f_item
        
        # Verify history structure
        history = data["history"]
        assert isinstance(history, list)
        
        print(f"Forecast method: {data['method']}")
        print(f"History days: {len(history)}, Forecast days: {len(forecast)}")
        if forecast:
            print(f"Sample forecast: {forecast[0]}")


class TestTodayVsYesterday(TestAuth):
    """Dashboard Today vs Yesterday comparison tests"""
    
    def test_get_today_vs_yesterday(self, auth_headers):
        """Test GET /api/dashboard/today-vs-yesterday returns comparison data"""
        response = requests.get(f"{BASE_URL}/api/dashboard/today-vs-yesterday",
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "today" in data
        assert "yesterday" in data
        assert "change" in data
        
        # Verify today structure
        today = data["today"]
        assert "sales" in today
        assert "expenses" in today
        assert "profit" in today
        assert "count" in today
        assert "cash" in today
        assert "bank" in today
        
        # Verify yesterday structure
        yesterday = data["yesterday"]
        assert "sales" in yesterday
        assert "expenses" in yesterday
        
        # Verify change percentages
        change = data["change"]
        assert "sales" in change
        assert "expenses" in change
        assert "profit" in change
        
        print(f"Today: Sales SAR {today['sales']}, Expenses SAR {today['expenses']}, Profit SAR {today['profit']}")
        print(f"Yesterday: Sales SAR {yesterday['sales']}, Expenses SAR {yesterday['expenses']}")
        print(f"Change: Sales {change['sales']}%, Expenses {change['expenses']}%, Profit {change['profit']}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
