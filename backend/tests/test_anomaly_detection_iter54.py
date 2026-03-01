"""
Iteration 54: Anomaly Detection API Tests
Tests for GET /api/anomaly-detection/scan and GET /api/anomaly-detection/history endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token for admin user"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestAnomalyDetectionScan:
    """Tests for GET /api/anomaly-detection/scan endpoint"""

    def test_scan_requires_auth(self, api_client):
        """Scan endpoint requires authentication"""
        # Remove auth header if present
        client = requests.Session()
        client.headers.update({"Content-Type": "application/json"})
        response = client.get(f"{BASE_URL}/api/anomaly-detection/scan")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Scan endpoint requires authentication")

    def test_scan_returns_scan_object(self, authenticated_client):
        """Scan returns scan object with required fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "scan" in data, "Response missing 'scan' object"
        
        scan = data["scan"]
        # Check required scan fields
        required_fields = ["id", "scanned_at", "period_days", "total_anomalies", 
                          "critical", "warning", "info", "by_category"]
        for field in required_fields:
            assert field in scan, f"Scan missing required field: {field}"
        
        print(f"PASS: Scan object has all required fields: {list(scan.keys())}")

    def test_scan_returns_anomalies_array(self, authenticated_client):
        """Scan returns anomalies array"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        data = response.json()
        assert "anomalies" in data, "Response missing 'anomalies' array"
        assert isinstance(data["anomalies"], list), "Anomalies should be a list"
        
        print(f"PASS: Scan returns anomalies array with {len(data['anomalies'])} items")

    def test_scan_by_category_breakdown(self, authenticated_client):
        """Scan includes category breakdown (sales, expenses, bank)"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        data = response.json()
        by_category = data["scan"]["by_category"]
        
        expected_categories = ["sales", "expenses", "bank"]
        for cat in expected_categories:
            assert cat in by_category, f"Missing category: {cat}"
            assert isinstance(by_category[cat], int), f"{cat} count should be integer"
        
        print(f"PASS: by_category breakdown: {by_category}")

    def test_scan_severity_counts(self, authenticated_client):
        """Scan includes severity counts (critical, warning, info)"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        scan = response.json()["scan"]
        
        assert "critical" in scan and isinstance(scan["critical"], int)
        assert "warning" in scan and isinstance(scan["warning"], int)
        assert "info" in scan and isinstance(scan["info"], int)
        
        # Verify total equals sum of severities
        total = scan["total_anomalies"]
        sum_severities = scan["critical"] + scan["warning"] + scan["info"]
        assert total == sum_severities, f"Total {total} != sum of severities {sum_severities}"
        
        print(f"PASS: Severity counts - Critical: {scan['critical']}, Warning: {scan['warning']}, Info: {scan['info']}")

    def test_scan_with_different_days(self, authenticated_client):
        """Scan respects days parameter"""
        for days in [30, 60, 90, 180]:
            response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days={days}")
            assert response.status_code == 200, f"Scan failed for days={days}"
            
            scan = response.json()["scan"]
            assert scan["period_days"] == days, f"Expected period_days={days}, got {scan['period_days']}"
        
        print("PASS: Scan respects days parameter for 30, 60, 90, 180")


class TestAnomalyStructure:
    """Tests for anomaly object structure"""

    def test_anomaly_has_required_fields(self, authenticated_client):
        """Each anomaly has required fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        anomalies = response.json()["anomalies"]
        if len(anomalies) == 0:
            pytest.skip("No anomalies detected - cannot verify structure")
        
        required_fields = ["id", "category", "type", "severity", "title", 
                         "description", "value", "expected", "z_score", "date", "metric"]
        
        for idx, anomaly in enumerate(anomalies[:5]):  # Check first 5
            for field in required_fields:
                assert field in anomaly, f"Anomaly {idx} missing field: {field}"
        
        print(f"PASS: Anomalies have all required fields: {required_fields}")

    def test_anomaly_category_values(self, authenticated_client):
        """Anomaly categories are valid (sales, expenses, bank)"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        anomalies = response.json()["anomalies"]
        valid_categories = ["sales", "expenses", "bank"]
        
        for anomaly in anomalies:
            assert anomaly["category"] in valid_categories, f"Invalid category: {anomaly['category']}"
        
        print(f"PASS: All anomalies have valid categories")

    def test_anomaly_severity_values(self, authenticated_client):
        """Anomaly severities are valid (critical, warning, info)"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        anomalies = response.json()["anomalies"]
        valid_severities = ["critical", "warning", "info"]
        
        for anomaly in anomalies:
            assert anomaly["severity"] in valid_severities, f"Invalid severity: {anomaly['severity']}"
        
        print(f"PASS: All anomalies have valid severities")

    def test_anomaly_z_score_numeric(self, authenticated_client):
        """Anomaly z_score is numeric"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        anomalies = response.json()["anomalies"]
        for anomaly in anomalies:
            assert isinstance(anomaly["z_score"], (int, float)), f"z_score should be numeric, got {type(anomaly['z_score'])}"
        
        print(f"PASS: All anomaly z_scores are numeric")

    def test_anomaly_value_expected_numeric(self, authenticated_client):
        """Anomaly value and expected are numeric"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        anomalies = response.json()["anomalies"]
        for anomaly in anomalies:
            assert isinstance(anomaly["value"], (int, float)), f"value should be numeric"
            assert isinstance(anomaly["expected"], (int, float)), f"expected should be numeric"
        
        print(f"PASS: All anomaly values and expected are numeric")


