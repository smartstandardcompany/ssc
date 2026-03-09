"""
Iteration 116: Test Duplicate Report feature
- GET /api/duplicate-report/scan endpoint
- Tests for sales, expenses, supplier_payments duplicate scanning
- Verify summary response structure
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in response"
    return data["access_token"]


@pytest.fixture
def auth_headers(auth_token):
    """Get authenticated headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestDuplicateReportScan:
    """Test GET /api/duplicate-report/scan endpoint"""
    
    def test_scan_duplicates_default_30_days(self, auth_headers):
        """Test scanning duplicates with default 30 days"""
        response = requests.get(
            f"{BASE_URL}/api/duplicate-report/scan",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        # Verify response structure - summary section
        assert "summary" in data, "Missing 'summary' in response"
        summary = data["summary"]
        
        assert "total_duplicate_groups" in summary, "Missing 'total_duplicate_groups'"
        assert "sales_groups" in summary, "Missing 'sales_groups'"
        assert "expense_groups" in summary, "Missing 'expense_groups'"
        assert "sp_groups" in summary, "Missing 'sp_groups'"
        assert "total_potential_excess" in summary, "Missing 'total_potential_excess'"
        assert "scan_period" in summary, "Missing 'scan_period'"
        assert summary["scan_period"] == "Last 30 days", f"Expected 'Last 30 days', got {summary['scan_period']}"
        
        # Verify arrays exist
        assert "sales" in data, "Missing 'sales' array"
        assert "expenses" in data, "Missing 'expenses' array"
        assert "supplier_payments" in data, "Missing 'supplier_payments' array"
        
        assert isinstance(data["sales"], list), "'sales' should be a list"
        assert isinstance(data["expenses"], list), "'expenses' should be a list"
        assert isinstance(data["supplier_payments"], list), "'supplier_payments' should be a list"
        
        print(f"✓ Scan returned: {summary['total_duplicate_groups']} groups, SAR {summary['total_potential_excess']} excess")
    
    def test_scan_duplicates_custom_days_7(self, auth_headers):
        """Test scanning duplicates with 7 days parameter"""
        response = requests.get(
            f"{BASE_URL}/api/duplicate-report/scan?days=7",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        summary = data["summary"]
        assert summary["scan_period"] == "Last 7 days", f"Expected 'Last 7 days', got {summary['scan_period']}"
        print(f"✓ 7-day scan: {summary['total_duplicate_groups']} groups found")
    
    def test_scan_duplicates_custom_days_90(self, auth_headers):
        """Test scanning duplicates with 90 days parameter"""
        response = requests.get(
            f"{BASE_URL}/api/duplicate-report/scan?days=90",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        summary = data["summary"]
        assert summary["scan_period"] == "Last 90 days", f"Expected 'Last 90 days', got {summary['scan_period']}"
        print(f"✓ 90-day scan: {summary['total_duplicate_groups']} groups found")
    
    def test_scan_duplicates_sales_structure(self, auth_headers):
        """Test that sales duplicate groups have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/duplicate-report/scan?days=90",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["sales"]) > 0:
            group = data["sales"][0]
            
            # Verify group structure
            assert "date" in group, "Missing 'date' in sales group"
            assert "branch" in group, "Missing 'branch' in sales group"
            assert "amount" in group, "Missing 'amount' in sales group"
            assert "count" in group, "Missing 'count' in sales group"
            assert "potential_excess" in group, "Missing 'potential_excess' in sales group"
            assert "entries" in group, "Missing 'entries' in sales group"
            
            assert group["count"] >= 2, "Group should have at least 2 entries (duplicates)"
            assert len(group["entries"]) >= 2, "Entries should have at least 2 items"
            
            # Verify entry structure
            entry = group["entries"][0]
            assert "id" in entry, "Missing 'id' in entry"
            assert "sale_type" in entry, "Missing 'sale_type' in entry"
            
            print(f"✓ Sales group structure verified - {group['count']}x on {group['date']}")
        else:
            print("✓ No sales duplicates found (structure test skipped)")
    
    def test_scan_duplicates_expenses_structure(self, auth_headers):
        """Test that expense duplicate groups have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/duplicate-report/scan?days=90",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["expenses"]) > 0:
            group = data["expenses"][0]
            
            # Verify group structure
            assert "date" in group, "Missing 'date' in expense group"
            assert "branch" in group, "Missing 'branch' in expense group"
            assert "amount" in group, "Missing 'amount' in expense group"
            assert "count" in group, "Missing 'count' in expense group"
            assert "potential_excess" in group, "Missing 'potential_excess' in expense group"
            assert "entries" in group, "Missing 'entries' in expense group"
            
            # Verify entry structure
            entry = group["entries"][0]
            assert "id" in entry, "Missing 'id' in entry"
            assert "category" in entry, "Missing 'category' in entry"
            
            print(f"✓ Expense group structure verified - {group['count']}x on {group['date']}")
        else:
            print("✓ No expense duplicates found (structure test skipped)")
    
    def test_scan_duplicates_supplier_payments_structure(self, auth_headers):
        """Test that supplier payment duplicate groups have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/duplicate-report/scan?days=90",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        if len(data["supplier_payments"]) > 0:
            group = data["supplier_payments"][0]
            
            # Verify group structure
            assert "date" in group, "Missing 'date' in SP group"
            assert "supplier" in group, "Missing 'supplier' in SP group"
            assert "amount" in group, "Missing 'amount' in SP group"
            assert "count" in group, "Missing 'count' in SP group"
            assert "potential_excess" in group, "Missing 'potential_excess' in SP group"
            assert "entries" in group, "Missing 'entries' in SP group"
            
            print(f"✓ SP group structure verified - {group['count']}x on {group['date']}")
        else:
            print("✓ No supplier payment duplicates found (structure test skipped)")
    
    def test_scan_requires_authentication(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/duplicate-report/scan")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Authentication required for duplicate scan")
    
    def test_scan_summary_counts_match(self, auth_headers):
        """Test that summary counts match actual array lengths"""
        response = requests.get(
            f"{BASE_URL}/api/duplicate-report/scan?days=90",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data["summary"]
        
        # Verify counts match
        assert summary["sales_groups"] == len(data["sales"]), \
            f"sales_groups mismatch: {summary['sales_groups']} vs {len(data['sales'])}"
        assert summary["expense_groups"] == len(data["expenses"]), \
            f"expense_groups mismatch: {summary['expense_groups']} vs {len(data['expenses'])}"
        assert summary["sp_groups"] == len(data["supplier_payments"]), \
            f"sp_groups mismatch: {summary['sp_groups']} vs {len(data['supplier_payments'])}"
        
        total = summary["sales_groups"] + summary["expense_groups"] + summary["sp_groups"]
        assert summary["total_duplicate_groups"] == total, \
            f"total_duplicate_groups mismatch: {summary['total_duplicate_groups']} vs {total}"
        
        print(f"✓ Summary counts verified: {summary['sales_groups']} sales, {summary['expense_groups']} expenses, {summary['sp_groups']} SP")


class TestAnomalyDetectionAccess:
    """Verify anomaly detection page is accessible"""
    
    def test_anomaly_history_endpoint(self, auth_headers):
        """Test /api/anomaly-detection/history endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/anomaly-detection/history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Anomaly history failed: {response.text}"
        data = response.json()
        
        # Should return a list of scan history
        assert isinstance(data, list), "Expected list response"
        print(f"✓ Anomaly history: {len(data)} scans found")
    
    def test_anomaly_scan_endpoint(self, auth_headers):
        """Test /api/anomaly-detection/scan endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/anomaly-detection/scan?days=30",
            headers=auth_headers
        )
        # May return 200 or 422 (validation) but should not 404
        assert response.status_code != 404, "Anomaly scan endpoint not found"
        print(f"✓ Anomaly scan endpoint accessible (status: {response.status_code})")
