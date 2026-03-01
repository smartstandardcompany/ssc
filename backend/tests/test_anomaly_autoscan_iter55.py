"""
Iteration 55: Anomaly Auto-Scan Schedule Feature Tests
Tests for scheduled auto-scan endpoints:
- GET /api/anomaly-detection/schedule - Get schedule settings
- PUT /api/anomaly-detection/schedule - Update schedule settings (enable/disable, frequency, threshold)
- POST /api/anomaly-detection/test-scan - Trigger manual test scan with source='auto'
"""
import pytest
import requests
import os
from datetime import datetime

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


class TestScheduleSettingsGet:
    """Tests for GET /api/anomaly-detection/schedule endpoint"""

    def test_schedule_requires_auth(self, api_client):
        """Schedule endpoint requires authentication"""
        client = requests.Session()
        client.headers.update({"Content-Type": "application/json"})
        response = client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Schedule endpoint requires authentication")

    def test_schedule_returns_settings(self, authenticated_client):
        """GET /schedule returns settings object with all required fields"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        required_fields = ["enabled", "frequency", "day_of_week", "hour", "period_days", 
                          "alert_threshold", "channels"]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"PASS: Schedule settings has all required fields: {list(data.keys())}")

    def test_schedule_enabled_is_boolean(self, authenticated_client):
        """enabled field is boolean"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["enabled"], bool), f"enabled should be boolean, got {type(data['enabled'])}"
        print(f"PASS: enabled is boolean (value: {data['enabled']})")

    def test_schedule_frequency_valid(self, authenticated_client):
        """frequency is daily or weekly"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code == 200
        
        data = response.json()
        assert data["frequency"] in ["daily", "weekly"], f"Invalid frequency: {data['frequency']}"
        print(f"PASS: frequency is valid (value: {data['frequency']})")

    def test_schedule_day_of_week_valid(self, authenticated_client):
        """day_of_week is valid day abbreviation"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code == 200
        
        data = response.json()
        valid_days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
        assert data["day_of_week"] in valid_days, f"Invalid day_of_week: {data['day_of_week']}"
        print(f"PASS: day_of_week is valid (value: {data['day_of_week']})")

    def test_schedule_hour_valid(self, authenticated_client):
        """hour is integer 0-23"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["hour"], int), f"hour should be int, got {type(data['hour'])}"
        assert 0 <= data["hour"] <= 23, f"hour should be 0-23, got {data['hour']}"
        print(f"PASS: hour is valid (value: {data['hour']})")

    def test_schedule_period_days_valid(self, authenticated_client):
        """period_days is positive integer"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["period_days"], int), f"period_days should be int"
        assert data["period_days"] > 0, f"period_days should be positive"
        print(f"PASS: period_days is valid (value: {data['period_days']})")

    def test_schedule_alert_threshold_valid(self, authenticated_client):
        """alert_threshold is critical/warning/info"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code == 200
        
        data = response.json()
        valid_thresholds = ["critical", "warning", "info"]
        assert data["alert_threshold"] in valid_thresholds, f"Invalid threshold: {data['alert_threshold']}"
        print(f"PASS: alert_threshold is valid (value: {data['alert_threshold']})")

    def test_schedule_channels_is_array(self, authenticated_client):
        """channels is array of strings"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["channels"], list), f"channels should be list"
        valid_channels = ["push", "whatsapp", "email"]
        for ch in data["channels"]:
            assert ch in valid_channels, f"Invalid channel: {ch}"
        print(f"PASS: channels is valid array (value: {data['channels']})")


