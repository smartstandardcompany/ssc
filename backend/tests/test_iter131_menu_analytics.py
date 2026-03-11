"""
Iteration 131: Menu Analytics Testing
Tests for /api/menu-analytics/* endpoints:
- /api/menu-analytics/items - Item sales analytics
- /api/menu-analytics/addons - Add-on/modifier usage analytics  
- /api/menu-analytics/trends - Daily sales trends for specific item
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
AUTH_CREDENTIALS = {"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json=AUTH_CREDENTIALS)
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json().get("access_token")
    assert token, "No access_token in login response"
    return token


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for requests"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestMenuAnalyticsItems:
    """Tests for /api/menu-analytics/items endpoint"""

    def test_01_get_items_analytics_default_period(self, auth_headers):
        """Test getting item analytics with default period (month)"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/items", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "items" in data, "Missing 'items' field"
        assert "category_summary" in data, "Missing 'category_summary' field"
        assert "total_qty" in data, "Missing 'total_qty' field"
        assert "total_revenue" in data, "Missing 'total_revenue' field"
        assert "period" in data, "Missing 'period' field"
        
        # Default period should be 'month'
        assert data["period"] == "month", f"Expected period 'month', got '{data['period']}'"
        print(f"Items analytics (month): {len(data['items'])} items, revenue: SAR {data['total_revenue']}")

    def test_02_get_items_analytics_all_time(self, auth_headers):
        """Test getting item analytics with 'all' period"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/items?period=all", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["period"] == "all"
        
        # Based on agent context: 25 POS orders, Chicken Shawarma top seller with 10 qty, SAR 125
        # Should have data if there are orders
        if data["total_qty"] > 0:
            assert len(data["items"]) > 0, "Expected at least one item in results"
            
            # Check item structure
            first_item = data["items"][0]
            assert "item_id" in first_item
            assert "name" in first_item
            assert "total_qty" in first_item
            assert "total_revenue" in first_item
            assert "order_count" in first_item
            assert "category" in first_item
            
            print(f"All time analytics: {data['total_qty']} total qty, {len(data['items'])} items")
            print(f"Top item: {first_item['name']} - {first_item['total_qty']} sold, SAR {first_item['total_revenue']}")

    def test_03_get_items_analytics_with_all_periods(self, auth_headers):
        """Test all period options: today, week, month, year, all"""
        periods = ["today", "week", "month", "year", "all"]
        
        for period in periods:
            response = requests.get(f"{BASE_URL}/api/menu-analytics/items?period={period}", headers=auth_headers)
            assert response.status_code == 200, f"Period '{period}' failed: {response.text}"
            data = response.json()
            assert data["period"] == period, f"Expected period '{period}', got '{data['period']}'"
            print(f"Period '{period}': {data['total_qty']} items sold, SAR {data['total_revenue']}")

    def test_04_get_items_analytics_with_invalid_period(self, auth_headers):
        """Test that invalid period returns 422 validation error"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/items?period=invalid", headers=auth_headers)
        assert response.status_code == 422, f"Expected 422 for invalid period, got {response.status_code}"

    def test_05_verify_category_summary(self, auth_headers):
        """Verify category summary is computed correctly"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/items?period=all", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        if len(data["items"]) > 0 and len(data["category_summary"]) > 0:
            # Verify category_summary structure
            cat = data["category_summary"][0]
            assert "category" in cat
            assert "total_qty" in cat
            assert "total_revenue" in cat
            assert "item_count" in cat
            
            # Verify totals match
            computed_qty = sum(c["total_qty"] for c in data["category_summary"])
            assert computed_qty == data["total_qty"], f"Category qty mismatch: {computed_qty} vs {data['total_qty']}"
            
            print(f"Categories: {[c['category'] for c in data['category_summary']]}")


class TestMenuAnalyticsAddons:
    """Tests for /api/menu-analytics/addons endpoint"""

    def test_01_get_addon_analytics_default(self, auth_headers):
        """Test getting addon/modifier analytics with defaults"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/addons", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "sizes" in data, "Missing 'sizes' field"
        assert "addons" in data, "Missing 'addons' field"
        assert "options" in data, "Missing 'options' field"
        assert "all_modifiers" in data, "Missing 'all_modifiers' field"
        assert "total_modifier_usage" in data, "Missing 'total_modifier_usage'"
        assert "total_modifier_revenue" in data, "Missing 'total_modifier_revenue'"
        assert "total_orders" in data, "Missing 'total_orders'"
        assert "orders_with_modifiers" in data, "Missing 'orders_with_modifiers'"
        assert "modifier_adoption_rate" in data, "Missing 'modifier_adoption_rate'"
        assert "period" in data, "Missing 'period'"
        
        assert data["period"] == "month"
        print(f"Addon analytics (month): {data['total_modifier_usage']} uses, SAR {data['total_modifier_revenue']}")

    def test_02_get_addon_analytics_all_time(self, auth_headers):
        """Test addon analytics with all time period"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/addons?period=all", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Based on context: 5 of 25 orders have modifiers, 1 'Regular' size (60% adoption)
        print(f"All time addon analytics:")
        print(f"  Total orders: {data['total_orders']}")
        print(f"  Orders with modifiers: {data['orders_with_modifiers']}")
        print(f"  Adoption rate: {data['modifier_adoption_rate']}%")
        print(f"  Total modifier uses: {data['total_modifier_usage']}")
        print(f"  Modifier revenue: SAR {data['total_modifier_revenue']}")
        
        # Verify adoption rate calculation
        if data['total_orders'] > 0:
            expected_rate = round((data['orders_with_modifiers'] / data['total_orders']) * 100, 1)
            assert data['modifier_adoption_rate'] == expected_rate, f"Adoption rate mismatch"

    def test_03_verify_modifier_structure(self, auth_headers):
        """Verify modifier data structure for sizes/addons/options"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/addons?period=all", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        
        # Check if we have any sizes data
        if len(data["sizes"]) > 0:
            size = data["sizes"][0]
            assert "group" in size
            assert "name" in size
            assert "usage_count" in size
            assert "total_revenue" in size
            assert "used_with_items" in size
            print(f"Size example: {size['name']} - {size['usage_count']}x, SAR {size['total_revenue']}")

        # Check all_modifiers structure
        if len(data["all_modifiers"]) > 0:
            mod = data["all_modifiers"][0]
            assert "group" in mod
            assert "name" in mod
            assert "usage_count" in mod
            print(f"Modifier example: {mod['group']} - {mod['name']} ({mod['usage_count']}x)")

    def test_04_test_all_periods_addons(self, auth_headers):
        """Test all period options work for addons endpoint"""
        periods = ["today", "week", "month", "year", "all"]
        
        for period in periods:
            response = requests.get(f"{BASE_URL}/api/menu-analytics/addons?period={period}", headers=auth_headers)
            assert response.status_code == 200, f"Period '{period}' failed: {response.text}"
            data = response.json()
            assert data["period"] == period


