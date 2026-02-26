"""
Iteration 23: Testing new features for SSC Track ERP
1. Scheduler: Weekly/Monthly digest jobs (GET /api/scheduler/config, PUT /api/scheduler/config/weekly_digest, etc.)
2. Dashboard widget customization (localStorage based - frontend only)
3. Mobile card views for Expenses, Employees, Stock (frontend only)
4. Responsive headings (frontend only)

Backend tests focus on scheduler APIs.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope='class')
    def auth_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    def test_admin_login(self, auth_token):
        """Verify admin login works"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print("PASS: Admin login successful")


class TestSchedulerConfigAPI:
    """Test scheduler config endpoints for weekly/monthly digest"""
    
    @pytest.fixture(scope='class')
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_scheduler_config_returns_5_jobs(self, auth_headers):
        """GET /api/scheduler/config should return 5 job types including weekly_digest and monthly_digest"""
        response = requests.get(f"{BASE_URL}/api/scheduler/config", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        jobs = response.json()
        assert isinstance(jobs, list), "Response should be a list"
        
        job_types = [j.get("job_type") for j in jobs]
        print(f"Job types returned: {job_types}")
        
        # Check required job types
        assert "daily_sales" in job_types, "daily_sales job missing"
        assert "low_stock" in job_types, "low_stock job missing"
        assert "expense_summary" in job_types, "expense_summary job missing"
        assert "weekly_digest" in job_types, "weekly_digest job missing"
        assert "monthly_digest" in job_types, "monthly_digest job missing"
        
        assert len(jobs) >= 5, f"Expected at least 5 jobs, got {len(jobs)}"
        print(f"PASS: Scheduler config returns {len(jobs)} jobs including weekly_digest and monthly_digest")
    
    def test_weekly_digest_has_day_of_week_field(self, auth_headers):
        """Weekly digest should have day_of_week field"""
        response = requests.get(f"{BASE_URL}/api/scheduler/config", headers=auth_headers)
        jobs = response.json()
        
        weekly = next((j for j in jobs if j.get("job_type") == "weekly_digest"), None)
        assert weekly is not None, "weekly_digest job not found"
        
        assert "day_of_week" in weekly, f"weekly_digest missing day_of_week field: {weekly}"
        print(f"PASS: weekly_digest has day_of_week={weekly.get('day_of_week')}")
    
    def test_monthly_digest_has_day_field(self, auth_headers):
        """Monthly digest should have day field"""
        response = requests.get(f"{BASE_URL}/api/scheduler/config", headers=auth_headers)
        jobs = response.json()
        
        monthly = next((j for j in jobs if j.get("job_type") == "monthly_digest"), None)
        assert monthly is not None, "monthly_digest job not found"
        
        assert "day" in monthly, f"monthly_digest missing day field: {monthly}"
        print(f"PASS: monthly_digest has day={monthly.get('day')}")
    
    def test_update_weekly_digest_day_of_week(self, auth_headers):
        """PUT /api/scheduler/config/weekly_digest should accept day_of_week"""
        # Update to Tuesday
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/weekly_digest",
            headers=auth_headers,
            json={"day_of_week": "tue"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("day_of_week") == "tue", f"Expected day_of_week='tue', got {data.get('day_of_week')}"
        print("PASS: Updated weekly_digest day_of_week to tue")
        
        # Reset to Sunday
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/weekly_digest",
            headers=auth_headers,
            json={"day_of_week": "sun"}
        )
        assert response.status_code == 200
        print("PASS: Reset weekly_digest day_of_week to sun")
    
    def test_update_monthly_digest_day(self, auth_headers):
        """PUT /api/scheduler/config/monthly_digest should accept day field"""
        # Update to day 15
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/monthly_digest",
            headers=auth_headers,
            json={"day": 15}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("day") == 15, f"Expected day=15, got {data.get('day')}"
        print("PASS: Updated monthly_digest day to 15")
        
        # Reset to day 1
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/monthly_digest",
            headers=auth_headers,
            json={"day": 1}
        )
        assert response.status_code == 200
        print("PASS: Reset monthly_digest day to 1")
    
    def test_trigger_weekly_digest(self, auth_headers):
        """POST /api/scheduler/trigger/weekly_digest should generate period digest"""
        response = requests.post(
            f"{BASE_URL}/api/scheduler/trigger/weekly_digest",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message field"
        assert "weekly_digest" in data["message"].lower(), f"Unexpected message: {data['message']}"
        print(f"PASS: Triggered weekly_digest - {data['message']}")
    
    def test_trigger_monthly_digest(self, auth_headers):
        """POST /api/scheduler/trigger/monthly_digest should generate period digest"""
        response = requests.post(
            f"{BASE_URL}/api/scheduler/trigger/monthly_digest",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message field"
        assert "monthly_digest" in data["message"].lower(), f"Unexpected message: {data['message']}"
        print(f"PASS: Triggered monthly_digest - {data['message']}")
    
    def test_scheduler_logs_after_trigger(self, auth_headers):
        """GET /api/scheduler/logs should show recent triggers"""
        response = requests.get(f"{BASE_URL}/api/scheduler/logs", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        logs = response.json()
        assert isinstance(logs, list), "Logs should be a list"
        
        # Check if recent triggers are in logs
        recent_types = [l.get("job_type") for l in logs[:10]]
        print(f"Recent log types: {recent_types}")
        
        # At least one of our triggered jobs should be in recent logs
        has_weekly = "weekly_digest" in recent_types
        has_monthly = "monthly_digest" in recent_types
        assert has_weekly or has_monthly, "No recent weekly_digest or monthly_digest in logs"
        print("PASS: Scheduler logs contain recent digest triggers")
    
    def test_update_scheduler_job_channels(self, auth_headers):
        """Update scheduler job channels (whatsapp/email)"""
        # Update weekly_digest to use email only
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/weekly_digest",
            headers=auth_headers,
            json={"channels": ["email"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data.get("channels", []), f"Expected email in channels: {data}"
        print("PASS: Updated weekly_digest channels to email")
    
    def test_update_scheduler_job_time(self, auth_headers):
        """Update scheduler job time (hour/minute)"""
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/daily_sales",
            headers=auth_headers,
            json={"hour": 10, "minute": 30}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("hour") == 10, f"Expected hour=10, got {data.get('hour')}"
        assert data.get("minute") == 30, f"Expected minute=30, got {data.get('minute')}"
        print("PASS: Updated daily_sales time to 10:30")
        
        # Reset to default
        requests.put(
            f"{BASE_URL}/api/scheduler/config/daily_sales",
            headers=auth_headers,
            json={"hour": 21, "minute": 0}
        )


class TestDashboardStatsAPI:
    """Test dashboard stats endpoint is still working"""
    
    @pytest.fixture(scope='class')
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_dashboard_stats_endpoint(self, auth_headers):
        """GET /api/dashboard/stats should work"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_sales" in data, "Missing total_sales"
        assert "total_expenses" in data, "Missing total_expenses"
        print(f"PASS: Dashboard stats returns total_sales={data.get('total_sales')}, total_expenses={data.get('total_expenses')}")


class TestExpensesAPI:
    """Test expenses endpoints for mobile card view"""
    
    @pytest.fixture(scope='class')
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_expenses_list(self, auth_headers):
        """GET /api/expenses should return expense list"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expenses should be a list"
        print(f"PASS: Expenses API returns {len(data)} expenses")


class TestEmployeesAPI:
    """Test employees endpoints for mobile card view"""
    
    @pytest.fixture(scope='class')
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_employees_list(self, auth_headers):
        """GET /api/employees should return employee list"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Employees should be a list"
        print(f"PASS: Employees API returns {len(data)} employees")
    
    def test_employees_pending_summary(self, auth_headers):
        """GET /api/employees/pending-summary should return pending salary info"""
        response = requests.get(f"{BASE_URL}/api/employees/pending-summary", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "employees" in data or isinstance(data, list), "Response should have employees"
        print("PASS: Employees pending summary works")


class TestStockAPI:
    """Test stock endpoints for mobile card view"""
    
    @pytest.fixture(scope='class')
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_stock_balance(self, auth_headers):
        """GET /api/stock/balance should return stock balance"""
        response = requests.get(f"{BASE_URL}/api/stock/balance", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Stock balance should be a list"
        print(f"PASS: Stock balance API returns {len(data)} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
