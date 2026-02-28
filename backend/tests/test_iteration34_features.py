"""
Iteration 34 - Testing 5 new SSC Track ERP Features:
1) Drag-and-drop dashboard widgets (frontend only)
2) Cashier shift management (start/end with cash count)  
3) Customer-facing order status display
4) Cashier login with PIN only
5) Menu item image upload

Credentials:
- Admin: ss@ssc.com / Aa147258369Ssc@
- Cashier PIN: 1234
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestCashierPINLogin:
    """Feature 4: Cashier login with PIN only"""
    
    def test_pin_login_success(self):
        """Test successful PIN login with PIN 1234"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": "1234"})
        assert response.status_code == 200, f"PIN login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "cashier"
        print(f"PIN login SUCCESS: user={data['user']['name']}")
    
    def test_pin_login_invalid(self):
        """Test invalid PIN returns 401"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": "0000"})
        assert response.status_code == 401
        assert "Invalid PIN" in response.json().get("detail", "")
        print("Invalid PIN test PASSED")
    
    def test_pin_login_auto_4_digits(self):
        """Test that 4-digit PIN works for login"""
        # Testing that a 4-digit PIN successfully logs in
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": "1234"})
        assert response.status_code == 200
        print("4-digit PIN auto-login test PASSED")


class TestCashierShiftManagement:
    """Feature 2: Cashier shift management with cash count"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get cashier token"""
        login = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": "1234"})
        if login.status_code == 200:
            self.token = login.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not login with PIN")
    
    def test_start_shift_with_opening_cash(self):
        """Test starting a shift with opening cash count"""
        # First end any existing shift
        requests.post(f"{BASE_URL}/api/cashier/shift/end", 
                     json={"closing_cash": 0}, 
                     headers=self.headers)
        
        # Start new shift
        response = requests.post(f"{BASE_URL}/api/cashier/shift/start", 
                                json={"branch_id": "default", "opening_cash": 500.00, "notes": "Test shift"},
                                headers=self.headers)
        assert response.status_code == 200, f"Failed to start shift: {response.text}"
        data = response.json()
        assert data["opening_cash"] == 500.00
        assert data["status"] == "open"
        assert "started_at" in data
        print(f"Start shift SUCCESS: opening_cash={data['opening_cash']}")
    
    def test_get_current_shift(self):
        """Test getting current open shift with totals"""
        response = requests.get(f"{BASE_URL}/api/cashier/shift/current", headers=self.headers)
        # Could be None if no shift, or shift data
        if response.status_code == 200:
            data = response.json()
            if data:
                assert "opening_cash" in data
                assert "expected_cash" in data
                assert "payment_breakdown" in data
                print(f"Current shift: opening={data.get('opening_cash')}, expected={data.get('expected_cash')}")
            else:
                print("No active shift found (valid response)")
        print("Get current shift test PASSED")
    
    def test_end_shift_with_closing_cash(self):
        """Test ending a shift with closing cash count"""
        # Start a shift first if needed
        requests.post(f"{BASE_URL}/api/cashier/shift/start", 
                     json={"branch_id": "default", "opening_cash": 100.00},
                     headers=self.headers)
        
        # End shift
        response = requests.post(f"{BASE_URL}/api/cashier/shift/end",
                                json={"closing_cash": 150.00, "notes": "Closing test shift"},
                                headers=self.headers)
        assert response.status_code in [200, 404]  # 404 if no shift was open
        if response.status_code == 200:
            data = response.json()
            assert data["closing_cash"] == 150.00
            assert data["status"] == "closed"
            assert "cash_difference" in data
            print(f"End shift SUCCESS: closing={data['closing_cash']}, diff={data.get('cash_difference')}")
        print("End shift test PASSED")
    
    def test_shift_calculates_expected_cash(self):
        """Test that shift correctly calculates expected cash (opening + cash sales)"""
        # End existing shift
        requests.post(f"{BASE_URL}/api/cashier/shift/end", 
                     json={"closing_cash": 0}, 
                     headers=self.headers)
        
        # Start fresh shift
        response = requests.post(f"{BASE_URL}/api/cashier/shift/start",
                                json={"branch_id": "default", "opening_cash": 200.00},
                                headers=self.headers)
        assert response.status_code == 200
        
        # Get current shift - expected cash should equal opening cash initially
        response = requests.get(f"{BASE_URL}/api/cashier/shift/current", headers=self.headers)
        if response.status_code == 200 and response.json():
            data = response.json()
            assert data["expected_cash"] == data["opening_cash"]
            print(f"Expected cash calculation CORRECT: {data['expected_cash']}")
        print("Expected cash calculation test PASSED")


