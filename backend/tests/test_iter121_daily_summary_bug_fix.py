"""
Iteration 121: Daily Summary Range Bug Fix Tests
Bug: The 'Day by Day' view was missing days and showing incorrect sales totals compared to the main Sales report.
Root Cause: The daily dict was only populated from records that existed, so days with no transactions were completely absent.
Fix: Pre-populate daily dict with all dates in the requested range (lines 755-762 in dashboard.py).

Tests verify:
1. /api/dashboard/daily-summary-range returns ALL dates in the requested range, including days with zero data
2. Sales totals per day match the totals from /api/sales endpoint for the same dates
3. Summary totals (total sales, total expenses) in the range response are correct
4. Single day /api/dashboard/daily-summary endpoint still works correctly
5. Net cash and net bank calculations are correct per day
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestAuth:
    """Get auth token for authenticated requests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get access token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with Bearer token"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestDailySummaryRangeFix(TestAuth):
    """Tests for the daily-summary-range bug fix - ensuring all dates in range are returned"""
    
    def test_daily_summary_range_returns_all_dates_in_range(self, auth_headers):
        """
        BUG FIX TEST: Verify that daily-summary-range returns ALL dates between start and end,
        including days with zero transactions (the main bug was missing days).
        """
        # Use the test range specified: 2026-03-01 to 2026-03-09
        start_date = "2026-03-01"
        end_date = "2026-03-09"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        assert response.status_code == 200, f"API failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "daily" in data, "Missing 'daily' field in response"
        assert "totals" in data, "Missing 'totals' field in response"
        assert "days_count" in data, "Missing 'days_count' field in response"
        
        # Calculate expected number of days
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        expected_days = (end - start).days + 1  # Inclusive
        
        # KEY ASSERTION: The fix should return ALL days, not just days with data
        actual_days = data["days_count"]
        assert actual_days == expected_days, f"Expected {expected_days} days, got {actual_days}. Bug may not be fixed!"
        
        # Verify each day in the range is present in the daily list
        daily_dates = [d["date"] for d in data["daily"]]
        current = start
        while current <= end:
            date_str = current.strftime("%Y-%m-%d")
            assert date_str in daily_dates, f"Date {date_str} is missing from daily list - BUG NOT FIXED!"
            current += timedelta(days=1)
        
        print(f"PASS: All {expected_days} dates present in range (including zero-data days)")
    
    def test_daily_summary_range_dates_are_continuous(self, auth_headers):
        """Verify there are no gaps between consecutive dates in the response"""
        start_date = "2026-03-01"
        end_date = "2026-03-09"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Sort daily entries by date
        daily = sorted(data["daily"], key=lambda x: x["date"])
        
        # Check for gaps
        for i in range(len(daily) - 1):
            current_date = datetime.strptime(daily[i]["date"], "%Y-%m-%d")
            next_date = datetime.strptime(daily[i + 1]["date"], "%Y-%m-%d")
            days_diff = (next_date - current_date).days
            assert days_diff == 1, f"Gap found between {daily[i]['date']} and {daily[i+1]['date']} - {days_diff} days apart"
        
        print("PASS: All dates are continuous with no gaps")
    
    def test_daily_sales_match_sales_endpoint(self, auth_headers):
        """
        Verify that sales totals per day in daily-summary-range match
        the totals from /api/sales endpoint for the same dates.
        """
        # Pick a specific date that should have data
        test_date = "2026-03-03"
        
        # Get daily summary range for just that day
        range_response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": test_date, "end_date": test_date},
            headers=auth_headers
        )
        assert range_response.status_code == 200
        range_data = range_response.json()
        
        # Get sales for that date
        sales_response = requests.get(
            f"{BASE_URL}/api/sales",
            params={"start_date": test_date, "end_date": test_date, "limit": 500},
            headers=auth_headers
        )
        assert sales_response.status_code == 200
        sales_data = sales_response.json()
        
        # Calculate total from sales endpoint
        sales_total = sum(
            s.get("final_amount", s.get("amount", 0)) 
            for s in sales_data.get("data", [])
        )
        sales_count = sales_data.get("total", 0)
        
        # Get values from range endpoint
        range_totals = range_data["totals"]
        range_daily = range_data["daily"][0] if range_data["daily"] else {}
        
        # Compare totals
        assert abs(range_totals.get("sales", 0) - sales_total) < 0.01, \
            f"Total sales mismatch: range={range_totals.get('sales')}, sales_api={sales_total}"
        
        assert range_totals.get("sales_count", 0) == sales_count, \
            f"Sales count mismatch: range={range_totals.get('sales_count')}, sales_api={sales_count}"
        
        print(f"PASS: Daily sales match sales endpoint - {range_totals.get('sales')} SAR ({sales_count} transactions)")
    
    def test_zero_data_days_have_zero_values(self, auth_headers):
        """
        Verify that days with no transactions show 0 for all metrics,
        not missing or null values.
        """
        # Use a range that likely includes days with no data
        start_date = "2026-03-01"
        end_date = "2026-03-09"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check that each day has all required fields (even if zero)
        required_fields = ["date", "sales", "sales_cash", "sales_bank", "sales_credit", 
                          "sales_online", "sales_count", "expenses", "exp_cash", "exp_bank", 
                          "exp_credit", "exp_count", "sp_total", "sp_cash", "sp_bank",
                          "net_cash", "net_bank"]
        
        for day in data["daily"]:
            for field in required_fields:
                assert field in day, f"Missing field '{field}' for date {day.get('date')}"
                # Values should be numbers, not null
                if field != "date":
                    assert day[field] is not None, f"Field '{field}' is null for date {day.get('date')}"
        
        print(f"PASS: All {len(data['daily'])} days have complete data structure")


