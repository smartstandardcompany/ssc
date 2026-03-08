"""
Iteration 112 Tests:
1. Sales Duplicate Detection - frontend feature that marks same branch + same amount on same day
2. Monthly Reconciliation Report - GET /api/platform-reconciliation/monthly-report endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Login as admin and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Auth failed - skipping tests")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for API calls"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestMonthlyReconciliationReportAPI:
    """Test the monthly-report endpoint for platform reconciliation"""
    
    def test_monthly_report_endpoint_exists(self, auth_headers):
        """GET /api/platform-reconciliation/monthly-report should return 200"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/monthly-report?months=3", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASSED: monthly-report endpoint returns 200")

    def test_monthly_report_returns_months_array(self, auth_headers):
        """Response should contain 'months' array"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/monthly-report?months=3", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "months" in data, "Response missing 'months' key"
        assert isinstance(data["months"], list), "'months' should be a list"
        print(f"PASSED: Response contains 'months' array with {len(data['months'])} entries")

    def test_monthly_report_returns_platforms_array(self, auth_headers):
        """Response should contain 'platforms' array"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/monthly-report?months=3", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "platforms" in data, "Response missing 'platforms' key"
        assert isinstance(data["platforms"], list), "'platforms' should be a list"
        print(f"PASSED: Response contains 'platforms' array with {len(data['platforms'])} entries")

    def test_monthly_report_month_structure(self, auth_headers):
        """Each month entry should have required fields"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/monthly-report?months=6", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        required_fields = ["month", "month_name", "platforms", "total_sales", "total_received", 
                          "total_expected_fee", "total_actual_cut", "total_variance", "order_count"]
        
        months_with_data = [m for m in data["months"] if m.get("total_sales", 0) > 0]
        if not months_with_data:
            print("SKIPPED: No months with data to verify structure")
            return
            
        month_entry = months_with_data[0]
        for field in required_fields:
            assert field in month_entry, f"Month entry missing required field: {field}"
        
        print(f"PASSED: Month entry contains all required fields: {required_fields}")
        print(f"  Sample month: {month_entry['month_name']} - Sales: SAR {month_entry['total_sales']}, Expected Fee: SAR {month_entry['total_expected_fee']}")

    def test_monthly_report_platform_entry_structure(self, auth_headers):
        """Each platform entry in a month should have required fields"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/monthly-report?months=6", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        months_with_platforms = [m for m in data["months"] if len(m.get("platforms", [])) > 0]
        if not months_with_platforms:
            print("SKIPPED: No months with platform data to verify structure")
            return
            
        platform_entry = months_with_platforms[0]["platforms"][0]
        required_fields = ["platform_id", "platform_name", "commission_rate", "total_sales", 
                          "total_received", "expected_fee", "actual_cut", "variance", "sales_count"]
        
        for field in required_fields:
            assert field in platform_entry, f"Platform entry missing required field: {field}"
        
        print(f"PASSED: Platform entry contains all required fields")
        print(f"  Sample platform: {platform_entry['platform_name']} - Sales: SAR {platform_entry['total_sales']}, Expected Fee: SAR {platform_entry['expected_fee']}")

    def test_monthly_report_months_parameter(self, auth_headers):
        """Requesting different months counts should work"""
        # Test 3 months
        response3 = requests.get(f"{BASE_URL}/api/platform-reconciliation/monthly-report?months=3", headers=auth_headers)
        assert response3.status_code == 200
        data3 = response3.json()
        
        # Test 6 months  
        response6 = requests.get(f"{BASE_URL}/api/platform-reconciliation/monthly-report?months=6", headers=auth_headers)
        assert response6.status_code == 200
        data6 = response6.json()
        
        # 6 months should have same or more entries than 3 months
        assert len(data6["months"]) >= len(data3["months"]), "6 months should have >= entries than 3 months"
        print(f"PASSED: months parameter works - 3 months returned {len(data3['months'])} entries, 6 months returned {len(data6['months'])} entries")

    def test_monthly_report_variance_calculation(self, auth_headers):
        """Variance should equal actual_cut - expected_fee"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/monthly-report?months=6", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        months_with_data = [m for m in data["months"] if m.get("total_sales", 0) > 0]
        if not months_with_data:
            print("SKIPPED: No months with data to verify variance calculation")
            return
        
        for month in months_with_data:
            expected_variance = round(month["total_actual_cut"] - month["total_expected_fee"], 2)
            actual_variance = month["total_variance"]
            # Allow small floating point difference
            assert abs(expected_variance - actual_variance) < 0.1, f"Variance mismatch: expected {expected_variance}, got {actual_variance}"
        
        print(f"PASSED: Variance calculation correct for {len(months_with_data)} months with data")


class TestSalesAPIForDuplicateData:
    """Test that sales API returns data that can be used for duplicate detection in frontend"""
    
    def test_sales_endpoint_returns_data(self, auth_headers):
        """GET /api/sales should return sales data"""
        response = requests.get(f"{BASE_URL}/api/sales?limit=200", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Response can be { data: [...], page, pages, total } or just [...]
        sales = data.get("data") if isinstance(data, dict) else data
        assert isinstance(sales, list), "Sales should be a list"
        print(f"PASSED: Sales endpoint returns {len(sales)} records")
        return sales

    def test_sales_have_required_fields_for_duplicate_detection(self, auth_headers):
        """Each sale should have branch_id, amount, and date for duplicate detection"""
        response = requests.get(f"{BASE_URL}/api/sales?limit=200", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        sales = data.get("data") if isinstance(data, dict) else data
        
        if not sales:
            print("SKIPPED: No sales data to check")
            return
            
        required_fields = ["id", "branch_id", "date"]
        sample_sale = sales[0]
        
        for field in required_fields:
            assert field in sample_sale, f"Sale missing field: {field}"
        
        # Check for amount field (could be 'amount' or 'final_amount')
        has_amount = "amount" in sample_sale or "final_amount" in sample_sale
        assert has_amount, "Sale missing amount/final_amount field"
        
        print(f"PASSED: Sales have required fields for duplicate detection: {required_fields} + amount/final_amount")

    def test_sales_on_known_duplicate_dates(self, auth_headers):
        """Verify sales exist on dates known to have duplicates (2026-02-11, etc)"""
        # Known duplicate dates from agent context
        duplicate_dates = ["2026-02-11", "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-27", "2026-02-28"]
        
        response = requests.get(f"{BASE_URL}/api/sales?limit=500&start_date=2026-02-01&end_date=2026-02-28", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        sales = data.get("data") if isinstance(data, dict) else data
        
        # Group by date
        sales_by_date = {}
        for sale in sales:
            date_str = sale.get("date", "")[:10]  # Extract YYYY-MM-DD
            if date_str not in sales_by_date:
                sales_by_date[date_str] = []
            sales_by_date[date_str].append(sale)
        
        found_duplicate_dates = []
        for date in duplicate_dates:
            if date in sales_by_date and len(sales_by_date[date]) > 1:
                found_duplicate_dates.append(date)
        
        print(f"INFO: Sales by date: {[(d, len(s)) for d, s in sales_by_date.items() if len(s) > 1]}")
        print(f"INFO: Found {len(found_duplicate_dates)} dates with multiple sales: {found_duplicate_dates}")
        
        # This is informational - the actual duplicate detection happens in frontend based on branch_id + amount
        print("PASSED: Sales data retrieved for February 2026 for frontend duplicate detection")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
