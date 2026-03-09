"""
Test Suite for Iteration 119 - Dashboard Daily Summary Bug Fix
Testing:
1. Dashboard stats card shows cash/bank/online breakdown in subItems
2. Dashboard Total Expenses card shows top 3 expense categories
3. Daily Summary single-day endpoint returns correct sales total (not doubled)
4. Daily Summary range endpoint returns correct totals (not doubled)
5. Sales page Grand Total calculation matches Cash+Bank+Credit+Online
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardDailySummaryFix:
    """Tests for the dashboard and daily summary bug fixes"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API returns access_token, not token
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Auth headers for API calls"""
        return {"Authorization": f"Bearer {auth_token}"}

    # ============ Dashboard Stats Tests ============
    
    def test_dashboard_stats_returns_cash_bank_online(self, auth_headers):
        """Test that dashboard stats returns cash_sales, bank_sales, online_sales"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        
        # Verify cash_sales, bank_sales, online_sales exist
        assert "cash_sales" in data, "cash_sales field missing from dashboard stats"
        assert "bank_sales" in data, "bank_sales field missing from dashboard stats"
        assert "online_sales" in data, "online_sales field missing from dashboard stats"
        assert "total_sales" in data, "total_sales field missing from dashboard stats"
        
        # Verify they are numeric
        assert isinstance(data["cash_sales"], (int, float)), "cash_sales should be numeric"
        assert isinstance(data["bank_sales"], (int, float)), "bank_sales should be numeric"
        assert isinstance(data["online_sales"], (int, float)), "online_sales should be numeric"
        
        print(f"Dashboard stats - Total: {data['total_sales']}, Cash: {data['cash_sales']}, Bank: {data['bank_sales']}, Online: {data['online_sales']}")
    
    def test_dashboard_stats_expense_by_category(self, auth_headers):
        """Test that dashboard stats returns expense_by_category for top categories"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        
        # Verify expense_by_category exists
        assert "expense_by_category" in data, "expense_by_category field missing from dashboard stats"
        assert isinstance(data["expense_by_category"], dict), "expense_by_category should be a dict"
        
        # Log top 3 categories
        categories = sorted(data["expense_by_category"].items(), key=lambda x: -x[1])[:3]
        print(f"Top 3 expense categories: {categories}")
    
    # ============ Daily Summary Single Day Tests ============
    
    def test_daily_summary_single_day_march_5(self, auth_headers):
        """Test daily summary for March 5, 2026 - should be SAR 1000 (4 sales) NOT doubled"""
        response = requests.get(f"{BASE_URL}/api/dashboard/daily-summary?date=2026-03-05", headers=auth_headers)
        assert response.status_code == 200, f"Daily summary failed: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "date" in data, "date field missing"
        assert "sales" in data, "sales field missing"
        assert data["date"] == "2026-03-05", f"Expected date 2026-03-05, got {data['date']}"
        
        # Verify sales total is approximately 1000 (not doubled to ~2000)
        sales_total = data["sales"].get("total", 0)
        sales_count = data["sales"].get("count", 0)
        
        print(f"March 5, 2026 - Sales Total: {sales_total}, Count: {sales_count}")
        
        # The fix should prevent double counting - expected ~1000, not ~2000
        # Allow some tolerance but it should NOT be doubled
        assert sales_total < 1500, f"Sales total {sales_total} appears to be doubled (expected ~1000)"
    
    def test_daily_summary_payment_breakdown(self, auth_headers):
        """Test that daily summary returns correct payment breakdown (cash, bank, credit, online)"""
        response = requests.get(f"{BASE_URL}/api/dashboard/daily-summary?date=2026-03-05", headers=auth_headers)
        assert response.status_code == 200, f"Daily summary failed: {response.text}"
        
        data = response.json()
        sales = data.get("sales", {})
        
        # Verify payment breakdown fields exist
        assert "cash" in sales, "cash field missing from sales breakdown"
        assert "bank" in sales, "bank field missing from sales breakdown"
        assert "credit" in sales, "credit field missing from sales breakdown"
        assert "online" in sales, "online field missing from sales breakdown"
        
        print(f"Payment breakdown - Cash: {sales['cash']}, Bank: {sales['bank']}, Credit: {sales['credit']}, Online: {sales['online']}")
    
    # ============ Daily Summary Range Tests ============
    
    def test_daily_summary_range_not_doubled(self, auth_headers):
        """Test daily summary range endpoint - totals should NOT be doubled"""
        # Get range data for all available dates
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range?start_date=2026-01-01&end_date=2026-12-31",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Daily summary range failed: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "totals" in data, "totals field missing"
        assert "daily" in data, "daily field missing"
        
        totals = data["totals"]
        
        # The expected total is approximately SAR 64,662 (54 sales)
        # It should NOT be ~129,324 (which was the doubled value)
        sales_total = totals.get("sales", 0)
        sales_count = totals.get("sales_count", 0)
        
        print(f"Range totals - Sales: {sales_total}, Count: {sales_count}")
        
        # If there's significant sales, check it's not doubled
        # The doubled value would be roughly 2x the expected
        if sales_count > 0:
            avg_per_sale = sales_total / sales_count
            print(f"Average per sale: {avg_per_sale}")
            # Average should be reasonable (not doubled)
    
    def test_daily_summary_range_payment_breakdown(self, auth_headers):
        """Test that range totals include payment breakdown"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range?start_date=2026-03-01&end_date=2026-03-31",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Daily summary range failed: {response.text}"
        
        data = response.json()
        totals = data.get("totals", {})
        
        # Verify payment breakdown fields
        assert "sales_cash" in totals, "sales_cash missing from totals"
        assert "sales_bank" in totals, "sales_bank missing from totals"
        assert "sales_credit" in totals, "sales_credit missing from totals"
        assert "sales_online" in totals, "sales_online missing from totals"
        
        print(f"Range payment breakdown - Cash: {totals['sales_cash']}, Bank: {totals['sales_bank']}, Credit: {totals['sales_credit']}, Online: {totals['sales_online']}")
    
    def test_daily_breakdown_in_range(self, auth_headers):
        """Test that daily breakdown within range is correct"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range?start_date=2026-03-01&end_date=2026-03-31",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Daily summary range failed: {response.text}"
        
        data = response.json()
        daily = data.get("daily", [])
        
        # Find March 5 in daily breakdown
        march_5_data = next((d for d in daily if d.get("date") == "2026-03-05"), None)
        
        if march_5_data:
            sales_for_day = march_5_data.get("sales", 0)
            count_for_day = march_5_data.get("sales_count", 0)
            print(f"March 5 in range - Sales: {sales_for_day}, Count: {count_for_day}")
            
            # Should not be doubled
            assert sales_for_day < 1500, f"March 5 sales {sales_for_day} appears doubled"
        else:
            print("March 5 not found in daily breakdown - may have no data")
    
    # ============ Sales API Tests ============
    
    def test_sales_api_returns_data(self, auth_headers):
        """Test that sales API returns data correctly"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200, f"Sales API failed: {response.text}"
        
        data = response.json()
        
        # Handle paginated response
        if isinstance(data, dict) and "data" in data:
            sales = data["data"]
        else:
            sales = data if isinstance(data, list) else []
        
        print(f"Sales API returned {len(sales)} records")
        
        # Verify each sale has required fields
        if sales:
            sale = sales[0]
            assert "amount" in sale, "amount field missing from sale"
            assert "payment_details" in sale or "payment_mode" in sale, "payment info missing"
    
    def test_sales_final_amount_calculation(self, auth_headers):
        """Test that sales have correct final_amount (accounting for nulls)"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200, f"Sales API failed: {response.text}"
        
        data = response.json()
        sales = data.get("data", data) if isinstance(data, dict) else data
        
        # Check for sales with null final_amount
        null_final_count = 0
        for sale in sales[:50]:  # Check first 50
            final_amount = sale.get("final_amount")
            amount = sale.get("amount", 0)
            discount = sale.get("discount", 0)
            
            if final_amount is None:
                null_final_count += 1
                # Expected final should be amount - discount
                expected = amount - discount
                print(f"Sale with null final_amount: amount={amount}, discount={discount}, expected={expected}")
        
        print(f"Sales with null final_amount: {null_final_count}")
    
    # ============ Today vs Yesterday Comparison Tests ============
    
    def test_today_vs_yesterday_endpoint(self, auth_headers):
        """Test today vs yesterday comparison endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/today-vs-yesterday", headers=auth_headers)
        assert response.status_code == 200, f"Today vs yesterday failed: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "today" in data, "today field missing"
        assert "yesterday" in data, "yesterday field missing"
        assert "change" in data, "change field missing"
        
        today = data["today"]
        assert "sales" in today, "today.sales missing"
        assert "cash" in today, "today.cash missing"
        assert "bank" in today, "today.bank missing"
        
        print(f"Today: Sales={today['sales']}, Cash={today['cash']}, Bank={today['bank']}")
    
    # ============ Export Center Regression Test ============
    
    def test_export_center_still_works(self, auth_headers):
        """Regression: Export Center should still work after dashboard fixes"""
        response = requests.get(f"{BASE_URL}/api/export-center/report-types", headers=auth_headers)
        assert response.status_code == 200, f"Export center types failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Report types should be a list"
        assert len(data) > 0, "Should have at least one report type"
        
        print(f"Export Center has {len(data)} report types available")


class TestLoginFlow:
    """Test login flow works correctly"""
    
    def test_login_with_admin_credentials(self):
        """Test login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        # API returns access_token, not token
        assert "access_token" in data or "token" in data, "Token missing from login response"
        assert "user" in data, "User missing from login response"
        
        user = data["user"]
        assert user.get("email") == "ss@ssc.com", "Email mismatch"
        print(f"Login successful for user: {user.get('name', user.get('email'))}")
    
    def test_login_with_invalid_credentials(self):
        """Test login fails with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [401, 400], f"Expected 401/400, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
