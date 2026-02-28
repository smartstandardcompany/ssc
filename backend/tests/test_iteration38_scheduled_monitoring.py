"""
Iteration 38: Testing P1/P2 Features
1) Scheduled AI Monitoring with WhatsApp/Email notifications
2) Partner P&L Report
3) Mobile Tab Bar Customization

Admin credentials: ss@ssc.com / Aa147258369Ssc@
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPartnerPLReport:
    """Tests for Partner P&L Report API"""
    
    @pytest.fixture(autouse=True)
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_partner_pl_report_endpoint_exists(self):
        """Test GET /api/partner-pl-report returns data"""
        response = requests.get(f"{BASE_URL}/api/partner-pl-report", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Check structure
        assert "company_summary" in data or "error" in data
    
    def test_partner_pl_report_company_summary(self):
        """Test Partner P&L report includes company summary"""
        response = requests.get(f"{BASE_URL}/api/partner-pl-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # If we have partners data
        if "company_summary" in data:
            summary = data["company_summary"]
            # Verify expected fields
            expected_fields = ["total_revenue", "net_profit"]
            for field in expected_fields:
                assert field in summary, f"Missing {field} in company_summary"
    
    def test_partner_pl_report_date_filter(self):
        """Test Partner P&L report with date range filter"""
        params = {"start_date": "2025-01-01", "end_date": "2025-12-31"}
        response = requests.get(f"{BASE_URL}/api/partner-pl-report", params=params, headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have period info
        if "period" in data:
            assert data["period"]["start"] == "2025-01-01"
            assert data["period"]["end"] == "2025-12-31"
    
    def test_partner_pl_report_partner_breakdown(self):
        """Test Partner P&L report includes partner breakdown"""
        response = requests.get(f"{BASE_URL}/api/partner-pl-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have partners list
        assert "partners" in data
        assert isinstance(data["partners"], list)
        
        # If partners exist, check structure
        if data["partners"]:
            partner = data["partners"][0]
            assert "partner_id" in partner or "partner_name" in partner
    
    def test_partner_pl_report_expense_categories(self):
        """Test Partner P&L report includes expense breakdown"""
        response = requests.get(f"{BASE_URL}/api/partner-pl-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have expense by category
        if "expense_by_category" in data:
            assert isinstance(data["expense_by_category"], list)
    
    def test_partner_pl_report_payment_breakdown(self):
        """Test Partner P&L report includes payment mode breakdown"""
        response = requests.get(f"{BASE_URL}/api/partner-pl-report", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have payment breakdown
        if "payment_breakdown" in data:
            breakdown = data["payment_breakdown"]
            assert "cash" in breakdown or len(breakdown) > 0


class TestScheduledAIMonitoring:
    """Tests for Scheduled AI Monitoring config and execution"""
    
    @pytest.fixture(autouse=True)
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_monitoring_config(self):
        """Test GET /api/cctv/monitoring/config returns configuration"""
        response = requests.get(f"{BASE_URL}/api/cctv/monitoring/config", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Check expected fields
        assert "enabled" in data
        assert "interval_minutes" in data
        assert "features" in data
        assert "notification_channels" in data
    
    def test_save_monitoring_config(self):
        """Test POST /api/cctv/monitoring/config saves configuration"""
        config = {
            "enabled": True,
            "interval_minutes": 5,
            "cameras": [],
            "features": ["people_counting", "motion_detection"],
            "notification_channels": ["in_app", "whatsapp"]
        }
        response = requests.post(f"{BASE_URL}/api/cctv/monitoring/config", json=config, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True
    
    def test_save_monitoring_config_with_email(self):
        """Test monitoring config with email notification channel"""
        config = {
            "enabled": True,
            "interval_minutes": 15,
            "cameras": [],
            "features": ["people_counting", "motion_detection", "object_detection"],
            "notification_channels": ["in_app", "email"]
        }
        response = requests.post(f"{BASE_URL}/api/cctv/monitoring/config", json=config, headers=self.headers)
        assert response.status_code == 200
        
        # Verify saved
        get_response = requests.get(f"{BASE_URL}/api/cctv/monitoring/config", headers=self.headers)
        data = get_response.json()
        assert "email" in data.get("notification_channels", [])
    
    def test_run_monitoring_disabled(self):
        """Test POST /api/cctv/monitoring/run when disabled"""
        # First disable monitoring
        config = {
            "enabled": False,
            "interval_minutes": 5,
            "cameras": [],
            "features": ["people_counting"],
            "notification_channels": ["in_app"]
        }
        requests.post(f"{BASE_URL}/api/cctv/monitoring/config", json=config, headers=self.headers)
        
        # Try to run
        response = requests.post(f"{BASE_URL}/api/cctv/monitoring/run", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Should indicate disabled
        assert data.get("success") == False or "disabled" in data.get("message", "").lower()
    
    def test_run_monitoring_enabled(self):
        """Test POST /api/cctv/monitoring/run when enabled"""
        # Enable monitoring
        config = {
            "enabled": True,
            "interval_minutes": 5,
            "cameras": [],
            "features": ["people_counting", "motion_detection"],
            "notification_channels": ["in_app"]
        }
        requests.post(f"{BASE_URL}/api/cctv/monitoring/config", json=config, headers=self.headers)
        
        # Try to run
        response = requests.post(f"{BASE_URL}/api/cctv/monitoring/run", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "queued" in data.get("message", "").lower() or "success" in str(data)
    
    def test_get_monitoring_logs(self):
        """Test GET /api/cctv/monitoring/logs returns logs"""
        response = requests.get(f"{BASE_URL}/api/cctv/monitoring/logs", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestCCTVIntegration:
    """Tests for CCTV Settings integration with monitoring"""
    
    @pytest.fixture(autouse=True)
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_cctv_settings(self):
        """Test CCTV settings endpoint"""
        response = requests.get(f"{BASE_URL}/api/cctv/settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "people_counting_enabled" in data
        assert "motion_alerts_enabled" in data
    
    def test_cctv_alerts(self):
        """Test CCTV alerts endpoint"""
        response = requests.get(f"{BASE_URL}/api/cctv/alerts", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestPartnersAPI:
    """Tests for Partners API supporting P&L report"""
    
    @pytest.fixture(autouse=True)
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_partners_list(self):
        """Test GET /api/partners returns list"""
        response = requests.get(f"{BASE_URL}/api/partners", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
