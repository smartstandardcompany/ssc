"""
Iteration 32: Cashier POS System Tests
Testing:
1. Cashier login endpoint at /api/cashier/login
2. Menu categories endpoint at /api/cashier/categories
3. Menu items endpoint at /api/cashier/menu
4. POS orders endpoint at /api/cashier/orders
5. Seed menu data endpoint at /api/cashier/seed-menu
6. Customer endpoints for credit payment
7. VAT calculation (15%)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


class TestCashierLogin:
    """Test cashier login functionality"""
    
    def test_cashier_login_success(self):
        """Test successful cashier login with admin credentials"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"Cashier login successful - User: {data['user']['name']}, Role: {data['user'].get('role')}")
        return data["access_token"]
    
    def test_cashier_login_invalid_credentials(self):
        """Test cashier login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": "invalid@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        print("Invalid credentials correctly rejected")
    
    def test_cashier_login_missing_fields(self):
        """Test cashier login with missing fields"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL
        })
        assert response.status_code == 400, f"Expected 400 for missing password, got {response.status_code}"
        print("Missing fields correctly rejected")


class TestMenuCategories:
    """Test menu categories endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_categories(self):
        """Test getting menu categories"""
        response = requests.get(f"{BASE_URL}/api/cashier/categories", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Categories should be a list"
        assert len(data) > 0, "Should have at least one category"
        
        # Check for expected categories
        category_ids = [c.get("id") for c in data]
        expected_cats = ["all", "popular", "main", "appetizer", "beverage", "dessert", "sides"]
        for cat in expected_cats:
            assert cat in category_ids, f"Missing expected category: {cat}"
        
        print(f"Found {len(data)} categories: {category_ids}")


class TestMenuItems:
    """Test menu items endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_menu_items(self):
        """Test getting menu items"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Menu items should be a list"
        print(f"Found {len(data)} menu items")
        
        # If items exist, validate structure
        if len(data) > 0:
            item = data[0]
            assert "id" in item, "Item should have id"
            assert "name" in item, "Item should have name"
            assert "price" in item, "Item should have price"
            assert "category" in item, "Item should have category"
            print(f"Sample item: {item['name']} - SAR {item['price']}")
        
        return data
    
    def test_get_menu_items_by_category(self):
        """Test filtering menu items by category"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu?category=main", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        if len(data) > 0:
            for item in data:
                assert item.get("category") == "main", f"Item {item['name']} has wrong category: {item.get('category')}"
        print(f"Found {len(data)} main dish items")
    
    def test_menu_items_have_modifiers(self):
        """Test that menu items with modifiers have correct structure"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        items_with_modifiers = [i for i in data if i.get("modifiers") and len(i.get("modifiers", [])) > 0]
        
        print(f"Found {len(items_with_modifiers)} items with modifiers")
        
        if len(items_with_modifiers) > 0:
            item = items_with_modifiers[0]
            mod = item["modifiers"][0]
            assert "name" in mod, "Modifier should have name"
            assert "options" in mod, "Modifier should have options"
            print(f"Sample modifier: {item['name']} has '{mod['name']}' modifier with {len(mod.get('options', []))} options")


class TestSeedMenuData:
    """Test seeding menu data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_seed_menu_data(self):
        """Test seeding menu data - should work or return already seeded message"""
        response = requests.post(f"{BASE_URL}/api/cashier/seed-menu", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"Seed menu response: {data['message']}")


