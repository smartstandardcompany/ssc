"""
Iteration 107 Tests: Date Quick Filter, Summary Bars, Tour Buttons
Tests:
1. Sales API date filtering with start_date/end_date params
2. Expenses API date filtering with start_date/end_date params
3. Verify date range filtering returns correct subset of data
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_headers():
    """Get auth token for API calls"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


class TestDateQuickFilterBackend:
    """Backend API tests for date filtering functionality"""
    
    def test_sales_api_without_date_filter(self, auth_headers):
        """Test /api/sales returns all data when no date filter applied"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "total" in data
        print(f"Sales without filter: {data['total']} records")
    
    def test_sales_api_with_this_month_filter(self, auth_headers):
        """Test /api/sales with current month date range"""
        now = datetime.now()
        start_date = now.replace(day=1).strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/sales?start_date={start_date}&end_date={end_date}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"Sales this month ({start_date} to {end_date}): {len(data['data'])} records")
    
    def test_sales_api_with_today_filter(self, auth_headers):
        """Test /api/sales with today's date only"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/sales?start_date={today}&end_date={today}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"Sales today ({today}): {len(data['data'])} records")
    
    def test_sales_api_with_yesterday_filter(self, auth_headers):
        """Test /api/sales with yesterday's date"""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/sales?start_date={yesterday}&end_date={yesterday}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"Sales yesterday ({yesterday}): {len(data['data'])} records")
    
    def test_sales_api_with_custom_range_filter(self, auth_headers):
        """Test /api/sales with a custom date range (Feb 2026)"""
        # Data exists for Feb-Mar 2026 per context
        response = requests.get(
            f"{BASE_URL}/api/sales?start_date=2026-02-01&end_date=2026-02-28",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"Sales Feb 2026: {len(data['data'])} records")
    
    def test_expenses_api_without_date_filter(self, auth_headers):
        """Test /api/expenses returns all data when no date filter applied"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "total" in data
        print(f"Expenses without filter: {data['total']} records")
    
    def test_expenses_api_with_this_month_filter(self, auth_headers):
        """Test /api/expenses with current month date range"""
        now = datetime.now()
        start_date = now.replace(day=1).strftime("%Y-%m-%d")
        end_date = now.strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/expenses?start_date={start_date}&end_date={end_date}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"Expenses this month ({start_date} to {end_date}): {len(data['data'])} records")
    
    def test_expenses_api_with_today_filter(self, auth_headers):
        """Test /api/expenses with today's date only"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/expenses?start_date={today}&end_date={today}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"Expenses today ({today}): {len(data['data'])} records")
    
    def test_expenses_api_with_custom_range_filter(self, auth_headers):
        """Test /api/expenses with a custom date range (Feb 2026)"""
        response = requests.get(
            f"{BASE_URL}/api/expenses?start_date=2026-02-01&end_date=2026-02-28",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"Expenses Feb 2026: {len(data['data'])} records")
    
    def test_sales_date_filter_returns_correct_data(self, auth_headers):
        """Verify date filter only returns sales within the date range"""
        # Get all sales first
        all_response = requests.get(f"{BASE_URL}/api/sales?limit=500", headers=auth_headers)
        assert all_response.status_code == 200
        all_sales = all_response.json()["data"]
        
        # Filter for Feb 2026
        filtered_response = requests.get(
            f"{BASE_URL}/api/sales?start_date=2026-02-01&end_date=2026-02-28&limit=500",
            headers=auth_headers
        )
        assert filtered_response.status_code == 200
        filtered_sales = filtered_response.json()["data"]
        
        # Verify all filtered sales are within date range
        for sale in filtered_sales:
            sale_date = sale.get("date", "")[:10]  # Get YYYY-MM-DD part
            assert sale_date >= "2026-02-01", f"Sale date {sale_date} before start date"
            assert sale_date <= "2026-02-28", f"Sale date {sale_date} after end date"
        
        print(f"Date filter validation passed: {len(filtered_sales)} sales in Feb 2026")
    
    def test_expenses_date_filter_returns_correct_data(self, auth_headers):
        """Verify date filter only returns expenses within the date range"""
        # Filter for Feb 2026
        filtered_response = requests.get(
            f"{BASE_URL}/api/expenses?start_date=2026-02-01&end_date=2026-02-28&limit=500",
            headers=auth_headers
        )
        assert filtered_response.status_code == 200
        filtered_expenses = filtered_response.json()["data"]
        
        # Verify all filtered expenses are within date range
        for expense in filtered_expenses:
            expense_date = expense.get("date", "")[:10]  # Get YYYY-MM-DD part
            assert expense_date >= "2026-02-01", f"Expense date {expense_date} before start date"
            assert expense_date <= "2026-02-28", f"Expense date {expense_date} after end date"
        
        print(f"Date filter validation passed: {len(filtered_expenses)} expenses in Feb 2026")
    
    def test_sales_api_pagination_with_date_filter(self, auth_headers):
        """Test that pagination works correctly with date filter"""
        response = requests.get(
            f"{BASE_URL}/api/sales?start_date=2026-01-01&end_date=2026-12-31&page=1&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "page" in data
        assert "pages" in data
        assert "total" in data
        assert data["page"] == 1
        assert len(data["data"]) <= 10
        print(f"Pagination with date filter: page {data['page']}/{data['pages']}, total {data['total']}")
    
    def test_expenses_api_pagination_with_date_filter(self, auth_headers):
        """Test that pagination works correctly with date filter for expenses"""
        response = requests.get(
            f"{BASE_URL}/api/expenses?start_date=2026-01-01&end_date=2026-12-31&page=1&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "page" in data
        assert "pages" in data
        assert "total" in data
        assert data["page"] == 1
        assert len(data["data"]) <= 10
        print(f"Expenses pagination with filter: page {data['page']}/{data['pages']}, total {data['total']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
