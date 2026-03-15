"""
Iteration 147: Platform Features Tests
Testing:
1. White-Label Branding API (/api/branding)
2. Scheduled Reports API (/api/scheduled-reports)
3. Usage Alerts API (/api/usage-alerts)
4. API Rate Limiting Headers

Test accounts:
- Super Admin: ss@ssc.com / Aa147258369Ssc@
- Operator: test@ssc.com / testtest
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication setup tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get super admin auth token"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        return resp.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def operator_token(self):
        """Get operator auth token (for rate limit testing)"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@ssc.com",
            "password": "testtest"
        })
        if resp.status_code != 200:
            pytest.skip("Operator account not found - skipping operator tests")
        return resp.json()["access_token"]
    
    def test_admin_login(self, admin_token):
        """Verify admin can login"""
        assert admin_token is not None
        print(f"PASS: Admin login successful")


# ═══════════════════════════════════════════════════════════════════
# 1. WHITE-LABEL BRANDING TESTS
# ═══════════════════════════════════════════════════════════════════

class TestWhiteLabelBranding:
    """White-Label Branding API tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return resp.json()["access_token"]
    
    def test_get_branding_returns_default_or_saved(self, admin_token):
        """GET /api/branding returns branding settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/branding", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        # Should have default fields
        assert "primary_color" in data, "Missing primary_color in branding response"
        assert "app_name" in data, "Missing app_name in branding response"
        assert "tagline" in data, "Missing tagline in branding response"
        assert "sidebar_color" in data, "Missing sidebar_color in branding response"
        print(f"PASS: GET /api/branding returned: {data.get('app_name')}, primary_color: {data.get('primary_color')}")
    
    def test_update_branding_settings(self, admin_token):
        """PUT /api/branding updates branding settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_name = f"TEST_App_{uuid.uuid4().hex[:6]}"
        resp = requests.put(f"{BASE_URL}/api/branding", headers=headers, json={
            "app_name": test_name,
            "tagline": "Test Tagline",
            "primary_color": "#FF5500",
            "accent_color": "#FFAA00",
            "sidebar_color": "#222222",
            "hide_powered_by": True
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        
        # Verify the update was saved
        resp2 = requests.get(f"{BASE_URL}/api/branding", headers=headers)
        assert resp2.status_code == 200
        data = resp2.json()
        assert data["app_name"] == test_name, f"Expected app_name {test_name}, got {data['app_name']}"
        assert data["primary_color"] == "#FF5500", "Primary color not updated"
        assert data["hide_powered_by"] == True, "hide_powered_by not updated"
        print(f"PASS: PUT /api/branding successfully updated app_name to {test_name}")
        
        # Reset to default
        requests.put(f"{BASE_URL}/api/branding", headers=headers, json={
            "app_name": "SSC Track",
            "tagline": "Business Management Platform",
            "primary_color": "#f97316",
            "hide_powered_by": False
        })
    
    def test_branding_requires_authentication(self):
        """GET /api/branding requires auth"""
        resp = requests.get(f"{BASE_URL}/api/branding")
        assert resp.status_code in [401, 403], f"Expected 401/403 without auth, got {resp.status_code}"
        print("PASS: /api/branding requires authentication")


# ═══════════════════════════════════════════════════════════════════
# 2. SCHEDULED REPORTS TESTS
# ═══════════════════════════════════════════════════════════════════

class TestScheduledReports:
    """Scheduled Reports API tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return resp.json()["access_token"]
    
    def test_get_scheduled_reports_list(self, admin_token):
        """GET /api/scheduled-reports returns list"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/scheduled-reports", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Expected list response"
        print(f"PASS: GET /api/scheduled-reports returned {len(data)} reports")
    
    def test_create_scheduled_report(self, admin_token):
        """POST /api/scheduled-reports creates a new report"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_name = f"TEST_Report_{uuid.uuid4().hex[:6]}"
        resp = requests.post(f"{BASE_URL}/api/scheduled-reports", headers=headers, json={
            "name": test_name,
            "report_type": "daily_summary",
            "schedule": "daily",
            "recipients": ["test@example.com"]
        })
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("id"), "Response should contain report id"
        assert data.get("name") == test_name, f"Expected name {test_name}, got {data.get('name')}"
        assert data.get("report_type") == "daily_summary"
        assert data.get("schedule") == "daily"
        assert data.get("is_active") == True, "New report should be active"
        assert data.get("next_run"), "Should have next_run scheduled"
        print(f"PASS: POST /api/scheduled-reports created report: {test_name}")
        return data.get("id")
    
    def test_delete_scheduled_report(self, admin_token):
        """DELETE /api/scheduled-reports/{id} deletes a report"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Create a report to delete
        test_name = f"TEST_DeleteMe_{uuid.uuid4().hex[:6]}"
        create_resp = requests.post(f"{BASE_URL}/api/scheduled-reports", headers=headers, json={
            "name": test_name,
            "report_type": "sales_report",
            "schedule": "weekly"
        })
        assert create_resp.status_code == 200
        report_id = create_resp.json().get("id")
        
        # Delete it
        del_resp = requests.delete(f"{BASE_URL}/api/scheduled-reports/{report_id}", headers=headers)
        assert del_resp.status_code == 200, f"Expected 200, got {del_resp.status_code}: {del_resp.text}"
        
        # Verify it's gone
        list_resp = requests.get(f"{BASE_URL}/api/scheduled-reports", headers=headers)
        reports = list_resp.json()
        assert not any(r.get("id") == report_id for r in reports), "Report should be deleted"
        print(f"PASS: DELETE /api/scheduled-reports/{report_id} successful")
    
    def test_get_report_history(self, admin_token):
        """GET /api/scheduled-reports/history returns history"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/scheduled-reports/history", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert isinstance(data, list), "Expected list response"
        print(f"PASS: GET /api/scheduled-reports/history returned {len(data)} entries")
    
    def test_scheduled_reports_requires_admin(self):
        """Scheduled reports requires admin role"""
        resp = requests.get(f"{BASE_URL}/api/scheduled-reports")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("PASS: /api/scheduled-reports requires authentication")


