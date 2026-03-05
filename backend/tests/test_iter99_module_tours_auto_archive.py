"""
Iteration 99 Backend Tests
Tests: Module Tours API, Data Management Auto-Archive, Responsive improvements verification

Features tested:
1. Auto-archive settings API (GET/PUT)
2. Data management stats API
3. Export collection API
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


class TestAuth:
    """Authentication tests"""
    
    def test_admin_login(self):
        """Test admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        print(f"✅ Admin login successful - Role: {data['user'].get('role')}")
        return data["access_token"]


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with authentication"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestDataManagementStats:
    """Data Management Stats API Tests"""
    
    def test_get_data_stats(self, auth_headers):
        """Test fetching data management stats"""
        response = requests.get(f"{BASE_URL}/api/data-management/stats", headers=auth_headers)
        assert response.status_code == 200, f"Stats fetch failed: {response.text}"
        data = response.json()
        assert "stats" in data, "No stats in response"
        assert "archives" in data, "No archives in response"
        assert isinstance(data["stats"], list), "Stats should be a list"
        print(f"✅ Data management stats fetched - {len(data['stats'])} collections")
        
        # Verify expected collections exist
        collection_names = [s["collection"] for s in data["stats"]]
        expected_collections = ["sales", "expenses", "invoices", "notifications", "activity_logs"]
        for coll in expected_collections:
            assert coll in collection_names, f"Missing collection: {coll}"
        print(f"✅ All expected collections present: {expected_collections}")

    def test_stats_contain_required_fields(self, auth_headers):
        """Verify each stat entry has required fields"""
        response = requests.get(f"{BASE_URL}/api/data-management/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        for stat in data["stats"]:
            assert "collection" in stat, "Missing collection field"
            assert "label" in stat, "Missing label field"
            assert "total" in stat, "Missing total field"
            assert "older_than_3_months" in stat, "Missing older_than_3_months"
            assert "older_than_6_months" in stat, "Missing older_than_6_months"
            assert "older_than_12_months" in stat, "Missing older_than_12_months"
        print(f"✅ All stats have required fields")


class TestAutoArchiveSettings:
    """Auto-Archive Settings API Tests"""
    
    def test_get_auto_archive_settings(self, auth_headers):
        """Test fetching auto-archive settings"""
        response = requests.get(f"{BASE_URL}/api/data-management/auto-archive-settings", headers=auth_headers)
        assert response.status_code == 200, f"Settings fetch failed: {response.text}"
        data = response.json()
        
        # Verify settings structure
        assert "enabled" in data, "Missing enabled field"
        assert "frequency" in data, "Missing frequency field"
        assert "collections" in data, "Missing collections field"
        print(f"✅ Auto-archive settings fetched - Enabled: {data.get('enabled')}, Frequency: {data.get('frequency')}")

    def test_update_auto_archive_settings(self, auth_headers):
        """Test updating auto-archive settings"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/data-management/auto-archive-settings", headers=auth_headers)
        original_settings = get_response.json()
        
        # Update settings with test values
        test_settings = {
            "enabled": False,  # Keep disabled for safety
            "frequency": "monthly",
            "day_of_month": 15,
            "hour": 3,
            "minute": 30,
            "default_months": 12,
            "collections": {
                "sales": {"enabled": False, "months": 12},
                "expenses": {"enabled": False, "months": 12},
                "invoices": {"enabled": False, "months": 6},
                "notifications": {"enabled": False, "months": 3},
                "activity_logs": {"enabled": False, "months": 6},
                "supplier_payments": {"enabled": False, "months": 12},
                "scheduler_logs": {"enabled": False, "months": 3}
            },
            "notify_on_archive": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data-management/auto-archive-settings",
            json=test_settings,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Settings update failed: {response.text}"
        
        # Verify updated settings
        verify_response = requests.get(f"{BASE_URL}/api/data-management/auto-archive-settings", headers=auth_headers)
        updated = verify_response.json()
        
        assert updated.get("frequency") == "monthly", "Frequency not updated"
        assert updated.get("day_of_month") == 15, "Day of month not updated"
        print(f"✅ Auto-archive settings updated successfully")

    def test_auto_archive_toggle_collections(self, auth_headers):
        """Test enabling/disabling individual collection auto-archive"""
        test_settings = {
            "enabled": False,
            "frequency": "weekly",
            "day_of_week": "sun",
            "hour": 2,
            "minute": 0,
            "collections": {
                "sales": {"enabled": True, "months": 6},  # Enable sales
                "expenses": {"enabled": False, "months": 12},
                "invoices": {"enabled": False, "months": 12},
                "notifications": {"enabled": True, "months": 3},  # Enable notifications
                "activity_logs": {"enabled": False, "months": 6},
                "supplier_payments": {"enabled": False, "months": 12},
                "scheduler_logs": {"enabled": False, "months": 3}
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/data-management/auto-archive-settings",
            json=test_settings,
            headers=auth_headers
        )
        assert response.status_code == 200
        
        verify = requests.get(f"{BASE_URL}/api/data-management/auto-archive-settings", headers=auth_headers)
        data = verify.json()
        
        # Check collection settings were saved
        collections = data.get("collections", {})
        assert collections.get("sales", {}).get("enabled") == True, "Sales auto-archive not enabled"
        assert collections.get("notifications", {}).get("enabled") == True, "Notifications auto-archive not enabled"
        assert collections.get("expenses", {}).get("enabled") == False, "Expenses should be disabled"
        print(f"✅ Individual collection auto-archive settings working")
        
        # Reset to disabled for safety
        test_settings["collections"]["sales"]["enabled"] = False
        test_settings["collections"]["notifications"]["enabled"] = False
        requests.put(f"{BASE_URL}/api/data-management/auto-archive-settings", json=test_settings, headers=auth_headers)


class TestDataExport:
    """Data Export API Tests"""
    
    def test_export_sales_collection(self, auth_headers):
        """Test exporting sales collection as JSON"""
        response = requests.get(f"{BASE_URL}/api/data-management/export/sales", headers=auth_headers)
        assert response.status_code == 200, f"Export failed: {response.text}"
        data = response.json()
        
        assert "collection" in data, "Missing collection field"
        assert "count" in data, "Missing count field"
        assert "exported_at" in data, "Missing exported_at field"
        assert "data" in data, "Missing data field"
        assert data["collection"] == "sales", "Wrong collection name"
        print(f"✅ Sales export successful - {data['count']} records")

    def test_export_expenses_collection(self, auth_headers):
        """Test exporting expenses collection"""
        response = requests.get(f"{BASE_URL}/api/data-management/export/expenses", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["collection"] == "expenses"
        print(f"✅ Expenses export successful - {data['count']} records")

    def test_export_notifications_collection(self, auth_headers):
        """Test exporting notifications collection"""
        response = requests.get(f"{BASE_URL}/api/data-management/export/notifications", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["collection"] == "notifications"
        print(f"✅ Notifications export successful - {data['count']} records")

    def test_export_invalid_collection_returns_error(self, auth_headers):
        """Test that exporting invalid collection returns 400"""
        response = requests.get(f"{BASE_URL}/api/data-management/export/invalid_collection", headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for invalid collection, got {response.status_code}"
        print(f"✅ Invalid collection export correctly returns 400")


class TestAccessControl:
    """Access Control Tests for Admin-only endpoints"""
    
    def test_data_management_requires_admin(self):
        """Test that non-admin users cannot access data management"""
        # Login as operator
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@ssc.com",
            "password": "testtest"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Operator user not available")
        
        operator_token = login_response.json()["access_token"]
        operator_headers = {"Authorization": f"Bearer {operator_token}"}
        
        # Try to access data management stats
        response = requests.get(f"{BASE_URL}/api/data-management/stats", headers=operator_headers)
        assert response.status_code == 403, f"Expected 403 for operator, got {response.status_code}"
        print(f"✅ Data management correctly requires admin role")


class TestSchedulerConfig:
    """Scheduler configuration tests for scheduled reports"""
    
    def test_get_scheduler_config(self, auth_headers):
        """Test fetching scheduler configuration"""
        response = requests.get(f"{BASE_URL}/api/scheduler/config", headers=auth_headers)
        assert response.status_code == 200, f"Scheduler config fetch failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Scheduler config should be a list"
        print(f"✅ Scheduler config fetched - {len(data)} jobs configured")

    def test_get_scheduler_logs(self, auth_headers):
        """Test fetching scheduler logs"""
        response = requests.get(f"{BASE_URL}/api/scheduler/logs", headers=auth_headers)
        assert response.status_code == 200, f"Scheduler logs fetch failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Scheduler logs should be a list"
        print(f"✅ Scheduler logs fetched - {len(data)} log entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
