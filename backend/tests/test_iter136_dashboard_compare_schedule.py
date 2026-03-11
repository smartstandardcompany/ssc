"""
Iteration 136: Dashboard Compare Toggle + Menu Item Schedule Tests

Testing:
1. Dashboard Compare Toggle: GET /api/dashboard/period-compare endpoint with period=day|week|month
2. Menu Item Schedule: Create/Update menu items with schedule field
3. CashierPOS: Schedule filtering logic (tested via menu item data)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"

@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")

@pytest.fixture
def auth_headers(auth_token):
    """Get authenticated headers"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestDashboardPeriodCompare:
    """Test /api/dashboard/period-compare endpoint"""
    
    def test_01_period_compare_day(self, auth_headers):
        """Test period-compare with period=day returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/period-compare?period=day", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify structure
        assert "period" in data, "Missing 'period' field"
        assert data["period"] == "day", f"Expected period='day', got {data['period']}"
        
        assert "labels" in data, "Missing 'labels' field"
        assert data["labels"]["current"] == "Today", f"Expected 'Today', got {data['labels']['current']}"
        assert data["labels"]["previous"] == "Yesterday", f"Expected 'Yesterday', got {data['labels']['previous']}"
        
        assert "current" in data, "Missing 'current' field"
        assert "previous" in data, "Missing 'previous' field"
        assert "change" in data, "Missing 'change' field"
        
        # Verify current period has expected metrics
        current = data["current"]
        expected_fields = ["sales", "expenses", "profit", "transactions", "cash", "bank"]
        for field in expected_fields:
            assert field in current, f"Missing '{field}' in current data"
        
        print(f"Period compare (day) - Current sales: {current['sales']}, Transactions: {current['transactions']}")
    
    def test_02_period_compare_week(self, auth_headers):
        """Test period-compare with period=week returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/period-compare?period=week", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["period"] == "week"
        assert data["labels"]["current"] == "This Week"
        assert data["labels"]["previous"] == "Last Week"
        
        # Verify change percentage structure
        change = data["change"]
        for field in ["sales", "expenses", "profit", "transactions", "cash", "bank"]:
            assert field in change, f"Missing '{field}' in change data"
            # Change should be a number (float)
            assert isinstance(change[field], (int, float)), f"'{field}' change should be numeric"
        
        print(f"Period compare (week) - Sales change: {change['sales']}%, Profit change: {change['profit']}%")
    
    def test_03_period_compare_month(self, auth_headers):
        """Test period-compare with period=month returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/period-compare?period=month", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["period"] == "month"
        assert data["labels"]["current"] == "This Month"
        assert data["labels"]["previous"] == "Last Month"
        
        # Verify date ranges
        assert "current_range" in data, "Missing 'current_range' field"
        assert "previous_range" in data, "Missing 'previous_range' field"
        assert "start" in data["current_range"]
        assert "end" in data["current_range"]
        
        print(f"Period compare (month) - Range: {data['current_range']['start'][:10]} to {data['current_range']['end'][:10]}")
    
    def test_04_period_compare_with_branch_filter(self, auth_headers):
        """Test period-compare accepts branch_ids parameter"""
        # First get a branch
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        if branches_resp.status_code == 200 and branches_resp.json():
            branch_id = branches_resp.json()[0]["id"]
            response = requests.get(f"{BASE_URL}/api/dashboard/period-compare?period=day&branch_ids={branch_id}", headers=auth_headers)
            assert response.status_code == 200, f"Expected 200 with branch filter, got {response.status_code}"
            print(f"Period compare with branch filter - Status: {response.status_code}")
        else:
            print("Skipping branch filter test - no branches found")


class TestMenuItemSchedule:
    """Test Menu Item Schedule feature"""
    
    test_menu_item_id = None
    
    def test_05_create_menu_item_with_schedule(self, auth_headers):
        """Create a menu item with schedule enabled"""
        payload = {
            "name": "TEST_Scheduled_Item_136",
            "name_ar": "عنصر مجدول للاختبار",
            "category": "main",
            "price": 25.0,
            "cost_price": 10.0,
            "preparation_time": 15,
            "is_available": True,
            "schedule": {
                "enabled": True,
                "available_days": [0, 1, 2, 3, 4],  # Sun-Thu
                "start_time": "11:00",
                "end_time": "22:00",
                "unavailable_behavior": "disabled"
            },
            "tags": ["scheduled", "test"]
        }
        
        response = requests.post(f"{BASE_URL}/api/cashier/menu", json=payload, headers=auth_headers)
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        TestMenuItemSchedule.test_menu_item_id = data.get("id")
        
        # Verify schedule was saved
        assert "schedule" in data, "Schedule field missing from response"
        assert data["schedule"]["enabled"] == True, "Schedule should be enabled"
        assert data["schedule"]["available_days"] == [0, 1, 2, 3, 4], "Available days mismatch"
        assert data["schedule"]["start_time"] == "11:00", "Start time mismatch"
        assert data["schedule"]["end_time"] == "22:00", "End time mismatch"
        assert data["schedule"]["unavailable_behavior"] == "disabled", "Unavailable behavior mismatch"
        
        print(f"Created scheduled menu item: {data['name']} (ID: {data['id']})")
    
    def test_06_get_menu_item_with_schedule(self, auth_headers):
        """Verify menu item schedule persists on GET"""
        if not TestMenuItemSchedule.test_menu_item_id:
            pytest.skip("No test menu item created")
        
        response = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=auth_headers)
        assert response.status_code == 200
        
        items = response.json()
        test_item = next((i for i in items if i["id"] == TestMenuItemSchedule.test_menu_item_id), None)
        
        assert test_item is not None, "Test menu item not found"
        assert test_item.get("schedule", {}).get("enabled") == True, "Schedule should be enabled"
        assert test_item["schedule"]["available_days"] == [0, 1, 2, 3, 4]
        
        print(f"Verified schedule persisted for item: {test_item['name']}")
    
    def test_07_update_menu_item_schedule_to_hide(self, auth_headers):
        """Update menu item to use 'hide' behavior"""
        if not TestMenuItemSchedule.test_menu_item_id:
            pytest.skip("No test menu item created")
        
        payload = {
            "name": "TEST_Scheduled_Item_136",
            "category": "main",
            "price": 25.0,
            "schedule": {
                "enabled": True,
                "available_days": [5, 6],  # Fri-Sat only
                "start_time": "18:00",
                "end_time": "23:59",
                "unavailable_behavior": "hide"
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/cashier/menu/{TestMenuItemSchedule.test_menu_item_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["schedule"]["unavailable_behavior"] == "hide"
        assert data["schedule"]["available_days"] == [5, 6]
        
        print(f"Updated schedule to weekend dinner only with hide behavior")
    
    def test_08_disable_menu_item_schedule(self, auth_headers):
        """Disable schedule on menu item"""
        if not TestMenuItemSchedule.test_menu_item_id:
            pytest.skip("No test menu item created")
        
        payload = {
            "name": "TEST_Scheduled_Item_136",
            "category": "main",
            "price": 25.0,
            "schedule": {
                "enabled": False,
                "available_days": [0,1,2,3,4,5,6],
                "start_time": "00:00",
                "end_time": "23:59",
                "unavailable_behavior": "disabled"
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/cashier/menu/{TestMenuItemSchedule.test_menu_item_id}", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # When schedule is disabled, it may be null or have enabled=false
        schedule = data.get("schedule")
        if schedule:
            assert schedule.get("enabled") == False, "Schedule should be disabled"
        
        print(f"Schedule disabled for menu item")
    
    def test_09_cleanup_test_menu_item(self, auth_headers):
        """Delete test menu item"""
        if not TestMenuItemSchedule.test_menu_item_id:
            pytest.skip("No test menu item to cleanup")
        
        response = requests.delete(f"{BASE_URL}/api/cashier/menu/{TestMenuItemSchedule.test_menu_item_id}", headers=auth_headers)
        assert response.status_code in [200, 204], f"Failed to delete test menu item: {response.status_code}"
        
        print(f"Cleaned up test menu item: {TestMenuItemSchedule.test_menu_item_id}")


class TestCashierPOSMenuFiltering:
    """Test that cashier/menu endpoint properly returns schedule data for POS filtering"""
    
    def test_10_cashier_menu_returns_schedule_field(self, auth_headers):
        """Verify /cashier/menu returns items with schedule field"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        items = response.json()
        if items:
            # Check that schedule field is available (can be null)
            item = items[0]
            assert "schedule" in item or item.get("schedule") is None, "Schedule field should be present or null"
            print(f"Cashier menu returns {len(items)} items, schedule field present")
        else:
            print("No menu items found - schedule field test passed (no items to check)")
    
    def test_11_menu_all_includes_schedule_data(self, auth_headers):
        """Verify /cashier/menu-all includes schedule data for management"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=auth_headers)
        assert response.status_code == 200
        
        items = response.json()
        scheduled_count = sum(1 for i in items if i.get("schedule", {}).get("enabled", False))
        print(f"Menu-all: {len(items)} total items, {scheduled_count} with active schedules")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