class TestDailySummaryTotals(TestAuth):
    """Tests for summary totals correctness"""
    
    def test_totals_match_daily_sum(self, auth_headers):
        """Verify that totals.sales equals the sum of all daily sales"""
        start_date = "2026-03-01"
        end_date = "2026-03-09"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Sum up daily values
        daily_sales_sum = sum(d.get("sales", 0) for d in data["daily"])
        daily_expenses_sum = sum(d.get("expenses", 0) for d in data["daily"])
        daily_sales_cash_sum = sum(d.get("sales_cash", 0) for d in data["daily"])
        daily_sales_bank_sum = sum(d.get("sales_bank", 0) for d in data["daily"])
        
        # Compare with totals
        assert abs(data["totals"]["sales"] - daily_sales_sum) < 0.01, \
            f"Sales total mismatch: totals={data['totals']['sales']}, daily_sum={daily_sales_sum}"
        
        assert abs(data["totals"]["expenses"] - daily_expenses_sum) < 0.01, \
            f"Expenses total mismatch: totals={data['totals']['expenses']}, daily_sum={daily_expenses_sum}"
        
        assert abs(data["totals"]["sales_cash"] - daily_sales_cash_sum) < 0.01, \
            f"Sales cash total mismatch: totals={data['totals']['sales_cash']}, daily_sum={daily_sales_cash_sum}"
        
        assert abs(data["totals"]["sales_bank"] - daily_sales_bank_sum) < 0.01, \
            f"Sales bank total mismatch: totals={data['totals']['sales_bank']}, daily_sum={daily_sales_bank_sum}"
        
        print(f"PASS: Totals match daily sums - Sales: {data['totals']['sales']}, Expenses: {data['totals']['expenses']}")
    
    def test_net_profit_calculation(self, auth_headers):
        """Verify net_profit = sales - expenses"""
        start_date = "2026-03-01"
        end_date = "2026-03-09"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        expected_net_profit = data["totals"]["sales"] - data["totals"]["expenses"]
        actual_net_profit = data["totals"]["net_profit"]
        
        assert abs(actual_net_profit - expected_net_profit) < 0.01, \
            f"Net profit mismatch: expected={expected_net_profit}, actual={actual_net_profit}"
        
        print(f"PASS: Net profit calculation correct: {actual_net_profit}")
    
    def test_net_cash_and_bank_calculations(self, auth_headers):
        """Verify net_cash and net_bank calculations per day"""
        start_date = "2026-03-01"
        end_date = "2026-03-09"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check each day's net_cash and net_bank calculations
        for day in data["daily"]:
            expected_net_cash = (day.get("sales_cash", 0) or 0) - (day.get("exp_cash", 0) or 0)
            expected_net_bank = (day.get("sales_bank", 0) or 0) - (day.get("exp_bank", 0) or 0)
            
            actual_net_cash = day.get("net_cash", 0)
            actual_net_bank = day.get("net_bank", 0)
            
            assert abs(actual_net_cash - expected_net_cash) < 0.01, \
                f"Net cash mismatch for {day['date']}: expected={expected_net_cash}, actual={actual_net_cash}"
            
            assert abs(actual_net_bank - expected_net_bank) < 0.01, \
                f"Net bank mismatch for {day['date']}: expected={expected_net_bank}, actual={actual_net_bank}"
        
        print(f"PASS: Net cash and net bank calculations correct for all {len(data['daily'])} days")


