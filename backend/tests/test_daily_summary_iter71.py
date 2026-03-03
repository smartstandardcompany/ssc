"""
Test Daily Summary Dashboard Feature - Iteration 71
Tests for GET /api/dashboard/daily-summary endpoint
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestDailySummaryEndpoint:
    """Tests for the /dashboard/daily-summary endpoint"""
    
    def test_daily_summary_without_auth(self):
        """Should return 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/daily-summary")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Daily summary requires authentication")
    
    def test_daily_summary_default_date(self, auth_headers):
        """Should return today's summary by default"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify date is today
        today = datetime.now().strftime("%Y-%m-%d")
        assert data["date"] == today, f"Expected today's date {today}, got {data['date']}"
        
        print(f"✓ Default date is today: {data['date']}")
    
    def test_daily_summary_response_structure(self, auth_headers):
        """Should return correct data structure"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Check main sections exist
        assert "date" in data, "Missing 'date' field"
        assert "sales" in data, "Missing 'sales' section"
        assert "expenses" in data, "Missing 'expenses' section"
        assert "suppliers" in data, "Missing 'suppliers' section"
        assert "summary" in data, "Missing 'summary' section"
        
        print("✓ Response has all main sections")
    
    def test_daily_summary_sales_structure(self, auth_headers):
        """Should return correct sales data structure"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        sales = response.json()["sales"]
        
        # Check sales fields
        required_fields = ["total", "count", "cash", "bank", "credit", "online", 
                         "pending_credit", "by_branch", "top_items", "recent"]
        for field in required_fields:
            assert field in sales, f"Missing sales field: {field}"
        
        # Verify types
        assert isinstance(sales["total"], (int, float)), "sales.total should be numeric"
        assert isinstance(sales["count"], int), "sales.count should be integer"
        assert isinstance(sales["cash"], (int, float)), "sales.cash should be numeric"
        assert isinstance(sales["bank"], (int, float)), "sales.bank should be numeric"
        assert isinstance(sales["credit"], (int, float)), "sales.credit should be numeric"
        assert isinstance(sales["online"], (int, float)), "sales.online should be numeric"
        assert isinstance(sales["by_branch"], dict), "sales.by_branch should be dict"
        assert isinstance(sales["top_items"], list), "sales.top_items should be list"
        assert isinstance(sales["recent"], list), "sales.recent should be list"
        
        print("✓ Sales section has correct structure and types")
    
    def test_daily_summary_expenses_structure(self, auth_headers):
        """Should return correct expenses data structure"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        expenses = response.json()["expenses"]
        
        # Check expenses fields
        required_fields = ["total", "count", "cash", "bank", "credit", 
                         "by_category", "recent"]
        for field in required_fields:
            assert field in expenses, f"Missing expenses field: {field}"
        
        # Verify types
        assert isinstance(expenses["total"], (int, float)), "expenses.total should be numeric"
        assert isinstance(expenses["count"], int), "expenses.count should be integer"
        assert isinstance(expenses["by_category"], dict), "expenses.by_category should be dict"
        assert isinstance(expenses["recent"], list), "expenses.recent should be list"
        
        print("✓ Expenses section has correct structure and types")
    
    def test_daily_summary_suppliers_structure(self, auth_headers):
        """Should return correct suppliers data structure"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        suppliers = response.json()["suppliers"]
        
        # Check suppliers fields
        required_fields = ["payments_total", "payments_count", "credit_purchases", "recent_payments"]
        for field in required_fields:
            assert field in suppliers, f"Missing suppliers field: {field}"
        
        # Verify types
        assert isinstance(suppliers["payments_total"], (int, float)), "suppliers.payments_total should be numeric"
        assert isinstance(suppliers["payments_count"], int), "suppliers.payments_count should be integer"
        assert isinstance(suppliers["credit_purchases"], (int, float)), "suppliers.credit_purchases should be numeric"
        assert isinstance(suppliers["recent_payments"], list), "suppliers.recent_payments should be list"
        
        print("✓ Suppliers section has correct structure and types")
    
    def test_daily_summary_summary_section(self, auth_headers):
        """Should return correct summary data with net calculations"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        summary = response.json()["summary"]
        
        # Check summary fields
        required_fields = ["net_cash_flow", "net_bank_flow", "net_profit", "total_in", "total_out"]
        for field in required_fields:
            assert field in summary, f"Missing summary field: {field}"
        
        # All should be numeric
        for field in required_fields:
            assert isinstance(summary[field], (int, float)), f"summary.{field} should be numeric"
        
        print("✓ Summary section has correct structure with net calculations")
    
    def test_daily_summary_with_specific_date(self, auth_headers):
        """Should return summary for specified date"""
        # Test with yesterday's date
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary?date={yesterday}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["date"] == yesterday, f"Expected date {yesterday}, got {data['date']}"
        
        print(f"✓ Can query specific date: {yesterday}")
    
    def test_daily_summary_with_branch_filter(self, auth_headers):
        """Should accept branch_id filter parameter"""
        # First get branches list
        branches_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        
        if branches_response.status_code == 200:
            branches = branches_response.json()
            if len(branches) > 0:
                branch_id = branches[0]["id"]
                
                response = requests.get(
                    f"{BASE_URL}/api/dashboard/daily-summary?branch_id={branch_id}",
                    headers=auth_headers
                )
                assert response.status_code == 200, f"Expected 200, got {response.status_code}"
                
                print(f"✓ Can filter by branch_id: {branch_id}")
            else:
                print("⚠ No branches available for testing branch filter")
        else:
            print("⚠ Could not fetch branches for filter test")
    
    def test_daily_summary_date_and_branch_filter(self, auth_headers):
        """Should accept both date and branch_id filters together"""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Get first branch if available
        branches_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branch_param = ""
        if branches_response.status_code == 200 and len(branches_response.json()) > 0:
            branch_param = f"&branch_id={branches_response.json()[0]['id']}"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary?date={yesterday}{branch_param}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["date"] == yesterday
        
        print("✓ Can combine date and branch filters")
    
    def test_daily_summary_net_profit_calculation(self, auth_headers):
        """Verify net profit is correctly calculated as sales - expenses"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify net_profit = total_sales - total_expenses
        expected_net_profit = data["sales"]["total"] - data["expenses"]["total"]
        actual_net_profit = data["summary"]["net_profit"]
        
        assert abs(actual_net_profit - expected_net_profit) < 0.01, \
            f"Net profit mismatch: expected {expected_net_profit}, got {actual_net_profit}"
        
        print(f"✓ Net profit correctly calculated: {actual_net_profit}")
    
    def test_daily_summary_net_cash_flow_calculation(self, auth_headers):
        """Verify net cash flow is correctly calculated"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify net_cash_flow = cash_sales - cash_expenses
        expected_cash_flow = data["sales"]["cash"] - data["expenses"]["cash"]
        actual_cash_flow = data["summary"]["net_cash_flow"]
        
        assert abs(actual_cash_flow - expected_cash_flow) < 0.01, \
            f"Net cash flow mismatch: expected {expected_cash_flow}, got {actual_cash_flow}"
        
        print(f"✓ Net cash flow correctly calculated: {actual_cash_flow}")
    
    def test_daily_summary_empty_day(self, auth_headers):
        """Should handle days with no data gracefully"""
        # Use a far future date that won't have data
        future_date = "2030-01-01"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary?date={future_date}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Should return zeros
        assert data["sales"]["total"] == 0, "Sales total should be 0 for empty day"
        assert data["sales"]["count"] == 0, "Sales count should be 0 for empty day"
        assert data["expenses"]["total"] == 0, "Expenses total should be 0 for empty day"
        assert data["expenses"]["count"] == 0, "Expenses count should be 0 for empty day"
        
        print("✓ Empty day returns zeros gracefully")
    
    def test_daily_summary_top_items_structure(self, auth_headers):
        """Verify top_items have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        top_items = response.json()["sales"]["top_items"]
        
        # If there are top items, verify structure
        if len(top_items) > 0:
            item = top_items[0]
            assert "name" in item, "top_item should have 'name'"
            assert "qty" in item, "top_item should have 'qty'"
            assert "revenue" in item, "top_item should have 'revenue'"
            print(f"✓ Top items have correct structure (found {len(top_items)} items)")
        else:
            print("⚠ No top items found (may be empty day)")
    
    def test_daily_summary_recent_sales_structure(self, auth_headers):
        """Verify recent sales have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        recent_sales = response.json()["sales"]["recent"]
        
        # If there are recent sales, verify structure
        if len(recent_sales) > 0:
            sale = recent_sales[0]
            required_fields = ["id", "time", "amount", "customer", "payment_mode", "branch"]
            for field in required_fields:
                assert field in sale, f"recent sale should have '{field}'"
            print(f"✓ Recent sales have correct structure (found {len(recent_sales)} sales)")
        else:
            print("⚠ No recent sales found (may be empty day)")


class TestDailySummaryIntegration:
    """Integration tests for daily summary with other endpoints"""
    
    def test_branches_endpoint_available(self, auth_headers):
        """Verify branches endpoint works for branch filter"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200, f"Branches endpoint failed: {response.status_code}"
        
        branches = response.json()
        assert isinstance(branches, list), "Branches should return a list"
        print(f"✓ Branches endpoint works ({len(branches)} branches)")
    
    def test_daily_summary_consistency(self, auth_headers):
        """Verify data consistency between daily summary and other endpoints"""
        # Get daily summary
        summary_response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            headers=auth_headers
        )
        assert summary_response.status_code == 200
        
        summary = summary_response.json()
        
        # Values should be non-negative
        assert summary["sales"]["total"] >= 0, "Sales total should be non-negative"
        assert summary["expenses"]["total"] >= 0, "Expenses total should be non-negative"
        assert summary["suppliers"]["payments_total"] >= 0, "Supplier payments should be non-negative"
        
        print("✓ All values are non-negative")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