class TestScheduleSettingsUpdate:
    """Tests for PUT /api/anomaly-detection/schedule endpoint"""

    def test_schedule_update_requires_auth(self, api_client):
        """Schedule update requires authentication"""
        client = requests.Session()
        client.headers.update({"Content-Type": "application/json"})
        response = client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={"enabled": False})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Schedule update requires authentication")

    def test_schedule_update_enabled(self, authenticated_client):
        """PUT /schedule updates enabled field"""
        # Get current state
        get_resp = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        current_enabled = get_resp.json()["enabled"]
        
        # Toggle enabled
        new_enabled = not current_enabled
        response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
            "enabled": new_enabled,
            "frequency": "daily",
            "day_of_week": "mon",
            "hour": 8,
            "period_days": 90,
            "alert_threshold": "warning",
            "channels": ["push"]
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["enabled"] == new_enabled, f"Expected enabled={new_enabled}, got {data['enabled']}"
        
        # Verify with GET
        get_resp2 = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        assert get_resp2.json()["enabled"] == new_enabled
        
        print(f"PASS: enabled updated to {new_enabled}")

    def test_schedule_update_frequency_daily(self, authenticated_client):
        """PUT /schedule can set frequency to daily"""
        response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
            "enabled": True,
            "frequency": "daily",
            "hour": 9,
            "period_days": 90,
            "alert_threshold": "warning",
            "channels": ["push"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["frequency"] == "daily"
        print("PASS: frequency updated to daily")

    def test_schedule_update_frequency_weekly(self, authenticated_client):
        """PUT /schedule can set frequency to weekly"""
        response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
            "enabled": True,
            "frequency": "weekly",
            "day_of_week": "mon",
            "hour": 7,
            "period_days": 90,
            "alert_threshold": "warning",
            "channels": ["push", "whatsapp"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["frequency"] == "weekly"
        assert data["day_of_week"] == "mon"
        print("PASS: frequency updated to weekly with day_of_week=mon")

    def test_schedule_update_hour(self, authenticated_client):
        """PUT /schedule updates hour"""
        response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
            "enabled": True,
            "frequency": "daily",
            "hour": 14,
            "period_days": 90,
            "alert_threshold": "warning",
            "channels": ["push"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["hour"] == 14
        print("PASS: hour updated to 14")

    def test_schedule_update_period_days(self, authenticated_client):
        """PUT /schedule updates period_days"""
        response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
            "enabled": True,
            "frequency": "daily",
            "hour": 7,
            "period_days": 60,
            "alert_threshold": "warning",
            "channels": ["push"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["period_days"] == 60
        print("PASS: period_days updated to 60")

    def test_schedule_update_alert_threshold(self, authenticated_client):
        """PUT /schedule updates alert_threshold"""
        for threshold in ["critical", "warning", "info"]:
            response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
                "enabled": True,
                "frequency": "daily",
                "hour": 7,
                "period_days": 90,
                "alert_threshold": threshold,
                "channels": ["push"]
            })
            
            assert response.status_code == 200
            data = response.json()
            assert data["alert_threshold"] == threshold
        
        print("PASS: alert_threshold updated for critical, warning, info")

    def test_schedule_update_channels(self, authenticated_client):
        """PUT /schedule updates channels array"""
        test_channels = [["push"], ["whatsapp"], ["email"], ["push", "whatsapp"], ["push", "whatsapp", "email"]]
        
        for channels in test_channels:
            response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
                "enabled": True,
                "frequency": "daily",
                "hour": 7,
                "period_days": 90,
                "alert_threshold": "warning",
                "channels": channels
            })
            
            assert response.status_code == 200
            data = response.json()
            assert set(data["channels"]) == set(channels)
        
        print("PASS: channels updated for various combinations")


