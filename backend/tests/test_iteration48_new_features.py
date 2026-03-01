"""
Iteration 48 Test Suite
Tests for 5 new feature sets:
1. Bank Auto-Match Engine: POST /auto-match, GET /matches, POST /confirm, DELETE /reject
2. Push Notification Preferences: channel_push, channel_whatsapp toggles
3. Daily Digest Email: POST /scheduler/ai-reports/daily_digest/trigger
4. (Frontend features: PWA, Keyboard Shortcuts - tested via Playwright)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and get token."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return auth headers."""
    return {"Authorization": f"Bearer {auth_token}"}


class TestBankAutoMatchEngine:
    """Test bank auto-match endpoints"""

    def test_get_bank_statements(self, auth_headers):
        """GET /api/bank-statements - list available statements"""
        response = requests.get(f"{BASE_URL}/api/bank-statements", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} bank statements")

    def test_auto_match_with_no_statement(self, auth_headers):
        """POST /api/bank-statements/nonexistent/auto-match - should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/bank-statements/nonexistent_id/auto-match",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("Correctly returns 404 for non-existent statement")

    def test_get_matches_with_no_statement(self, auth_headers):
        """GET /api/bank-statements/nonexistent/matches"""
        response = requests.get(
            f"{BASE_URL}/api/bank-statements/nonexistent_id/matches",
            headers=auth_headers
        )
        # Should return empty list for non-existent statement
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        print("Correctly returns empty list for non-existent statement")

    def test_confirm_match_nonexistent(self, auth_headers):
        """POST /api/bank-statements/{stmt_id}/matches/{match_id}/confirm - 404 for non-existent"""
        response = requests.post(
            f"{BASE_URL}/api/bank-statements/test_stmt/matches/test_match/confirm",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("Confirm returns 404 for non-existent match")

    def test_reject_match_nonexistent(self, auth_headers):
        """DELETE /api/bank-statements/{stmt_id}/matches/{match_id}"""
        response = requests.delete(
            f"{BASE_URL}/api/bank-statements/test_stmt/matches/test_match",
            headers=auth_headers
        )
        # Delete on non-existent should return success (idempotent)
        assert response.status_code == 200
        print("Delete returns 200 for non-existent match (idempotent)")


class TestBankAutoMatchWithRealStatement:
    """Test auto-match with real bank statement if available"""

    def test_auto_match_on_real_statement(self, auth_headers):
        """Test auto-match on an existing bank statement if available"""
        # Get list of statements
        list_resp = requests.get(f"{BASE_URL}/api/bank-statements", headers=auth_headers)
        statements = list_resp.json()
        
        if len(statements) == 0:
            pytest.skip("No bank statements available for auto-match testing")
        
        stmt = statements[0]
        stmt_id = stmt.get("id")
        print(f"Testing auto-match on statement: {stmt.get('file_name', stmt_id)}")
        
        # Run auto-match
        response = requests.post(
            f"{BASE_URL}/api/bank-statements/{stmt_id}/auto-match",
            headers=auth_headers,
            params={"tolerance": 5.0, "date_range": 3}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "matched" in data
        assert "unmatched" in data
        assert "stats" in data
        
        stats = data["stats"]
        assert "total_txns" in stats
        assert "auto_matched" in stats
        assert "unmatched" in stats
        
        print(f"Auto-match stats: {stats}")
        print(f"Matched: {len(data['matched'])}, Unmatched: {len(data['unmatched'])}")

    def test_get_matches_after_auto_match(self, auth_headers):
        """GET /api/bank-statements/{stmt_id}/matches after auto-match"""
        list_resp = requests.get(f"{BASE_URL}/api/bank-statements", headers=auth_headers)
        statements = list_resp.json()
        
        if len(statements) == 0:
            pytest.skip("No bank statements available")
        
        stmt_id = statements[0].get("id")
        
        response = requests.get(
            f"{BASE_URL}/api/bank-statements/{stmt_id}/matches",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            match = data[0]
            # Validate match structure
            expected_fields = ["id", "statement_id", "txn_index", "txn_amount", 
                              "match_type", "match_id", "confidence", "status"]
            for field in expected_fields:
                assert field in match, f"Missing field: {field}"
            
            print(f"Found {len(data)} matches with proper structure")
        else:
            print("No matches found (may be no matching transactions)")


class TestNotificationPreferencesChannel:
    """Test push notification preferences including WhatsApp channel"""

    def test_get_preferences_has_channels(self, auth_headers):
        """GET /api/push/preferences - should include channel_push and channel_whatsapp"""
        response = requests.get(f"{BASE_URL}/api/push/preferences", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check for channel preferences
        assert "channel_push" in data or data.get("channel_push") is not None
        assert "channel_whatsapp" in data or data.get("channel_whatsapp") is not None
        
        print(f"channel_push: {data.get('channel_push')}")
        print(f"channel_whatsapp: {data.get('channel_whatsapp')}")

    def test_update_preferences_with_channels(self, auth_headers):
        """PUT /api/push/preferences - update including channel preferences"""
        payload = {
            "low_stock_alerts": True,
            "leave_requests": True,
            "order_updates": False,
            "loan_installments": True,
            "expense_anomalies": True,
            "document_expiry": True,
            "daily_summary": False,
            "channel_push": True,
            "channel_whatsapp": True  # Enable WhatsApp channel
        }
        
        response = requests.put(
            f"{BASE_URL}/api/push/preferences",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        print("Successfully updated preferences with WhatsApp channel enabled")
        
        # Verify the update
        verify_resp = requests.get(f"{BASE_URL}/api/push/preferences", headers=auth_headers)
        assert verify_resp.status_code == 200
        data = verify_resp.json()
        assert data.get("channel_whatsapp") == True
        assert data.get("channel_push") == True
        print("Verified channel preferences were saved")

    def test_disable_whatsapp_channel(self, auth_headers):
        """Disable WhatsApp channel and verify"""
        payload = {
            "low_stock_alerts": True,
            "leave_requests": True,
            "order_updates": True,
            "loan_installments": True,
            "expense_anomalies": True,
            "document_expiry": True,
            "daily_summary": False,
            "channel_push": True,
            "channel_whatsapp": False
        }
        
        response = requests.put(
            f"{BASE_URL}/api/push/preferences",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200
        
        # Verify
        verify_resp = requests.get(f"{BASE_URL}/api/push/preferences", headers=auth_headers)
        data = verify_resp.json()
        assert data.get("channel_whatsapp") == False
        print("WhatsApp channel disabled and verified")


class TestDailyDigestEmail:
    """Test daily digest email feature"""

    def test_trigger_daily_digest(self, auth_headers):
        """POST /api/scheduler/ai-reports/daily_digest/trigger - trigger daily digest"""
        response = requests.post(
            f"{BASE_URL}/api/scheduler/ai-reports/daily_digest/trigger",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "message" in data
        assert "preview" in data
        
        preview = data.get("preview", "")
        assert "SSC Track" in preview or "Daily Digest" in preview
        
        print(f"Daily digest triggered successfully")
        print(f"Preview snippet: {preview[:200]}...")

    def test_ai_reports_list_includes_daily_digest(self, auth_headers):
        """GET /api/scheduler/ai-reports - verify daily_digest is available"""
        response = requests.get(
            f"{BASE_URL}/api/scheduler/ai-reports",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "available_reports" in data
        report_types = [r["type"] for r in data["available_reports"]]
        assert "daily_digest" in report_types
        
        # Find the daily_digest entry
        digest_report = next((r for r in data["available_reports"] if r["type"] == "daily_digest"), None)
        assert digest_report is not None
        assert "name" in digest_report
        assert "description" in digest_report
        
        print(f"Daily digest report info: {digest_report}")

    def test_scheduler_config_includes_daily_digest(self, auth_headers):
        """GET /api/scheduler/config - verify daily_digest job type exists"""
        response = requests.get(
            f"{BASE_URL}/api/scheduler/config",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        job_types = [cfg.get("job_type") for cfg in data]
        assert "daily_digest" in job_types
        
        # Find daily_digest config
        digest_config = next((cfg for cfg in data if cfg.get("job_type") == "daily_digest"), None)
        assert digest_config is not None
        
        print(f"Daily digest scheduler config: {digest_config}")


class TestSchedulerTriggers:
    """Test other scheduler trigger endpoints"""

    def test_trigger_other_ai_reports(self, auth_headers):
        """Test triggering other AI report types"""
        report_types = ["cashflow_alert", "employee_performance", "expense_anomaly", "supplier_reminder"]
        
        for report_type in report_types:
            response = requests.post(
                f"{BASE_URL}/api/scheduler/ai-reports/{report_type}/trigger",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "message" in data
            print(f"  {report_type}: triggered successfully")

    def test_trigger_invalid_report_type(self, auth_headers):
        """POST /api/scheduler/ai-reports/invalid/trigger - should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/scheduler/ai-reports/invalid_type/trigger",
            headers=auth_headers
        )
        assert response.status_code == 400
        print("Invalid report type correctly returns 400")


