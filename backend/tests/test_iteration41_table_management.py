"""
Iteration 41: Table Management & Waiter Ordering System Tests
Tests all CRUD operations for tables, sections, waiters, and order flow

Features tested:
- Table sections CRUD
- Tables CRUD
- Table status management
- Waiter login and table selection
- Order flow (start order, add items, close order)
"""

import pytest
import requests
import os
import json
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def unique_id():
    """Generate short unique identifier for test data"""
    return str(uuid.uuid4())[:8]

# =====================================================
# FIXTURES
# =====================================================

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def waiter_token():
    """Get waiter/cashier token via PIN login"""
    response = requests.post(
        f"{BASE_URL}/api/cashier/login",
        json={"pin": "1234"}
    )
    assert response.status_code == 200, f"PIN login failed: {response.text}"
    data = response.json()
    return data["access_token"], data.get("user", {})


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# =====================================================
# TABLE SECTIONS TESTS
# =====================================================

class TestTableSections:
    """Test table sections CRUD operations"""
    
    def test_get_sections_returns_200(self, api_client, admin_token):
        """GET /api/tables/sections should return 200"""
        response = api_client.get(
            f"{BASE_URL}/api/tables/sections",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        print(f"GET /api/tables/sections returned {len(response.json())} sections")
    
    def test_get_sections_returns_list(self, api_client, admin_token):
        """GET /api/tables/sections should return a list of sections"""
        response = api_client.get(
            f"{BASE_URL}/api/tables/sections",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "name" in data[0]
            assert "color" in data[0]
    
    def test_create_section(self, api_client, admin_token):
        """POST /api/tables/sections should create a new section"""
        section_data = {
            "name": "TEST_Terrace",
            "color": "#10b981",
            "floor": 2
        }
        response = api_client.post(
            f"{BASE_URL}/api/tables/sections",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=section_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Terrace"
        assert data["color"] == "#10b981"
        assert "id" in data
        print(f"Created section: {data['name']} with id {data['id']}")
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/tables/sections/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )


# =====================================================
# TABLES CRUD TESTS
# =====================================================

class TestTablesCRUD:
    """Test tables CRUD operations"""
    
    def test_get_tables_returns_200(self, api_client, admin_token):
        """GET /api/tables should return 200"""
        response = api_client.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        print(f"GET /api/tables returned {len(response.json())} tables")
    
    def test_get_tables_returns_list(self, api_client, admin_token):
        """GET /api/tables should return a list of tables"""
        response = api_client.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "id" in data[0]
            assert "table_number" in data[0]
            assert "section" in data[0]
            assert "capacity" in data[0]
            assert "status" in data[0]
    
    def test_get_tables_stats(self, api_client, admin_token):
        """GET /api/tables/stats should return table statistics"""
        response = api_client.get(
            f"{BASE_URL}/api/tables/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_tables" in data
        assert "available" in data
        assert "occupied" in data
        assert "reserved" in data
        assert "cleaning" in data
        assert "total_capacity" in data
        assert "occupancy_rate" in data
        print(f"Table stats: {data['total_tables']} total, {data['available']} available")
    
    def test_create_table(self, api_client, admin_token):
        """POST /api/tables should create a new table"""
        uid = unique_id()
        table_data = {
            "table_number": f"TEST_T{uid}",
            "section": "Main Hall",
            "capacity": 6,
            "shape": "round"
        }
        response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        assert response.status_code == 200, f"Failed to create table: {response.text}"
        data = response.json()
        assert data["table_number"] == f"TEST_T{uid}"
        assert data["section"] == "Main Hall"
        assert data["capacity"] == 6
        assert data["status"] == "available"
        assert "id" in data
        print(f"Created table: {data['table_number']} with id {data['id']}")
        
        # Verify by GET
        get_response = api_client.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        tables = get_response.json()
        created_table = next((t for t in tables if t["table_number"] == f"TEST_T{uid}"), None)
        assert created_table is not None, "Created table not found in GET response"
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/tables/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_update_table(self, api_client, admin_token):
        """PUT /api/tables/{id} should update table details"""
        uid = unique_id()
        # Create table first
        table_data = {"table_number": f"TEST_UPD{uid}", "section": "Main Hall", "capacity": 4}
        create_response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        assert create_response.status_code == 200, f"Failed to create table: {create_response.text}"
        table_id = create_response.json()["id"]
        
        # Update
        update_data = {"capacity": 8, "shape": "rectangle"}
        update_response = api_client.put(
            f"{BASE_URL}/api/tables/{table_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=update_data
        )
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["capacity"] == 8
        assert updated["shape"] == "rectangle"
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/tables/{table_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_create_duplicate_table_fails(self, api_client, admin_token):
        """POST /api/tables with duplicate table number should fail"""
        # Get existing tables
        get_response = api_client.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        tables = get_response.json()
        if len(tables) == 0:
            pytest.skip("No existing tables to test duplicate")
        
        existing_number = tables[0]["table_number"]
        
        # Try to create duplicate
        table_data = {"table_number": existing_number, "section": "Main Hall", "capacity": 4}
        response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "").lower()


# =====================================================
# TABLE STATUS TESTS
# =====================================================

class TestTableStatus:
    """Test table status management"""
    
    def test_update_table_status(self, api_client, admin_token):
        """POST /api/tables/{id}/status should update table status"""
        uid = unique_id()
        # Create a test table
        table_data = {"table_number": f"TEST_STS{uid}", "section": "Main Hall", "capacity": 4}
        create_response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        assert create_response.status_code == 200, f"Failed to create table: {create_response.text}"
        table_id = create_response.json()["id"]
        
        # Update status to reserved
        status_data = {"status": "reserved", "notes": "Test reservation"}
        response = api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=status_data
        )
        assert response.status_code == 200
        assert response.json()["status"] == "reserved"
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/tables/{table_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_mark_table_available(self, api_client, admin_token):
        """POST /api/tables/{id}/mark-available should mark table as available"""
        # Create a test table
        table_data = {"table_number": "TEST_AVAILABLE", "section": "Main Hall", "capacity": 4}
        create_response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        assert create_response.status_code == 200
        table_id = create_response.json()["id"]
        
        # Set to cleaning first
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/status",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"status": "cleaning"}
        )
        
        # Mark as available
        response = api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/mark-available",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        # Verify status
        get_response = api_client.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        table = next((t for t in get_response.json() if t["id"] == table_id), None)
        assert table["status"] == "available"
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/tables/{table_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )


# =====================================================
# WAITER LOGIN TESTS
# =====================================================

class TestWaiterLogin:
    """Test waiter/cashier PIN login"""
    
    def test_waiter_login_with_pin_1234(self, api_client):
        """POST /api/cashier/login with PIN 1234 should succeed"""
        response = api_client.post(
            f"{BASE_URL}/api/cashier/login",
            json={"pin": "1234"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Waiter login successful: {data['user'].get('name', 'Unknown')}")
    
    def test_waiter_login_invalid_pin(self, api_client):
        """POST /api/cashier/login with invalid PIN should fail"""
        response = api_client.post(
            f"{BASE_URL}/api/cashier/login",
            json={"pin": "9999"}
        )
        assert response.status_code == 401


# =====================================================
# ORDER FLOW TESTS
# =====================================================

class TestOrderFlow:
    """Test complete order flow: start → add items → close"""
    
    def test_start_order_for_table(self, api_client, admin_token):
        """POST /api/tables/{id}/start-order should create an order"""
        # Create a test table
        table_data = {"table_number": "TEST_ORDER", "section": "Main Hall", "capacity": 4}
        create_response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        assert create_response.status_code == 200
        table_id = create_response.json()["id"]
        
        # Start order
        order_data = {"waiter_id": "test-waiter", "customer_count": 2}
        response = api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/start-order",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=order_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "order" in data
        assert "table" in data
        assert data["order"]["status"] == "open"
        print(f"Order started: {data['order']['order_number']}")
        
        # Verify table is now occupied
        get_response = api_client.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        table = next((t for t in get_response.json() if t["id"] == table_id), None)
        assert table["status"] == "occupied"
        
        # Cleanup - close order and delete table
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/close-order",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"payment_mode": "cash"}
        )
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/mark-available",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        api_client.delete(
            f"{BASE_URL}/api/tables/{table_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_add_items_to_order(self, api_client, admin_token):
        """POST /api/tables/{id}/add-items should add items to order"""
        # Create table and start order
        table_data = {"table_number": "TEST_ITEMS", "section": "Main Hall", "capacity": 4}
        create_response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        table_id = create_response.json()["id"]
        
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/start-order",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"waiter_id": "test-waiter", "customer_count": 1}
        )
        
        # Add items
        items_data = {
            "items": [
                {"name": "Test Burger", "price": 25.00, "quantity": 2},
                {"name": "Test Cola", "price": 5.00, "quantity": 1}
            ]
        }
        response = api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/add-items",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=items_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "order" in data
        assert len(data["order"]["items"]) == 2
        assert data["order"]["subtotal"] == 55.00
        print(f"Items added. Order total: {data['order']['total']}")
        
        # Cleanup
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/close-order",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"payment_mode": "cash"}
        )
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/mark-available",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        api_client.delete(
            f"{BASE_URL}/api/tables/{table_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_close_order(self, api_client, admin_token):
        """POST /api/tables/{id}/close-order should close and pay the order"""
        # Create table, start order, add items
        table_data = {"table_number": "TEST_CLOSE", "section": "Main Hall", "capacity": 4}
        create_response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        table_id = create_response.json()["id"]
        
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/start-order",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"waiter_id": "test-waiter", "customer_count": 1}
        )
        
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/add-items",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"items": [{"name": "Test Item", "price": 10.00, "quantity": 1}]}
        )
        
        # Close order
        close_data = {"payment_mode": "cash", "amount_paid": 11.50}
        response = api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/close-order",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=close_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["payment_mode"] == "cash"
        assert "sale_id" in data
        print(f"Order closed. Sale ID: {data['sale_id']}")
        
        # Verify table is set to cleaning
        get_response = api_client.get(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        table = next((t for t in get_response.json() if t["id"] == table_id), None)
        assert table["status"] == "cleaning"
        
        # Cleanup
        api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/mark-available",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        api_client.delete(
            f"{BASE_URL}/api/tables/{table_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
    
    def test_add_items_without_order_fails(self, api_client, admin_token):
        """POST /api/tables/{id}/add-items without active order should fail"""
        # Create table but don't start order
        table_data = {"table_number": "TEST_NO_ORDER", "section": "Main Hall", "capacity": 4}
        create_response = api_client.post(
            f"{BASE_URL}/api/tables",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=table_data
        )
        table_id = create_response.json()["id"]
        
        # Try to add items
        items_data = {"items": [{"name": "Test", "price": 10.00, "quantity": 1}]}
        response = api_client.post(
            f"{BASE_URL}/api/tables/{table_id}/add-items",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=items_data
        )
        assert response.status_code == 400
        assert "no active order" in response.json().get("detail", "").lower()
        
        # Cleanup
        api_client.delete(
            f"{BASE_URL}/api/tables/{table_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )


# =====================================================
# WAITER TABLES ENDPOINT TESTS
# =====================================================

class TestWaiterEndpoints:
    """Test waiter-specific endpoints"""
    
    def test_get_waiters(self, api_client, admin_token):
        """GET /api/waiters should return list of waiters"""
        response = api_client.get(
            f"{BASE_URL}/api/waiters",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_waiter_login_uses_cashier_endpoint(self, api_client):
        """POST /api/cashier/login should authenticate waiter (frontend uses this)"""
        # The WaiterPage actually uses /api/cashier/login endpoint
        response = api_client.post(
            f"{BASE_URL}/api/cashier/login",
            json={"pin": "1234"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