class TestPOSOrders:
    """Test POS order creation and management"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and menu items before each test"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
        
        # Get menu items
        menu_response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=self.headers)
        if menu_response.status_code == 200:
            self.menu_items = menu_response.json()
        else:
            self.menu_items = []
    
    def test_create_order_cash_payment(self):
        """Test creating an order with cash payment"""
        if not self.menu_items:
            pytest.skip("No menu items available")
        
        item = self.menu_items[0]
        order_data = {
            "branch_id": "default",
            "customer_id": None,
            "items": [
                {
                    "item_id": item["id"],
                    "quantity": 2,
                    "modifiers": []
                }
            ],
            "discount": 0,
            "discount_type": "amount",
            "payment_method": "cash",
            "order_type": "dine_in",
            "table_number": "5",
            "notes": "TEST_POS_Order"
        }
        
        response = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "order_number" in data
        assert "total" in data
        assert "tax" in data
        assert data["payment_method"] == "cash"
        assert data["status"] == "completed"
        
        # Verify VAT calculation (15%)
        expected_subtotal = item["price"] * 2
        expected_tax = expected_subtotal * 0.15
        assert abs(data["subtotal"] - expected_subtotal) < 0.01, f"Subtotal mismatch: {data['subtotal']} vs {expected_subtotal}"
        assert abs(data["tax"] - expected_tax) < 0.01, f"Tax mismatch: {data['tax']} vs {expected_tax}"
        
        print(f"Order created: #{data['order_number']}, Total: SAR {data['total']}, Tax: SAR {data['tax']}")
        return data
    
    def test_create_order_with_modifiers(self):
        """Test creating an order with item modifiers"""
        if not self.menu_items:
            pytest.skip("No menu items available")
        
        # Find item with modifiers
        items_with_mods = [i for i in self.menu_items if i.get("modifiers") and len(i.get("modifiers", [])) > 0]
        if not items_with_mods:
            pytest.skip("No items with modifiers found")
        
        item = items_with_mods[0]
        modifier = item["modifiers"][0]
        modifier_option = modifier["options"][0] if modifier.get("options") else None
        
        modifiers = []
        if modifier_option:
            modifiers.append({
                "group": modifier["name"],
                "name": modifier_option["name"],
                "price": modifier_option.get("price", 0)
            })
        
        order_data = {
            "branch_id": "default",
            "items": [
                {
                    "item_id": item["id"],
                    "quantity": 1,
                    "modifiers": modifiers
                }
            ],
            "discount": 0,
            "discount_type": "amount",
            "payment_method": "card",
            "order_type": "takeaway",
            "notes": "TEST_POS_Order_with_modifiers"
        }
        
        response = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["payment_method"] == "card"
        print(f"Order with modifiers created: #{data['order_number']}, Payment: {data['payment_method']}")
    
    def test_create_order_with_discount(self):
        """Test creating an order with discount"""
        if not self.menu_items:
            pytest.skip("No menu items available")
        
        item = self.menu_items[0]
        order_data = {
            "branch_id": "default",
            "items": [
                {
                    "item_id": item["id"],
                    "quantity": 1,
                    "modifiers": []
                }
            ],
            "discount": 10,
            "discount_type": "percent",
            "payment_method": "online",
            "order_type": "delivery",
            "notes": "TEST_POS_Order_with_discount"
        }
        
        response = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["discount"] > 0, "Discount should be applied"
        
        # Verify discount calculation
        expected_subtotal = item["price"]
        expected_discount = expected_subtotal * 0.10  # 10%
        expected_taxable = expected_subtotal - expected_discount
        expected_tax = expected_taxable * 0.15
        expected_total = expected_taxable + expected_tax
        
        assert abs(data["discount"] - expected_discount) < 0.01
        assert abs(data["total"] - expected_total) < 0.01
        
        print(f"Order with discount: Subtotal={data['subtotal']}, Discount={data['discount']}, Tax={data['tax']}, Total={data['total']}")
    
    def test_get_orders(self):
        """Test getting orders list"""
        response = requests.get(f"{BASE_URL}/api/cashier/orders", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} orders")


class TestCustomerForCredit:
    """Test customer endpoints for credit payment"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_customers(self):
        """Test getting customers list"""
        response = requests.get(f"{BASE_URL}/api/cashier/customers", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} customers for credit selection")
    
    def test_quick_create_customer(self):
        """Test quick customer creation from POS"""
        customer_data = {
            "name": "TEST_POS_Customer",
            "phone": "0501234567",
            "branch_id": "default"
        }
        
        response = requests.post(f"{BASE_URL}/api/cashier/customers/quick", json=customer_data, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["name"] == "TEST_POS_Customer"
        print(f"Quick customer created: {data['name']} - ID: {data['id']}")
        return data["id"]


class TestPOSStats:
    """Test POS statistics endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_get_pos_stats(self):
        """Test getting POS statistics"""
        response = requests.get(f"{BASE_URL}/api/cashier/stats", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "today" in data
        assert "total_sales" in data["today"]
        assert "total_orders" in data["today"]
        assert "payment_breakdown" in data["today"]
        
        print(f"Today's stats: Sales={data['today']['total_sales']}, Orders={data['today']['total_orders']}")


class TestSendToKitchen:
    """Test send to kitchen functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and create a test order"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
    
    def test_send_order_to_kitchen(self):
        """Test sending an order to kitchen"""
        # First get menu items
        menu_response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=self.headers)
        if menu_response.status_code != 200 or not menu_response.json():
            pytest.skip("No menu items available")
        
        item = menu_response.json()[0]
        
        # Create order
        order_data = {
            "branch_id": "default",
            "items": [{"item_id": item["id"], "quantity": 1, "modifiers": []}],
            "discount": 0,
            "discount_type": "amount",
            "payment_method": "cash",
            "order_type": "dine_in",
            "notes": "TEST_Kitchen_Order"
        }
        
        order_response = requests.post(f"{BASE_URL}/api/cashier/orders", json=order_data, headers=self.headers)
        assert order_response.status_code == 200
        order_id = order_response.json()["id"]
        
        # Send to kitchen
        kitchen_response = requests.post(f"{BASE_URL}/api/cashier/orders/{order_id}/send-kitchen", headers=self.headers)
        assert kitchen_response.status_code == 200, f"Expected 200, got {kitchen_response.status_code}: {kitchen_response.text}"
        
        data = kitchen_response.json()
        assert "message" in data
        print(f"Order sent to kitchen: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