class TestReconciliationEndpoints:
    """Test existing reconciliation endpoints (used by ReconciliationPage)"""

    def test_get_reconciliation_for_statement(self, auth_headers):
        """GET /api/bank-statements/{stmt_id}/reconciliation"""
        list_resp = requests.get(f"{BASE_URL}/api/bank-statements", headers=auth_headers)
        statements = list_resp.json()
        
        if len(statements) == 0:
            pytest.skip("No bank statements available")
        
        stmt_id = statements[0].get("id")
        
        response = requests.get(
            f"{BASE_URL}/api/bank-statements/{stmt_id}/reconciliation",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Validate structure
        assert "rows" in data
        assert "summary" in data
        
        summary = data.get("summary", {})
        expected_fields = ["total_bank_pos", "total_app_sales", "total_difference", 
                          "matched_count", "discrepancy_count", "total_rows"]
        for field in expected_fields:
            assert field in summary, f"Missing field in summary: {field}"
        
        print(f"Reconciliation summary: {summary}")


class TestVapidKeyEndpoint:
    """Test VAPID key endpoint for push notifications"""

    def test_get_vapid_key(self, auth_headers):
        """GET /api/push/vapid-key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "publicKey" in data
        # Public key may be empty if not configured, but field should exist
        print(f"VAPID public key available: {'Yes' if data.get('publicKey') else 'Not configured'}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
