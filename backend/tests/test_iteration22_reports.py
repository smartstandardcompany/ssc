"""
Iteration 22: Testing new report endpoints and currency fixes
- GET /api/reports/daily-summary - daily sales/expense/profit data
- GET /api/reports/top-customers - customer rankings by total purchases
- GET /api/reports/cashier-performance - user sales performance data
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication for testing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in login response"
        print(f"✓ Login successful for ss@ssc.com")
        return data["access_token"]

    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestDailySummaryEndpoint(TestAuth):
    """Tests for GET /api/reports/daily-summary endpoint"""
    
    def test_daily_summary_returns_200(self, auth_headers):
        """Daily summary endpoint should return 200 status"""
        response = requests.get(f"{BASE_URL}/api/reports/daily-summary", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/reports/daily-summary returns 200")
    
    def test_daily_summary_returns_list(self, auth_headers):
        """Daily summary should return a list"""
        response = requests.get(f"{BASE_URL}/api/reports/daily-summary", headers=auth_headers)
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Daily summary returns list with {len(data)} items")
    
    def test_daily_summary_structure(self, auth_headers):
        """Daily summary items should have correct fields"""
        response = requests.get(f"{BASE_URL}/api/reports/daily-summary", headers=auth_headers)
        data = response.json()
        
        if len(data) > 0:
            item = data[0]
            required_fields = ['date', 'sales', 'expenses', 'profit', 'cash', 'bank', 'online', 'credit', 'txn_count']
            for field in required_fields:
                assert field in item, f"Missing field '{field}' in daily summary item"
            print(f"✓ Daily summary structure correct: {required_fields}")
        else:
            print("✓ Daily summary returns empty list (no data)")
    
    def test_daily_summary_sorted_by_date_desc(self, auth_headers):
        """Daily summary should be sorted by date descending"""
        response = requests.get(f"{BASE_URL}/api/reports/daily-summary", headers=auth_headers)
        data = response.json()
        
        if len(data) > 1:
            dates = [item['date'] for item in data]
            assert dates == sorted(dates, reverse=True), "Daily summary not sorted by date descending"
            print("✓ Daily summary sorted by date descending")
        else:
            print("✓ Not enough data to verify sorting")
    
    def test_daily_summary_with_date_filters(self, auth_headers):
        """Daily summary should accept date filters"""
        response = requests.get(
            f"{BASE_URL}/api/reports/daily-summary",
            params={"start_date": "2025-01-01", "end_date": "2025-12-31"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed with date filters: {response.text}"
        print("✓ Daily summary accepts start_date and end_date filters")


class TestTopCustomersEndpoint(TestAuth):
    """Tests for GET /api/reports/top-customers endpoint"""
    
    def test_top_customers_returns_200(self, auth_headers):
        """Top customers endpoint should return 200 status"""
        response = requests.get(f"{BASE_URL}/api/reports/top-customers", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/reports/top-customers returns 200")
    
    def test_top_customers_returns_list(self, auth_headers):
        """Top customers should return a list"""
        response = requests.get(f"{BASE_URL}/api/reports/top-customers", headers=auth_headers)
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Top customers returns list with {len(data)} items")
    
    def test_top_customers_structure(self, auth_headers):
        """Top customers items should have correct fields"""
        response = requests.get(f"{BASE_URL}/api/reports/top-customers", headers=auth_headers)
        data = response.json()
        
        if len(data) > 0:
            item = data[0]
            required_fields = ['id', 'name', 'phone', 'total_purchases', 'transaction_count', 
                             'credit_given', 'credit_received', 'credit_outstanding']
            for field in required_fields:
                assert field in item, f"Missing field '{field}' in top customers item"
            print(f"✓ Top customers structure correct: {required_fields}")
        else:
            print("✓ Top customers returns empty list (no data)")
    
    def test_top_customers_sorted_by_purchases_desc(self, auth_headers):
        """Top customers should be sorted by total_purchases descending"""
        response = requests.get(f"{BASE_URL}/api/reports/top-customers", headers=auth_headers)
        data = response.json()
        
        if len(data) > 1:
            purchases = [item['total_purchases'] for item in data]
            assert purchases == sorted(purchases, reverse=True), "Top customers not sorted by total_purchases descending"
            print("✓ Top customers sorted by total_purchases descending")
        else:
            print("✓ Not enough data to verify sorting")


class TestCashierPerformanceEndpoint(TestAuth):
    """Tests for GET /api/reports/cashier-performance endpoint"""
    
    def test_cashier_performance_returns_200(self, auth_headers):
        """Cashier performance endpoint should return 200 status"""
        response = requests.get(f"{BASE_URL}/api/reports/cashier-performance", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/reports/cashier-performance returns 200")
    
    def test_cashier_performance_returns_list(self, auth_headers):
        """Cashier performance should return a list"""
        response = requests.get(f"{BASE_URL}/api/reports/cashier-performance", headers=auth_headers)
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Cashier performance returns list with {len(data)} items")
    
    def test_cashier_performance_structure(self, auth_headers):
        """Cashier performance items should have correct fields"""
        response = requests.get(f"{BASE_URL}/api/reports/cashier-performance", headers=auth_headers)
        data = response.json()
        
        if len(data) > 0:
            item = data[0]
            required_fields = ['user_id', 'name', 'email', 'role', 'branch', 
                             'total_sales', 'transaction_count', 'cash_collected', 
                             'bank_collected', 'avg_transaction']
            for field in required_fields:
                assert field in item, f"Missing field '{field}' in cashier performance item"
            print(f"✓ Cashier performance structure correct: {required_fields}")
        else:
            print("✓ Cashier performance returns empty list (no data)")
    
    def test_cashier_performance_sorted_by_sales_desc(self, auth_headers):
        """Cashier performance should be sorted by total_sales descending"""
        response = requests.get(f"{BASE_URL}/api/reports/cashier-performance", headers=auth_headers)
        data = response.json()
        
        if len(data) > 1:
            sales = [item['total_sales'] for item in data]
            assert sales == sorted(sales, reverse=True), "Cashier performance not sorted by total_sales descending"
            print("✓ Cashier performance sorted by total_sales descending")
        else:
            print("✓ Not enough data to verify sorting")


class TestExistingReportEndpoints(TestAuth):
    """Tests to verify existing report endpoints still work"""
    
    def test_credit_sales_report_works(self, auth_headers):
        """Credit sales report should still work"""
        response = requests.get(f"{BASE_URL}/api/reports/credit-sales", headers=auth_headers)
        assert response.status_code == 200, f"Credit sales failed: {response.text}"
        print("✓ GET /api/reports/credit-sales works")
    
    def test_suppliers_report_works(self, auth_headers):
        """Suppliers report should still work"""
        response = requests.get(f"{BASE_URL}/api/reports/suppliers", headers=auth_headers)
        assert response.status_code == 200, f"Suppliers failed: {response.text}"
        print("✓ GET /api/reports/suppliers works")
    
    def test_branch_cashbank_works(self, auth_headers):
        """Branch cash/bank report should still work"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-cashbank", headers=auth_headers)
        assert response.status_code == 200, f"Branch cashbank failed: {response.text}"
        print("✓ GET /api/reports/branch-cashbank works")
    
    def test_item_pnl_works(self, auth_headers):
        """Item P&L report should still work"""
        response = requests.get(f"{BASE_URL}/api/reports/item-pnl", headers=auth_headers)
        assert response.status_code == 200, f"Item P&L failed: {response.text}"
        print("✓ GET /api/reports/item-pnl works")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
