"""
Test Suite for P3 Features - Iteration 72
Tests:
1. Sales Forecast API endpoint (/predictions/sales-forecast)
2. AdvancedSearch component filter configs on Sales and Expenses pages
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "ss@ssc.com"
TEST_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Login and get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestSalesForecastAPI:
    """Test the AI-powered Sales Forecast endpoint"""
    
    def test_sales_forecast_endpoint_exists(self, auth_headers):
        """Test that the /predictions/sales-forecast endpoint exists and returns 200"""
        response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: Sales forecast endpoint exists and returns 200")
    
    def test_sales_forecast_returns_correct_structure(self, auth_headers):
        """Test that the response has the expected data structure"""
        response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check for main keys in response
        assert "forecast" in data or "message" in data, "Response should have 'forecast' or 'message' key"
        
        if "forecast" in data:
            # Full forecast response
            assert "summary" in data, "Response should have 'summary' key"
            assert "historical" in data, "Response should have 'historical' key"
            assert "day_of_week_pattern" in data, "Response should have 'day_of_week_pattern' key"
            print("PASS: Sales forecast response has correct structure with all keys")
        else:
            # Insufficient data response
            print(f"PASS: Sales forecast returned message (possibly insufficient data): {data.get('message')}")
    
    def test_sales_forecast_summary_fields(self, auth_headers):
        """Test that the summary contains expected fields"""
        response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if "summary" in data:
            summary = data["summary"]
            expected_fields = [
                "forecast_period_days",
                "total_predicted",
                "next_7_days",
                "next_30_days",
                "avg_daily_predicted",
                "trend",
                "trend_percentage",
                "best_day",
                "worst_day",
                "confidence_level"
            ]
            for field in expected_fields:
                assert field in summary, f"Summary should have '{field}' field"
            print(f"PASS: Summary has all expected fields. Trend: {summary.get('trend')}, Best day: {summary.get('best_day')}")
        else:
            print("SKIP: No summary in response (insufficient data)")
    
    def test_sales_forecast_with_days_parameter(self, auth_headers):
        """Test forecast with different days parameter"""
        for days in [7, 14, 30, 60, 90]:
            response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast?days={days}", headers=auth_headers)
            assert response.status_code == 200, f"Failed for days={days}"
            data = response.json()
            
            if "forecast" in data:
                assert len(data["forecast"]) == days, f"Expected {days} forecast entries, got {len(data['forecast'])}"
        print("PASS: Forecast works with all days parameters (7, 14, 30, 60, 90)")
    
    def test_sales_forecast_day_of_week_pattern(self, auth_headers):
        """Test that day-of-week pattern is returned correctly"""
        response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if "day_of_week_pattern" in data:
            dow_pattern = data["day_of_week_pattern"]
            expected_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            for day in expected_days:
                assert day in dow_pattern, f"Day-of-week pattern should have '{day}'"
            print(f"PASS: Day-of-week pattern has all 7 days")
        else:
            print("SKIP: No day_of_week_pattern in response")
    
    def test_sales_forecast_historical_data(self, auth_headers):
        """Test that historical data is returned correctly"""
        response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if "historical" in data:
            historical = data["historical"]
            expected_fields = [
                "avg_last_7_days",
                "avg_last_30_days",
                "avg_last_180_days",
                "std_deviation"
            ]
            for field in expected_fields:
                assert field in historical, f"Historical should have '{field}' field"
            print(f"PASS: Historical data has all expected fields. Avg 30 days: {historical.get('avg_last_30_days')}")
        else:
            print("SKIP: No historical data in response")
    
    def test_sales_forecast_individual_day_structure(self, auth_headers):
        """Test individual forecast day structure"""
        response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast?days=7", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if "forecast" in data and len(data["forecast"]) > 0:
            forecast_day = data["forecast"][0]
            expected_fields = ["date", "day_name", "predicted", "lower_bound", "upper_bound", "confidence"]
            for field in expected_fields:
                assert field in forecast_day, f"Forecast day should have '{field}' field"
            print(f"PASS: Individual forecast day has correct structure. First day: {forecast_day.get('date')}, predicted: {forecast_day.get('predicted')}")
        else:
            print("SKIP: No forecast data available")
    
    def test_sales_forecast_confidence_interval(self, auth_headers):
        """Test that confidence intervals make sense (lower < predicted < upper)"""
        response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast?days=7", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if "forecast" in data:
            for fc in data["forecast"]:
                lower = fc.get("lower_bound", 0)
                predicted = fc.get("predicted", 0)
                upper = fc.get("upper_bound", 0)
                # Lower should be <= predicted and predicted should be <= upper
                assert lower <= predicted, f"Lower bound ({lower}) should be <= predicted ({predicted})"
                assert predicted <= upper, f"Predicted ({predicted}) should be <= upper bound ({upper})"
            print("PASS: All confidence intervals are valid (lower <= predicted <= upper)")
        else:
            print("SKIP: No forecast data available")
    
    def test_sales_forecast_requires_authentication(self):
        """Test that the endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/predictions/sales-forecast")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("PASS: Sales forecast requires authentication")


class TestSalesPageAPI:
    """Test Sales page API endpoints"""
    
    def test_sales_endpoint(self, auth_headers):
        """Test that sales endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Sales endpoint should return a list"
        print(f"PASS: Sales endpoint returns {len(data)} records")
    
    def test_branches_endpoint(self, auth_headers):
        """Test that branches endpoint returns data for AdvancedSearch filter"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Branches endpoint should return a list"
        print(f"PASS: Branches endpoint returns {len(data)} branches")


class TestExpensesPageAPI:
    """Test Expenses page API endpoints"""
    
    def test_expenses_endpoint(self, auth_headers):
        """Test that expenses endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expenses endpoint should return a list"
        print(f"PASS: Expenses endpoint returns {len(data)} records")
    
    def test_categories_endpoint(self, auth_headers):
        """Test that categories endpoint returns data for AdvancedSearch filter"""
        response = requests.get(f"{BASE_URL}/api/categories?category_type=expense", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Categories endpoint should return a list"
        print(f"PASS: Categories endpoint returns {len(data)} expense categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
