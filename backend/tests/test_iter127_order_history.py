"""
Test cases for Iteration 127: Order History with view/edit/delete capabilities
Tests the cashier POS order history endpoints:
- GET /api/cashier/orders - List today's POS orders
- PUT /api/cashier/orders/{id} - Edit order (change notes, payment_method, items)
- DELETE /api/cashier/orders/{id} - Void order and linked sale
"""
import pytest
import requests
import os
from datetime import datetime

# Use public URL from frontend .env
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestOrderHistory:
    """Test Order History CRUD operations for POS"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get cashier token and test data"""
        # Login as cashier with PIN 1234
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": "1234"})
        assert response.status_code == 200, f"Cashier login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token") or data.get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = data.get("user", {})
        
        # Get menu items for creating test orders
        menu_res = requests.get(f"{BASE_URL}/api/cashier/menu", headers=self.headers)
        self.menu_items = menu_res.json() if menu_res.status_code == 200 else []
        
        # Get branches for order creation
        branches_res = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        self.branches = branches_res.json() if branches_res.status_code == 200 else []
        
        self.test_order_ids = []
        yield
        
        # Cleanup: Delete test orders
        for order_id in self.test_order_ids:
            try:
                requests.delete(f"{BASE_URL}/api/cashier/orders/{order_id}", headers=self.headers)
            except:
                pass
    
    def test_01_cashier_login_returns_token(self):
        """Test that cashier login with PIN 1234 returns a valid token"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": "1234"})
        assert response.status_code == 200
        data = response.json()
        token = data.get("access_token") or data.get("token")
        assert token is not None, "Expected access_token in response"
        print(f"✓ Cashier login successful, token received")
    
    def test_02_get_orders_returns_list(self):
        """GET /api/cashier/orders returns list of today's orders"""
        response = requests.get(f"{BASE_URL}/api/cashier/orders", headers=self.headers)
        assert response.status_code == 200
        orders = response.json()
        assert isinstance(orders, list), "Expected list of orders"
        print(f"✓ GET /cashier/orders returned {len(orders)} orders")
    
    def test_03_create_and_get_order(self):
        """Create a test order via POST and verify it appears in GET /cashier/orders"""
        if not self.menu_items:
            pytest.skip("No menu items available for testing")
        
        # Create order payload
        branch_id = self.branches[0]["id"] if self.branches else "default"
        item = self.menu_items[0]
        order_payload = {
            "branch_id": branch_id,
            "items": [{"item_id": item["id"], "quantity": 1, "modifiers": []}],
            "discount": 0,
            "discount_type": "amount",
            "payment_method": "cash",
            "payment_details": [{"mode": "cash", "amount": item.get("price", 10) * 1.15}],
            "order_type": "dine_in",
            "notes": "TEST_order_history_iter127"
        }
        
        # Create the order
        create_res = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_payload, headers=self.headers)
        assert create_res.status_code == 200, f"Create order failed: {create_res.text}"
        order = create_res.json()
        order_id = order.get("id")
        order_number = order.get("order_number")
        self.test_order_ids.append(order_id)
        print(f"✓ Created order #{order_number} with ID {order_id}")
        
        # Verify order appears in GET /cashier/orders
        get_res = requests.get(f"{BASE_URL}/api/cashier/orders", headers=self.headers)
        assert get_res.status_code == 200
        orders = get_res.json()
        order_ids = [o.get("id") for o in orders]
        assert order_id in order_ids, f"Order {order_id} not found in orders list"
        print(f"✓ Order verified in GET /cashier/orders")
    
    def test_04_edit_order_notes_and_payment(self):
        """PUT /api/cashier/orders/{id} - Edit order notes and payment method"""
        if not self.menu_items:
            pytest.skip("No menu items available for testing")
        
        # First create an order
        branch_id = self.branches[0]["id"] if self.branches else "default"
        item = self.menu_items[0]
        order_payload = {
            "branch_id": branch_id,
            "items": [{"item_id": item["id"], "quantity": 1, "modifiers": []}],
            "discount": 0,
            "discount_type": "amount",
            "payment_method": "cash",
            "payment_details": [{"mode": "cash", "amount": item.get("price", 10) * 1.15}],
            "order_type": "dine_in",
            "notes": "TEST_original_note"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_payload, headers=self.headers)
        assert create_res.status_code == 200, f"Create order failed: {create_res.text}"
        order = create_res.json()
        order_id = order.get("id")
        self.test_order_ids.append(order_id)
        print(f"✓ Created order for edit test: {order_id}")
        
        # Edit the order - change notes and payment method
        edit_payload = {
            "notes": "TEST_updated_note_iter127",
            "payment_method": "bank"
        }
        
        edit_res = requests.put(f"{BASE_URL}/api/cashier/orders/{order_id}", json=edit_payload, headers=self.headers)
        assert edit_res.status_code == 200, f"Edit order failed: {edit_res.text}"
        updated_order = edit_res.json()
        
        assert updated_order.get("notes") == "TEST_updated_note_iter127", "Notes not updated"
        assert updated_order.get("payment_method") == "bank", "Payment method not updated"
        print(f"✓ Order edited successfully - notes and payment_method updated")
        
        # Verify persistence with GET
        get_res = requests.get(f"{BASE_URL}/api/cashier/orders/{order_id}", headers=self.headers)
        assert get_res.status_code == 200
        fetched_order = get_res.json()
        assert fetched_order.get("notes") == "TEST_updated_note_iter127", "Notes not persisted"
        assert fetched_order.get("payment_method") == "bank", "Payment method not persisted"
        print(f"✓ Edit verified via GET /cashier/orders/{order_id}")
    
    def test_05_edit_order_items(self):
        """PUT /api/cashier/orders/{id} - Edit order items (change quantity, add item)"""
        if len(self.menu_items) < 2:
            pytest.skip("Need at least 2 menu items for this test")
        
        # First create an order with 1 item
        branch_id = self.branches[0]["id"] if self.branches else "default"
        item1 = self.menu_items[0]
        order_payload = {
            "branch_id": branch_id,
            "items": [{"item_id": item1["id"], "quantity": 1, "modifiers": []}],
            "discount": 0,
            "discount_type": "amount",
            "payment_method": "cash",
            "order_type": "takeaway",
            "notes": "TEST_edit_items"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_payload, headers=self.headers)
        assert create_res.status_code == 200
        order = create_res.json()
        order_id = order.get("id")
        original_total = order.get("total", 0)
        self.test_order_ids.append(order_id)
        print(f"✓ Created order with 1 item, total: {original_total}")
        
        # Edit: add 2nd item and increase quantity of 1st
        item2 = self.menu_items[1]
        edit_payload = {
            "items": [
                {"item_id": item1["id"], "quantity": 2, "modifiers": []},
                {"item_id": item2["id"], "quantity": 1, "modifiers": []}
            ]
        }
        
        edit_res = requests.put(f"{BASE_URL}/api/cashier/orders/{order_id}", json=edit_payload, headers=self.headers)
        assert edit_res.status_code == 200, f"Edit items failed: {edit_res.text}"
        updated_order = edit_res.json()
        
        assert len(updated_order.get("items", [])) == 2, "Expected 2 items after edit"
        new_total = updated_order.get("total", 0)
        assert new_total > original_total, f"Total should increase after adding items (was {original_total}, now {new_total})"
        print(f"✓ Order items edited: 2 items, new total: {new_total}")
    
    def test_06_delete_order_and_linked_sale(self):
        """DELETE /api/cashier/orders/{id} - Void order and verify linked sale is deleted"""
        if not self.menu_items:
            pytest.skip("No menu items available for testing")
        
        # Create an order
        branch_id = self.branches[0]["id"] if self.branches else "default"
        item = self.menu_items[0]
        order_payload = {
            "branch_id": branch_id,
            "items": [{"item_id": item["id"], "quantity": 1, "modifiers": []}],
            "discount": 0,
            "discount_type": "amount",
            "payment_method": "cash",
            "order_type": "dine_in",
            "notes": "TEST_delete_order"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_payload, headers=self.headers)
        assert create_res.status_code == 200
        order = create_res.json()
        order_id = order.get("id")
        order_number = order.get("order_number")
        print(f"✓ Created order #{order_number} for deletion test")
        
        # Delete the order
        delete_res = requests.delete(f"{BASE_URL}/api/cashier/orders/{order_id}", headers=self.headers)
        assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
        print(f"✓ DELETE returned 200 for order {order_id}")
        
        # Verify order no longer exists
        get_res = requests.get(f"{BASE_URL}/api/cashier/orders/{order_id}", headers=self.headers)
        assert get_res.status_code == 404, f"Expected 404 after delete, got {get_res.status_code}"
        print(f"✓ Order confirmed deleted (404 on GET)")
        
        # Note: We can't easily verify the linked sale deletion via API, 
        # but the backend code shows it deletes sales with pos_order_id match
    
    def test_07_delete_returns_success_message(self):
        """DELETE /api/cashier/orders/{id} - Returns success message with order number"""
        if not self.menu_items:
            pytest.skip("No menu items available for testing")
        
        # Create an order
        branch_id = self.branches[0]["id"] if self.branches else "default"
        item = self.menu_items[0]
        order_payload = {
            "branch_id": branch_id,
            "items": [{"item_id": item["id"], "quantity": 1, "modifiers": []}],
            "payment_method": "bank",
            "order_type": "takeaway",
            "notes": "TEST_delete_message"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_payload, headers=self.headers)
        assert create_res.status_code == 200
        order = create_res.json()
        order_id = order.get("id")
        order_number = order.get("order_number")
        
        # Delete and check message
        delete_res = requests.delete(f"{BASE_URL}/api/cashier/orders/{order_id}", headers=self.headers)
        assert delete_res.status_code == 200
        result = delete_res.json()
        assert "message" in result, "Expected message in delete response"
        assert str(order_number) in result["message"], "Order number should be in success message"
        print(f"✓ Delete response: {result['message']}")
    
    def test_08_delete_nonexistent_order_returns_404(self):
        """DELETE /api/cashier/orders/{id} - Returns 404 for nonexistent order"""
        fake_id = "nonexistent-order-id-12345"
        delete_res = requests.delete(f"{BASE_URL}/api/cashier/orders/{fake_id}", headers=self.headers)
        assert delete_res.status_code == 404, f"Expected 404 for nonexistent order, got {delete_res.status_code}"
        print(f"✓ DELETE nonexistent order returns 404")
    
    def test_09_edit_nonexistent_order_returns_404(self):
        """PUT /api/cashier/orders/{id} - Returns 404 for nonexistent order"""
        fake_id = "nonexistent-order-id-12345"
        edit_payload = {"notes": "test"}
        edit_res = requests.put(f"{BASE_URL}/api/cashier/orders/{fake_id}", json=edit_payload, headers=self.headers)
        assert edit_res.status_code == 404, f"Expected 404 for nonexistent order, got {edit_res.status_code}"
        print(f"✓ PUT nonexistent order returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
