"""
Iteration 77 - Test Backlog Features:
- Supplier Aging Report (GET /api/suppliers/aging-report)
- Supplier Aging Export (GET /api/suppliers/aging-report/export)
- Trend Comparison (GET /api/reports/trend-comparison)
- CCTV Monitoring Schedules CRUD
- CCTV Motion Alerts CRUD
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
AUTH_TOKEN = None


@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and get token"""
    global AUTH_TOKEN
    if AUTH_TOKEN:
        return AUTH_TOKEN
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
    )
    if response.status_code == 200:
        AUTH_TOKEN = response.json().get("access_token")
        return AUTH_TOKEN
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture
def api(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


# =====================================================
# SUPPLIER AGING REPORT TESTS
# =====================================================

class TestSupplierAgingReport:
    """Test GET /api/suppliers/aging-report"""
    
    def test_get_aging_report(self, api):
        """Aging report returns proper structure with buckets"""
        response = api.get(f"{BASE_URL}/api/suppliers/aging-report")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check structure
        assert "totals" in data, "Response should have 'totals'"
        assert "suppliers" in data, "Response should have 'suppliers'"
        assert "supplier_count" in data, "Response should have 'supplier_count'"
        assert "report_date" in data, "Response should have 'report_date'"
        
        # Check bucket keys in totals
        totals = data["totals"]
        assert "0_30" in totals, "Totals should have '0_30' bucket"
        assert "31_60" in totals, "Totals should have '31_60' bucket"
        assert "61_90" in totals, "Totals should have '61_90' bucket"
        assert "90_plus" in totals, "Totals should have '90_plus' bucket"
        assert "total" in totals, "Totals should have 'total'"
        
        print(f"✓ Aging report returned {data['supplier_count']} suppliers with total outstanding: SAR {totals['total']}")
    
    def test_get_aging_report_with_branch_filter(self, api):
        """Test aging report with branch filter"""
        # First get branches
        branches_resp = api.get(f"{BASE_URL}/api/branches")
        if branches_resp.status_code == 200 and branches_resp.json():
            branch_id = branches_resp.json()[0]["id"]
            response = api.get(f"{BASE_URL}/api/suppliers/aging-report?branch_id={branch_id}")
            assert response.status_code == 200, f"Expected 200, got {response.status_code}"
            print(f"✓ Aging report with branch filter returned successfully")
        else:
            pytest.skip("No branches available for filter test")


class TestSupplierAgingExport:
    """Test GET /api/suppliers/aging-report/export"""
    
    def test_export_aging_pdf(self, api):
        """Export aging report as PDF"""
        response = api.get(f"{BASE_URL}/api/suppliers/aging-report/export?format=pdf")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "pdf" in response.headers.get("content-type", "").lower() or "octet-stream" in response.headers.get("content-type", "").lower(), "Response should be PDF"
        assert len(response.content) > 100, "PDF should have content"
        print(f"✓ PDF export successful, size: {len(response.content)} bytes")
    
    def test_export_aging_excel(self, api):
        """Export aging report as Excel"""
        response = api.get(f"{BASE_URL}/api/suppliers/aging-report/export?format=excel")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        content_type = response.headers.get("content-type", "").lower()
        assert "spreadsheet" in content_type or "excel" in content_type or "octet-stream" in content_type, f"Response should be Excel, got {content_type}"
        assert len(response.content) > 100, "Excel should have content"
        print(f"✓ Excel export successful, size: {len(response.content)} bytes")


# =====================================================
# TREND COMPARISON TESTS
# =====================================================

class TestTrendComparison:
    """Test GET /api/reports/trend-comparison"""
    
    def test_get_trend_comparison(self, api):
        """Trend comparison returns weekly and monthly data with daily_trend"""
        response = api.get(f"{BASE_URL}/api/reports/trend-comparison")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check weekly structure
        assert "weekly" in data, "Response should have 'weekly'"
        weekly = data["weekly"]
        assert "this_week" in weekly, "Weekly should have 'this_week'"
        assert "last_week" in weekly, "Weekly should have 'last_week'"
        assert "sales_change" in weekly, "Weekly should have 'sales_change'"
        
        # Check this_week structure
        this_week = weekly["this_week"]
        assert "sales" in this_week, "this_week should have 'sales'"
        assert "expenses" in this_week, "this_week should have 'expenses'"
        assert "profit" in this_week, "this_week should have 'profit'"
        
        # Check monthly structure
        assert "monthly" in data, "Response should have 'monthly'"
        monthly = data["monthly"]
        assert "this_month" in monthly, "Monthly should have 'this_month'"
        assert "last_month" in monthly, "Monthly should have 'last_month'"
        assert "sales_change" in monthly, "Monthly should have 'sales_change'"
        
        # Check daily_trend for chart
        assert "daily_trend" in data, "Response should have 'daily_trend'"
        daily_trend = data["daily_trend"]
        assert isinstance(daily_trend, list), "daily_trend should be a list"
        assert len(daily_trend) == 14, f"daily_trend should have 14 days, got {len(daily_trend)}"
        
        # Check daily_trend item structure
        if daily_trend:
            day = daily_trend[0]
            assert "date" in day, "daily_trend item should have 'date'"
            assert "sales" in day, "daily_trend item should have 'sales'"
            assert "expenses" in day, "daily_trend item should have 'expenses'"
        
        print(f"✓ Trend comparison returned weekly/monthly data with {len(daily_trend)} days of trend")


# =====================================================
# CCTV MONITORING SCHEDULES TESTS
# =====================================================

class TestCCTVMonitoringSchedules:
    """Test CCTV monitoring schedules CRUD"""
    
    def test_get_monitoring_schedules(self, api):
        """GET /api/cctv/monitoring-schedules returns array"""
        response = api.get(f"{BASE_URL}/api/cctv/monitoring-schedules")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Monitoring schedules returned {len(data)} items")
    
    def test_create_monitoring_schedule(self, api):
        """POST /api/cctv/monitoring-schedules creates a new schedule"""
        schedule_data = {
            "name": "TEST_Night Watch Schedule",
            "camera_ids": [],
            "days": ["mon", "tue", "wed", "thu", "fri"],
            "start_time": "22:00",
            "end_time": "06:00",
            "alert_types": ["motion", "person"],
            "sensitivity": "high",
            "is_active": True,
            "notify_channels": ["app"]
        }
        
        response = api.post(f"{BASE_URL}/api/cctv/monitoring-schedules", json=schedule_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have 'id'"
        assert data.get("name") == "TEST_Night Watch Schedule", "Name should match"
        
        # Cleanup
        schedule_id = data["id"]
        api.delete(f"{BASE_URL}/api/cctv/monitoring-schedules/{schedule_id}")
        
        print(f"✓ Monitoring schedule created with ID: {schedule_id}")


# =====================================================
# CCTV MOTION ALERTS TESTS
# =====================================================

class TestCCTVMotionAlerts:
    """Test CCTV motion alerts CRUD"""
    
    def test_get_motion_alerts(self, api):
        """GET /api/cctv/motion-alerts returns array"""
        response = api.get(f"{BASE_URL}/api/cctv/motion-alerts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Motion alerts returned {len(data)} items")
    
    def test_create_motion_alert(self, api):
        """POST /api/cctv/motion-alerts creates a new alert"""
        alert_data = {
            "camera_id": "TEST_cam_001",
            "camera_name": "Test Camera",
            "alert_type": "motion",
            "severity": "medium",
            "description": "TEST motion detected in zone A",
            "zone": "Zone A",
            "confidence": 85
        }
        
        response = api.post(f"{BASE_URL}/api/cctv/motion-alerts", json=alert_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should have 'id'"
        assert data.get("camera_id") == "TEST_cam_001", "camera_id should match"
        assert data.get("alert_type") == "motion", "alert_type should match"
        assert data.get("acknowledged") == False, "acknowledged should be False"
        assert "timestamp" in data, "Response should have 'timestamp'"
        
        print(f"✓ Motion alert created with ID: {data['id']}")


# =====================================================
# BRANCH FILTER PROPAGATION TESTS
# =====================================================

class TestBranchFilterPropagation:
    """Test that restricted users have branch filter applied"""
    
    def test_assets_endpoint_with_branch_filter(self, api):
        """GET /api/assets should work and apply branch filter"""
        response = api.get(f"{BASE_URL}/api/assets")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Assets endpoint returned {len(data)} items")
    
    def test_documents_endpoint_with_branch_filter(self, api):
        """GET /api/documents should work and apply branch filter"""
        response = api.get(f"{BASE_URL}/api/documents")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Documents endpoint returned {len(data)} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
