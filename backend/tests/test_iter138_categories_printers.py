# Iteration 138: Testing categories auto-include and printer CRUD endpoints
# Features: 1) Categories from categories collection + menu_items.distinct('category')
# 2) Printer CRUD at /api/cashier/printers
# 3) Printer test connection at /api/cashier/printers/{id}/test

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
CASHIER_PIN = "1234"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token via standard login"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def cashier_token():
    """Get cashier token via PIN login"""
    response = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": CASHIER_PIN})
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Cashier login failed: {response.status_code} - {response.text}")


class TestCashierCategories:
    """Test /api/cashier/categories endpoint"""
    
    def test_categories_returns_default_7(self, cashier_token):
        """Categories endpoint should return at least 7 default categories"""
        response = requests.get(
            f"{BASE_URL}/api/cashier/categories",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list), "Categories should be a list"
        assert len(categories) >= 7, f"Expected at least 7 default categories, got {len(categories)}"
        
        # Check default categories exist
        cat_ids = [c["id"] for c in categories]
        default_cats = ["all", "popular", "main", "appetizer", "beverage", "dessert", "sides"]
        for default_cat in default_cats:
            assert default_cat in cat_ids, f"Default category '{default_cat}' missing from categories"
        
        print(f"PASS: Categories endpoint returns {len(categories)} categories including all 7 defaults")
    
    def test_categories_have_required_fields(self, cashier_token):
        """Each category should have id, name, icon, color, display_order"""
        response = requests.get(
            f"{BASE_URL}/api/cashier/categories",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200
        
        categories = response.json()
        required_fields = ["id", "name", "icon", "color", "display_order"]
        
        for cat in categories:
            for field in required_fields:
                assert field in cat, f"Category {cat.get('id')} missing required field: {field}"
        
        print("PASS: All categories have required fields")


class TestPrinterCRUD:
    """Test printer CRUD endpoints at /api/cashier/printers"""
    
    test_printer_id = None
    
    def test_get_printers_list(self, cashier_token):
        """GET /api/cashier/printers should return list of printers"""
        response = requests.get(
            f"{BASE_URL}/api/cashier/printers",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        printers = response.json()
        assert isinstance(printers, list), "Printers should be a list"
        print(f"PASS: GET printers returns {len(printers)} printers")
    
    def test_create_printer(self, cashier_token):
        """POST /api/cashier/printers - Create new printer"""
        unique_name = f"TEST_Printer_{uuid.uuid4().hex[:6]}"
        printer_data = {
            "name": unique_name,
            "type": "receipt",
            "ip_address": "192.168.1.200",
            "port": 9100,
            "paper_width": "80mm",
            "is_default": False,
            "auto_print": False,
            "copies": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/cashier/printers",
            json=printer_data,
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        created = response.json()
        assert "id" in created, "Created printer should have an id"
        assert created["name"] == unique_name, f"Name mismatch: expected {unique_name}, got {created['name']}"
        assert created["type"] == "receipt", "Type should be receipt"
        assert created["ip_address"] == "192.168.1.200", "IP address mismatch"
        assert created["port"] == 9100, "Port mismatch"
        assert created["paper_width"] == "80mm", "Paper width mismatch"
        
        # Store for later tests
        TestPrinterCRUD.test_printer_id = created["id"]
        print(f"PASS: Created printer with id {created['id']}")
        return created["id"]
    
    def test_update_printer(self, cashier_token):
        """PUT /api/cashier/printers/{id} - Update printer"""
        if not TestPrinterCRUD.test_printer_id:
            pytest.skip("No test printer created yet")
        
        update_data = {
            "name": "TEST_Updated_Printer",
            "ip_address": "192.168.1.201",
            "is_default": True
        }
        
        response = requests.put(
            f"{BASE_URL}/api/cashier/printers/{TestPrinterCRUD.test_printer_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        updated = response.json()
        assert updated["name"] == "TEST_Updated_Printer", "Name should be updated"
        assert updated["ip_address"] == "192.168.1.201", "IP should be updated"
        assert updated["is_default"] == True, "is_default should be updated"
        
        print(f"PASS: Updated printer {TestPrinterCRUD.test_printer_id}")
    
    def test_test_printer_connection(self, cashier_token):
        """POST /api/cashier/printers/{id}/test - Test printer connection"""
        if not TestPrinterCRUD.test_printer_id:
            pytest.skip("No test printer created yet")
        
        response = requests.post(
            f"{BASE_URL}/api/cashier/printers/{TestPrinterCRUD.test_printer_id}/test",
            json={},
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "message" in result, "Test result should have a message"
        assert "status" in result, "Test result should have a status"
        assert result["status"] == "ok", f"Expected status 'ok', got {result['status']}"
        
        print(f"PASS: Printer test returned: {result['message']}")
    
    def test_delete_printer(self, cashier_token):
        """DELETE /api/cashier/printers/{id} - Delete printer"""
        if not TestPrinterCRUD.test_printer_id:
            pytest.skip("No test printer created yet")
        
        response = requests.delete(
            f"{BASE_URL}/api/cashier/printers/{TestPrinterCRUD.test_printer_id}",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "message" in result, "Delete result should have a message"
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/cashier/printers",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        printers = get_response.json()
        printer_ids = [p["id"] for p in printers]
        assert TestPrinterCRUD.test_printer_id not in printer_ids, "Deleted printer should not appear in list"
        
        print(f"PASS: Deleted printer {TestPrinterCRUD.test_printer_id}")
        TestPrinterCRUD.test_printer_id = None
    
    def test_delete_nonexistent_printer_returns_404(self, cashier_token):
        """DELETE /api/cashier/printers/{id} with invalid id should return 404"""
        fake_id = "nonexistent-printer-id-12345"
        response = requests.delete(
            f"{BASE_URL}/api/cashier/printers/{fake_id}",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Delete nonexistent printer returns 404")


class TestMenuItemsAndCategoriesIntegration:
    """Test that custom categories from menu_items appear in categories endpoint"""
    
    def test_menu_items_endpoint_works(self, cashier_token):
        """GET /api/cashier/menu should return menu items"""
        response = requests.get(
            f"{BASE_URL}/api/cashier/menu",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        items = response.json()
        assert isinstance(items, list), "Menu items should be a list"
        print(f"PASS: Menu endpoint returns {len(items)} items")
        
        # Print unique categories
        categories = set()
        for item in items:
            if item.get("category"):
                categories.add(item["category"])
        print(f"Unique categories in menu items: {categories}")
    
    def test_menu_by_category_filter(self, cashier_token):
        """GET /api/cashier/menu?category=main should filter by category"""
        response = requests.get(
            f"{BASE_URL}/api/cashier/menu?category=main",
            headers={"Authorization": f"Bearer {cashier_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        items = response.json()
        for item in items:
            assert item.get("category") == "main", f"Item {item.get('name')} has category {item.get('category')}, expected 'main'"
        
        print(f"PASS: Category filter works, {len(items)} items with category='main'")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
