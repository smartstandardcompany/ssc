"""
Iteration 128: Menu Items with Size Variants, Add-ons, and Branch-Specific Pricing
Tests: POST/GET/PUT menu items with modifiers and branch_prices

Features tested:
1. POST /api/cashier/menu with modifiers (Size + Add-ons) and branch_prices
2. GET /api/cashier/menu - items with modifiers return Size and Add-on groups
3. PUT /api/cashier/menu/{id} - update modifiers and branch_prices
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
CASHIER_PIN = "1234"


class TestMenuModifiers:
    """Test menu items with size variants, add-ons, and branch-specific pricing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def cashier_token(self):
        """Get cashier authentication token via PIN"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={
            "pin": CASHIER_PIN
        })
        assert response.status_code == 200, f"Cashier login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def branches(self, auth_token):
        """Get available branches for testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        assert response.status_code == 200, f"Get branches failed: {response.text}"
        return response.json()
    
    @pytest.fixture(scope="class")
    def test_item_id(self):
        """Store test item ID for cleanup"""
        return {"id": None}
    
    # Test 1: Create menu item with Size and Add-ons modifiers
    def test_01_create_menu_item_with_modifiers(self, auth_token, branches, test_item_id):
        """POST /api/cashier/menu - Create item with Size and Add-on modifiers"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Build modifiers array with Size and Add-ons groups
        modifiers = [
            {
                "name": "Size",
                "required": True,
                "multiple": False,
                "options": [
                    {"name": "Small", "price": 0},
                    {"name": "Medium", "price": 3},
                    {"name": "Large", "price": 5}
                ]
            },
            {
                "name": "Add-ons",
                "required": False,
                "multiple": True,
                "options": [
                    {"name": "Extra Cheese", "price": 2},
                    {"name": "Bacon", "price": 4},
                    {"name": "Mushrooms", "price": 2.5}
                ]
            }
        ]
        
        # Build branch_prices if branches exist
        branch_prices = {}
        if branches and len(branches) > 0:
            # Set different price for first branch
            branch_prices[branches[0]["id"]] = 22.50
            if len(branches) > 1:
                branch_prices[branches[1]["id"]] = 24.00
        
        payload = {
            "name": f"TEST_Burger_Modifiers_{uuid.uuid4().hex[:8]}",
            "name_ar": "برجر اختبار",
            "description": "Test burger with size and add-on modifiers",
            "category": "main",
            "price": 20.00,
            "cost_price": 8.00,
            "modifiers": modifiers,
            "branch_prices": branch_prices,
            "is_available": True,
            "preparation_time": 15,
            "tags": ["popular"]
        }
        
        response = requests.post(f"{BASE_URL}/api/cashier/menu", json=payload, headers=headers)
        assert response.status_code == 200, f"Create menu item failed: {response.text}"
        
        data = response.json()
        test_item_id["id"] = data["id"]
        
        # Verify item created with modifiers
        assert data["name"] == payload["name"]
        assert "modifiers" in data
        assert len(data["modifiers"]) == 2
        
        # Verify Size modifier
        size_mod = next((m for m in data["modifiers"] if m["name"] == "Size"), None)
        assert size_mod is not None, "Size modifier not found"
        assert size_mod["required"] == True
        assert size_mod["multiple"] == False
        assert len(size_mod["options"]) == 3
        
        # Verify Add-ons modifier
        addons_mod = next((m for m in data["modifiers"] if m["name"] == "Add-ons"), None)
        assert addons_mod is not None, "Add-ons modifier not found"
        assert addons_mod["required"] == False
        assert addons_mod["multiple"] == True
        assert len(addons_mod["options"]) == 3
        
        # Verify branch_prices
        if branches and len(branches) > 0:
            assert "branch_prices" in data
            assert data["branch_prices"].get(branches[0]["id"]) == 22.50
        
        print(f"PASS: Created menu item with modifiers: {data['id']}")
    
    # Test 2: GET menu items returns modifiers correctly
    def test_02_get_menu_items_with_modifiers(self, auth_token, test_item_id):
        """GET /api/cashier/menu - Verify modifiers returned correctly"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=headers)
        assert response.status_code == 200, f"Get menu items failed: {response.text}"
        
        items = response.json()
        assert isinstance(items, list)
        
        # Find the test item
        test_item = next((i for i in items if i["id"] == test_item_id["id"]), None)
        assert test_item is not None, "Test item not found in menu list"
        
        # Verify modifiers structure
        assert "modifiers" in test_item
        assert len(test_item["modifiers"]) == 2
        
        # Verify Size group with options
        size_mod = next((m for m in test_item["modifiers"] if m["name"] == "Size"), None)
        assert size_mod is not None
        assert len(size_mod["options"]) == 3
        
        # Verify Add-ons group with options
        addons_mod = next((m for m in test_item["modifiers"] if m["name"] == "Add-ons"), None)
        assert addons_mod is not None
        assert len(addons_mod["options"]) == 3
        
        print(f"PASS: GET menu items returns modifiers correctly")
    
    # Test 3: GET single menu item with full modifier details
    def test_03_get_single_menu_item_modifiers(self, auth_token, test_item_id):
        """GET /api/cashier/menu/{id} - Verify single item has full modifiers"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/cashier/menu/{test_item_id['id']}", headers=headers)
        assert response.status_code == 200, f"Get single menu item failed: {response.text}"
        
        data = response.json()
        
        # Verify full modifier structure with prices
        size_mod = next((m for m in data["modifiers"] if m["name"] == "Size"), None)
        assert size_mod is not None
        
        # Check each size option has correct price
        small = next((o for o in size_mod["options"] if o["name"] == "Small"), None)
        medium = next((o for o in size_mod["options"] if o["name"] == "Medium"), None)
        large = next((o for o in size_mod["options"] if o["name"] == "Large"), None)
        
        assert small is not None and small["price"] == 0
        assert medium is not None and medium["price"] == 3
        assert large is not None and large["price"] == 5
        
        print(f"PASS: Single item GET returns full modifier details")
    
    # Test 4: Update menu item modifiers
    def test_04_update_menu_item_modifiers(self, auth_token, test_item_id, branches):
        """PUT /api/cashier/menu/{id} - Update modifiers and branch_prices"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get current item
        response = requests.get(f"{BASE_URL}/api/cashier/menu/{test_item_id['id']}", headers=headers)
        assert response.status_code == 200
        current_item = response.json()
        
        # Update with new modifiers (add extra size option)
        new_modifiers = [
            {
                "name": "Size",
                "required": True,
                "multiple": False,
                "options": [
                    {"name": "Small", "price": 0},
                    {"name": "Medium", "price": 3},
                    {"name": "Large", "price": 5},
                    {"name": "Extra Large", "price": 8}  # New option added
                ]
            },
            {
                "name": "Add-ons",
                "required": False,
                "multiple": True,
                "options": [
                    {"name": "Extra Cheese", "price": 3},  # Updated price
                    {"name": "Bacon", "price": 4},
                    {"name": "Mushrooms", "price": 2.5},
                    {"name": "Avocado", "price": 5}  # New option added
                ]
            }
        ]
        
        # Update branch_prices
        new_branch_prices = {}
        if branches and len(branches) > 0:
            new_branch_prices[branches[0]["id"]] = 25.00  # Updated price
            if len(branches) > 1:
                new_branch_prices[branches[1]["id"]] = 27.00  # Updated price
        
        update_payload = {
            "name": current_item["name"],
            "name_ar": current_item.get("name_ar"),
            "description": "Updated description with more options",
            "category": current_item["category"],
            "price": 21.00,  # Base price updated
            "cost_price": current_item.get("cost_price", 0),
            "modifiers": new_modifiers,
            "branch_prices": new_branch_prices,
            "is_available": True,
            "preparation_time": 15,
            "tags": current_item.get("tags", [])
        }
        
        response = requests.put(f"{BASE_URL}/api/cashier/menu/{test_item_id['id']}", 
                               json=update_payload, headers=headers)
        assert response.status_code == 200, f"Update menu item failed: {response.text}"
        
        data = response.json()
        
        # Verify update
        assert data["price"] == 21.00
        assert "modifiers" in data
        
        # Verify Size has 4 options now
        size_mod = next((m for m in data["modifiers"] if m["name"] == "Size"), None)
        assert size_mod is not None
        assert len(size_mod["options"]) == 4, f"Expected 4 size options, got {len(size_mod['options'])}"
        
        # Verify Extra Large option exists
        xl_option = next((o for o in size_mod["options"] if o["name"] == "Extra Large"), None)
        assert xl_option is not None, "Extra Large size option not found after update"
        assert xl_option["price"] == 8
        
        # Verify Add-ons has 4 options now
        addons_mod = next((m for m in data["modifiers"] if m["name"] == "Add-ons"), None)
        assert addons_mod is not None
        assert len(addons_mod["options"]) == 4, f"Expected 4 addon options, got {len(addons_mod['options'])}"
        
        # Verify branch_prices updated
        if branches and len(branches) > 0:
            assert data.get("branch_prices", {}).get(branches[0]["id"]) == 25.00
        
        print(f"PASS: Update menu item modifiers successful")
    
    # Test 5: Verify updated modifiers persist on GET
    def test_05_verify_modifiers_persist_after_update(self, auth_token, test_item_id):
        """Verify modifiers persist correctly after update"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/cashier/menu/{test_item_id['id']}", headers=headers)
        assert response.status_code == 200, f"Get updated item failed: {response.text}"
        
        data = response.json()
        
        # Verify Size modifier with 4 options
        size_mod = next((m for m in data["modifiers"] if m["name"] == "Size"), None)
        assert size_mod is not None
        assert len(size_mod["options"]) == 4
        
        # Verify Add-ons modifier with 4 options
        addons_mod = next((m for m in data["modifiers"] if m["name"] == "Add-ons"), None)
        assert addons_mod is not None
        assert len(addons_mod["options"]) == 4
        
        # Verify Avocado add-on exists with correct price
        avocado = next((o for o in addons_mod["options"] if o["name"] == "Avocado"), None)
        assert avocado is not None
        assert avocado["price"] == 5
        
        print(f"PASS: Modifiers persist correctly after update")
    
    # Test 6: Create menu item without modifiers (baseline)
    def test_06_create_menu_item_without_modifiers(self, auth_token):
        """Create menu item without modifiers as baseline"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        payload = {
            "name": f"TEST_Simple_Item_{uuid.uuid4().hex[:8]}",
            "description": "Simple item without modifiers",
            "category": "beverage",
            "price": 5.00,
            "is_available": True
        }
        
        response = requests.post(f"{BASE_URL}/api/cashier/menu", json=payload, headers=headers)
        assert response.status_code == 200, f"Create simple item failed: {response.text}"
        
        data = response.json()
        
        # Verify modifiers is empty or not present
        modifiers = data.get("modifiers", [])
        assert len(modifiers) == 0 or modifiers == [], "Simple item should have no modifiers"
        
        print(f"PASS: Created simple item without modifiers")
        return data["id"]
    
    # Test 7: Cashier login and view menu items with modifiers
    def test_07_cashier_view_menu_with_modifiers(self, cashier_token, test_item_id):
        """Cashier can view menu items with modifiers"""
        headers = {"Authorization": f"Bearer {cashier_token}"}
        
        response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=headers)
        assert response.status_code == 200, f"Cashier get menu failed: {response.text}"
        
        items = response.json()
        assert isinstance(items, list)
        
        # Find test item
        test_item = next((i for i in items if i["id"] == test_item_id["id"]), None)
        if test_item:  # May not be visible if not available
            assert "modifiers" in test_item
            print(f"PASS: Cashier can view menu items with modifiers")
        else:
            # Item might be filtered out, check in menu-all
            response = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=headers)
            items_all = response.json()
            test_item = next((i for i in items_all if i["id"] == test_item_id["id"]), None)
            assert test_item is not None, "Test item not found in any menu list"
            print(f"PASS: Cashier can access test item via menu-all")
    
    # Test 8: Cleanup - Delete test item
    def test_08_cleanup_test_items(self, auth_token, test_item_id):
        """Cleanup: Delete test items"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        if test_item_id["id"]:
            response = requests.delete(f"{BASE_URL}/api/cashier/menu/{test_item_id['id']}", headers=headers)
            assert response.status_code == 200, f"Delete test item failed: {response.text}"
            print(f"PASS: Test item cleaned up")
        
        # Clean up any other TEST_ items
        response = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=headers)
        if response.status_code == 200:
            items = response.json()
            for item in items:
                if item.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/cashier/menu/{item['id']}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
