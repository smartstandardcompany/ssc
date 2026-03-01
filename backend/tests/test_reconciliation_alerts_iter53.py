"""
Iteration 53: Automated Scheduled Reconciliation Reports Tests
Tests for the new Reconciliation Alerts feature:
- GET /api/reconciliation-alerts/settings - returns default/saved alert settings
- PUT /api/reconciliation-alerts/settings - updates alert settings (threshold, enabled, schedule, channels)
- POST /api/reconciliation-alerts/run - runs alert generation, returns alert with flagged items
- GET /api/reconciliation-alerts - returns alert history sorted by created_at desc
- GET /api/reconciliation-alerts/latest - returns most recent alert
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestReconciliationAlertsSettings:
    """Tests for GET /api/reconciliation-alerts/settings"""
    
    def test_get_settings_requires_auth(self, api_client):
        """Settings endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/reconciliation-alerts/settings")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: GET /api/reconciliation-alerts/settings requires auth")
    
    def test_get_settings_returns_defaults(self, authenticated_client):
        """Settings endpoint returns default values"""
        response = authenticated_client.get(f"{BASE_URL}/api/reconciliation-alerts/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "threshold" in data, "Response should contain threshold"
        assert "enabled" in data, "Response should contain enabled"
        assert "day_of_week" in data, "Response should contain day_of_week"
        assert "hour" in data, "Response should contain hour"
        assert "minute" in data, "Response should contain minute"
        assert "channels" in data, "Response should contain channels"
        
        # Validate types
        assert isinstance(data["threshold"], (int, float)), "threshold should be numeric"
        assert isinstance(data["enabled"], bool), "enabled should be boolean"
        assert isinstance(data["channels"], list), "channels should be a list"
        
        print(f"PASS: GET /api/reconciliation-alerts/settings returns valid structure: threshold={data['threshold']}, enabled={data['enabled']}, day_of_week={data['day_of_week']}")


class TestReconciliationAlertsSettingsUpdate:
    """Tests for PUT /api/reconciliation-alerts/settings"""
    
    def test_update_settings_requires_auth(self, api_client):
        """Update settings endpoint requires authentication"""
        response = requests.put(f"{BASE_URL}/api/reconciliation-alerts/settings", json={"threshold": 1000})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: PUT /api/reconciliation-alerts/settings requires auth")
    
    def test_update_threshold(self, authenticated_client):
        """Can update threshold setting"""
        new_threshold = 1000
        response = authenticated_client.put(f"{BASE_URL}/api/reconciliation-alerts/settings", json={
            "threshold": new_threshold
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("threshold") == new_threshold, f"Expected threshold={new_threshold}, got {data.get('threshold')}"
        print(f"PASS: Threshold updated to {new_threshold}")
    
    def test_update_enabled_toggle(self, authenticated_client):
        """Can toggle enabled flag"""
        # First get current state
        get_resp = authenticated_client.get(f"{BASE_URL}/api/reconciliation-alerts/settings")
        current_enabled = get_resp.json().get("enabled", False)
        
        # Toggle it
        new_enabled = not current_enabled
        response = authenticated_client.put(f"{BASE_URL}/api/reconciliation-alerts/settings", json={
            "enabled": new_enabled
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("enabled") == new_enabled, f"Expected enabled={new_enabled}, got {data.get('enabled')}"
        print(f"PASS: Enabled toggled from {current_enabled} to {new_enabled}")
    
    def test_update_schedule(self, authenticated_client):
        """Can update schedule day and hour"""
        response = authenticated_client.put(f"{BASE_URL}/api/reconciliation-alerts/settings", json={
            "day_of_week": "mon",
            "hour": 10,
            "minute": 30
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("day_of_week") == "mon", f"Expected day_of_week=mon, got {data.get('day_of_week')}"
        assert data.get("hour") == 10, f"Expected hour=10, got {data.get('hour')}"
        assert data.get("minute") == 30, f"Expected minute=30, got {data.get('minute')}"
        print(f"PASS: Schedule updated to day_of_week=mon, hour=10, minute=30")
    
    def test_update_channels(self, authenticated_client):
        """Can update notification channels"""
        response = authenticated_client.put(f"{BASE_URL}/api/reconciliation-alerts/settings", json={
            "channels": ["whatsapp", "email", "push"]
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data.get("channels"), list), "channels should be a list"
        assert "whatsapp" in data.get("channels", []), "whatsapp should be in channels"
        assert "push" in data.get("channels", []), "push should be in channels"
        print(f"PASS: Channels updated to {data.get('channels')}")
    
    def test_update_returns_updated_at(self, authenticated_client):
        """Settings update returns updated_at timestamp"""
        response = authenticated_client.put(f"{BASE_URL}/api/reconciliation-alerts/settings", json={
            "threshold": 500
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "updated_at" in data, "Response should contain updated_at timestamp"
        print(f"PASS: Settings update includes updated_at: {data.get('updated_at')}")


class TestReconciliationAlertsRun:
    """Tests for POST /api/reconciliation-alerts/run"""
    
    def test_run_alert_requires_auth(self, api_client):
        """Run alert endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/reconciliation-alerts/run", json={})
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: POST /api/reconciliation-alerts/run requires auth")
    
    def test_run_alert_returns_alert(self, authenticated_client):
        """Run alert generates and returns alert object"""
        response = authenticated_client.post(f"{BASE_URL}/api/reconciliation-alerts/run", json={
            "threshold": 500
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "alert" in data, "Response should contain alert object"
        
        alert = data.get("alert")
        if alert:  # Only validate if alert was created (bank statements exist)
            assert "id" in alert, "Alert should have id"
            assert "total_flagged" in alert, "Alert should have total_flagged"
            assert "total_unmatched" in alert, "Alert should have total_unmatched"
            assert "flagged_items" in alert, "Alert should have flagged_items"
            assert "statement_summaries" in alert, "Alert should have statement_summaries"
            assert "status" in alert, "Alert should have status"
            assert "threshold" in alert, "Alert should have threshold"
            assert "created_at" in alert, "Alert should have created_at"
            
            assert isinstance(alert["flagged_items"], list), "flagged_items should be a list"
            assert isinstance(alert["statement_summaries"], list), "statement_summaries should be a list"
            assert alert["status"] in ["flagged", "clean"], f"status should be flagged or clean, got {alert['status']}"
            
            print(f"PASS: Run alert returns valid alert: total_flagged={alert['total_flagged']}, total_unmatched={alert['total_unmatched']}, status={alert['status']}")
        else:
            print("PASS: Run alert handles no bank statements gracefully")
    
    def test_run_alert_with_custom_threshold(self, authenticated_client):
        """Can run alert with custom threshold"""
        response = authenticated_client.post(f"{BASE_URL}/api/reconciliation-alerts/run", json={
            "threshold": 1000
        })
        assert response.status_code == 200
        
        data = response.json()
        alert = data.get("alert")
        if alert:
            assert alert.get("threshold") == 1000, f"Alert threshold should be 1000, got {alert.get('threshold')}"
            print(f"PASS: Run alert respects custom threshold=1000")
        else:
            print("PASS: Run alert with custom threshold handles no data gracefully")
    
    def test_run_alert_flagged_items_structure(self, authenticated_client):
        """Flagged items have correct structure"""
        response = authenticated_client.post(f"{BASE_URL}/api/reconciliation-alerts/run", json={
            "threshold": 100  # Lower threshold to get more items
        })
        assert response.status_code == 200
        
        data = response.json()
        alert = data.get("alert")
        if alert and alert.get("flagged_items"):
            fi = alert["flagged_items"][0]
            assert "statement_id" in fi, "flagged item should have statement_id"
            assert "txn_index" in fi, "flagged item should have txn_index"
            assert "date" in fi, "flagged item should have date"
            assert "amount" in fi, "flagged item should have amount"
            assert "type" in fi, "flagged item should have type (credit/debit)"
            
            print(f"PASS: Flagged items have correct structure: date={fi.get('date')}, amount={fi.get('amount')}, type={fi.get('type')}")
        else:
            print("PASS: No flagged items to validate (may have no unmatched transactions above threshold)")
    
    def test_run_alert_statement_summaries_structure(self, authenticated_client):
        """Statement summaries have correct structure"""
        response = authenticated_client.post(f"{BASE_URL}/api/reconciliation-alerts/run", json={})
        assert response.status_code == 200
        
        data = response.json()
        alert = data.get("alert")
        if alert and alert.get("statement_summaries"):
            ss = alert["statement_summaries"][0]
            assert "statement_id" in ss, "summary should have statement_id"
            assert "file_name" in ss, "summary should have file_name"
            assert "total_txns" in ss, "summary should have total_txns"
            assert "matched" in ss, "summary should have matched count"
            assert "unmatched" in ss, "summary should have unmatched count"
            assert "flagged" in ss, "summary should have flagged count"
            assert "match_rate" in ss, "summary should have match_rate"
            
            print(f"PASS: Statement summaries have correct structure: file={ss.get('file_name')}, match_rate={ss.get('match_rate')}%")
        else:
            print("PASS: No statement summaries to validate")


class TestReconciliationAlertsHistory:
    """Tests for GET /api/reconciliation-alerts"""
    
    def test_get_alerts_requires_auth(self, api_client):
        """Alerts history endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/reconciliation-alerts")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: GET /api/reconciliation-alerts requires auth")
    
    def test_get_alerts_returns_array(self, authenticated_client):
        """Alerts history endpoint returns array"""
        response = authenticated_client.get(f"{BASE_URL}/api/reconciliation-alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET /api/reconciliation-alerts returns array with {len(data)} alerts")
    
    def test_alerts_sorted_by_created_at_desc(self, authenticated_client):
        """Alert history is sorted by created_at descending (newest first)"""
        response = authenticated_client.get(f"{BASE_URL}/api/reconciliation-alerts")
        assert response.status_code == 200
        
        data = response.json()
        if len(data) >= 2:
            for i in range(len(data) - 1):
                curr = data[i].get("created_at", "")
                next_item = data[i + 1].get("created_at", "")
                assert curr >= next_item, f"Alerts not sorted desc: {curr} < {next_item}"
            print("PASS: Alert history sorted by created_at descending")
        else:
            print("PASS: Not enough alerts to verify sort order (need >= 2)")
    
    def test_alert_history_structure(self, authenticated_client):
        """Alert history items have correct structure"""
        response = authenticated_client.get(f"{BASE_URL}/api/reconciliation-alerts")
        assert response.status_code == 200
        
        data = response.json()
        if data:
            alert = data[0]
            assert "id" in alert, "Alert should have id"
            assert "created_at" in alert, "Alert should have created_at"
            assert "status" in alert, "Alert should have status"
            assert "total_flagged" in alert, "Alert should have total_flagged"
            assert "total_unmatched" in alert, "Alert should have total_unmatched"
            assert "threshold" in alert, "Alert should have threshold"
            
            print(f"PASS: Alert history item structure valid: status={alert.get('status')}, flagged={alert.get('total_flagged')}")
        else:
            print("PASS: No alerts in history to validate structure")


class TestReconciliationAlertsLatest:
    """Tests for GET /api/reconciliation-alerts/latest"""
    
    def test_get_latest_requires_auth(self, api_client):
        """Latest alert endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/reconciliation-alerts/latest")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: GET /api/reconciliation-alerts/latest requires auth")
    
    def test_get_latest_returns_single_alert(self, authenticated_client):
        """Latest alert endpoint returns single alert object"""
        response = authenticated_client.get(f"{BASE_URL}/api/reconciliation-alerts/latest")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        if data:
            assert isinstance(data, dict), "Response should be a single object"
            assert "id" in data, "Latest alert should have id"
            assert "created_at" in data, "Latest alert should have created_at"
            assert "status" in data, "Latest alert should have status"
            
            print(f"PASS: GET /api/reconciliation-alerts/latest returns alert: id={data.get('id')[:8]}..., status={data.get('status')}")
        else:
            print("PASS: No alerts exist yet, returned empty object")
    
    def test_latest_matches_first_in_history(self, authenticated_client):
        """Latest alert matches first item in history"""
        latest_resp = authenticated_client.get(f"{BASE_URL}/api/reconciliation-alerts/latest")
        history_resp = authenticated_client.get(f"{BASE_URL}/api/reconciliation-alerts")
        
        assert latest_resp.status_code == 200
        assert history_resp.status_code == 200
        
        latest = latest_resp.json()
        history = history_resp.json()
        
        if latest and history:
            assert latest.get("id") == history[0].get("id"), "Latest should match first in history"
            print("PASS: Latest alert matches first item in history")
        else:
            print("PASS: No alerts to compare")
