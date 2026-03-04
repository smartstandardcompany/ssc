"""
Test Supplier Payment Reminders feature (Iteration 78)
Tests: config CRUD, test endpoint, reminder history
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and return token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestSupplierReminderConfig:
    """Tests for GET/POST /api/supplier-reminders/config"""

    def test_get_reminder_config_returns_defaults(self, auth_headers):
        """GET /api/supplier-reminders/config should return default config with thresholds [30,60,90,120]"""
        response = requests.get(f"{BASE_URL}/api/supplier-reminders/config", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get config: {response.text}"
        data = response.json()
        
        # Verify default thresholds
        assert "thresholds" in data, "Config should have thresholds field"
        expected_thresholds = [30, 60, 90, 120]
        assert data["thresholds"] == expected_thresholds, f"Expected {expected_thresholds}, got {data['thresholds']}"
        
        # Verify other expected fields
        assert "enabled" in data
        assert "email_enabled" in data
        assert "whatsapp_enabled" in data
        assert "alert_time" in data
        assert "recipients_email" in data
        assert "recipients_phone" in data
        print(f"✓ Config returned with default thresholds: {data['thresholds']}")

    def test_save_reminder_config(self, auth_headers):
        """POST /api/supplier-reminders/config should save configuration"""
        config_payload = {
            "enabled": True,
            "thresholds": [30, 60, 90, 120],
            "alert_time": "10:00",
            "email_enabled": True,
            "whatsapp_enabled": True,
            "recipients_email": ["test@example.com"],
            "recipients_phone": ["+966512345678"],
            "include_summary": True
        }
        
        response = requests.post(f"{BASE_URL}/api/supplier-reminders/config", 
                                 headers=auth_headers, json=config_payload)
        assert response.status_code == 200, f"Failed to save config: {response.text}"
        
        data = response.json()
        assert "message" in data or "config" in data, "Response should have message or config"
        print(f"✓ Config saved successfully")
        
        # Verify by fetching again
        get_response = requests.get(f"{BASE_URL}/api/supplier-reminders/config", headers=auth_headers)
        assert get_response.status_code == 200
        saved_config = get_response.json()
        assert saved_config.get("alert_time") == "10:00", "Alert time should be updated"
        assert saved_config.get("recipients_email") == ["test@example.com"], "Email recipients should be saved"
        print(f"✓ Config verified after save")


class TestSupplierReminderTest:
    """Tests for POST /api/supplier-reminders/test"""

    def test_run_reminder_test(self, auth_headers):
        """POST /api/supplier-reminders/test should run reminder check and return results with supplier summary"""
        response = requests.post(f"{BASE_URL}/api/supplier-reminders/test", headers=auth_headers)
        assert response.status_code == 200, f"Test reminder failed: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        assert "sent" in data, "Response should have sent field"
        
        # Check for supplier_summary if there are alerts
        if data.get("sent"):
            assert "supplier_summary" in data or "results" in data, "Sent response should have supplier_summary or results"
            print(f"✓ Test reminder ran with alerts: {data.get('supplier_summary', [])}")
        else:
            print(f"✓ Test reminder ran: {data['message']}")


class TestSupplierReminderHistory:
    """Tests for GET /api/supplier-reminders/history"""

    def test_get_reminder_history(self, auth_headers):
        """GET /api/supplier-reminders/history should return history of sent reminders"""
        response = requests.get(f"{BASE_URL}/api/supplier-reminders/history", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get history: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "History should be a list"
        
        # If there are history entries, verify structure
        if len(data) > 0:
            entry = data[0]
            assert "id" in entry, "Entry should have id"
            assert "sent_at" in entry, "Entry should have sent_at"
            assert "alerts_count" in entry, "Entry should have alerts_count"
            assert "suppliers_count" in entry, "Entry should have suppliers_count"
            print(f"✓ History has {len(data)} entries. Latest: {entry.get('sent_at')}")
        else:
            print("✓ History is empty (no reminders sent yet)")


class TestSupplierReminderIntegration:
    """Integration tests for supplier reminders"""

    def test_config_toggle_thresholds(self, auth_headers):
        """Test toggling thresholds in config"""
        # Save config with limited thresholds
        config = {
            "enabled": True,
            "thresholds": [30, 90],  # Only 30 and 90 days
            "alert_time": "09:00",
            "email_enabled": False,
            "whatsapp_enabled": False,
            "recipients_email": [],
            "recipients_phone": []
        }
        
        response = requests.post(f"{BASE_URL}/api/supplier-reminders/config", 
                                 headers=auth_headers, json=config)
        assert response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/supplier-reminders/config", headers=auth_headers)
        saved = get_response.json()
        assert 30 in saved["thresholds"]
        assert 90 in saved["thresholds"]
        assert 60 not in saved["thresholds"]
        print(f"✓ Thresholds toggled correctly: {saved['thresholds']}")

    def test_add_remove_recipients(self, auth_headers):
        """Test adding and removing recipients"""
        # Add multiple recipients
        config = {
            "enabled": True,
            "thresholds": [30, 60, 90, 120],
            "alert_time": "09:00",
            "email_enabled": True,
            "whatsapp_enabled": True,
            "recipients_email": ["admin@ssc.com", "finance@ssc.com"],
            "recipients_phone": ["+966500000001", "+966500000002"]
        }
        
        response = requests.post(f"{BASE_URL}/api/supplier-reminders/config", 
                                 headers=auth_headers, json=config)
        assert response.status_code == 200
        
        # Verify recipients saved
        get_response = requests.get(f"{BASE_URL}/api/supplier-reminders/config", headers=auth_headers)
        saved = get_response.json()
        assert len(saved.get("recipients_email", [])) == 2, "Should have 2 email recipients"
        assert len(saved.get("recipients_phone", [])) == 2, "Should have 2 phone recipients"
        print(f"✓ Recipients added: {len(saved['recipients_email'])} emails, {len(saved['recipients_phone'])} phones")
        
        # Remove recipients
        config["recipients_email"] = []
        config["recipients_phone"] = []
        response = requests.post(f"{BASE_URL}/api/supplier-reminders/config", 
                                 headers=auth_headers, json=config)
        assert response.status_code == 200
        
        get_response = requests.get(f"{BASE_URL}/api/supplier-reminders/config", headers=auth_headers)
        saved = get_response.json()
        assert len(saved.get("recipients_email", [])) == 0, "Should have 0 email recipients"
        print(f"✓ Recipients removed successfully")


class TestSupplierReminderTestEndpointDetails:
    """Detailed tests for the test endpoint response"""

    def test_test_endpoint_returns_supplier_summary(self, auth_headers):
        """Test endpoint should return supplier summary with severity levels"""
        response = requests.post(f"{BASE_URL}/api/supplier-reminders/test", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # According to test data, Test Supplier has SAR 690 at 30+ days
        if data.get("sent") and data.get("supplier_summary"):
            for supplier in data["supplier_summary"]:
                assert "name" in supplier, "Supplier should have name"
                assert "outstanding" in supplier, "Supplier should have outstanding"
                assert "severity" in supplier, "Supplier should have severity"
                print(f"✓ Supplier: {supplier['name']} - SAR {supplier['outstanding']} - {supplier['severity']}")
        
        # Verify results structure
        if "results" in data:
            results = data["results"]
            assert "alerts_count" in results or "alerts_count" in data, "Should have alerts_count"
            assert "suppliers_count" in results or "suppliers_count" in data, "Should have suppliers_count"
        
        print(f"✓ Test endpoint completed: {data.get('message')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