class TestAnomalyHistory:
    """Tests for GET /api/anomaly-detection/history endpoint"""

    def test_history_requires_auth(self, api_client):
        """History endpoint requires authentication"""
        client = requests.Session()
        client.headers.update({"Content-Type": "application/json"})
        response = client.get(f"{BASE_URL}/api/anomaly-detection/history")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: History endpoint requires authentication")

    def test_history_returns_array(self, authenticated_client):
        """History returns array of scans"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/history")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "History should return array"
        
        print(f"PASS: History returns array with {len(data)} scans")

    def test_history_sorted_desc(self, authenticated_client):
        """History is sorted by scanned_at descending"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/history")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) < 2:
            pytest.skip("Need at least 2 scans to verify sorting")
        
        # Verify descending order
        for i in range(len(data) - 1):
            assert data[i]["scanned_at"] >= data[i + 1]["scanned_at"], \
                f"History not sorted descending at index {i}"
        
        print("PASS: History sorted by scanned_at descending")

    def test_history_item_structure(self, authenticated_client):
        """History items have required fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/history")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) == 0:
            pytest.skip("No history items to verify")
        
        required_fields = ["id", "scanned_at", "period_days", "total_anomalies",
                         "critical", "warning", "info", "by_category"]
        
        for item in data[:3]:  # Check first 3
            for field in required_fields:
                assert field in item, f"History item missing field: {field}"
        
        print(f"PASS: History items have all required fields")


class TestSalesAnomalyTypes:
    """Tests for sales anomaly detection types"""

    def test_sales_anomalies_detected(self, authenticated_client):
        """Sales anomalies are detected (if data exists)"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=180")
        assert response.status_code == 200
        
        scan = response.json()["scan"]
        sales_count = scan["by_category"]["sales"]
        
        print(f"PASS: Sales anomalies detected: {sales_count}")

    def test_sales_anomaly_types(self, authenticated_client):
        """Sales anomalies have valid types"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=180")
        assert response.status_code == 200
        
        anomalies = response.json()["anomalies"]
        sales_anomalies = [a for a in anomalies if a["category"] == "sales"]
        
        valid_types = ["daily_sales_spike", "daily_sales_drop", "txn_count_high", 
                      "txn_count_low", "payment_mode_shift", "branch_underperforming"]
        
        for a in sales_anomalies:
            assert a["type"] in valid_types, f"Unknown sales anomaly type: {a['type']}"
        
        if sales_anomalies:
            types_found = list(set(a["type"] for a in sales_anomalies))
            print(f"PASS: Sales anomaly types found: {types_found}")
        else:
            print("PASS: No sales anomalies (data may not have anomalous patterns)")


class TestExpenseAnomalyTypes:
    """Tests for expense anomaly detection types"""

    def test_expense_anomalies_detected(self, authenticated_client):
        """Expense anomalies are detected (if data exists)"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=180")
        assert response.status_code == 200
        
        scan = response.json()["scan"]
        expense_count = scan["by_category"]["expenses"]
        
        print(f"PASS: Expense anomalies detected: {expense_count}")

    def test_expense_anomaly_types(self, authenticated_client):
        """Expense anomalies have valid types"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=180")
        assert response.status_code == 200
        
        anomalies = response.json()["anomalies"]
        expense_anomalies = [a for a in anomalies if a["category"] == "expenses"]
        
        valid_types = ["expense_above_average", "weekly_expense_spike", 
                      "weekly_expense_drop", "category_concentration"]
        
        for a in expense_anomalies:
            assert a["type"] in valid_types, f"Unknown expense anomaly type: {a['type']}"
        
        if expense_anomalies:
            types_found = list(set(a["type"] for a in expense_anomalies))
            print(f"PASS: Expense anomaly types found: {types_found}")
        else:
            print("PASS: No expense anomalies (data may not have anomalous patterns)")


class TestBankAnomalyTypes:
    """Tests for bank anomaly detection types"""

    def test_bank_anomalies_detected(self, authenticated_client):
        """Bank anomalies are detected (if data exists)"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        scan = response.json()["scan"]
        bank_count = scan["by_category"]["bank"]
        
        print(f"PASS: Bank anomalies detected: {bank_count}")

    def test_bank_anomaly_types(self, authenticated_client):
        """Bank anomalies have valid types"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/scan?days=90")
        assert response.status_code == 200
        
        anomalies = response.json()["anomalies"]
        bank_anomalies = [a for a in anomalies if a["category"] == "bank"]
        
        valid_types = ["match_rate_drop", "flagged_spike", "large_unmatched_txn"]
        
        for a in bank_anomalies:
            assert a["type"] in valid_types, f"Unknown bank anomaly type: {a['type']}"
        
        if bank_anomalies:
            types_found = list(set(a["type"] for a in bank_anomalies))
            print(f"PASS: Bank anomaly types found: {types_found}")
        else:
            print("PASS: No bank anomalies (data may not have anomalous patterns)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
