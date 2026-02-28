"""
Iteration 35: Testing 4 new SSC Track ERP features:
1. Daily Shift Report - aggregate cashier shifts into daily/range reports
2. Bulk Salary Payment - one-click salary payment for all employees
3. Dashboard Layout Preferences - save/load widget customization per user
4. API Improvements - new endpoints for the above features
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


class TestAuth:
    """Authentication helper for tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Auth failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestDailyShiftReport(TestAuth):
    """Tests for Daily Shift Report feature"""
    
    def test_shift_report_endpoint_exists(self, auth_headers):
        """Test /api/cashier/shift-report endpoint returns valid response"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/cashier/shift-report?date={today}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Shift report endpoint failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "date" in data, "Response missing 'date' field"
        assert "summary" in data, "Response missing 'summary' field"
        assert "shifts" in data, "Response missing 'shifts' field"
        
    def test_shift_report_summary_fields(self, auth_headers):
        """Test shift report summary contains all required fields"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/cashier/shift-report?date={today}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        required_fields = [
            "total_shifts", "open_shifts", "closed_shifts",
            "total_opening_cash", "total_closing_cash", "total_expected_cash",
            "total_cash_difference", "total_sales", "total_orders",
            "payment_breakdown"
        ]
        for field in required_fields:
            assert field in summary, f"Summary missing '{field}' field"
            
    def test_shift_report_with_branch_filter(self, auth_headers):
        """Test shift report can filter by branch"""
        today = datetime.now().strftime("%Y-%m-%d")
        # First get branches
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert branches_resp.status_code == 200
        branches = branches_resp.json()
        
        if branches:
            branch_id = branches[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/cashier/shift-report?date={today}&branch_id={branch_id}",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Branch filter failed: {response.text}"
            
    def test_shift_report_range_endpoint(self, auth_headers):
        """Test /api/cashier/shift-report/range endpoint returns valid response"""
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/cashier/shift-report/range?start_date={start_date}&end_date={end_date}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Range report endpoint failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "start_date" in data, "Response missing 'start_date'"
        assert "end_date" in data, "Response missing 'end_date'"
        assert "summary" in data, "Response missing 'summary'"
        assert "daily_breakdown" in data, "Response missing 'daily_breakdown'"
        
    def test_shift_report_range_summary_fields(self, auth_headers):
        """Test range report summary contains all required fields"""
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/cashier/shift-report/range?start_date={start_date}&end_date={end_date}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        required_fields = [
            "total_days", "total_shifts", "total_sales",
            "total_orders", "total_cash_difference", "avg_sales_per_day"
        ]
        for field in required_fields:
            assert field in summary, f"Range summary missing '{field}' field"


class TestBulkSalaryPayment(TestAuth):
    """Tests for Bulk Salary Payment feature"""
    
    def test_bulk_preview_endpoint(self, auth_headers):
        """Test /api/salary-payments/bulk-preview endpoint"""
        period = datetime.now().strftime("%b %Y")  # e.g., "Jan 2026"
        
        response = requests.get(
            f"{BASE_URL}/api/salary-payments/bulk-preview?period={period}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Bulk preview failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "period" in data, "Response missing 'period'"
        assert "total_employees" in data, "Response missing 'total_employees'"
        assert "to_pay" in data, "Response missing 'to_pay' (list of employees to pay)"
        assert "to_pay_count" in data, "Response missing 'to_pay_count'"
        assert "to_pay_total" in data, "Response missing 'to_pay_total'"
        assert "already_paid" in data, "Response missing 'already_paid'"
        assert "already_paid_count" in data, "Response missing 'already_paid_count'"
        
    def test_bulk_preview_with_branch_filter(self, auth_headers):
        """Test bulk preview can filter by branch"""
        period = datetime.now().strftime("%b %Y")
        
        # Get branches first
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert branches_resp.status_code == 200
        branches = branches_resp.json()
        
        if branches:
            branch_id = branches[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/salary-payments/bulk-preview?period={period}&branch_id={branch_id}",
                headers=auth_headers
            )
            assert response.status_code == 200, f"Branch filter failed: {response.text}"
            
    def test_bulk_preview_employee_details(self, auth_headers):
        """Test bulk preview returns proper employee details"""
        period = datetime.now().strftime("%b %Y")
        
        response = requests.get(
            f"{BASE_URL}/api/salary-payments/bulk-preview?period={period}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check to_pay employee structure if any exist
        to_pay = data.get("to_pay", [])
        if to_pay:
            emp = to_pay[0]
            assert "id" in emp, "Employee missing 'id'"
            assert "name" in emp, "Employee missing 'name'"
            assert "salary" in emp, "Employee missing 'salary'"
            assert "branch_name" in emp, "Employee missing 'branch_name'"
            
    def test_bulk_payment_endpoint_requires_period(self, auth_headers):
        """Test bulk payment endpoint validates period requirement"""
        response = requests.post(
            f"{BASE_URL}/api/salary-payments/bulk",
            headers=auth_headers,
            json={}  # Missing period
        )
        assert response.status_code == 400, "Should reject missing period"
        assert "period" in response.text.lower(), "Error should mention period"


class TestDashboardLayout(TestAuth):
    """Tests for Dashboard Layout Preferences feature"""
    
    def test_get_dashboard_layout(self, auth_headers):
        """Test GET /api/dashboard/layout returns user preferences"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/layout",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get layout failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data, "Response missing 'user_id'"
        # layout and widgets can be null for new users
        
    def test_save_dashboard_layout_widgets(self, auth_headers):
        """Test POST /api/dashboard/layout saves widget preferences"""
        widgets_config = {
            "stats": True,
            "charts": True,
            "cashBank": True,
            "paymentMode": False,
            "spending": True,
            "dues": True,
            "vatSummary": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dashboard/layout",
            headers=auth_headers,
            json={"widgets": widgets_config}
        )
        assert response.status_code == 200, f"Save layout failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Save should return success=true"
        
        # Verify it was saved by getting it back
        get_response = requests.get(
            f"{BASE_URL}/api/dashboard/layout",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        saved_data = get_response.json()
        assert saved_data.get("widgets") == widgets_config, "Widgets should be saved correctly"
        
    def test_save_dashboard_layout_grid(self, auth_headers):
        """Test POST /api/dashboard/layout saves grid layout"""
        layout_config = [
            {"i": "stats", "x": 0, "y": 0, "w": 12, "h": 4},
            {"i": "charts", "x": 0, "y": 4, "w": 12, "h": 5}
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/dashboard/layout",
            headers=auth_headers,
            json={"layout": layout_config}
        )
        assert response.status_code == 200, f"Save grid layout failed: {response.text}"
        
    def test_save_dashboard_theme(self, auth_headers):
        """Test POST /api/dashboard/layout saves theme preference"""
        response = requests.post(
            f"{BASE_URL}/api/dashboard/layout",
            headers=auth_headers,
            json={"theme": "dark"}
        )
        assert response.status_code == 200, f"Save theme failed: {response.text}"
        
    def test_delete_dashboard_layout(self, auth_headers):
        """Test DELETE /api/dashboard/layout resets to default"""
        response = requests.delete(
            f"{BASE_URL}/api/dashboard/layout",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Delete layout failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Delete should return success=true"
        
        # Verify it was reset
        get_response = requests.get(
            f"{BASE_URL}/api/dashboard/layout",
            headers=auth_headers
        )
        assert get_response.status_code == 200
        reset_data = get_response.json()
        # After reset, layout and widgets should be null
        assert reset_data.get("layout") is None, "Layout should be reset to null"


class TestAPIHealth(TestAuth):
    """General API health checks for all new endpoints"""
    
    def test_api_health(self):
        """Basic health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
    def test_dashboard_stats(self, auth_headers):
        """Test dashboard stats endpoint still works"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
    def test_employees_list(self, auth_headers):
        """Test employees list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/employees",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Employees list failed: {response.text}"
        
    def test_branches_list(self, auth_headers):
        """Test branches list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/branches",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Branches list failed: {response.text}"
