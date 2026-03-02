"""
Test suite for Bank Reconciliation, CCTV AI, and Predictive Analytics features
Iteration 58 - Comprehensive API testing
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"

# Test bank statement ID (provided in test request)
TEST_STATEMENT_ID = "ff71fc88-ed18-49bc-8cf9-3c1e0a1520a1"

# Sample base64 image for CCTV AI tests (1x1 transparent PNG)
SAMPLE_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        # Try both 'access_token' and 'token' keys
        token = data.get("access_token") or data.get("token")
        if token:
            return token
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


# ===================================================================
# HEALTH CHECK
# ===================================================================

class TestHealthCheck:
    """Basic API health check"""
    
    def test_api_root(self):
        """Test API root endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API root failed: {response.status_code}"
        data = response.json()
        assert "message" in data
        print(f"API Health: PASS - {data.get('message')}")


# ===================================================================
# BANK STATEMENTS - Upload, Auto-Match, Unmatched
# ===================================================================

class TestBankStatements:
    """Bank Statement API tests"""
    
    def test_get_bank_statements_list(self, auth_headers):
        """Test GET /api/bank-statements - List all statements"""
        response = requests.get(f"{BASE_URL}/api/bank-statements", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Bank Statements List: PASS - {len(data)} statements found")
    
    def test_get_bank_statement_detail(self, auth_headers):
        """Test GET /api/bank-statements/{id} - Get statement detail"""
        response = requests.get(f"{BASE_URL}/api/bank-statements/{TEST_STATEMENT_ID}", headers=auth_headers)
        # May return 404 if statement doesn't exist
        if response.status_code == 404:
            print(f"Bank Statement Detail: SKIP - Statement {TEST_STATEMENT_ID} not found")
            pytest.skip("Test statement not found")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "id" in data or "transactions" in data, "Response should contain statement data"
        print(f"Bank Statement Detail: PASS - Found statement with {len(data.get('transactions', []))} transactions")
    
    def test_bank_statement_auto_match(self, auth_headers):
        """Test POST /api/bank-statements/{id}/auto-match - Auto-match transactions"""
        response = requests.post(
            f"{BASE_URL}/api/bank-statements/{TEST_STATEMENT_ID}/auto-match",
            headers=auth_headers,
            params={"tolerance": 1.0, "date_range": 2}
        )
        if response.status_code == 404:
            print(f"Auto-Match: SKIP - Statement {TEST_STATEMENT_ID} not found")
            pytest.skip("Test statement not found")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        # Response should have matched, unmatched, and stats
        assert "matched" in data or "stats" in data, "Response should contain match results"
        print(f"Auto-Match: PASS - {len(data.get('matched', []))} matched, {len(data.get('unmatched', []))} unmatched")
    
    def test_bank_statement_unmatched(self, auth_headers):
        """Test GET /api/bank-statements/{id}/unmatched - Get unmatched transactions"""
        response = requests.get(
            f"{BASE_URL}/api/bank-statements/{TEST_STATEMENT_ID}/unmatched",
            headers=auth_headers
        )
        if response.status_code == 404:
            print(f"Unmatched Transactions: SKIP - Statement {TEST_STATEMENT_ID} not found")
            pytest.skip("Test statement not found")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "unmatched" in data or "total" in data, "Response should contain unmatched data"
        print(f"Unmatched Transactions: PASS - {data.get('total', len(data.get('unmatched', [])))} unmatched transactions")
    
    def test_bank_statement_analysis(self, auth_headers):
        """Test GET /api/bank-statements/{id}/analysis - Statement analysis"""
        response = requests.get(
            f"{BASE_URL}/api/bank-statements/{TEST_STATEMENT_ID}/analysis",
            headers=auth_headers
        )
        if response.status_code == 404:
            print(f"Statement Analysis: SKIP - Statement {TEST_STATEMENT_ID} not found")
            pytest.skip("Test statement not found")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        # Should have senders or pos_by_branch
        print(f"Statement Analysis: PASS - {len(data.get('senders', []))} senders found")
    
    def test_bank_statement_reconciliation(self, auth_headers):
        """Test GET /api/bank-statements/{id}/reconciliation - POS reconciliation"""
        response = requests.get(
            f"{BASE_URL}/api/bank-statements/{TEST_STATEMENT_ID}/reconciliation",
            headers=auth_headers
        )
        if response.status_code == 404:
            print(f"POS Reconciliation: SKIP - Statement {TEST_STATEMENT_ID} not found")
            pytest.skip("Test statement not found")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "rows" in data or "summary" in data, "Response should contain reconciliation data"
        print(f"POS Reconciliation: PASS - {len(data.get('rows', []))} rows")
    
    def test_bank_statement_matches(self, auth_headers):
        """Test GET /api/bank-statements/{id}/matches - Get auto-matches"""
        response = requests.get(
            f"{BASE_URL}/api/bank-statements/{TEST_STATEMENT_ID}/matches",
            headers=auth_headers
        )
        if response.status_code == 404:
            print(f"Get Matches: SKIP - Statement {TEST_STATEMENT_ID} not found")
            pytest.skip("Test statement not found")
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list of matches"
        print(f"Get Matches: PASS - {len(data)} matches found")


# ===================================================================
# CCTV AI - People Counting, Object Detection, Motion Analysis
# ===================================================================

class TestCCTVAI:
    """CCTV AI Feature API tests"""
    
    def test_cctv_ai_count_people(self, auth_headers):
        """Test POST /api/cctv/ai/count-people - AI people counting"""
        payload = {
            "camera_id": "test_camera_1",
            "image_data": SAMPLE_IMAGE_BASE64,
            "previous_count": 0
        }
        response = requests.post(
            f"{BASE_URL}/api/cctv/ai/count-people",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        # Should return success or people_count
        assert "success" in data or "people_count" in data, f"Response should contain success or count: {data}"
        print(f"AI People Counting: PASS - success={data.get('success')}, count={data.get('people_count', 'N/A')}")
    
    def test_cctv_ai_detect_objects(self, auth_headers):
        """Test POST /api/cctv/ai/detect-objects - AI object detection"""
        payload = {
            "camera_id": "test_camera_1",
            "image_data": SAMPLE_IMAGE_BASE64,
            "target_objects": ["products", "boxes"],
            "context": "retail store inventory"
        }
        response = requests.post(
            f"{BASE_URL}/api/cctv/ai/detect-objects",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "success" in data or "objects_detected" in data, f"Response should contain results: {data}"
        print(f"AI Object Detection: PASS - success={data.get('success')}, objects={len(data.get('objects_detected', []))}")
    
    def test_cctv_ai_analyze_motion(self, auth_headers):
        """Test POST /api/cctv/ai/analyze-motion - AI motion analysis"""
        payload = {
            "camera_id": "test_camera_1",
            "image_data": SAMPLE_IMAGE_BASE64
        }
        response = requests.post(
            f"{BASE_URL}/api/cctv/ai/analyze-motion",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "success" in data or "motion_detected" in data, f"Response should contain results: {data}"
        print(f"AI Motion Analysis: PASS - success={data.get('success')}, motion={data.get('motion_detected', 'N/A')}")
    
    def test_cctv_settings(self, auth_headers):
        """Test GET /api/cctv/settings - Get CCTV settings"""
        response = requests.get(f"{BASE_URL}/api/cctv/settings", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "people_counting_enabled" in data or "motion_alerts_enabled" in data, "Should return settings"
        print(f"CCTV Settings: PASS - people_counting={data.get('people_counting_enabled')}, motion={data.get('motion_alerts_enabled')}")
    
    def test_cctv_cameras_list(self, auth_headers):
        """Test GET /api/cctv/cameras - List cameras"""
        response = requests.get(f"{BASE_URL}/api/cctv/cameras", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"CCTV Cameras: PASS - {len(data)} cameras found")
    
    def test_cctv_dvrs_list(self, auth_headers):
        """Test GET /api/cctv/dvrs - List DVRs"""
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"CCTV DVRs: PASS - {len(data)} DVRs found")
    
    def test_cctv_alerts_list(self, auth_headers):
        """Test GET /api/cctv/alerts - List motion alerts"""
        response = requests.get(f"{BASE_URL}/api/cctv/alerts", headers=auth_headers, params={"limit": 20})
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"CCTV Alerts: PASS - {len(data)} alerts found")
    
    def test_cctv_analytics(self, auth_headers):
        """Test GET /api/cctv/analytics - CCTV analytics summary"""
        response = requests.get(f"{BASE_URL}/api/cctv/analytics", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "period" in data or "summary" in data, "Response should contain analytics data"
        print(f"CCTV Analytics: PASS - summary={data.get('summary', {})}")
    
    def test_cctv_people_count(self, auth_headers):
        """Test GET /api/cctv/people-count - People count data"""
        response = requests.get(f"{BASE_URL}/api/cctv/people-count", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "total_entries" in data or "date" in data, "Response should contain count data"
        print(f"CCTV People Count: PASS - entries={data.get('total_entries', 0)}, exits={data.get('total_exits', 0)}")


# ===================================================================
# PREDICTIONS - Inventory Demand, Customer CLV, Peak Hours, Profit Decomposition
# ===================================================================

class TestPredictions:
    """Predictive Analytics API tests"""
    
    def test_inventory_demand_forecast(self, auth_headers):
        """Test GET /api/predictions/inventory-demand - Inventory demand prediction"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/inventory-demand",
            headers=auth_headers,
            params={"days": 14}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "items" in data or "forecast_period" in data, f"Response should contain forecast data: {data.keys()}"
        print(f"Inventory Demand: PASS - {len(data.get('items', []))} items tracked, {data.get('items_at_risk', 0)} at risk")
    
    def test_customer_clv_prediction(self, auth_headers):
        """Test GET /api/predictions/customer-clv - Customer lifetime value prediction"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/customer-clv",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "customers" in data or "segments" in data, f"Response should contain CLV data: {data.keys()}"
        print(f"Customer CLV: PASS - {data.get('total_customers', 0)} customers, projected revenue: {data.get('total_projected_revenue', 0)}")
    
    def test_peak_hours_analysis(self, auth_headers):
        """Test GET /api/predictions/peak-hours - Peak hours analysis for staff scheduling"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/peak-hours",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "hourly_analysis" in data or "peak_hours" in data, f"Response should contain peak hours data: {data.keys()}"
        peak_hours = data.get('peak_hours', [])
        print(f"Peak Hours: PASS - {len(data.get('hourly_analysis', []))} hours analyzed, top peaks: {[h.get('label') for h in peak_hours[:3]]}")
    
    def test_profit_decomposition(self, auth_headers):
        """Test GET /api/predictions/profit-decomposition - Profit trend analysis"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/profit-decomposition",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "daily" in data or "summary" in data or "monthly" in data, f"Response should contain profit data: {data.keys()}"
        summary = data.get('summary', {})
        print(f"Profit Decomposition: PASS - trend={summary.get('profit_trend', 'N/A')}, best_day={summary.get('best_day', 'N/A')}, anomalies={summary.get('total_anomalies', 0)}")


# ===================================================================
# ADDITIONAL BANK STATEMENT TESTS - POS Machines
# ===================================================================

class TestPOSMachines:
    """POS Machine management tests"""
    
    def test_get_pos_machines(self, auth_headers):
        """Test GET /api/pos-machines - List POS machines"""
        response = requests.get(f"{BASE_URL}/api/pos-machines", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"POS Machines: PASS - {len(data)} machines configured")


# ===================================================================
# CCTV AI - Validation Tests (bad requests)
# ===================================================================

class TestCCTVAIValidation:
    """CCTV AI endpoint validation tests"""
    
    def test_count_people_missing_image(self, auth_headers):
        """Test count-people with missing image_data"""
        payload = {"camera_id": "test_camera"}
        response = requests.post(
            f"{BASE_URL}/api/cctv/ai/count-people",
            headers=auth_headers,
            json=payload
        )
        # Should return 400 for missing required field
        assert response.status_code in [400, 422], f"Expected 400/422 for missing image_data, got: {response.status_code}"
        print(f"Count People Validation: PASS - correctly rejects missing image_data")
    
    def test_detect_objects_missing_image(self, auth_headers):
        """Test detect-objects with missing image_data"""
        payload = {"camera_id": "test_camera"}
        response = requests.post(
            f"{BASE_URL}/api/cctv/ai/detect-objects",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code in [400, 422], f"Expected 400/422 for missing image_data, got: {response.status_code}"
        print(f"Detect Objects Validation: PASS - correctly rejects missing image_data")
    
    def test_analyze_motion_missing_image(self, auth_headers):
        """Test analyze-motion with missing image_data"""
        payload = {"camera_id": "test_camera"}
        response = requests.post(
            f"{BASE_URL}/api/cctv/ai/analyze-motion",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code in [400, 422], f"Expected 400/422 for missing image_data, got: {response.status_code}"
        print(f"Analyze Motion Validation: PASS - correctly rejects missing image_data")


# ===================================================================
# AUTHENTICATION TESTS
# ===================================================================

class TestAuthentication:
    """Authentication requirement tests"""
    
    def test_predictions_requires_auth(self):
        """Test that prediction endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/predictions/inventory-demand")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got: {response.status_code}"
        print(f"Auth Required: PASS - predictions endpoint requires authentication")
    
    def test_cctv_ai_requires_auth(self):
        """Test that CCTV AI endpoints require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/cctv/ai/count-people",
            json={"camera_id": "test", "image_data": SAMPLE_IMAGE_BASE64}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got: {response.status_code}"
        print(f"Auth Required: PASS - CCTV AI endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