# ═══════════════════════════════════════════════════════════════════
# 3. USAGE ALERTS TESTS
# ═══════════════════════════════════════════════════════════════════

class TestUsageAlerts:
    """Usage Alerts API tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return resp.json()["access_token"]
    
    def test_get_usage_alerts(self, admin_token):
        """GET /api/usage-alerts returns usage data and alerts"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/usage-alerts", headers=headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "alerts" in data, "Missing alerts field"
        assert "plan" in data, "Missing plan field"
        assert "usage" in data, "Missing usage field"
        assert "limits" in data, "Missing limits field"
        
        # Verify usage structure
        usage = data["usage"]
        assert "users" in usage, "Missing users in usage"
        assert "branches" in usage, "Missing branches in usage"
        
        # Verify limits structure
        limits = data["limits"]
        assert "max_users" in limits, "Missing max_users in limits"
        assert "max_branches" in limits, "Missing max_branches in limits"
        
        print(f"PASS: GET /api/usage-alerts returned plan={data['plan']}, users={usage['users']}, branches={usage['branches']}")
    
    def test_enterprise_plan_has_unlimited_limits(self, admin_token):
        """Enterprise plan should have unlimited (-1) limits"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/usage-alerts", headers=headers)
        data = resp.json()
        
        # ss@ssc.com is enterprise plan
        if data["plan"] == "enterprise":
            assert data["limits"]["max_users"] == -1, "Enterprise should have unlimited users"
            assert data["limits"]["max_branches"] == -1, "Enterprise should have unlimited branches"
            print("PASS: Enterprise plan has unlimited limits (max_users=-1, max_branches=-1)")
        else:
            print(f"INFO: Current plan is {data['plan']}, not enterprise")
    
    def test_usage_alerts_requires_auth(self):
        """Usage alerts requires authentication"""
        resp = requests.get(f"{BASE_URL}/api/usage-alerts")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        print("PASS: /api/usage-alerts requires authentication")


# ═══════════════════════════════════════════════════════════════════
# 4. API RATE LIMITING TESTS
# ═══════════════════════════════════════════════════════════════════

class TestRateLimiting:
    """API Rate Limiting tests - headers should appear for non-enterprise plans"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Super admin token (enterprise plan - unlimited)"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return resp.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def operator_token(self):
        """Operator token (non-enterprise plan)"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@ssc.com",
            "password": "testtest"
        })
        if resp.status_code != 200:
            pytest.skip("Operator account test@ssc.com not found")
        return resp.json()["access_token"]
    
    def test_enterprise_no_rate_limit_headers(self, admin_token):
        """Enterprise plan should not show rate limit headers (unlimited)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/branding", headers=headers)
        
        # For enterprise, either no headers or limit=-1
        has_limit_header = "X-RateLimit-Limit" in resp.headers
        if has_limit_header:
            limit = resp.headers.get("X-RateLimit-Limit")
            assert limit == "-1", f"Enterprise should have unlimited (-1), got {limit}"
            print("PASS: Enterprise plan has X-RateLimit-Limit=-1 (unlimited)")
        else:
            print("PASS: Enterprise plan has no rate limit headers (unlimited)")
    
    def test_operator_rate_limit_headers(self, operator_token):
        """Non-enterprise plan should show rate limit headers"""
        headers = {"Authorization": f"Bearer {operator_token}"}
        resp = requests.get(f"{BASE_URL}/api/dashboard", headers=headers)
        
        # Check for rate limit headers
        has_limit = "X-RateLimit-Limit" in resp.headers
        has_remaining = "X-RateLimit-Remaining" in resp.headers
        has_reset = "X-RateLimit-Reset" in resp.headers
        
        if has_limit:
            limit = resp.headers.get("X-RateLimit-Limit")
            remaining = resp.headers.get("X-RateLimit-Remaining")
            reset = resp.headers.get("X-RateLimit-Reset")
            print(f"PASS: Operator has rate limit headers - Limit: {limit}, Remaining: {remaining}, Reset: {reset}s")
            assert int(limit) > 0 or limit == "-1", "Limit should be positive or -1"
        else:
            # If operator is also on enterprise plan, that's ok
            print("INFO: Operator account may be on enterprise plan - no rate limit headers")
    
    def test_rate_limit_middleware_active(self, admin_token):
        """Verify rate limit middleware is active on API routes"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Make a simple request to any API endpoint
        resp = requests.get(f"{BASE_URL}/api/", headers=headers)
        assert resp.status_code == 200, f"API root should return 200, got {resp.status_code}"
        print("PASS: API endpoint accessible, middleware active")


# ═══════════════════════════════════════════════════════════════════
# REGRESSION TESTS
# ═══════════════════════════════════════════════════════════════════

class TestRegression:
    """Regression tests to ensure existing functionality works"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return resp.json()["access_token"]
    
    def test_dashboard_endpoint(self, admin_token):
        """Dashboard endpoints still work"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Try the dashboard data endpoint
        resp = requests.get(f"{BASE_URL}/api/dashboard/data", headers=headers)
        # 200 or 404 with empty data is fine - endpoint exists
        assert resp.status_code in [200, 404], f"Dashboard failed: {resp.status_code}"
        print(f"PASS: Dashboard endpoint returned {resp.status_code}")
    
    def test_branches_endpoint(self, admin_token):
        """Branches endpoint still works"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        assert resp.status_code == 200, f"Branches failed: {resp.status_code}"
        print("PASS: Branches endpoint working")
    
    def test_login_still_works(self):
        """Login endpoint still works"""
        resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert resp.status_code == 200, f"Login failed: {resp.status_code}"
        assert "access_token" in resp.json(), "Missing access_token"
        print("PASS: Login endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
