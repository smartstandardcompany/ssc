"""
Tests for Performance Report API - Iteration 51
Tests the GET /api/performance-report endpoint for automated performance reporting feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Admin authentication failed")

@pytest.fixture
def auth_headers(admin_token):
    """Get auth headers with token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestPerformanceReportAPI:
    """Tests for /api/performance-report endpoint"""
    
    def test_performance_report_without_auth(self):
        """Should return 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/performance-report")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Returns 401 without authentication")
    
    def test_performance_report_default_period(self, auth_headers):
        """Should return performance report with default 30-day period"""
        response = requests.get(f"{BASE_URL}/api/performance-report", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all expected keys are present
        expected_keys = ["kpi", "sales_trend", "branch_ranking", "employee_performance", 
                        "expense_breakdown", "payment_distribution", "period_days"]
        for key in expected_keys:
            assert key in data, f"Missing key: {key}"
        
        assert data["period_days"] == 30, f"Expected period_days=30, got {data['period_days']}"
        print(f"PASS: Default period returns all expected fields with period_days=30")
    
    def test_performance_report_kpi_structure(self, auth_headers):
        """Should return KPI with all expected fields"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=30", headers=auth_headers)
        assert response.status_code == 200
        
        kpi = response.json()["kpi"]
        expected_kpi_fields = [
            "total_sales", "prev_total_sales", "sales_growth",
            "total_expenses", "prev_total_expenses", "expense_growth",
            "net_profit", "profit_margin", "total_transactions", "avg_transaction",
            "total_salary_paid", "employee_count", "task_compliance"
        ]
        
        for field in expected_kpi_fields:
            assert field in kpi, f"Missing KPI field: {field}"
        
        print(f"PASS: KPI structure verified - total_sales={kpi['total_sales']}, "
              f"total_expenses={kpi['total_expenses']}, net_profit={kpi['net_profit']}, "
              f"employee_count={kpi['employee_count']}, task_compliance={kpi['task_compliance']}%")
    
    def test_performance_report_period_7_days(self, auth_headers):
        """Should return performance report for 7-day period"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=7", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 7
        print(f"PASS: 7-day period report returned successfully")
    
    def test_performance_report_period_60_days(self, auth_headers):
        """Should return performance report for 60-day period"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=60", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 60
        print(f"PASS: 60-day period report returned successfully")
    
    def test_performance_report_period_90_days(self, auth_headers):
        """Should return performance report for 90-day period"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=90", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 90
        print(f"PASS: 90-day period report returned successfully")
    
    def test_sales_trend_structure(self, auth_headers):
        """Should return sales trend with daily data"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=30", headers=auth_headers)
        assert response.status_code == 200
        
        sales_trend = response.json()["sales_trend"]
        assert isinstance(sales_trend, list), "sales_trend should be a list"
        
        if len(sales_trend) > 0:
            entry = sales_trend[0]
            assert "date" in entry, "sales_trend entry missing 'date'"
            assert "sales" in entry, "sales_trend entry missing 'sales'"
            assert "expenses" in entry, "sales_trend entry missing 'expenses'"
            assert "profit" in entry, "sales_trend entry missing 'profit'"
        
        print(f"PASS: Sales trend structure verified - {len(sales_trend)} days of data")
    
    def test_branch_ranking_structure(self, auth_headers):
        """Should return branch ranking with performance data"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=30", headers=auth_headers)
        assert response.status_code == 200
        
        branch_ranking = response.json()["branch_ranking"]
        assert isinstance(branch_ranking, list), "branch_ranking should be a list"
        
        if len(branch_ranking) > 0:
            branch = branch_ranking[0]
            expected_fields = ["branch_id", "name", "sales", "expenses", "profit", "transactions", "avg_ticket"]
            for field in expected_fields:
                assert field in branch, f"branch_ranking entry missing '{field}'"
        
        print(f"PASS: Branch ranking verified - {len(branch_ranking)} branches")
    
    def test_employee_performance_structure(self, auth_headers):
        """Should return employee performance with compliance data"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=30", headers=auth_headers)
        assert response.status_code == 200
        
        employee_performance = response.json()["employee_performance"]
        assert isinstance(employee_performance, list), "employee_performance should be a list"
        
        if len(employee_performance) > 0:
            emp = employee_performance[0]
            expected_fields = ["id", "name", "role", "branch", "tasks_received", 
                             "tasks_completed", "compliance", "status"]
            for field in expected_fields:
                assert field in emp, f"employee_performance entry missing '{field}'"
            
            # Verify status is valid
            valid_statuses = ["excellent", "good", "needs_attention", "critical"]
            assert emp["status"] in valid_statuses, f"Invalid status: {emp['status']}"
        
        print(f"PASS: Employee performance verified - {len(employee_performance)} employees")
    
    def test_expense_breakdown_structure(self, auth_headers):
        """Should return expense breakdown by category"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=30", headers=auth_headers)
        assert response.status_code == 200
        
        expense_breakdown = response.json()["expense_breakdown"]
        assert isinstance(expense_breakdown, list), "expense_breakdown should be a list"
        
        if len(expense_breakdown) > 0:
            exp = expense_breakdown[0]
            assert "category" in exp, "expense_breakdown entry missing 'category'"
            assert "amount" in exp, "expense_breakdown entry missing 'amount'"
        
        print(f"PASS: Expense breakdown verified - {len(expense_breakdown)} categories")
    
    def test_payment_distribution_structure(self, auth_headers):
        """Should return payment distribution by mode"""
        response = requests.get(f"{BASE_URL}/api/performance-report?period=30", headers=auth_headers)
        assert response.status_code == 200
        
        payment_distribution = response.json()["payment_distribution"]
        assert isinstance(payment_distribution, list), "payment_distribution should be a list"
        
        if len(payment_distribution) > 0:
            pay = payment_distribution[0]
            assert "mode" in pay, "payment_distribution entry missing 'mode'"
            assert "amount" in pay, "payment_distribution entry missing 'amount'"
        
        print(f"PASS: Payment distribution verified - {len(payment_distribution)} payment modes")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
