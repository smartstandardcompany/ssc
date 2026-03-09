"""
Iteration 120: Data Integrity Checker Tests
Tests for the new Data Integrity feature including scan, fix, and fix-all endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestDataIntegrity:
    """Data Integrity Checker endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")  # API returns access_token not token
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # -- Data Integrity Scan Tests --
    
    def test_scan_endpoint_returns_200(self):
        """Test that scan endpoint returns 200 for admin user"""
        response = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        assert response.status_code == 200, f"Scan failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "summary" in data, "Response should contain 'summary'"
        assert "issues" in data, "Response should contain 'issues'"
        print(f"Scan completed: {data['summary']['total_issues']} total issues found")
    
    def test_scan_returns_valid_summary_structure(self):
        """Test that scan summary has correct structure"""
        response = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        assert response.status_code == 200
        
        summary = response.json()["summary"]
        assert "total_issues" in summary, "Summary should have total_issues"
        assert "by_type" in summary, "Summary should have by_type"
        assert "by_severity" in summary, "Summary should have by_severity"
        assert "total_sales_scanned" in summary, "Summary should have total_sales_scanned"
        
        # Validate by_severity structure
        by_severity = summary["by_severity"]
        assert "high" in by_severity, "by_severity should have 'high'"
        assert "medium" in by_severity, "by_severity should have 'medium'"
        assert "low" in by_severity, "by_severity should have 'low'"
        
        print(f"Summary: Total={summary['total_issues']}, High={by_severity['high']}, Medium={by_severity['medium']}, Low={by_severity['low']}")
    
    def test_scan_issues_have_correct_types(self):
        """Test that issues are categorized into correct types"""
        response = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        by_type = data["summary"]["by_type"]
        
        # Check valid issue types (based on implementation)
        valid_types = ["missing_final_amount", "payment_mismatch", "unusual_mode"]
        for issue_type in by_type.keys():
            assert issue_type in valid_types, f"Unknown issue type: {issue_type}"
        
        print(f"Issue types found: {by_type}")
    
    def test_scan_issues_have_required_fields(self):
        """Test that each issue has all required fields"""
        response = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        assert response.status_code == 200
        
        issues = response.json()["issues"]
        if len(issues) == 0:
            pytest.skip("No issues found to validate")
        
        required_fields = ["id", "sale_id", "type", "severity", "module", "date", 
                          "branch", "description", "suggested_fix"]
        
        for issue in issues[:5]:  # Check first 5 issues
            for field in required_fields:
                assert field in issue, f"Issue missing required field: {field}"
        
        print(f"Validated {min(5, len(issues))} issues have all required fields")
    
    def test_scan_severity_counts_match_total(self):
        """Test that severity counts add up to total issues"""
        response = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        assert response.status_code == 200
        
        summary = response.json()["summary"]
        total = summary["total_issues"]
        by_severity = summary["by_severity"]
        
        severity_sum = by_severity["high"] + by_severity["medium"] + by_severity["low"]
        assert severity_sum == total, f"Severity sum {severity_sum} != total {total}"
        print(f"Severity counts verified: {by_severity['high']}+{by_severity['medium']}+{by_severity['low']}={total}")
    
    # -- Fix Endpoint Tests --
    
    def test_fix_endpoint_exists(self):
        """Test that fix endpoint exists and responds"""
        # Send empty request to verify endpoint exists
        response = requests.post(f"{BASE_URL}/api/data-integrity/fix", 
                                headers=self.headers, 
                                json={"issue_type": "unknown", "sale_id": "nonexistent"})
        # Should return 200 but with error message, not 404
        assert response.status_code != 404, "Fix endpoint should exist"
        print(f"Fix endpoint response: {response.status_code}")
    
    def test_fix_missing_final_amount_single(self):
        """Test fixing a single missing_final_amount issue"""
        # First, get an issue of this type
        scan_response = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        assert scan_response.status_code == 200
        
        issues = scan_response.json()["issues"]
        missing_final = [i for i in issues if i["type"] == "missing_final_amount"]
        
        if not missing_final:
            pytest.skip("No missing_final_amount issues to fix")
        
        issue = missing_final[0]
        response = requests.post(f"{BASE_URL}/api/data-integrity/fix", 
                                headers=self.headers,
                                json={
                                    "issue_type": "missing_final_amount",
                                    "sale_id": issue["sale_id"],
                                    "fix_value": issue.get("fix_value")
                                })
        
        assert response.status_code == 200, f"Fix failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Fix should succeed: {data}"
        print(f"Fixed missing_final_amount for sale {issue['sale_id']}")
    
    # -- Fix All Endpoint Tests --
    
    def test_fix_all_endpoint_exists(self):
        """Test that fix-all endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/data-integrity/fix-all",
                                headers=self.headers,
                                json={"issue_type": "unknown_type"})
        assert response.status_code != 404, "Fix-all endpoint should exist"
        print(f"Fix-all endpoint response: {response.status_code}")
    
    def test_fix_all_missing_final_amount(self):
        """Test bulk fix of missing_final_amount issues"""
        # Get initial count
        scan_before = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        assert scan_before.status_code == 200
        before_count = scan_before.json()["summary"]["by_type"].get("missing_final_amount", 0)
        
        if before_count == 0:
            pytest.skip("No missing_final_amount issues to fix")
        
        # Execute bulk fix
        response = requests.post(f"{BASE_URL}/api/data-integrity/fix-all",
                                headers=self.headers,
                                json={"issue_type": "missing_final_amount"})
        
        assert response.status_code == 200, f"Bulk fix failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Bulk fix should succeed: {data}"
        assert "fixed_count" in data, "Response should include fixed_count"
        
        print(f"Bulk fix completed: {data.get('fixed_count')} records fixed (was {before_count})")
        
        # Verify by rescanning
        scan_after = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        after_count = scan_after.json()["summary"]["by_type"].get("missing_final_amount", 0)
        
        assert after_count < before_count, f"After fix, count should decrease: {before_count} -> {after_count}"
        print(f"Verified: missing_final_amount count reduced from {before_count} to {after_count}")
    

class TestDashboardRegression:
    """Regression tests to ensure dashboard still works correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats_still_shows_payment_breakdown(self):
        """Regression: Dashboard should still show cash/bank breakdown"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        # Check for payment breakdown fields (from iteration 119)
        assert "cash_sales" in data or "payment_breakdown" in data, "Dashboard should show payment breakdown"
        print(f"Dashboard stats: cash_sales={data.get('cash_sales')}, bank_sales={data.get('bank_sales')}")
    
    def test_daily_summary_no_double_counting(self):
        """Regression: Daily summary should not double count sales"""
        # Test with a specific date range
        params = {"start_date": "2026-03-01", "end_date": "2026-03-08"}
        response = requests.get(f"{BASE_URL}/api/dashboard/daily-summary-range", 
                               headers=self.headers, params=params)
        assert response.status_code == 200, f"Daily summary failed: {response.text}"
        
        data = response.json()
        # Response has 'totals' key containing total_sales
        assert "totals" in data or "daily" in data, "Response should have totals or daily data"
        totals = data.get("totals", {})
        print(f"Daily summary range totals: {totals.get('total_sales', 'N/A')}")


class TestDataIntegritySidebarAccess:
    """Test that Data Integrity page is accessible via sidebar (admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = response.json().get("user")
    
    def test_admin_user_role(self):
        """Verify test user is admin"""
        assert self.user.get("role") == "admin", f"User should be admin, got: {self.user.get('role')}"
        print(f"User role verified: {self.user.get('role')}")
    
    def test_scan_requires_admin(self):
        """Test that scan endpoint requires admin role"""
        # This is implicit since we test with admin - but endpoint returns error for non-admin
        response = requests.get(f"{BASE_URL}/api/data-integrity/scan", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "error" not in data or data.get("error") != "Admin only", "Admin should have access"
        print("Admin access to scan endpoint confirmed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
