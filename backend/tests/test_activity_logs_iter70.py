"""
Tests for Activity Logs P2 Feature - Iteration 70
Tests:
- Activity Logs API endpoints (GET /api/activity-logs, GET /api/activity-logs/summary)
- Login creates activity log entry with IP address
- Creating a sale creates activity log entry
- Deleting items creates activity log entries
- Activity Logs filter by action type (login, create, delete)
- Activity Logs filter by resource (auth, sales, expenses)
- Activity Logs pagination works correctly
- Activity Logs cleanup endpoint
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestActivityLogsAPI:
    """Activity Logs API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        token = login_response.json().get("token") or login_response.json().get("access_token")
        assert token, "No token received from login"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    # === Activity Logs List Endpoint ===
    
    def test_get_activity_logs_success(self):
        """Test GET /api/activity-logs returns logs successfully"""
        response = self.session.get(f"{BASE_URL}/api/activity-logs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "logs" in data, "Response should have 'logs' key"
        assert "total" in data, "Response should have 'total' key"
        assert "limit" in data, "Response should have 'limit' key"
        assert "offset" in data, "Response should have 'offset' key"
        assert isinstance(data["logs"], list), "logs should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        print(f"✅ Got {len(data['logs'])} logs, total: {data['total']}")
        
    def test_get_activity_logs_pagination(self):
        """Test activity logs pagination with limit and offset"""
        # Get first page
        response1 = self.session.get(f"{BASE_URL}/api/activity-logs?limit=5&offset=0")
        assert response1.status_code == 200
        data1 = response1.json()
        
        assert data1["limit"] == 5, "Limit should be 5"
        assert data1["offset"] == 0, "Offset should be 0"
        
        # If there are more than 5 logs, test second page
        if data1["total"] > 5:
            response2 = self.session.get(f"{BASE_URL}/api/activity-logs?limit=5&offset=5")
            assert response2.status_code == 200
            data2 = response2.json()
            assert data2["offset"] == 5, "Offset should be 5"
            
            # Ensure different logs
            if len(data1["logs"]) > 0 and len(data2["logs"]) > 0:
                assert data1["logs"][0]["id"] != data2["logs"][0]["id"], "First page and second page should have different logs"
                print("✅ Pagination working - pages have different logs")
        else:
            print(f"⚠️ Only {data1['total']} logs, skipping second page test")
            
    def test_get_activity_logs_filter_by_action(self):
        """Test filtering activity logs by action type"""
        # Filter by login action
        response = self.session.get(f"{BASE_URL}/api/activity-logs?action=login")
        assert response.status_code == 200
        data = response.json()
        
        # All returned logs should have action=login
        for log in data["logs"]:
            assert log["action"] == "login", f"Expected action 'login', got '{log['action']}'"
        print(f"✅ Filter by action=login returned {len(data['logs'])} login logs")
        
    def test_get_activity_logs_filter_by_resource(self):
        """Test filtering activity logs by resource type"""
        # Filter by auth resource
        response = self.session.get(f"{BASE_URL}/api/activity-logs?resource=auth")
        assert response.status_code == 200
        data = response.json()
        
        # All returned logs should have resource=auth
        for log in data["logs"]:
            assert log["resource"] == "auth", f"Expected resource 'auth', got '{log['resource']}'"
        print(f"✅ Filter by resource=auth returned {len(data['logs'])} auth logs")
        
    def test_get_activity_logs_filter_by_date_range(self):
        """Test filtering activity logs by date range"""
        from datetime import datetime, timedelta
        
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Filter by date range
        response = self.session.get(f"{BASE_URL}/api/activity-logs?start_date={yesterday}&end_date={today}")
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Date range filter returned {len(data['logs'])} logs")
        
    # === Activity Logs Summary Endpoint ===
    
    def test_get_activity_summary_success(self):
        """Test GET /api/activity-logs/summary returns summary data"""
        response = self.session.get(f"{BASE_URL}/api/activity-logs/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "period_days" in data, "Response should have 'period_days'"
        assert "by_action" in data, "Response should have 'by_action'"
        assert "by_resource" in data, "Response should have 'by_resource'"
        assert "top_users" in data, "Response should have 'top_users'"
        assert "recent_logins" in data, "Response should have 'recent_logins'"
        
        assert isinstance(data["by_action"], dict), "by_action should be a dict"
        assert isinstance(data["by_resource"], dict), "by_resource should be a dict"
        assert isinstance(data["top_users"], list), "top_users should be a list"
        
        print(f"✅ Activity summary: {data['by_action']} actions in last {data['period_days']} days")
        
    def test_get_activity_summary_custom_days(self):
        """Test activity summary with custom days parameter"""
        response = self.session.get(f"{BASE_URL}/api/activity-logs/summary?days=30")
        assert response.status_code == 200
        data = response.json()
        assert data["period_days"] == 30, "Period should be 30 days"
        print(f"✅ Custom 30-day summary: {data['by_action']}")
        
    # === Login Activity Logging ===
    
    def test_login_creates_activity_log(self):
        """Test that login action creates an activity log entry"""
        # Get current login count
        initial_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=login&resource=auth&limit=100")
        initial_count = initial_response.json()["total"]
        
        # Perform a new login (creates new session)
        new_session = requests.Session()
        new_session.headers.update({"Content-Type": "application/json"})
        login_response = new_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_response.status_code == 200
        
        # Small delay to ensure log is written
        time.sleep(0.5)
        
        # Check login count increased
        new_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=login&resource=auth&limit=100")
        new_count = new_response.json()["total"]
        
        assert new_count > initial_count, f"Login count should increase. Initial: {initial_count}, New: {new_count}"
        print(f"✅ Login created activity log. Count: {initial_count} -> {new_count}")
        
    def test_login_log_has_ip_address(self):
        """Test that login activity log contains IP address"""
        response = self.session.get(f"{BASE_URL}/api/activity-logs?action=login&limit=5")
        assert response.status_code == 200
        logs = response.json()["logs"]
        
        if len(logs) > 0:
            latest_login = logs[0]
            assert "ip_address" in latest_login, "Login log should have ip_address"
            assert "user_email" in latest_login, "Login log should have user_email"
            assert "timestamp" in latest_login, "Login log should have timestamp"
            print(f"✅ Login log has IP: {latest_login.get('ip_address')}, email: {latest_login.get('user_email')}")
        else:
            print("⚠️ No login logs found to check IP address")
            
    # === Sales Activity Logging ===
    
    def test_create_sale_creates_activity_log(self):
        """Test that creating a sale creates an activity log"""
        from datetime import datetime
        
        # Get current sales create count
        initial_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=create&resource=sales&limit=100")
        initial_count = initial_response.json()["total"]
        
        # Create a test sale
        sale_data = {
            "sale_type": "branch",
            "amount": 100.00,
            "discount": 0,
            "payment_details": [{"mode": "cash", "amount": 100.00}],
            "notes": "TEST_ACTIVITY_LOG_SALE",
            "date": datetime.now().isoformat()
        }
        sale_response = self.session.post(f"{BASE_URL}/api/sales", json=sale_data)
        assert sale_response.status_code == 200, f"Create sale failed: {sale_response.text}"
        sale_id = sale_response.json()["id"]
        
        time.sleep(0.5)
        
        # Check create count increased
        new_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=create&resource=sales&limit=100")
        new_count = new_response.json()["total"]
        
        assert new_count > initial_count, f"Sales create count should increase. Initial: {initial_count}, New: {new_count}"
        print(f"✅ Sale create logged. Count: {initial_count} -> {new_count}")
        
        # Cleanup - delete the test sale
        self.session.delete(f"{BASE_URL}/api/sales/{sale_id}")
        
    def test_delete_sale_creates_activity_log(self):
        """Test that deleting a sale creates an activity log"""
        from datetime import datetime
        
        # First create a sale to delete
        sale_data = {
            "sale_type": "branch",
            "amount": 50.00,
            "discount": 0,
            "payment_details": [{"mode": "cash", "amount": 50.00}],
            "notes": "TEST_DELETE_ACTIVITY_LOG",
            "date": datetime.now().isoformat()
        }
        sale_response = self.session.post(f"{BASE_URL}/api/sales", json=sale_data)
        assert sale_response.status_code == 200
        sale_id = sale_response.json()["id"]
        
        # Get current delete count
        initial_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=delete&resource=sales&limit=100")
        initial_count = initial_response.json()["total"]
        
        # Delete the sale
        delete_response = self.session.delete(f"{BASE_URL}/api/sales/{sale_id}")
        assert delete_response.status_code == 200
        
        time.sleep(0.5)
        
        # Check delete count increased
        new_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=delete&resource=sales&limit=100")
        new_count = new_response.json()["total"]
        
        assert new_count > initial_count, f"Sales delete count should increase. Initial: {initial_count}, New: {new_count}"
        print(f"✅ Sale delete logged. Count: {initial_count} -> {new_count}")
        
    # === Expense Activity Logging ===
    
    def test_create_expense_creates_activity_log(self):
        """Test that creating an expense creates an activity log"""
        from datetime import datetime
        
        # Get current expense create count
        initial_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=create&resource=expenses&limit=100")
        initial_count = initial_response.json()["total"]
        
        # Create a test expense
        expense_data = {
            "category": "general",
            "description": "TEST_ACTIVITY_LOG_EXPENSE",
            "amount": 25.00,
            "payment_mode": "cash",
            "date": datetime.now().isoformat()
        }
        expense_response = self.session.post(f"{BASE_URL}/api/expenses", json=expense_data)
        assert expense_response.status_code == 200, f"Create expense failed: {expense_response.text}"
        expense_id = expense_response.json()["id"]
        
        time.sleep(0.5)
        
        # Check create count increased
        new_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=create&resource=expenses&limit=100")
        new_count = new_response.json()["total"]
        
        assert new_count > initial_count, f"Expense create count should increase. Initial: {initial_count}, New: {new_count}"
        print(f"✅ Expense create logged. Count: {initial_count} -> {new_count}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/expenses/{expense_id}")
        
    def test_delete_expense_creates_activity_log(self):
        """Test that deleting an expense creates an activity log"""
        from datetime import datetime
        
        # First create an expense to delete
        expense_data = {
            "category": "general",
            "description": "TEST_DELETE_EXPENSE_LOG",
            "amount": 15.00,
            "payment_mode": "cash",
            "date": datetime.now().isoformat()
        }
        expense_response = self.session.post(f"{BASE_URL}/api/expenses", json=expense_data)
        assert expense_response.status_code == 200
        expense_id = expense_response.json()["id"]
        
        # Get current delete count
        initial_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=delete&resource=expenses&limit=100")
        initial_count = initial_response.json()["total"]
        
        # Delete the expense
        delete_response = self.session.delete(f"{BASE_URL}/api/expenses/{expense_id}")
        assert delete_response.status_code == 200
        
        time.sleep(0.5)
        
        # Check delete count increased
        new_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=delete&resource=expenses&limit=100")
        new_count = new_response.json()["total"]
        
        assert new_count > initial_count, f"Expense delete count should increase. Initial: {initial_count}, New: {new_count}"
        print(f"✅ Expense delete logged. Count: {initial_count} -> {new_count}")
        
    # === Settings Activity Logging ===
    
    def test_settings_update_creates_activity_log(self):
        """Test that updating company settings creates an activity log"""
        # Get current settings update count
        initial_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=update&resource=settings&limit=100")
        initial_count = initial_response.json()["total"]
        
        # Get current company settings
        settings_response = self.session.get(f"{BASE_URL}/api/settings/company")
        assert settings_response.status_code == 200
        current_settings = settings_response.json()
        
        # Update company settings (make a trivial change)
        update_data = {
            "company_name": current_settings.get("company_name", "Smart Standard Company"),
            "vat_enabled": current_settings.get("vat_enabled", True),
            "vat_rate": current_settings.get("vat_rate", 15)
        }
        update_response = self.session.post(f"{BASE_URL}/api/settings/company", json=update_data)
        assert update_response.status_code == 200
        
        time.sleep(0.5)
        
        # Check update count increased
        new_response = self.session.get(f"{BASE_URL}/api/activity-logs?action=update&resource=settings&limit=100")
        new_count = new_response.json()["total"]
        
        assert new_count > initial_count, f"Settings update count should increase. Initial: {initial_count}, New: {new_count}"
        print(f"✅ Settings update logged. Count: {initial_count} -> {new_count}")
        
    # === Authorization Tests ===
    
    def test_activity_logs_requires_auth(self):
        """Test that activity logs endpoint requires authentication"""
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.get(f"{BASE_URL}/api/activity-logs")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✅ Activity logs requires authentication")
        
    def test_activity_summary_requires_auth(self):
        """Test that activity summary endpoint requires authentication"""
        unauthenticated_session = requests.Session()
        response = unauthenticated_session.get(f"{BASE_URL}/api/activity-logs/summary")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✅ Activity summary requires authentication")
        
    # === Cleanup Endpoint ===
    
    def test_cleanup_endpoint_exists(self):
        """Test that cleanup endpoint exists and works (with high days_to_keep to avoid deleting real data)"""
        # Use a high number of days to keep so we don't actually delete anything
        response = self.session.delete(f"{BASE_URL}/api/activity-logs/cleanup?days_to_keep=9999")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "deleted_count" in data, "Response should have 'deleted_count'"
        assert "cutoff_date" in data, "Response should have 'cutoff_date'"
        print(f"✅ Cleanup endpoint works. Deleted: {data['deleted_count']} (should be 0 with high days_to_keep)")


class TestAdvancedSearchComponent:
    """Tests for AdvancedSearch component functionality - minimal backend validation"""
    
    def test_search_component_prerequisites_exist(self):
        """Test that data needed for AdvancedSearch exists (items, sales, expenses)"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_response.status_code == 200
        token = login_response.json().get("token") or login_response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Check sales endpoint works (AdvancedSearch is used here)
        sales_response = session.get(f"{BASE_URL}/api/sales")
        assert sales_response.status_code == 200, "Sales endpoint should work"
        
        # Check expenses endpoint works
        expenses_response = session.get(f"{BASE_URL}/api/expenses")
        assert expenses_response.status_code == 200, "Expenses endpoint should work"
        
        print("✅ Prerequisites for AdvancedSearch component exist")
