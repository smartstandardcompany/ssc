"""
Test Iteration 16: P3 (Scheduler) + P4 (Stock Reports) Features
==============================================================
P3: Automated WhatsApp Notification Triggers with APScheduler
P4: Advanced Stock/Inventory Reporting (Consumption, Profitability, Wastage)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token."""
    return {"Authorization": f"Bearer {auth_token}"}


# ==============================================================================
# P3: SCHEDULER API TESTS
# ==============================================================================

class TestSchedulerConfigAPI:
    """Tests for GET/PUT /api/scheduler/config endpoints."""
    
    def test_get_scheduler_config_returns_3_default_jobs(self, auth_headers):
        """P3: GET /api/scheduler/config returns 3 default jobs."""
        response = requests.get(f"{BASE_URL}/api/scheduler/config", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Should return a list of jobs"
        assert len(data) >= 3, f"Expected at least 3 jobs, got {len(data)}"
        
        # Check job types exist
        job_types = [j["job_type"] for j in data]
        assert "daily_sales" in job_types, "Missing daily_sales job"
        assert "low_stock" in job_types, "Missing low_stock job"
        assert "expense_summary" in job_types, "Missing expense_summary job"
        
        # Verify job structure
        for job in data:
            assert "job_type" in job
            assert "enabled" in job
            assert "hour" in job
            assert "minute" in job
            assert "channels" in job
            assert isinstance(job["channels"], list)
        
        print(f"✓ Found {len(data)} scheduler jobs: {job_types}")
    
    def test_get_scheduler_config_jobs_have_labels(self, auth_headers):
        """P3: Each job should have a label field."""
        response = requests.get(f"{BASE_URL}/api/scheduler/config", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        for job in data:
            assert "label" in job, f"Job {job['job_type']} missing label"
        
        print("✓ All jobs have labels")
    
    def test_update_scheduler_config_enabled_flag(self, auth_headers):
        """P3: PUT /api/scheduler/config/daily_sales updates enabled flag."""
        # Get current state
        response = requests.get(f"{BASE_URL}/api/scheduler/config", headers=auth_headers)
        jobs = response.json()
        daily_sales = next(j for j in jobs if j["job_type"] == "daily_sales")
        original_enabled = daily_sales.get("enabled", False)
        
        # Toggle enabled
        new_enabled = not original_enabled
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/daily_sales", 
            json={"enabled": new_enabled},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        updated = response.json()
        assert updated["enabled"] == new_enabled, "Enabled flag not updated"
        
        # Restore original state
        requests.put(
            f"{BASE_URL}/api/scheduler/config/daily_sales",
            json={"enabled": original_enabled},
            headers=auth_headers
        )
        
        print(f"✓ Updated daily_sales enabled: {original_enabled} -> {new_enabled} -> {original_enabled}")
    
    def test_update_scheduler_config_time(self, auth_headers):
        """P3: PUT /api/scheduler/config/daily_sales updates hour/minute."""
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/daily_sales",
            json={"hour": 22, "minute": 30},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        updated = response.json()
        assert updated["hour"] == 22
        assert updated["minute"] == 30
        
        # Reset to default
        requests.put(
            f"{BASE_URL}/api/scheduler/config/daily_sales",
            json={"hour": 21, "minute": 0},
            headers=auth_headers
        )
        
        print("✓ Updated scheduler time to 22:30, reset to 21:00")
    
    def test_update_scheduler_config_channels(self, auth_headers):
        """P3: PUT /api/scheduler/config/daily_sales updates channels."""
        response = requests.put(
            f"{BASE_URL}/api/scheduler/config/daily_sales",
            json={"channels": ["whatsapp", "email"]},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        updated = response.json()
        assert "whatsapp" in updated["channels"]
        assert "email" in updated["channels"]
        
        # Reset to whatsapp only
        requests.put(
            f"{BASE_URL}/api/scheduler/config/daily_sales",
            json={"channels": ["whatsapp"]},
            headers=auth_headers
        )
        
        print("✓ Updated channels to [whatsapp, email], reset to [whatsapp]")


class TestSchedulerTriggerAPI:
    """Tests for POST /api/scheduler/trigger/{job_type} endpoint."""
    
    def test_trigger_daily_sales_job(self, auth_headers):
        """P3: POST /api/scheduler/trigger/daily_sales triggers manual execution."""
        response = requests.post(
            f"{BASE_URL}/api/scheduler/trigger/daily_sales",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "daily_sales" in data["message"]
        
        print(f"✓ Triggered daily_sales: {data['message']}")
    
    def test_trigger_low_stock_job(self, auth_headers):
        """P3: POST /api/scheduler/trigger/low_stock triggers manual execution."""
        response = requests.post(
            f"{BASE_URL}/api/scheduler/trigger/low_stock",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        
        print(f"✓ Triggered low_stock: {data['message']}")
    
    def test_trigger_expense_summary_job(self, auth_headers):
        """P3: POST /api/scheduler/trigger/expense_summary triggers manual execution."""
        response = requests.post(
            f"{BASE_URL}/api/scheduler/trigger/expense_summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        
        print(f"✓ Triggered expense_summary: {data['message']}")


class TestSchedulerLogsAPI:
    """Tests for GET /api/scheduler/logs endpoint."""
    
    def test_get_scheduler_logs(self, auth_headers):
        """P3: GET /api/scheduler/logs returns execution logs."""
        response = requests.get(f"{BASE_URL}/api/scheduler/logs", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Should have logs from previous trigger tests
        if data:
            log = data[0]
            assert "job_type" in log
            assert "triggered_at" in log
            assert "status" in log
            print(f"✓ Found {len(data)} scheduler logs, latest: {log['job_type']} - {log['status']}")
        else:
            print("✓ Logs endpoint working (empty list)")


# ==============================================================================
# P4: STOCK REPORT API TESTS
# ==============================================================================

class TestStockConsumptionReportAPI:
    """Tests for GET /api/stock/report/consumption endpoint."""
    
    def test_get_consumption_report(self, auth_headers):
        """P4: GET /api/stock/report/consumption returns consumption data."""
        response = requests.get(f"{BASE_URL}/api/stock/report/consumption", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "daily_trend" in data
        assert "period_days" in data
        assert "total_consumption_cost" in data
        
        assert isinstance(data["items"], list)
        assert isinstance(data["daily_trend"], list)
        
        # Check item structure if there's data
        if data["items"]:
            item = data["items"][0]
            assert "item_id" in item
            assert "item_name" in item
            assert "daily_avg" in item
            assert "total_used" in item
            assert "total_cost" in item
        
        print(f"✓ Consumption report: {len(data['items'])} items, {len(data['daily_trend'])} days trend")
    
    def test_get_consumption_report_with_days_param(self, auth_headers):
        """P4: GET /api/stock/report/consumption supports days parameter."""
        response = requests.get(
            f"{BASE_URL}/api/stock/report/consumption",
            params={"days": 7},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 7
        
        print("✓ Consumption report with days=7 parameter")
    
    def test_get_consumption_report_with_branch_filter(self, auth_headers):
        """P4: GET /api/stock/report/consumption supports branch_id filter."""
        # First get a branch ID
        branches_res = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_res.json()
        
        if branches:
            branch_id = branches[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/stock/report/consumption",
                params={"branch_id": branch_id},
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"✓ Consumption report with branch_id filter: {branch_id[:8]}...")
        else:
            print("⚠ No branches to test branch filter")


class TestStockProfitabilityReportAPI:
    """Tests for GET /api/stock/report/profitability endpoint."""
    
    def test_get_profitability_report(self, auth_headers):
        """P4: GET /api/stock/report/profitability returns profitability data."""
        response = requests.get(f"{BASE_URL}/api/stock/report/profitability", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total_consumed_cost" in data
        assert "total_consumed_revenue" in data
        assert "total_profit" in data
        assert "avg_margin_pct" in data
        
        # Check item structure if there's data
        if data["items"]:
            item = data["items"][0]
            assert "item_id" in item
            assert "item_name" in item
            assert "margin" in item
            assert "margin_pct" in item
            assert "avg_cost" in item
            assert "sale_price" in item
            assert "qty_consumed" in item
            assert "consumed_profit" in item
        
        print(f"✓ Profitability report: {len(data['items'])} items, total profit: {data['total_profit']}")
    
    def test_profitability_report_with_branch_filter(self, auth_headers):
        """P4: GET /api/stock/report/profitability supports branch_id filter."""
        branches_res = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_res.json()
        
        if branches:
            branch_id = branches[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/stock/report/profitability",
                params={"branch_id": branch_id},
                headers=auth_headers
            )
            assert response.status_code == 200
            print(f"✓ Profitability report with branch_id filter")


class TestStockWastageReportAPI:
    """Tests for GET /api/stock/report/wastage endpoint."""
    
    def test_get_wastage_report(self, auth_headers):
        """P4: GET /api/stock/report/wastage returns wastage data."""
        response = requests.get(f"{BASE_URL}/api/stock/report/wastage", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "items" in data
        assert "total_waste_cost" in data
        assert "total_waste_entries" in data
        assert "period_days" in data
        
        # Check item structure if there's wastage data
        if data["items"]:
            item = data["items"][0]
            assert "item_id" in item
            assert "item_name" in item
            assert "waste_qty" in item
            assert "normal_qty" in item
            assert "waste_pct" in item
            assert "waste_cost" in item
        
        print(f"✓ Wastage report: {len(data['items'])} items with wastage, cost: {data['total_waste_cost']}")
    
    def test_wastage_report_with_days_param(self, auth_headers):
        """P4: GET /api/stock/report/wastage supports days parameter."""
        response = requests.get(
            f"{BASE_URL}/api/stock/report/wastage",
            params={"days": 14},
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["period_days"] == 14
        
        print("✓ Wastage report with days=14 parameter")


# ==============================================================================
# REGRESSION TESTS
# ==============================================================================

class TestNoRegressions:
    """Verify no regressions in existing functionality."""
    
    def test_dashboard_stats(self, auth_headers):
        """Dashboard stats still working."""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Dashboard stats working")
    
    def test_sales_endpoint(self, auth_headers):
        """Sales list still working."""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Sales endpoint working")
    
    def test_employees_endpoint(self, auth_headers):
        """Employees list still working."""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Employees endpoint working")
    
    def test_stock_balance_endpoint(self, auth_headers):
        """Stock balance (existing) still working."""
        response = requests.get(f"{BASE_URL}/api/stock/balance", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Stock balance endpoint working")
    
    def test_settings_email_endpoint(self, auth_headers):
        """Settings email endpoint still working."""
        response = requests.get(f"{BASE_URL}/api/settings/email", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Settings email endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
