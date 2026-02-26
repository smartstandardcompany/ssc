"""
Test Suite for Stock Management Module - Iteration 10
Tests: Item Master, Stock In/Out, Balance Tracking, Kitchen Usage
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestStockManagement:
    """Stock management API tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "SSC@SSC.com",
            "password": "Aa147258369SsC@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def branch_a_id(self):
        """Branch A ID"""
        return "d805e6cb-f65a-4a09-8707-95f3f5e505bf"
    
    @pytest.fixture(scope="class")
    def branch_b_id(self):
        """Branch B ID"""
        return "4ea291a5-c3e4-4067-8437-2121f3c12882"
    
    # ===== ITEM MASTER TESTS =====
    
    def test_get_items(self, auth_headers):
        """Test GET /api/items returns list"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/items: {len(data)} items found")
    
    def test_create_item_chicken_breast(self, auth_headers):
        """Test POST /api/items creates new item with all fields"""
        item_data = {
            "name": "TEST_Chicken Breast",
            "cost_price": 25,
            "unit_price": 45,
            "unit": "kg",
            "category": "Meat",
            "min_stock_level": 5
        }
        response = requests.post(f"{BASE_URL}/api/items", json=item_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify all fields are saved correctly
        assert data["name"] == "TEST_Chicken Breast"
        assert data["cost_price"] == 25
        assert data["unit_price"] == 45
        assert data["unit"] == "kg"
        assert data["category"] == "Meat"
        assert data["min_stock_level"] == 5
        assert "id" in data
        
        print(f"✓ Created item: {data['name']} with id={data['id']}")
        # Store for later tests
        TestStockManagement.chicken_item_id = data["id"]
    
    def test_create_item_rice(self, auth_headers):
        """Test creating Rice item"""
        item_data = {
            "name": "TEST_Rice",
            "cost_price": 8,
            "unit_price": 15,
            "unit": "kg",
            "category": "Grains",
            "min_stock_level": 10
        }
        response = requests.post(f"{BASE_URL}/api/items", json=item_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["name"] == "TEST_Rice"
        assert data["cost_price"] == 8
        assert data["unit_price"] == 15
        assert data["unit"] == "kg"
        
        print(f"✓ Created item: {data['name']} with id={data['id']}")
        TestStockManagement.rice_item_id = data["id"]
    
    def test_get_items_shows_new_items(self, auth_headers):
        """Verify newly created items appear in list"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200
        items = response.json()
        
        item_names = [item["name"] for item in items]
        assert "TEST_Chicken Breast" in item_names, "Chicken Breast not found in items list"
        assert "TEST_Rice" in item_names, "Rice not found in items list"
        print(f"✓ Both test items found in items list")
    
    # ===== STOCK ENTRY TESTS =====
    
    def test_create_stock_entry_chicken(self, auth_headers, branch_a_id):
        """Test POST /api/stock/entries creates stock entry"""
        entry_data = {
            "item_id": TestStockManagement.chicken_item_id,
            "branch_id": branch_a_id,
            "quantity": 20,
            "unit_cost": 25,
            "date": datetime.now().isoformat(),
            "notes": "Test stock entry"
        }
        response = requests.post(f"{BASE_URL}/api/stock/entries", json=entry_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["item_id"] == TestStockManagement.chicken_item_id
        assert data["item_name"] == "TEST_Chicken Breast"
        assert data["branch_id"] == branch_a_id
        assert data["quantity"] == 20
        assert data["unit_cost"] == 25
        
        print(f"✓ Created stock entry for Chicken Breast: {data['quantity']} {data.get('unit', 'units')}")
    
    def test_create_stock_entry_rice(self, auth_headers, branch_a_id):
        """Test creating stock entry for Rice"""
        entry_data = {
            "item_id": TestStockManagement.rice_item_id,
            "branch_id": branch_a_id,
            "quantity": 50,
            "unit_cost": 8,
            "date": datetime.now().isoformat(),
            "notes": "Test stock entry for rice"
        }
        response = requests.post(f"{BASE_URL}/api/stock/entries", json=entry_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["item_id"] == TestStockManagement.rice_item_id
        assert data["item_name"] == "TEST_Rice"
        assert data["quantity"] == 50
        
        print(f"✓ Created stock entry for Rice: {data['quantity']} {data.get('unit', 'units')}")
    
    def test_get_stock_entries(self, auth_headers, branch_a_id):
        """Test GET /api/stock/entries returns entries"""
        response = requests.get(f"{BASE_URL}/api/stock/entries?branch_id={branch_a_id}", headers=auth_headers)
        assert response.status_code == 200
        entries = response.json()
        
        assert isinstance(entries, list)
        test_entries = [e for e in entries if e["item_name"].startswith("TEST_")]
        assert len(test_entries) >= 2, f"Expected 2+ test entries, got {len(test_entries)}"
        
        print(f"✓ GET /api/stock/entries: Found {len(test_entries)} test entries")
    
    # ===== STOCK BALANCE TESTS =====
    
    def test_get_stock_balance_all(self, auth_headers):
        """Test GET /api/stock/balance returns correct balance"""
        response = requests.get(f"{BASE_URL}/api/stock/balance", headers=auth_headers)
        assert response.status_code == 200
        balance = response.json()
        
        assert isinstance(balance, list)
        
        # Find our test items
        chicken_balance = next((b for b in balance if b["item_name"] == "TEST_Chicken Breast"), None)
        rice_balance = next((b for b in balance if b["item_name"] == "TEST_Rice"), None)
        
        assert chicken_balance is not None, "Chicken Breast not found in balance"
        assert rice_balance is not None, "Rice not found in balance"
        
        assert chicken_balance["stock_in"] == 20, f"Expected stock_in=20, got {chicken_balance['stock_in']}"
        assert chicken_balance["balance"] == 20, f"Expected balance=20, got {chicken_balance['balance']}"
        assert rice_balance["stock_in"] == 50, f"Expected stock_in=50, got {rice_balance['stock_in']}"
        assert rice_balance["balance"] == 50, f"Expected balance=50, got {rice_balance['balance']}"
        
        print(f"✓ Stock balance: Chicken={chicken_balance['balance']}, Rice={rice_balance['balance']}")
    
    def test_get_stock_balance_by_branch(self, auth_headers, branch_a_id):
        """Test GET /api/stock/balance?branch_id returns branch-specific balance"""
        response = requests.get(f"{BASE_URL}/api/stock/balance?branch_id={branch_a_id}", headers=auth_headers)
        assert response.status_code == 200
        balance = response.json()
        
        # Verify items have correct balance for branch A
        chicken_balance = next((b for b in balance if b["item_name"] == "TEST_Chicken Breast"), None)
        assert chicken_balance is not None
        assert chicken_balance["balance"] == 20
        
        print(f"✓ Branch A balance verified: Chicken={chicken_balance['balance']}")
    
    # ===== STOCK USAGE TESTS =====
    
    def test_create_stock_usage_bulk(self, auth_headers, branch_a_id):
        """Test POST /api/stock/usage/bulk creates bulk usage records"""
        usage_data = {
            "branch_id": branch_a_id,
            "used_by": "Test Chef",
            "date": datetime.now().isoformat(),
            "items": [
                {"item_id": TestStockManagement.chicken_item_id, "quantity": 3},
                {"item_id": TestStockManagement.rice_item_id, "quantity": 5}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/stock/usage/bulk", json=usage_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["created"] == 2, f"Expected 2 usage records, got {data['created']}"
        assert len(data["entries"]) == 2
        
        print(f"✓ Created {data['created']} bulk usage records")
    
    def test_stock_balance_after_usage(self, auth_headers, branch_a_id):
        """Verify stock balance reduces after usage"""
        response = requests.get(f"{BASE_URL}/api/stock/balance?branch_id={branch_a_id}", headers=auth_headers)
        assert response.status_code == 200
        balance = response.json()
        
        chicken_balance = next((b for b in balance if b["item_name"] == "TEST_Chicken Breast"), None)
        rice_balance = next((b for b in balance if b["item_name"] == "TEST_Rice"), None)
        
        assert chicken_balance is not None
        assert rice_balance is not None
        
        # Chicken: 20 in - 3 used = 17 balance
        assert chicken_balance["stock_in"] == 20
        assert chicken_balance["stock_used"] == 3
        assert chicken_balance["balance"] == 17, f"Expected Chicken balance=17, got {chicken_balance['balance']}"
        
        # Rice: 50 in - 5 used = 45 balance
        assert rice_balance["stock_in"] == 50
        assert rice_balance["stock_used"] == 5
        assert rice_balance["balance"] == 45, f"Expected Rice balance=45, got {rice_balance['balance']}"
        
        print(f"✓ Balance after usage: Chicken={chicken_balance['balance']}, Rice={rice_balance['balance']}")
    
    def test_get_stock_usage(self, auth_headers, branch_a_id):
        """Test GET /api/stock/usage returns usage records"""
        response = requests.get(f"{BASE_URL}/api/stock/usage?branch_id={branch_a_id}", headers=auth_headers)
        assert response.status_code == 200
        usage = response.json()
        
        assert isinstance(usage, list)
        test_usage = [u for u in usage if u["item_name"].startswith("TEST_")]
        assert len(test_usage) >= 2, f"Expected 2+ test usage records, got {len(test_usage)}"
        
        print(f"✓ GET /api/stock/usage: Found {len(test_usage)} test usage records")
    
    # ===== LOW STOCK ALERT TEST =====
    
    def test_low_stock_detection(self, auth_headers, branch_a_id):
        """Verify low stock detection works"""
        # Use more items to trigger low stock
        usage_data = {
            "branch_id": branch_a_id,
            "used_by": "Test Chef",
            "date": datetime.now().isoformat(),
            "items": [
                {"item_id": TestStockManagement.chicken_item_id, "quantity": 12}  # Will leave 5 (min_stock_level)
            ]
        }
        requests.post(f"{BASE_URL}/api/stock/usage/bulk", json=usage_data, headers=auth_headers)
        
        response = requests.get(f"{BASE_URL}/api/stock/balance?branch_id={branch_a_id}", headers=auth_headers)
        assert response.status_code == 200
        balance = response.json()
        
        chicken = next((b for b in balance if b["item_name"] == "TEST_Chicken Breast"), None)
        assert chicken is not None
        assert chicken["balance"] == 5, f"Expected balance=5, got {chicken['balance']}"
        assert chicken["low_stock"] == True, "Low stock flag should be True when balance <= min_stock_level"
        
        print(f"✓ Low stock detection working: Chicken balance={chicken['balance']}, low_stock={chicken['low_stock']}")
    
    # ===== CLEANUP =====
    
    def test_cleanup_test_data(self, auth_headers):
        """Clean up test items"""
        # Delete test items
        if hasattr(TestStockManagement, 'chicken_item_id'):
            requests.delete(f"{BASE_URL}/api/items/{TestStockManagement.chicken_item_id}", headers=auth_headers)
        if hasattr(TestStockManagement, 'rice_item_id'):
            requests.delete(f"{BASE_URL}/api/items/{TestStockManagement.rice_item_id}", headers=auth_headers)
        
        print(f"✓ Test data cleanup completed")


class TestBranchesAndSuppliers:
    """Verify branches and suppliers exist for stock operations"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "SSC@SSC.com",
            "password": "Aa147258369SsC@"
        })
        assert response.status_code == 200
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_branches_exist(self, auth_headers):
        """Verify branches A and B exist"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200
        branches = response.json()
        
        branch_ids = [b["id"] for b in branches]
        assert "d805e6cb-f65a-4a09-8707-95f3f5e505bf" in branch_ids, "Branch A not found"
        assert "4ea291a5-c3e4-4067-8437-2121f3c12882" in branch_ids, "Branch B not found"
        
        print(f"✓ Found {len(branches)} branches including A and B")
    
    def test_suppliers_endpoint(self, auth_headers):
        """Verify suppliers endpoint works"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200
        suppliers = response.json()
        
        assert isinstance(suppliers, list)
        print(f"✓ GET /api/suppliers: {len(suppliers)} suppliers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
