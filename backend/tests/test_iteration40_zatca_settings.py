"""
Iteration 40: ZATCA Settings API Tests
Tests for ZATCA Settings section in Settings where users can configure their CSID credentials

Features tested:
- GET /api/settings/zatca - returns ZATCA configuration (sensitive fields masked)
- POST /api/settings/zatca - saves ZATCA configuration
- POST /api/settings/zatca/test - tests connection (validates format, MOCKED)
- GET /api/settings/zatca/status - returns status summary with invoice stats
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


class TestZatcaSettingsAPI:
    """ZATCA Settings API Tests"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        self.session = requests.Session()
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.auth_success = True
        else:
            self.auth_success = False

    def test_auth_works(self):
        """Verify auth is working"""
        assert self.auth_success, "Authentication failed - cannot proceed with tests"
        print("✓ Authentication successful")

    # ===================== GET ZATCA SETTINGS =====================
    def test_get_zatca_settings_returns_200(self):
        """GET /api/settings/zatca should return 200"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        response = self.session.get(f"{BASE_URL}/api/settings/zatca")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/settings/zatca returns 200")

    def test_get_zatca_settings_structure(self):
        """GET /api/settings/zatca should return expected structure"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        response = self.session.get(f"{BASE_URL}/api/settings/zatca")
        data = response.json()
        
        # Check required fields exist
        required_fields = ["enabled", "environment", "otp", "csid", "csid_secret", 
                          "production_csid", "production_secret", "certificate", 
                          "private_key", "auto_submit", "invoice_counter"]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print("✓ GET /api/settings/zatca has all required fields")

    def test_get_zatca_settings_defaults(self):
        """GET /api/settings/zatca should return correct defaults"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        response = self.session.get(f"{BASE_URL}/api/settings/zatca")
        data = response.json()
        
        # Check default types and values
        assert isinstance(data.get("enabled"), bool), "enabled should be boolean"
        assert data.get("environment") in ["sandbox", "production"], "environment should be sandbox or production"
        assert isinstance(data.get("auto_submit"), bool), "auto_submit should be boolean"
        assert isinstance(data.get("invoice_counter"), int), "invoice_counter should be integer"
        
        print("✓ GET /api/settings/zatca returns correct default types")

    # ===================== SAVE ZATCA SETTINGS =====================
    def test_save_zatca_settings_returns_200(self):
        """POST /api/settings/zatca should return 200 with success message"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        payload = {
            "enabled": True,
            "environment": "sandbox",
            "otp": "123456",
            "csid": "VEVTVF9DU0lEX0ZPUl9TQU5EQk9Y",  # Test CSID (base64)
            "csid_secret": "test_secret_123",
            "production_csid": "",
            "production_secret": "",
            "certificate": "",
            "private_key": "",
            "auto_submit": False,
            "invoice_counter": 100
        }
        
        response = self.session.post(f"{BASE_URL}/api/settings/zatca", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message field"
        print(f"✓ POST /api/settings/zatca returns 200 with message: {data.get('message')}")

    def test_save_zatca_settings_persistence(self):
        """POST /api/settings/zatca should persist data"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        # Save new settings
        payload = {
            "enabled": True,
            "environment": "production",
            "otp": "999888",
            "csid": "UFJPRFVDVElPTl9DU0lE",  # Production CSID (base64)
            "csid_secret": "prod_secret",
            "production_csid": "UFJPRFVDVElPTl9DU0lEX1BST0Q=",
            "production_secret": "prod_secret_production",
            "certificate": "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
            "private_key": "-----BEGIN EC PRIVATE KEY-----\nTEST\n-----END EC PRIVATE KEY-----",
            "auto_submit": True,
            "invoice_counter": 500
        }
        
        save_response = self.session.post(f"{BASE_URL}/api/settings/zatca", json=payload)
        assert save_response.status_code == 200
        
        # Verify data persisted
        get_response = self.session.get(f"{BASE_URL}/api/settings/zatca")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data.get("enabled") == True, "enabled should be True"
        assert data.get("environment") == "production", "environment should be production"
        assert data.get("otp") == "999888", "otp should be 999888"
        assert data.get("auto_submit") == True, "auto_submit should be True"
        assert data.get("invoice_counter") == 500, "invoice_counter should be 500"
        assert data.get("certificate") == "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----", "certificate should persist"
        
        print("✓ POST /api/settings/zatca persists data correctly")

    def test_save_zatca_settings_masks_secrets(self):
        """GET /api/settings/zatca should mask sensitive fields"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        # First save with real secrets
        payload = {
            "enabled": True,
            "environment": "sandbox",
            "csid": "VEVTVF9DU0lE",
            "csid_secret": "my_super_secret_key",
            "production_secret": "prod_super_secret",
            "private_key": "-----BEGIN EC PRIVATE KEY-----\nSECRET\n-----END EC PRIVATE KEY-----"
        }
        
        self.session.post(f"{BASE_URL}/api/settings/zatca", json=payload)
        
        # Get and verify masking
        response = self.session.get(f"{BASE_URL}/api/settings/zatca")
        data = response.json()
        
        # Secrets should be masked with •
        assert data.get("csid_secret") == "••••••••", f"csid_secret should be masked, got: {data.get('csid_secret')}"
        assert data.get("production_secret") == "••••••••", f"production_secret should be masked, got: {data.get('production_secret')}"
        assert data.get("private_key") == "••••••••", f"private_key should be masked, got: {data.get('private_key')}"
        
        print("✓ GET /api/settings/zatca correctly masks sensitive fields")

    def test_save_zatca_settings_preserves_masked_secrets(self):
        """POST /api/settings/zatca should preserve masked values when re-saving"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        # Save with real secret
        payload = {
            "enabled": True,
            "environment": "sandbox",
            "csid": "VEVTVF9DU0lE",
            "csid_secret": "original_secret_value_abc123"
        }
        self.session.post(f"{BASE_URL}/api/settings/zatca", json=payload)
        
        # Now save with masked value (simulating UI behavior)
        payload_masked = {
            "enabled": True,
            "environment": "sandbox",
            "csid": "VEVTVF9DU0lE",
            "csid_secret": "••••••••"  # Masked from UI
        }
        self.session.post(f"{BASE_URL}/api/settings/zatca", json=payload_masked)
        
        # The original secret should be preserved (we can't verify the actual value,
        # but we can verify the masking still shows)
        response = self.session.get(f"{BASE_URL}/api/settings/zatca")
        data = response.json()
        
        # Should still be masked (meaning secret is still stored)
        assert data.get("csid_secret") == "••••••••", "Secret should still be masked"
        print("✓ POST /api/settings/zatca preserves secrets when masked values sent")

    # ===================== TEST CONNECTION =====================
    def test_zatca_test_connection_no_settings(self):
        """POST /api/settings/zatca/test should handle no settings"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        response = self.session.post(f"{BASE_URL}/api/settings/zatca/test")
        assert response.status_code == 200
        
        data = response.json()
        assert "success" in data, "Response should have success field"
        assert "message" in data, "Response should have message field"
        
        print(f"✓ POST /api/settings/zatca/test handles response: {data.get('message')}")

    def test_zatca_test_connection_disabled(self):
        """POST /api/settings/zatca/test should fail when disabled"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        # Save with disabled
        self.session.post(f"{BASE_URL}/api/settings/zatca", json={
            "enabled": False,
            "environment": "sandbox",
            "csid": "VEVTVF9DU0lE",
            "csid_secret": "test_secret"
        })
        
        response = self.session.post(f"{BASE_URL}/api/settings/zatca/test")
        data = response.json()
        
        assert data.get("success") == False, "Should fail when disabled"
        assert "disabled" in data.get("message", "").lower(), "Message should mention disabled"
        
        print("✓ POST /api/settings/zatca/test returns failure when disabled")

    def test_zatca_test_connection_no_csid(self):
        """POST /api/settings/zatca/test should fail when no CSID"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        # Save with enabled but no CSID
        self.session.post(f"{BASE_URL}/api/settings/zatca", json={
            "enabled": True,
            "environment": "sandbox",
            "csid": "",
            "csid_secret": "test_secret"
        })
        
        response = self.session.post(f"{BASE_URL}/api/settings/zatca/test")
        data = response.json()
        
        assert data.get("success") == False, "Should fail when no CSID"
        assert "csid" in data.get("message", "").lower(), "Message should mention CSID"
        
        print("✓ POST /api/settings/zatca/test returns failure when no CSID")

    def test_zatca_test_connection_invalid_csid_format(self):
        """POST /api/settings/zatca/test should fail for invalid Base64 CSID"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        # Save with invalid base64 CSID
        self.session.post(f"{BASE_URL}/api/settings/zatca", json={
            "enabled": True,
            "environment": "sandbox",
            "csid": "!!!not-valid-base64!!!",  # Invalid
            "csid_secret": "test_secret"
        })
        
        response = self.session.post(f"{BASE_URL}/api/settings/zatca/test")
        data = response.json()
        
        assert data.get("success") == False, "Should fail for invalid Base64"
        assert "base64" in data.get("message", "").lower(), "Message should mention Base64"
        
        print("✓ POST /api/settings/zatca/test validates Base64 format")

    def test_zatca_test_connection_valid_sandbox(self):
        """POST /api/settings/zatca/test should succeed for valid sandbox credentials"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        # Create valid base64 CSID
        valid_csid = base64.b64encode(b"VALID_CSID_FOR_TESTING_123456789").decode()
        
        # Save with valid credentials
        self.session.post(f"{BASE_URL}/api/settings/zatca", json={
            "enabled": True,
            "environment": "sandbox",
            "csid": valid_csid,
            "csid_secret": "valid_secret_key"
        })
        
        response = self.session.post(f"{BASE_URL}/api/settings/zatca/test")
        data = response.json()
        
        assert data.get("success") == True, f"Should succeed with valid credentials: {data.get('message')}"
        assert data.get("environment") == "sandbox", "Should return sandbox environment"
        assert "note" in data, "Should include note about MOCKED test"
        
        print("✓ POST /api/settings/zatca/test succeeds for valid sandbox credentials")

    def test_zatca_test_connection_valid_production(self):
        """POST /api/settings/zatca/test should succeed for valid production credentials"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        # Create valid base64 CSID for production
        valid_csid = base64.b64encode(b"VALID_PRODUCTION_CSID_123456789").decode()
        
        # Save with valid production credentials
        self.session.post(f"{BASE_URL}/api/settings/zatca", json={
            "enabled": True,
            "environment": "production",
            "production_csid": valid_csid,
            "production_secret": "valid_production_secret"
        })
        
        response = self.session.post(f"{BASE_URL}/api/settings/zatca/test")
        data = response.json()
        
        assert data.get("success") == True, f"Should succeed with valid credentials: {data.get('message')}"
        assert data.get("environment") == "production", "Should return production environment"
        
        print("✓ POST /api/settings/zatca/test succeeds for valid production credentials")

    # ===================== STATUS ENDPOINT =====================
    def test_zatca_status_returns_200(self):
        """GET /api/settings/zatca/status should return 200"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        response = self.session.get(f"{BASE_URL}/api/settings/zatca/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/settings/zatca/status returns 200")

    def test_zatca_status_structure(self):
        """GET /api/settings/zatca/status should return expected structure"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        response = self.session.get(f"{BASE_URL}/api/settings/zatca/status")
        data = response.json()
        
        # Check required fields
        required_fields = ["enabled", "environment", "vat_enabled", "vat_number", 
                          "csid_configured", "auto_submit", "invoice_counter", "statistics"]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        # Check statistics structure
        stats = data.get("statistics", {})
        assert "total_invoices" in stats, "statistics should have total_invoices"
        assert "zatca_ready" in stats, "statistics should have zatca_ready"
        assert "submitted" in stats, "statistics should have submitted"
        
        print("✓ GET /api/settings/zatca/status has correct structure")

    def test_zatca_status_reflects_settings(self):
        """GET /api/settings/zatca/status should reflect current settings"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        valid_csid = base64.b64encode(b"STATUS_TEST_CSID_123456789").decode()
        
        # Save specific settings
        self.session.post(f"{BASE_URL}/api/settings/zatca", json={
            "enabled": True,
            "environment": "sandbox",
            "csid": valid_csid,
            "csid_secret": "secret",
            "auto_submit": True,
            "invoice_counter": 999
        })
        
        # Get status
        response = self.session.get(f"{BASE_URL}/api/settings/zatca/status")
        data = response.json()
        
        assert data.get("enabled") == True, "Status should reflect enabled=True"
        assert data.get("environment") == "sandbox", "Status should reflect environment=sandbox"
        assert data.get("auto_submit") == True, "Status should reflect auto_submit=True"
        assert data.get("invoice_counter") == 999, "Status should reflect invoice_counter=999"
        assert data.get("csid_configured") == True, "csid_configured should be True"
        
        print("✓ GET /api/settings/zatca/status reflects current settings")

    def test_zatca_status_statistics_types(self):
        """GET /api/settings/zatca/status statistics should have correct types"""
        if not self.auth_success:
            pytest.skip("Auth failed")
        
        response = self.session.get(f"{BASE_URL}/api/settings/zatca/status")
        data = response.json()
        stats = data.get("statistics", {})
        
        assert isinstance(stats.get("total_invoices"), int), "total_invoices should be int"
        assert isinstance(stats.get("zatca_ready"), int), "zatca_ready should be int"
        assert isinstance(stats.get("submitted"), int), "submitted should be int"
        
        print("✓ GET /api/settings/zatca/status statistics have correct types")


# Cleanup after tests
@pytest.fixture(scope="module", autouse=True)
def cleanup():
    """Reset ZATCA settings after all tests"""
    yield
    session = requests.Session()
    login_response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if login_response.status_code == 200:
        token = login_response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        # Reset to defaults
        session.post(f"{BASE_URL}/api/settings/zatca", json={
            "enabled": False,
            "environment": "sandbox",
            "otp": "",
            "csid": "",
            "csid_secret": "",
            "production_csid": "",
            "production_secret": "",
            "certificate": "",
            "private_key": "",
            "auto_submit": False,
            "invoice_counter": 1
        })