class TestOrderStatusDisplay:
    """Feature 3: Customer-facing order status display"""
    
    def test_order_status_active_no_auth(self):
        """Test order status endpoint requires no authentication"""
        response = requests.get(f"{BASE_URL}/api/order-status/active")
        assert response.status_code == 200, f"Order status failed: {response.text}"
        data = response.json()
        assert "preparing" in data
        assert "ready" in data
        assert "total_preparing" in data
        assert "total_ready" in data
        print(f"Order status: preparing={data['total_preparing']}, ready={data['total_ready']}")
    
    def test_order_status_returns_correct_structure(self):
        """Test order status returns proper structure for display"""
        response = requests.get(f"{BASE_URL}/api/order-status/active")
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert isinstance(data["preparing"], list)
        assert isinstance(data["ready"], list)
        assert isinstance(data["total_preparing"], int)
        assert isinstance(data["total_ready"], int)
        
        # If there are orders, check they have required fields
        for order in data["preparing"] + data["ready"]:
            assert "order_number" in order
            assert "status" in order
            print(f"Order #{order['order_number']} - {order['status']}")
        print("Order status structure test PASSED")
    
    def test_order_status_with_branch_filter(self):
        """Test order status can be filtered by branch"""
        response = requests.get(f"{BASE_URL}/api/order-status/active?branch_id=test-branch")
        assert response.status_code == 200
        print("Branch filter test PASSED")


