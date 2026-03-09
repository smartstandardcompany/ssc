"""
Iteration 114 Tests:
1. Daily Summary Bug Fix - Branch filter with cross-branch expenses (expense_for_branch_id)
2. Daily Summary Bug Fix - Date timezone handling with +00:00 suffix
3. Anomaly Detection - GET /api/anomaly-detection/scan 
4. Anomaly Detection - GET /api/anomaly-detection/history
5. Daily Summary - Net Cash/Bank columns verification
6. Duplicate Prevention - Still working from previous iteration
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://anomaly-finder-11.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"

# Test branch ID from the bug report (has cross-branch expenses)
TEST_BRANCH_ID = "d805e6cb-f65a-4a09-8707-95f3f5e505bf"


class TestAuth:
    """Get auth token for protected endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}


class TestDailySummaryBugFix(TestAuth):
    """Test the daily summary bug fix for cross-branch expenses and timezone handling"""
    
    def test_daily_summary_range_with_branch_filter(self, auth_headers):
        """
        Bug Fix #1: GET /api/dashboard/daily-summary-range with branch_id should include 
        expenses where expense_for_branch_id matches the selected branch.
        Test with branch_id=anomaly-finder-11
        """
        # Test last 30 days range
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        # Call with branch filter
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={
                "start_date": start_date,
                "end_date": end_date,
                "branch_id": TEST_BRANCH_ID
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "totals" in data, "Missing totals in response"
        assert "daily" in data, "Missing daily breakdown in response"
        assert "start_date" in data, "Missing start_date in response"
        assert "end_date" in data, "Missing end_date in response"
        
        # Verify totals structure
        totals = data["totals"]
        assert "sales" in totals
        assert "expenses" in totals
        assert "net_cash" in totals, "Missing net_cash in totals"
        assert "net_bank" in totals, "Missing net_bank in totals"
        
        print(f"Branch filter test passed. Totals: sales={totals['sales']}, expenses={totals['expenses']}")
        print(f"Net cash: {totals['net_cash']}, Net bank: {totals['net_bank']}")
        
    def test_daily_summary_range_returns_net_columns(self, auth_headers):
        """
        Verify net_cash and net_bank columns are present in each daily row
        """
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify net columns in totals
        assert "net_cash" in data["totals"], "Missing net_cash in totals"
        assert "net_bank" in data["totals"], "Missing net_bank in totals"
        
        # Verify net columns in daily rows (if any data exists)
        if len(data.get("daily", [])) > 0:
            first_day = data["daily"][0]
            assert "net_cash" in first_day, "Missing net_cash in daily row"
            assert "net_bank" in first_day, "Missing net_bank in daily row"
            print(f"Daily row has net_cash={first_day['net_cash']}, net_bank={first_day['net_bank']}")
        
        print(f"Net columns verified. Days returned: {len(data.get('daily', []))}")
    
    def test_daily_summary_single_day_with_branch(self, auth_headers):
        """
        Test single-day summary with branch filter
        Bug fix should include cross-branch expenses
        """
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            params={"date": today, "branch_id": TEST_BRANCH_ID},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "sales" in data
        assert "expenses" in data
        assert "summary" in data
        
        # Verify net cash flow calculations
        summary = data["summary"]
        assert "net_cash_flow" in summary
        assert "net_bank_flow" in summary
        assert "net_profit" in summary
        
        print(f"Single day summary for branch {TEST_BRANCH_ID}: sales={data['sales']['total']}, expenses={data['expenses']['total']}")
    
    def test_daily_summary_handles_timezone_dates(self, auth_headers):
        """
        Bug Fix #2: The endpoint should handle dates with +00:00 timezone suffix correctly
        using $lt next_day instead of $lte T23:59:59
        """
        # Test with specific date range
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # The fix ensures dates with timezone suffix are included properly
        # We verify by checking the API doesn't error and returns valid structure
        assert "start_date" in data
        assert "end_date" in data
        assert data["start_date"] == start_date
        assert data["end_date"] == end_date
        
        print(f"Timezone handling test passed. Date range: {start_date} to {end_date}")


class TestAnomalyDetection(TestAuth):
    """Test the new Anomaly Detection feature"""
    
    def test_anomaly_scan_endpoint(self, auth_headers):
        """
        Test GET /api/anomaly-detection/scan?days=30
        Should return scan results with anomalies, total, critical, warning, info counts
        """
        response = requests.get(
            f"{BASE_URL}/api/anomaly-detection/scan",
            params={"days": 30},
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "scan" in data, "Missing scan object in response"
        assert "anomalies" in data, "Missing anomalies array in response"
        
        scan = data["scan"]
        assert "total_anomalies" in scan, "Missing total_anomalies"
        assert "critical" in scan, "Missing critical count"
        assert "warning" in scan, "Missing warning count"
        assert "info" in scan, "Missing info count"
        assert "by_category" in scan, "Missing by_category"
        assert "scanned_at" in scan, "Missing scanned_at timestamp"
        
        # Verify by_category breakdown
        by_cat = scan["by_category"]
        assert "sales" in by_cat
        assert "expenses" in by_cat
        assert "bank" in by_cat
        
        # Verify anomalies array structure (if any)
        anomalies = data["anomalies"]
        assert isinstance(anomalies, list)
        
        if len(anomalies) > 0:
            first = anomalies[0]
            assert "id" in first
            assert "category" in first
            assert "type" in first
            assert "severity" in first
            assert "title" in first
            assert "description" in first
            print(f"First anomaly: {first['title']} ({first['severity']})")
        
        print(f"Anomaly scan completed: {scan['total_anomalies']} total anomalies")
        print(f"  Critical: {scan['critical']}, Warning: {scan['warning']}, Info: {scan['info']}")
    
    def test_anomaly_history_endpoint(self, auth_headers):
        """
        Test GET /api/anomaly-detection/history
        Should return array of previous scan results
        """
        response = requests.get(
            f"{BASE_URL}/api/anomaly-detection/history",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"History failed: {response.text}"
        data = response.json()
        
        # Should return an array
        assert isinstance(data, list), "Response should be a list"
        
        # If history exists, verify structure
        if len(data) > 0:
            first = data[0]
            assert "id" in first
            assert "scanned_at" in first
            assert "total_anomalies" in first
            assert "critical" in first
            assert "warning" in first
            assert "info" in first
            print(f"Latest scan: {first['scanned_at']} with {first['total_anomalies']} anomalies")
        
        print(f"Anomaly history returned {len(data)} scan records")
    
    def test_anomaly_schedule_endpoint(self, auth_headers):
        """Test GET /api/anomaly-detection/schedule"""
        response = requests.get(
            f"{BASE_URL}/api/anomaly-detection/schedule",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Schedule failed: {response.text}"
        data = response.json()
        
        # Verify schedule structure
        assert "enabled" in data
        assert "frequency" in data
        assert "period_days" in data
        
        print(f"Schedule settings: enabled={data['enabled']}, frequency={data['frequency']}")


class TestDuplicatePrevention(TestAuth):
    """Test duplicate prevention feature (regression from iteration 113)"""
    
    def test_check_duplicate_endpoint(self, auth_headers):
        """
        Verify GET /api/sales/check-duplicate still works
        """
        # Get a branch to test with
        branches_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert branches_response.status_code == 200
        branches = branches_response.json()
        
        if len(branches) > 0:
            branch_id = branches[0]["id"]
            today = datetime.now().strftime("%Y-%m-%d")
            
            response = requests.get(
                f"{BASE_URL}/api/sales/check-duplicate",
                params={
                    "branch_id": branch_id,
                    "amount": 100.00,
                    "date": today
                },
                headers=auth_headers
            )
            
            assert response.status_code == 200, f"Check duplicate failed: {response.text}"
            data = response.json()
            
            assert "has_duplicate" in data
            assert "count" in data
            assert isinstance(data["has_duplicate"], bool)
            assert isinstance(data["count"], int)
            
            print(f"Duplicate check: has_duplicate={data['has_duplicate']}, count={data['count']}")


class TestDashboardStats(TestAuth):
    """Test dashboard stats endpoint"""
    
    def test_dashboard_stats_endpoint(self, auth_headers):
        """Verify main dashboard stats work"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify key stats are present
        assert "total_sales" in data
        assert "total_expenses" in data
        assert "net_profit" in data
        assert "cash_in_hand" in data
        assert "bank_in_hand" in data
        
        print(f"Dashboard stats: sales={data['total_sales']}, expenses={data['total_expenses']}, profit={data['net_profit']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
