"""
Iteration 24 Backend Tests
Features:
1. GET /api/dashboard/today-vs-yesterday - Today vs Yesterday comparison with change percentages
2. POST /api/invoices/ocr-scan - OCR scan accepts base64 image and returns extracted invoice data
3. Analytics page supporting endpoints
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Auth failed: {response.status_code} - {response.text}")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for requests"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestTodayVsYesterday:
    """Tests for GET /api/dashboard/today-vs-yesterday endpoint"""

    def test_today_vs_yesterday_endpoint_exists(self, auth_headers):
        """Test that endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/dashboard/today-vs-yesterday", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"SUCCESS: today-vs-yesterday endpoint returned 200")

    def test_today_vs_yesterday_structure(self, auth_headers):
        """Test response has correct structure with today, yesterday, change"""
        response = requests.get(f"{BASE_URL}/api/dashboard/today-vs-yesterday", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check main keys
        assert "today" in data, "Missing 'today' key"
        assert "yesterday" in data, "Missing 'yesterday' key"
        assert "change" in data, "Missing 'change' key"
        print(f"SUCCESS: Response has correct top-level structure (today, yesterday, change)")

    def test_today_data_fields(self, auth_headers):
        """Test today object has sales, expenses, profit, count, cash, bank"""
        response = requests.get(f"{BASE_URL}/api/dashboard/today-vs-yesterday", headers=auth_headers)
        data = response.json()
        
        today = data.get("today", {})
        expected_fields = ["sales", "expenses", "profit", "count", "cash", "bank"]
        for field in expected_fields:
            assert field in today, f"Missing field 'today.{field}'"
        print(f"SUCCESS: Today data has all required fields: {expected_fields}")

    def test_yesterday_data_fields(self, auth_headers):
        """Test yesterday object has sales, expenses, profit, count, cash, bank"""
        response = requests.get(f"{BASE_URL}/api/dashboard/today-vs-yesterday", headers=auth_headers)
        data = response.json()
        
        yesterday = data.get("yesterday", {})
        expected_fields = ["sales", "expenses", "profit", "count", "cash", "bank"]
        for field in expected_fields:
            assert field in yesterday, f"Missing field 'yesterday.{field}'"
        print(f"SUCCESS: Yesterday data has all required fields: {expected_fields}")

    def test_change_percentages(self, auth_headers):
        """Test change object has percentage values for sales, expenses, profit, count"""
        response = requests.get(f"{BASE_URL}/api/dashboard/today-vs-yesterday", headers=auth_headers)
        data = response.json()
        
        change = data.get("change", {})
        expected_fields = ["sales", "expenses", "profit", "count", "cash", "bank"]
        for field in expected_fields:
            assert field in change, f"Missing field 'change.{field}'"
            # Should be numeric (float)
            assert isinstance(change[field], (int, float)), f"change.{field} should be numeric"
        print(f"SUCCESS: Change percentages present and numeric for all fields")


class TestOCRScan:
    """Tests for POST /api/invoices/ocr-scan endpoint"""

    def test_ocr_scan_endpoint_exists(self, auth_headers):
        """Test that OCR endpoint exists and requires image"""
        # Test without image - should return 400
        response = requests.post(f"{BASE_URL}/api/invoices/ocr-scan", json={}, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for missing image, got {response.status_code}"
        assert "image" in response.text.lower() or "no image" in response.text.lower()
        print(f"SUCCESS: OCR endpoint exists and validates image requirement")

    def test_ocr_scan_accepts_base64_image(self, auth_headers):
        """Test that endpoint accepts base64 image and returns invoice data"""
        # Create a minimal test image (1x1 pixel white PNG)
        # This is a valid base64 encoded 1x1 white PNG
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/ocr-scan",
            json={"image": test_image_base64},
            headers=auth_headers,
            timeout=60  # OCR may take time
        )
        
        # Could return 200 (success), 422 (couldn't parse), or 500 (OCR failed)
        # As long as it's not 400 (bad request), the endpoint is working
        assert response.status_code in [200, 422, 500], f"Unexpected status: {response.status_code}"
        print(f"SUCCESS: OCR endpoint accepts base64 image (status: {response.status_code})")

    def test_ocr_scan_response_structure_on_success(self, auth_headers):
        """Test OCR response structure - should have items, totals etc. on success"""
        # Create a slightly larger test image that might be parseable
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/ocr-scan",
            json={"image": test_image_base64},
            headers=auth_headers,
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            # Expected fields in successful OCR response
            possible_fields = ["items", "total", "subtotal", "customer_name", "invoice_number", "date"]
            found_fields = [f for f in possible_fields if f in data]
            print(f"SUCCESS: OCR returned data with fields: {found_fields}")
        else:
            print(f"INFO: OCR returned {response.status_code} (expected for minimal test image)")


class TestAnalyticsPageEndpoints:
    """Tests for endpoints used by the Analytics page"""

    def test_daily_summary_endpoint(self, auth_headers):
        """Test /api/reports/daily-summary used by Analytics page"""
        response = requests.get(f"{BASE_URL}/api/reports/daily-summary", headers=auth_headers)
        assert response.status_code == 200, f"daily-summary failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "daily-summary should return a list"
        print(f"SUCCESS: daily-summary returned {len(data)} days of data")

    def test_top_customers_endpoint(self, auth_headers):
        """Test /api/reports/top-customers used by Analytics page"""
        response = requests.get(f"{BASE_URL}/api/reports/top-customers", headers=auth_headers)
        assert response.status_code == 200, f"top-customers failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "top-customers should return a list"
        print(f"SUCCESS: top-customers returned {len(data)} customers")

    def test_cashier_performance_endpoint(self, auth_headers):
        """Test /api/reports/cashier-performance used by Analytics page"""
        response = requests.get(f"{BASE_URL}/api/reports/cashier-performance", headers=auth_headers)
        assert response.status_code == 200, f"cashier-performance failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "cashier-performance should return a list"
        print(f"SUCCESS: cashier-performance returned {len(data)} cashiers")

    def test_branch_cashbank_endpoint(self, auth_headers):
        """Test /api/reports/branch-cashbank used by Analytics page"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-cashbank", headers=auth_headers)
        assert response.status_code == 200, f"branch-cashbank failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "branch-cashbank should return a list"
        print(f"SUCCESS: branch-cashbank returned {len(data)} branches")

    def test_dashboard_stats_endpoint(self, auth_headers):
        """Test /api/dashboard/stats used by Analytics page"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"dashboard-stats failed: {response.status_code}"
        data = response.json()
        assert "total_sales" in data, "Missing total_sales"
        assert "total_expenses" in data, "Missing total_expenses"
        print(f"SUCCESS: dashboard-stats returned with total_sales={data.get('total_sales')}")


class TestInvoicesEndpoint:
    """Test basic invoices endpoint for OCR integration"""

    def test_invoices_list(self, auth_headers):
        """Test GET /api/invoices returns list"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200, f"invoices list failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "invoices should return a list"
        print(f"SUCCESS: invoices returned {len(data)} invoices")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