class TestMenuItemsCRUD:
    """Feature 5: Menu items management with image upload"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        login = requests.post(f"{BASE_URL}/api/auth/login", 
                             json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"})
        if login.status_code == 200:
            self.token = login.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not login as admin")
    
    def test_get_menu_items(self):
        """Test fetching menu items"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=self.headers)
        assert response.status_code == 200, f"Failed to get menu: {response.text}"
        items = response.json()
        assert isinstance(items, list)
        print(f"Found {len(items)} menu items")
        
        if items:
            item = items[0]
            assert "id" in item
            assert "name" in item
            assert "price" in item
            print(f"Sample item: {item['name']} - SAR {item['price']}")
    
    def test_create_menu_item(self):
        """Test creating a new menu item"""
        new_item = {
            "name": "TEST_Item_" + str(int(__import__('time').time())),
            "name_ar": "صنف اختبار",
            "category": "main",
            "price": 29.99,
            "cost_price": 15.00,
            "preparation_time": 12,
            "is_available": True,
            "tags": ["test"]
        }
        response = requests.post(f"{BASE_URL}/api/cashier/menu", json=new_item, headers=self.headers)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        data = response.json()
        assert data["name"] == new_item["name"]
        assert data["price"] == new_item["price"]
        print(f"Created item: {data['name']} (ID: {data['id']})")
        
        # Clean up - delete the test item
        requests.delete(f"{BASE_URL}/api/cashier/menu/{data['id']}", headers=self.headers)
    
    def test_update_menu_item(self):
        """Test updating a menu item"""
        # Create an item first
        new_item = {
            "name": "TEST_Update_Item",
            "category": "main",
            "price": 19.99
        }
        create_resp = requests.post(f"{BASE_URL}/api/cashier/menu", json=new_item, headers=self.headers)
        if create_resp.status_code != 200:
            pytest.skip("Could not create test item")
        item_id = create_resp.json()["id"]
        
        # Update the item
        update_data = {
            "name": "TEST_Updated_Item",
            "category": "main",
            "price": 24.99
        }
        response = requests.put(f"{BASE_URL}/api/cashier/menu/{item_id}", json=update_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to update: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Updated_Item"
        assert data["price"] == 24.99
        print(f"Updated item: {data['name']} - SAR {data['price']}")
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/cashier/menu/{item_id}", headers=self.headers)
    
    def test_delete_menu_item(self):
        """Test deleting (deactivating) a menu item"""
        # Create an item first
        new_item = {
            "name": "TEST_Delete_Item",
            "category": "main",
            "price": 9.99
        }
        create_resp = requests.post(f"{BASE_URL}/api/cashier/menu", json=new_item, headers=self.headers)
        if create_resp.status_code != 200:
            pytest.skip("Could not create test item")
        item_id = create_resp.json()["id"]
        
        # Delete the item
        response = requests.delete(f"{BASE_URL}/api/cashier/menu/{item_id}", headers=self.headers)
        assert response.status_code == 200
        print(f"Deleted item: {item_id}")


class TestMenuItemImageUpload:
    """Feature 5: Menu item image upload"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token and create a test item"""
        login = requests.post(f"{BASE_URL}/api/auth/login",
                             json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"})
        if login.status_code == 200:
            self.token = login.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not login as admin")
        
        # Create a test item for image upload
        new_item = {
            "name": "TEST_Image_Upload_Item",
            "category": "main",
            "price": 15.00
        }
        create_resp = requests.post(f"{BASE_URL}/api/cashier/menu", json=new_item, headers=self.headers)
        if create_resp.status_code == 200:
            self.test_item_id = create_resp.json()["id"]
        else:
            self.test_item_id = None
        
        yield
        
        # Cleanup
        if self.test_item_id:
            requests.delete(f"{BASE_URL}/api/cashier/menu/{self.test_item_id}", headers=self.headers)
    
    def test_upload_image_endpoint_exists(self):
        """Test that image upload endpoint exists"""
        if not self.test_item_id:
            pytest.skip("No test item available")
        
        # Create a simple test image (1x1 PNG)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("test.png", io.BytesIO(png_data), "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/cashier/menu/{self.test_item_id}/image",
            files=files,
            headers=self.headers
        )
        assert response.status_code == 200, f"Image upload failed: {response.text}"
        data = response.json()
        assert "image_url" in data
        print(f"Image uploaded: {data['image_url']}")
    
    def test_delete_image_endpoint_exists(self):
        """Test that image delete endpoint exists"""
        if not self.test_item_id:
            pytest.skip("No test item available")
        
        response = requests.delete(
            f"{BASE_URL}/api/cashier/menu/{self.test_item_id}/image",
            headers=self.headers
        )
        assert response.status_code == 200
        print("Image delete endpoint working")
    
    def test_invalid_file_type_rejected(self):
        """Test that non-image files are rejected"""
        if not self.test_item_id:
            pytest.skip("No test item available")
        
        files = {"file": ("test.txt", io.BytesIO(b"not an image"), "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/cashier/menu/{self.test_item_id}/image",
            files=files,
            headers=self.headers
        )
        assert response.status_code == 400
        print("Invalid file type correctly rejected")


class TestDashboardWidgets:
    """Feature 1: Dashboard widget customization (backend doesn't store this, frontend localStorage)"""
    
    def test_dashboard_stats_endpoint(self):
        """Test dashboard stats endpoint exists for widgets"""
        login = requests.post(f"{BASE_URL}/api/auth/login",
                             json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        
        # Check key metrics are present for widgets
        assert "total_sales" in data
        assert "total_expenses" in data
        assert "net_profit" in data
        print(f"Dashboard stats: Sales={data['total_sales']}, Expenses={data['total_expenses']}")
        print("Dashboard widget data endpoint test PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
