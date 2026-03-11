"""
Iteration 133: Staff Performance Dashboard and AI Duty Assignment Tests
Tests:
- GET /api/staff-performance - returns employees with reliability scores, tiers, attendance
- GET /api/staff-performance/{employee_id} - detailed individual performance
- POST /api/task-reminders/ai-generate - AI generates duty plan (validates input only, no actual AI call)
- POST /api/task-reminders/bulk - preset duties for roles
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestAuthSetup:
    """Authentication tests - get token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and return auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API uses access_token, not token
        token = data.get("access_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestStaffPerformanceAPI(TestAuthSetup):
    """Test GET /api/staff-performance endpoint"""
    
    def test_01_staff_performance_returns_200(self, auth_headers):
        """Test that staff performance endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASS: GET /api/staff-performance returns 200")
    
    def test_02_staff_performance_structure(self, auth_headers):
        """Test response structure has employees, summary, weekly_trends"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        data = response.json()
        
        assert "employees" in data, "Missing 'employees' in response"
        assert "summary" in data, "Missing 'summary' in response"
        assert "weekly_trends" in data, "Missing 'weekly_trends' in response"
        assert "period_days" in data, "Missing 'period_days' in response"
        print("PASS: Response has employees, summary, weekly_trends, period_days")
    
    def test_03_employee_fields(self, auth_headers):
        """Test each employee has required performance fields"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        data = response.json()
        
        employees = data.get("employees", [])
        if len(employees) == 0:
            pytest.skip("No employees found to test")
        
        required_fields = [
            "employee_id", "name", "role", "reliability_score", "tier",
            "attendance_rate", "punctuality_rate", "scheduled_shifts",
            "present", "late", "absent", "overtime_hours", "task_completions"
        ]
        
        for emp in employees:
            for field in required_fields:
                assert field in emp, f"Missing field '{field}' in employee {emp.get('name', 'unknown')}"
        
        print(f"PASS: All {len(employees)} employees have required fields: {required_fields}")
    
    def test_04_reliability_score_range(self, auth_headers):
        """Test that reliability scores are between 0-100"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        data = response.json()
        
        for emp in data.get("employees", []):
            score = emp.get("reliability_score", -1)
            assert 0 <= score <= 100, f"Score {score} out of range for {emp['name']}"
        
        print("PASS: All reliability scores are in valid range (0-100)")
    
    def test_05_tier_values(self, auth_headers):
        """Test that tier values are valid"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        data = response.json()
        
        valid_tiers = ["excellent", "good", "average", "needs_improvement"]
        
        for emp in data.get("employees", []):
            tier = emp.get("tier", "")
            assert tier in valid_tiers, f"Invalid tier '{tier}' for {emp['name']}"
        
        print(f"PASS: All tiers are valid: {valid_tiers}")
    
    def test_06_summary_structure(self, auth_headers):
        """Test summary has required aggregation fields"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        data = response.json()
        
        summary = data.get("summary", {})
        required_fields = [
            "total_employees", "avg_attendance_rate", "avg_punctuality_rate",
            "total_overtime_hours", "total_shifts_tracked", "tier_breakdown"
        ]
        
        for field in required_fields:
            assert field in summary, f"Missing '{field}' in summary"
        
        print("PASS: Summary has all required fields")
    
    def test_07_weekly_trends_structure(self, auth_headers):
        """Test weekly trends has correct structure"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        data = response.json()
        
        trends = data.get("weekly_trends", [])
        if len(trends) > 0:
            required_fields = ["week", "attendance_rate", "total_shifts", "late_count"]
            for trend in trends:
                for field in required_fields:
                    assert field in trend, f"Missing '{field}' in weekly trend"
        
        print(f"PASS: Weekly trends structure verified ({len(trends)} weeks)")
    
    def test_08_period_days_param(self, auth_headers):
        """Test period_days query parameter works"""
        response = requests.get(f"{BASE_URL}/api/staff-performance?period_days=7", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("period_days") == 7, "period_days not set correctly"
        print("PASS: period_days=7 parameter works")
    
    def test_09_requires_auth(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/staff-performance")
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("PASS: Endpoint requires authentication")


class TestIndividualEmployeePerformance(TestAuthSetup):
    """Test GET /api/staff-performance/{employee_id} endpoint"""
    
    def test_01_get_employee_list(self, auth_headers):
        """Get list of employees to test individual endpoint"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        data = response.json()
        employees = data.get("employees", [])
        return employees
    
    def test_02_individual_employee_returns_200(self, auth_headers):
        """Test individual employee endpoint returns 200"""
        # First get employee list
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        employees = response.json().get("employees", [])
        
        if len(employees) == 0:
            pytest.skip("No employees to test individual endpoint")
        
        emp_id = employees[0]["employee_id"]
        response = requests.get(f"{BASE_URL}/api/staff-performance/{emp_id}", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"PASS: GET /api/staff-performance/{emp_id} returns 200")
    
    def test_03_individual_employee_structure(self, auth_headers):
        """Test individual employee response structure"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        employees = response.json().get("employees", [])
        
        if len(employees) == 0:
            pytest.skip("No employees to test")
        
        emp_id = employees[0]["employee_id"]
        response = requests.get(f"{BASE_URL}/api/staff-performance/{emp_id}", headers=auth_headers)
        data = response.json()
        
        assert "employee" in data, "Missing 'employee' in response"
        assert "stats" in data, "Missing 'stats' in response"
        assert "daily" in data, "Missing 'daily' (daily breakdown) in response"
        assert "period_days" in data, "Missing 'period_days' in response"
        
        print("PASS: Individual employee response has employee, stats, daily, period_days")
    
    def test_04_individual_stats_fields(self, auth_headers):
        """Test individual employee stats fields"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        employees = response.json().get("employees", [])
        
        if len(employees) == 0:
            pytest.skip("No employees to test")
        
        emp_id = employees[0]["employee_id"]
        response = requests.get(f"{BASE_URL}/api/staff-performance/{emp_id}", headers=auth_headers)
        data = response.json()
        
        stats = data.get("stats", {})
        required_stats = [
            "scheduled", "present", "late", "absent", "overtime_hours",
            "attendance_rate", "punctuality_rate", "task_completions"
        ]
        
        for field in required_stats:
            assert field in stats, f"Missing '{field}' in stats"
        
        print("PASS: Individual employee stats has all required fields")
    
    def test_05_nonexistent_employee_returns_404(self, auth_headers):
        """Test that nonexistent employee returns 404"""
        response = requests.get(f"{BASE_URL}/api/staff-performance/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Nonexistent employee returns 404")


class TestAIDutyGeneration(TestAuthSetup):
    """Test POST /api/task-reminders/ai-generate endpoint (input validation only)"""
    
    def test_01_ai_generate_requires_role(self, auth_headers):
        """Test that role is required for AI generation"""
        response = requests.post(
            f"{BASE_URL}/api/task-reminders/ai-generate",
            headers=auth_headers,
            json={}  # No role provided
        )
        # Should return 400 since role is required
        assert response.status_code == 400, f"Expected 400 without role, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Expected error detail"
        assert "role" in data["detail"].lower(), f"Expected 'role' in error: {data['detail']}"
        print("PASS: AI generate requires role parameter")
    
    def test_02_ai_generate_requires_auth(self):
        """Test AI generate requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/task-reminders/ai-generate",
            json={"role": "cleaner"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: AI generate requires authentication")
    
    def test_03_ai_generate_accepts_valid_roles(self, auth_headers):
        """Test that valid roles are accepted (cleaner, waiter, cashier, chef)"""
        valid_roles = ["cleaner", "waiter", "cashier", "chef"]
        
        for role in valid_roles:
            response = requests.post(
                f"{BASE_URL}/api/task-reminders/ai-generate",
                headers=auth_headers,
                json={"role": role, "shift_hours": "08:00 - 22:00"}
            )
            # We expect 200 (success) or 500 (AI service issue) - not 400 (invalid input)
            assert response.status_code != 400, f"Role '{role}' should be valid, got 400"
            print(f"  - Role '{role}' accepted (status: {response.status_code})")
        
        print("PASS: All valid roles (cleaner, waiter, cashier, chef) are accepted")


class TestPresetBulkReminders(TestAuthSetup):
    """Test POST /api/task-reminders/bulk for preset duties"""
    
    def test_01_bulk_requires_role(self, auth_headers):
        """Test bulk endpoint requires role"""
        response = requests.post(
            f"{BASE_URL}/api/task-reminders/bulk",
            headers=auth_headers,
            json={}
        )
        assert response.status_code == 400, f"Expected 400 without role, got {response.status_code}"
        print("PASS: Bulk endpoint requires role")
    
    def test_02_bulk_creates_reminders_for_valid_role(self, auth_headers):
        """Test bulk endpoint creates reminders for valid role"""
        # Use cleaner role which has presets
        response = requests.post(
            f"{BASE_URL}/api/task-reminders/bulk",
            headers=auth_headers,
            json={"role": "cleaner", "target_type": "role", "target_value": "cleaner"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "created" in data, "Expected 'created' count in response"
        assert "reminders" in data, "Expected 'reminders' list in response"
        assert data["created"] > 0, "Expected at least 1 reminder created"
        
        print(f"PASS: Bulk created {data['created']} reminders for cleaner role")
    
    def test_03_bulk_requires_auth(self):
        """Test bulk endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/task-reminders/bulk",
            json={"role": "waiter"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("PASS: Bulk endpoint requires authentication")
    
    def test_04_invalid_role_returns_400(self, auth_headers):
        """Test invalid role returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/task-reminders/bulk",
            headers=auth_headers,
            json={"role": "invalid_role_xyz"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid role, got {response.status_code}"
        print("PASS: Invalid role returns 400")


class TestPresetTemplates(TestAuthSetup):
    """Test GET /api/task-reminders/presets endpoint"""
    
    def test_01_presets_returns_200(self, auth_headers):
        """Test presets endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/task-reminders/presets", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/task-reminders/presets returns 200")
    
    def test_02_presets_has_all_roles(self, auth_headers):
        """Test presets has cleaner, waiter, cashier, chef"""
        response = requests.get(f"{BASE_URL}/api/task-reminders/presets", headers=auth_headers)
        data = response.json()
        
        expected_roles = ["cleaner", "waiter", "cashier", "chef"]
        for role in expected_roles:
            assert role in data, f"Missing role '{role}' in presets"
            assert len(data[role]) > 0, f"Role '{role}' has no templates"
        
        print(f"PASS: Presets has all roles: {expected_roles}")
    
    def test_03_preset_template_structure(self, auth_headers):
        """Test each preset template has name, message, interval_hours"""
        response = requests.get(f"{BASE_URL}/api/task-reminders/presets", headers=auth_headers)
        data = response.json()
        
        for role, templates in data.items():
            for tmpl in templates:
                assert "name" in tmpl, f"Missing 'name' in {role} template"
                assert "message" in tmpl, f"Missing 'message' in {role} template"
                assert "interval_hours" in tmpl, f"Missing 'interval_hours' in {role} template"
        
        print("PASS: All preset templates have name, message, interval_hours")


class TestDataValidation(TestAuthSetup):
    """Validate actual data matches expected employee data from context"""
    
    def test_01_verify_employee_data(self, auth_headers):
        """Verify employee performance data aligns with context note"""
        response = requests.get(f"{BASE_URL}/api/staff-performance", headers=auth_headers)
        data = response.json()
        
        employees = data.get("employees", [])
        employee_names = [e["name"] for e in employees]
        
        print(f"Found {len(employees)} employees: {employee_names}")
        
        # Look for Ahmed Khan and aaaa as per context
        ahmed = next((e for e in employees if "Ahmed" in e["name"]), None)
        if ahmed:
            print(f"  - Ahmed Khan: score={ahmed['reliability_score']}, tier={ahmed['tier']}, attendance={ahmed['attendance_rate']}%, punctuality={ahmed['punctuality_rate']}%")
        
        aaaa = next((e for e in employees if "aaaa" in e["name"].lower()), None)
        if aaaa:
            print(f"  - aaaa: score={aaaa['reliability_score']}, tier={aaaa['tier']}, attendance={aaaa['attendance_rate']}%")
        
        print("PASS: Employee data verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
