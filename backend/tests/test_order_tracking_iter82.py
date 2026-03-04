"""
Order Tracking API Tests - Iteration 82
Tests the Order Tracking feature endpoints for customer notifications
- GET /api/order-tracking/recent - Get recent orders for tracking
- POST /api/order-tracking/update-status - Update order status with notification
- GET /api/order-tracking/config - Get tracking notification config
- POST /api/order-tracking/config - Update tracking notification config
- GET /api/order-tracking/order/{order_id} - Get order tracking details
- GET /api/order-tracking/notifications/{order_id} - Get order notification history
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "ss@ssc.com"
TEST_PASSWORD = "Aa147258369Ssc@"

@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for authenticated requests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Return headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestOrderTrackingConfig:
    """Test order tracking notification configuration endpoints"""
    
    def test_get_tracking_config(self):
        """GET /api/order-tracking/config - returns default config if none set"""
        response = requests.get(f"{BASE_URL}/api/order-tracking/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "enabled" in data, "Config should have 'enabled' field"
        assert "channels" in data, "Config should have 'channels' field"
        assert "notify_on_statuses" in data, "Config should have 'notify_on_statuses' field"
        assert isinstance(data["channels"], list), "Channels should be a list"
        assert isinstance(data["notify_on_statuses"], list), "notify_on_statuses should be a list"
        print(f"✓ Get tracking config returned: enabled={data['enabled']}, channels={data['channels']}")
    
    def test_update_tracking_config(self):
        """POST /api/order-tracking/config - updates notification settings"""
        payload = {
            "enabled": True,
            "channels": ["email"],
            "notify_on_statuses": ["confirmed", "delivered"]
        }
        response = requests.post(f"{BASE_URL}/api/order-tracking/config", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Config updated", "Should confirm config updated"
        assert data.get("enabled") == True, "Should return updated enabled status"
        assert data.get("channels") == ["email"], "Should return updated channels"
        assert data.get("notify_on_statuses") == ["confirmed", "delivered"], "Should return updated statuses"
        print(f"✓ Config updated successfully")
    
    def test_restore_default_config(self):
        """Restore default config for other tests"""
        payload = {
            "enabled": True,
            "channels": ["email", "whatsapp"],
            "notify_on_statuses": ["confirmed", "preparing", "ready", "delivered"]
        }
        response = requests.post(f"{BASE_URL}/api/order-tracking/config", json=payload)
        assert response.status_code == 200
        print(f"✓ Restored default config")


class TestOrderTrackingRecent:
    """Test recent orders endpoint for tracking"""
    
    def test_get_recent_orders(self):
        """GET /api/order-tracking/recent - returns recent orders with customer info"""
        response = requests.get(f"{BASE_URL}/api/order-tracking/recent")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list of orders"
        print(f"✓ Got {len(data)} recent orders for tracking")
        
        # If there are orders, verify structure
        if len(data) > 0:
            order = data[0]
            assert "id" in order, "Order should have 'id' field"
            assert "customer_name" in order, "Order should have 'customer_name' field"
            assert "order_status" in order, "Order should have 'order_status' field"
            print(f"✓ First order: id={order['id'][:6]}..., customer={order['customer_name']}, status={order['order_status']}")
    
    def test_get_recent_orders_with_limit(self):
        """GET /api/order-tracking/recent?limit=5 - respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/order-tracking/recent?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) <= 5, "Should respect the limit parameter"
        print(f"✓ Got {len(data)} orders with limit=5")


class TestOrderStatusUpdate:
    """Test order status update endpoint"""
    
    def test_update_order_status_not_found(self):
        """Test updating non-existent order returns 404"""
        payload = {
            "order_id": "000000000000000000000000",  # Non-existent ObjectId
            "status": "confirmed",
            "notify_customer": False
        }
        response = requests.post(f"{BASE_URL}/api/order-tracking/update-status", json=payload)
        assert response.status_code == 404, f"Expected 404 for non-existent order, got {response.status_code}"
        print(f"✓ Non-existent order correctly returns 404")
    
    def test_update_order_status_invalid_status(self):
        """Test updating with invalid status returns 400"""
        payload = {
            "order_id": "000000000000000000000000",
            "status": "invalid_status",
            "notify_customer": False
        }
        response = requests.post(f"{BASE_URL}/api/order-tracking/update-status", json=payload)
        assert response.status_code == 400, f"Expected 400 for invalid status, got {response.status_code}"
        print(f"✓ Invalid status correctly rejected with 400")