class TestSingleDaySummary(TestAuth):
    """Tests for single day /api/dashboard/daily-summary endpoint"""
    
    def test_single_day_summary_endpoint(self, auth_headers):
        """Verify single day summary endpoint still works correctly"""
        test_date = "2026-03-03"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            params={"date": test_date},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Single day summary failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "date" in data, "Missing 'date' field"
        assert "sales" in data, "Missing 'sales' field"
        assert "expenses" in data, "Missing 'expenses' field"
        assert "suppliers" in data, "Missing 'suppliers' field"
        assert "summary" in data, "Missing 'summary' field"
        
        # Verify sales breakdown
        assert "total" in data["sales"], "Missing sales.total"
        assert "cash" in data["sales"], "Missing sales.cash"
        assert "bank" in data["sales"], "Missing sales.bank"
        
        # Verify net calculations
        assert "net_cash_flow" in data["summary"], "Missing summary.net_cash_flow"
        assert "net_profit" in data["summary"], "Missing summary.net_profit"
        
        print(f"PASS: Single day summary working for {test_date}")
    
    def test_single_day_matches_range_day(self, auth_headers):
        """Verify single day endpoint returns same data as that day in range endpoint"""
        test_date = "2026-03-03"
        
        # Get single day
        single_response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary",
            params={"date": test_date},
            headers=auth_headers
        )
        assert single_response.status_code == 200
        single_data = single_response.json()
        
        # Get same day from range
        range_response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": test_date, "end_date": test_date},
            headers=auth_headers
        )
        assert range_response.status_code == 200
        range_data = range_response.json()
        
        # Compare sales totals
        single_sales = single_data["sales"]["total"]
        range_sales = range_data["totals"]["sales"]
        
        assert abs(single_sales - range_sales) < 0.01, \
            f"Sales mismatch: single={single_sales}, range={range_sales}"
        
        # Compare expenses totals
        single_expenses = single_data["expenses"]["total"]
        range_expenses = range_data["totals"]["expenses"]
        
        assert abs(single_expenses - range_expenses) < 0.01, \
            f"Expenses mismatch: single={single_expenses}, range={range_expenses}"
        
        print(f"PASS: Single day matches range day - Sales: {single_sales}, Expenses: {single_expenses}")


class TestExpenseByCategory(TestAuth):
    """Tests for expense_by_category in range response"""
    
    def test_expense_by_category_present(self, auth_headers):
        """Verify expense_by_category is included in response"""
        start_date = "2026-03-01"
        end_date = "2026-03-09"
        
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary-range",
            params={"start_date": start_date, "end_date": end_date},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "expense_by_category" in data, "Missing 'expense_by_category' in response"
        
        # If there are expenses, verify category totals
        if data["totals"]["expenses"] > 0:
            category_sum = sum(data["expense_by_category"].values())
            assert abs(category_sum - data["totals"]["expenses"]) < 0.01, \
                f"Category sum {category_sum} doesn't match total {data['totals']['expenses']}"
            print(f"PASS: Expense by category sums to total: {category_sum}")
        else:
            print("PASS: No expenses in range (expense_by_category present but empty)")


class TestBranchFiltering(TestAuth):
    """Tests for branch filtering in daily-summary-range"""
    
    def test_branch_filter_works(self, auth_headers):
        """Verify branch_id filter works"""
        start_date = "2026-03-01"
        end_date = "2026-03-09"
        
        # First get all branches
        branches_response = requests.get(
            f"{BASE_URL}/api/branches",
            headers=auth_headers
        )
        # If we have branches, test filtering
        if branches_response.status_code == 200:
            branches_data = branches_response.json()
            branches = branches_data if isinstance(branches_data, list) else branches_data.get("data", [])
            
            if branches:
                branch_id = branches[0].get("id")
                
                # Get filtered data
                filtered_response = requests.get(
                    f"{BASE_URL}/api/dashboard/daily-summary-range",
                    params={"start_date": start_date, "end_date": end_date, "branch_id": branch_id},
                    headers=auth_headers
                )
                assert filtered_response.status_code == 200, f"Branch filter failed: {filtered_response.text}"
                
                # Get unfiltered data
                unfiltered_response = requests.get(
                    f"{BASE_URL}/api/dashboard/daily-summary-range",
                    params={"start_date": start_date, "end_date": end_date},
                    headers=auth_headers
                )
                assert unfiltered_response.status_code == 200
                
                filtered_data = filtered_response.json()
                unfiltered_data = unfiltered_response.json()
                
                # Both should return all days (the fix applies regardless of filter)
                assert filtered_data["days_count"] == unfiltered_data["days_count"], \
                    "Branch filter should not affect days_count"
                
                # Filtered totals should be <= unfiltered totals
                assert filtered_data["totals"]["sales"] <= unfiltered_data["totals"]["sales"], \
                    "Filtered sales should not exceed unfiltered sales"
                
                print(f"PASS: Branch filter works - filtered sales: {filtered_data['totals']['sales']}, total: {unfiltered_data['totals']['sales']}")
            else:
                pytest.skip("No branches found to test filtering")
        else:
            pytest.skip("Could not get branches for filter test")
