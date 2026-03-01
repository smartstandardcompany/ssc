"""
Iteration 50: Test Task Compliance Dashboard
Tests GET /api/task-reminders/compliance endpoint with days parameter
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTaskCompliance:
    """Task Compliance Dashboard API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login as admin and get token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        data = login_response.json()
        self.token = data.get("access_token")
        assert self.token, "No access_token in login response"
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_compliance_endpoint_default_30_days(self):
        """Test GET /api/task-reminders/compliance with default 30 days"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify overview structure
        assert "overview" in data, "Missing 'overview' in response"
        overview = data["overview"]
        assert "overall_compliance" in overview, "Missing overall_compliance"
        assert "total_alerts_sent" in overview, "Missing total_alerts_sent"
        assert "total_acknowledgements" in overview, "Missing total_acknowledgements"
        assert "active_reminders" in overview, "Missing active_reminders"
        assert "best_role" in overview, "Missing best_role"
        assert "employees_tracked" in overview, "Missing employees_tracked"
        assert "flagged_count" in overview, "Missing flagged_count"
        assert "period_days" in overview, "Missing period_days"
        assert overview["period_days"] == 30, f"Expected period_days=30, got {overview['period_days']}"
        
        # Verify data types
        assert isinstance(overview["overall_compliance"], (int, float)), "overall_compliance should be numeric"
        assert isinstance(overview["total_alerts_sent"], int), "total_alerts_sent should be int"
        assert isinstance(overview["total_acknowledgements"], int), "total_acknowledgements should be int"
        assert isinstance(overview["active_reminders"], int), "active_reminders should be int"
        assert isinstance(overview["employees_tracked"], int), "employees_tracked should be int"
        assert isinstance(overview["flagged_count"], int), "flagged_count should be int"
        
        print(f"Overview: compliance={overview['overall_compliance']}%, alerts={overview['total_alerts_sent']}, acks={overview['total_acknowledgements']}, active={overview['active_reminders']}, best_role={overview['best_role']}, tracked={overview['employees_tracked']}, flagged={overview['flagged_count']}")
    
    def test_compliance_endpoint_7_days(self):
        """Test GET /api/task-reminders/compliance?days=7"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance?days=7",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["overview"]["period_days"] == 7, f"Expected period_days=7, got {data['overview']['period_days']}"
        print(f"7-day compliance: {data['overview']['overall_compliance']}%")
    
    def test_compliance_endpoint_14_days(self):
        """Test GET /api/task-reminders/compliance?days=14"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance?days=14",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["overview"]["period_days"] == 14, f"Expected period_days=14, got {data['overview']['period_days']}"
        print(f"14-day compliance: {data['overview']['overall_compliance']}%")
    
    def test_compliance_endpoint_60_days(self):
        """Test GET /api/task-reminders/compliance?days=60"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance?days=60",
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["overview"]["period_days"] == 60, f"Expected period_days=60, got {data['overview']['period_days']}"
        print(f"60-day compliance: {data['overview']['overall_compliance']}%")
    
    def test_compliance_role_compliance_structure(self):
        """Test role_compliance array structure"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "role_compliance" in data, "Missing 'role_compliance' in response"
        role_compliance = data["role_compliance"]
        assert isinstance(role_compliance, list), "role_compliance should be a list"
        
        if len(role_compliance) > 0:
            role = role_compliance[0]
            assert "role" in role, "Missing 'role' field in role_compliance item"
            assert "alerts_sent" in role, "Missing 'alerts_sent' field"
            assert "acknowledged" in role, "Missing 'acknowledged' field"
            assert "compliance" in role, "Missing 'compliance' field"
            print(f"Sample role compliance: {role}")
        else:
            print("No role compliance data yet (reminders may not have triggered)")
    
    def test_compliance_employee_leaderboard_structure(self):
        """Test employee_leaderboard array structure"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "employee_leaderboard" in data, "Missing 'employee_leaderboard' in response"
        leaderboard = data["employee_leaderboard"]
        assert isinstance(leaderboard, list), "employee_leaderboard should be a list"
        
        if len(leaderboard) > 0:
            emp = leaderboard[0]
            assert "employee_id" in emp, "Missing 'employee_id' field"
            assert "name" in emp, "Missing 'name' field"
            assert "role" in emp, "Missing 'role' field"
            assert "alerts_received" in emp, "Missing 'alerts_received' field"
            assert "acknowledged" in emp, "Missing 'acknowledged' field"
            assert "compliance" in emp, "Missing 'compliance' field"
            assert "status" in emp, "Missing 'status' field"
            assert emp["status"] in ["excellent", "good", "needs_attention", "critical"], f"Invalid status: {emp['status']}"
            print(f"Top employee: {emp['name']} - {emp['compliance']}% ({emp['status']})")
        else:
            print("No employee leaderboard data yet")
    
    def test_compliance_heatmap_structure(self):
        """Test heatmap array structure"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "heatmap" in data, "Missing 'heatmap' in response"
        heatmap = data["heatmap"]
        assert isinstance(heatmap, list), "heatmap should be a list"
        
        if len(heatmap) > 0:
            heat = heatmap[0]
            assert "day" in heat, "Missing 'day' field"
            assert "day_num" in heat, "Missing 'day_num' field"
            assert "hour" in heat, "Missing 'hour' field"
            assert "label" in heat, "Missing 'label' field"
            assert "count" in heat, "Missing 'count' field"
            assert heat["day_num"] >= 0 and heat["day_num"] <= 6, f"Invalid day_num: {heat['day_num']}"
            assert heat["hour"] >= 0 and heat["hour"] <= 23, f"Invalid hour: {heat['hour']}"
            print(f"Sample heatmap entry: {heat}")
        else:
            print("No heatmap data yet (no acknowledgements recorded)")
    
    def test_compliance_trend_structure(self):
        """Test trend array structure"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance?days=30",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "trend" in data, "Missing 'trend' in response"
        trend = data["trend"]
        assert isinstance(trend, list), "trend should be a list"
        assert len(trend) == 30, f"Expected 30 trend entries for 30 days, got {len(trend)}"
        
        if len(trend) > 0:
            t = trend[0]
            assert "date" in t, "Missing 'date' field"
            assert "alerts_sent" in t, "Missing 'alerts_sent' field"
            assert "acknowledged" in t, "Missing 'acknowledged' field"
            assert "compliance" in t, "Missing 'compliance' field"
            print(f"Sample trend entry: {t}")
    
    def test_compliance_flagged_employees_structure(self):
        """Test flagged_employees array structure"""
        response = requests.get(
            f"{BASE_URL}/api/task-reminders/compliance",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "flagged_employees" in data, "Missing 'flagged_employees' in response"
        flagged = data["flagged_employees"]
        assert isinstance(flagged, list), "flagged_employees should be a list"
        
        # Flagged count should match overview
        assert len(flagged) == data["overview"]["flagged_count"], "flagged_employees count mismatch with overview"
        
        if len(flagged) > 0:
            f = flagged[0]
            assert "employee_id" in f, "Missing 'employee_id' field"
            assert "name" in f, "Missing 'name' field"
            assert "role" in f, "Missing 'role' field"
            assert "compliance" in f, "Missing 'compliance' field"
            assert f["compliance"] < 50, f"Flagged employee should have <50% compliance, got {f['compliance']}%"
            print(f"Flagged employee: {f['name']} - {f['compliance']}%")
        else:
            print("No flagged employees (all above 50% compliance or no data)")
    
    def test_compliance_without_auth(self):
        """Test that compliance endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/task-reminders/compliance")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Auth check passed - endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