class TestOrderStatusUpdateWithAuth:
    """Test order status update with authentication for create operations"""
    
    def test_update_existing_order_status(self, auth_headers):
        """Update status of an existing order with customer"""
        # Get existing orders that have customers
        orders_response = requests.get(f"{BASE_URL}/api/order-tracking/recent?limit=5")
        assert orders_response.status_code == 200, f"Failed to get orders: {orders_response.text}"
        orders = orders_response.json()
        
        if len(orders) == 0:
            pytest.skip("No orders with customers available for testing")
        
        # Use first existing order
        sale_id = orders[0]["id"]
        original_status = orders[0].get("order_status", "placed")
        print(f"✓ Using existing order: {sale_id[:6]}..., current status: {original_status}")
        
        # Update order status to 'confirmed'
        payload = {
            "order_id": sale_id,
            "status": "confirmed",
            "notes": "Order confirmed for processing",
            "notify_customer": False  # Don't send real notification in test
        }
        response = requests.post(f"{BASE_URL}/api/order-tracking/update-status", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("message") == "Order status updated", "Should confirm status update"
        assert data.get("new_status") == "confirmed", "Should return new status"
        print(f"✓ Order status updated to 'confirmed'")
        
        # Verify via tracking endpoint
        tracking_response = requests.get(f"{BASE_URL}/api/order-tracking/order/{sale_id}")
        assert tracking_response.status_code == 200
        tracking_data = tracking_response.json()
        assert tracking_data.get("status") == "confirmed"
        assert len(tracking_data.get("status_history", [])) >= 1
        print(f"✓ Verified tracking shows confirmed status with {len(tracking_data.get('status_history', []))} history entries")
    
    def test_update_order_through_all_statuses(self, auth_headers):
        """Test updating through all valid statuses on existing order"""
        # Get existing orders
        orders_response = requests.get(f"{BASE_URL}/api/order-tracking/recent?limit=5")
        orders = orders_response.json()
        
        if len(orders) < 2:
            pytest.skip("Not enough orders with customers for full status cycle test")
        
        # Use second order for status cycle
        sale_id = orders[1]["id"] if len(orders) > 1 else orders[0]["id"]
        print(f"✓ Testing status cycle on order: {sale_id[:6]}...")
        
        # Test all statuses
        for status in ['preparing', 'ready', 'out_for_delivery', 'delivered', 'placed']:  # End back at placed
            update_payload = {
                "order_id": sale_id,
                "status": status,
                "notify_customer": False
            }
            update_response = requests.post(f"{BASE_URL}/api/order-tracking/update-status", json=update_payload)
            assert update_response.status_code == 200, f"Failed to update to {status}"
            assert update_response.json().get("new_status") == status
            print(f"  ✓ Updated to {status}")
        print(f"✓ Successfully cycled through all statuses")
    
    def test_get_order_notifications_empty(self, auth_headers):
        """GET /api/order-tracking/notifications/{order_id} - returns empty for non-notified orders"""
        # Use a valid ObjectId format but non-existent
        response = requests.get(f"{BASE_URL}/api/order-tracking/notifications/000000000000000000000000")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        assert len(data) == 0, "Should be empty for non-existent order"
        print(f"✓ Notifications endpoint returns empty list for non-existent order")


class TestOrderTrackingNotFound:
    """Test order tracking detail endpoints with not found"""
    
    def test_get_order_tracking_not_found(self):
        """GET /api/order-tracking/order/{order_id} - returns 404 for non-existent"""
        response = requests.get(f"{BASE_URL}/api/order-tracking/order/000000000000000000000000")
        assert response.status_code == 404
        print(f"✓ Non-existent order correctly returns 404")


class TestStockPageZustand:
    """Test that Stock page endpoints work with authentication"""
    
    def test_branches_endpoint_for_stock(self, auth_headers):
        """GET /api/branches - verify branches endpoint works for Stock page"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Should return list of branches"
        print(f"✓ Branches endpoint returns {len(data)} branches")
    
    def test_stock_balance_endpoint(self, auth_headers):
        """GET /api/stock/balance - verify stock balance endpoint works"""
        response = requests.get(f"{BASE_URL}/api/stock/balance", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Should return list of stock balances"
        print(f"✓ Stock balance returns {len(data)} items")
    
    def test_items_endpoint(self, auth_headers):
        """GET /api/items - verify items endpoint for Stock page"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Should return list of items"
        print(f"✓ Items endpoint returns {len(data)} items")
    
    def test_suppliers_endpoint(self, auth_headers):
        """GET /api/suppliers - verify suppliers endpoint for Stock page"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Should return list of suppliers"
        print(f"✓ Suppliers endpoint returns {len(data)} suppliers")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_customers(self, auth_headers):
        """Clean up TEST_ prefixed customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        if response.status_code == 200:
            customers = response.json()
            test_customers = [c for c in customers if c.get("name", "").startswith("TEST_")]
            for c in test_customers:
                requests.delete(f"{BASE_URL}/api/customers/{c['id']}", headers=auth_headers)
            print(f"✓ Cleaned up {len(test_customers)} test customers")