class TestMenuAnalyticsTrends:
    """Tests for /api/menu-analytics/trends endpoint"""

    def test_01_trends_requires_item_id(self, auth_headers):
        """Test that trends endpoint requires item_id parameter"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/trends", headers=auth_headers)
        assert response.status_code == 422, f"Expected 422 without item_id, got {response.status_code}"

    def test_02_get_trends_for_top_item(self, auth_headers):
        """Get trends for the top-selling item (Chicken Shawarma)"""
        # First get items to find item_id
        items_response = requests.get(f"{BASE_URL}/api/menu-analytics/items?period=all", headers=auth_headers)
        assert items_response.status_code == 200
        
        items_data = items_response.json()
        
        if len(items_data["items"]) == 0:
            pytest.skip("No items found for trends testing")
        
        # Get top item (Chicken Shawarma should be first)
        top_item = items_data["items"][0]
        item_id = top_item["item_id"]
        item_name = top_item["name"]
        
        print(f"Testing trends for: {item_name} (ID: {item_id})")
        
        # Get trends for this item
        trends_response = requests.get(
            f"{BASE_URL}/api/menu-analytics/trends?item_id={item_id}&period=all", 
            headers=auth_headers
        )
        assert trends_response.status_code == 200, f"Trends failed: {trends_response.text}"
        
        trends_data = trends_response.json()
        
        # Verify structure
        assert "item_id" in trends_data
        assert "daily" in trends_data
        assert "period" in trends_data
        
        assert trends_data["item_id"] == item_id
        
        # Check daily data structure
        if len(trends_data["daily"]) > 0:
            day = trends_data["daily"][0]
            assert "date" in day
            assert "qty" in day
            assert "revenue" in day
            
            total_qty = sum(d["qty"] for d in trends_data["daily"])
            total_revenue = sum(d["revenue"] for d in trends_data["daily"])
            print(f"Trends for {item_name}: {len(trends_data['daily'])} days, {total_qty} total qty, SAR {total_revenue}")

    def test_03_trends_with_different_periods(self, auth_headers):
        """Test trends with different period filters"""
        # Get a valid item_id first
        items_response = requests.get(f"{BASE_URL}/api/menu-analytics/items?period=all", headers=auth_headers)
        items_data = items_response.json()
        
        if len(items_data["items"]) == 0:
            pytest.skip("No items for trends testing")
        
        item_id = items_data["items"][0]["item_id"]
        
        for period in ["today", "week", "month", "year", "all"]:
            response = requests.get(
                f"{BASE_URL}/api/menu-analytics/trends?item_id={item_id}&period={period}", 
                headers=auth_headers
            )
            assert response.status_code == 200, f"Trends period '{period}' failed"
            data = response.json()
            assert data["period"] == period


class TestMenuAnalyticsAuthorization:
    """Test authorization for menu analytics endpoints"""

    def test_01_items_requires_auth(self):
        """Test that items endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/items")
        assert response.status_code == 401 or response.status_code == 403

    def test_02_addons_requires_auth(self):
        """Test that addons endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/addons")
        assert response.status_code == 401 or response.status_code == 403

    def test_03_trends_requires_auth(self):
        """Test that trends endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/menu-analytics/trends?item_id=test")
        assert response.status_code == 401 or response.status_code == 403


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