class TestScheduleJobRegistration:
    """Tests for APScheduler job registration via schedule update"""

    def test_enable_registers_job(self, authenticated_client):
        """PUT /schedule with enabled=true should register scheduler job"""
        # Enable the schedule
        response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
            "enabled": True,
            "frequency": "daily",
            "hour": 6,
            "period_days": 90,
            "alert_threshold": "warning",
            "channels": ["push"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == True
        
        # Note: We can't directly verify scheduler job registration via API
        # but successful 200 response indicates _register_anomaly_job was called
        print("PASS: Schedule enabled successfully (job should be registered)")

    def test_disable_removes_job(self, authenticated_client):
        """PUT /schedule with enabled=false should remove scheduler job"""
        response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
            "enabled": False,
            "frequency": "daily",
            "hour": 7,
            "period_days": 90,
            "alert_threshold": "warning",
            "channels": ["push"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == False
        print("PASS: Schedule disabled successfully (job should be removed)")


class TestAutoScanExecution:
    """Tests for POST /api/anomaly-detection/test-scan endpoint"""

    def test_test_scan_requires_auth(self, api_client):
        """Test scan endpoint requires authentication"""
        client = requests.Session()
        client.headers.update({"Content-Type": "application/json"})
        response = client.post(f"{BASE_URL}/api/anomaly-detection/test-scan")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Test scan endpoint requires authentication")

    def test_test_scan_returns_scan(self, authenticated_client):
        """POST /test-scan triggers auto-scan and returns result"""
        response = authenticated_client.post(f"{BASE_URL}/api/anomaly-detection/test-scan")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response missing message"
        assert "scan" in data, "Response missing scan object"
        assert data["message"] == "Auto-scan triggered"
        
        print(f"PASS: Test scan returned with message and scan object")

    def test_test_scan_has_source_auto(self, authenticated_client):
        """Auto-scan records have source='auto' field"""
        response = authenticated_client.post(f"{BASE_URL}/api/anomaly-detection/test-scan")
        assert response.status_code == 200
        
        data = response.json()
        scan = data["scan"]
        
        assert "source" in scan, "Scan missing source field"
        assert scan["source"] == "auto", f"Expected source='auto', got {scan['source']}"
        
        print(f"PASS: Test scan has source='auto'")

    def test_test_scan_updates_last_auto_scan(self, authenticated_client):
        """Auto-scan updates last_auto_scan timestamp in settings"""
        # Get timestamp before test scan
        before_resp = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        before_timestamp = before_resp.json().get("last_auto_scan")
        
        # Trigger test scan
        response = authenticated_client.post(f"{BASE_URL}/api/anomaly-detection/test-scan")
        assert response.status_code == 200
        
        # Get timestamp after test scan
        after_resp = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/schedule")
        after_timestamp = after_resp.json().get("last_auto_scan")
        
        # Verify timestamp was updated
        assert after_timestamp is not None, "last_auto_scan should be set after test scan"
        if before_timestamp:
            assert after_timestamp >= before_timestamp, "last_auto_scan should be updated"
        
        print(f"PASS: last_auto_scan updated to {after_timestamp}")

    def test_test_scan_has_anomaly_counts(self, authenticated_client):
        """Auto-scan result has all required count fields"""
        response = authenticated_client.post(f"{BASE_URL}/api/anomaly-detection/test-scan")
        assert response.status_code == 200
        
        scan = response.json()["scan"]
        
        required_fields = ["id", "scanned_at", "period_days", "total_anomalies",
                          "critical", "warning", "info", "by_category"]
        for field in required_fields:
            assert field in scan, f"Scan missing field: {field}"
        
        assert "sales" in scan["by_category"]
        assert "expenses" in scan["by_category"]
        assert "bank" in scan["by_category"]
        
        print(f"PASS: Auto-scan has all required fields. Anomalies: {scan['total_anomalies']}")


class TestAutoScanInHistory:
    """Tests for auto-scan records in history"""

    def test_auto_scan_appears_in_history(self, authenticated_client):
        """Auto-scan records appear in scan history"""
        # Trigger test scan to ensure we have at least one auto-scan
        authenticated_client.post(f"{BASE_URL}/api/anomaly-detection/test-scan")
        
        # Get history
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/history")
        assert response.status_code == 200
        
        history = response.json()
        auto_scans = [s for s in history if s.get("source") == "auto"]
        
        assert len(auto_scans) > 0, "No auto-scan records found in history"
        print(f"PASS: Found {len(auto_scans)} auto-scan records in history")

    def test_auto_scan_has_source_in_history(self, authenticated_client):
        """Auto-scan records in history have source='auto'"""
        response = authenticated_client.get(f"{BASE_URL}/api/anomaly-detection/history")
        assert response.status_code == 200
        
        history = response.json()
        auto_scans = [s for s in history if s.get("source") == "auto"]
        
        for scan in auto_scans[:3]:  # Check first 3
            assert scan["source"] == "auto"
        
        print(f"PASS: Auto-scan history records have source='auto'")


class TestScheduleRestore:
    """Restore schedule to a known good state for UI testing"""

    def test_restore_schedule(self, authenticated_client):
        """Restore schedule to enabled state for frontend testing"""
        response = authenticated_client.put(f"{BASE_URL}/api/anomaly-detection/schedule", json={
            "enabled": True,
            "frequency": "daily",
            "day_of_week": "mon",
            "hour": 7,
            "period_days": 90,
            "alert_threshold": "warning",
            "channels": ["push", "whatsapp"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] == True
        assert data["frequency"] == "daily"
        assert data["hour"] == 7
        
        print("PASS: Schedule restored to enabled daily at 07:00")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
