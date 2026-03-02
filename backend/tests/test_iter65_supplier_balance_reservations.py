"""
Test Suite for Iteration 65: Supplier Balance Bug Fix + Table Reservations
- Supplier balance recalculation endpoints
- Delete expense correctly reduces supplier credit  
- Full Reservations CRUD and lifecycle management
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for requests"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ==================== SUPPLIER BALANCE TESTS ====================

class TestSupplierBalanceRecalculation:
    """Test supplier balance recalculation endpoints - Bug fix verification"""
    
    def test_get_suppliers_list(self, auth_headers):
        """GET /api/suppliers - List all suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200
        suppliers = response.json()
        assert isinstance(suppliers, list)
        print(f"Found {len(suppliers)} suppliers")
    
    def test_recalculate_single_supplier_balance(self, auth_headers):
        """POST /api/suppliers/{id}/recalculate-balance - Recalculate single supplier"""
        # First get suppliers
        suppliers_res = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        suppliers = suppliers_res.json()
        
        if not suppliers:
            pytest.skip("No suppliers available for testing")
        
        supplier = suppliers[0]
        supplier_id = supplier["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/suppliers/{supplier_id}/recalculate-balance",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "supplier_id" in data
        assert "supplier_name" in data
        assert "old_balance" in data
        assert "new_balance" in data
        assert "total_credit_expenses" in data
        assert "total_payments" in data
        assert "message" in data
        
        print(f"Recalculated {data['supplier_name']}: {data['old_balance']} -> {data['new_balance']}")
    
    def test_recalculate_all_suppliers_balances(self, auth_headers):
        """POST /api/suppliers/recalculate-all-balances - Recalculate all supplier balances"""
        response = requests.post(
            f"{BASE_URL}/api/suppliers/recalculate-all-balances",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "suppliers_updated" in data
        assert "updates" in data
        assert isinstance(data["updates"], list)
        
        print(f"Updated {data['suppliers_updated']} suppliers")
    
    def test_recalculate_nonexistent_supplier(self, auth_headers):
        """POST /api/suppliers/{id}/recalculate-balance - 404 for invalid supplier"""
        response = requests.post(
            f"{BASE_URL}/api/suppliers/nonexistent-id-12345/recalculate-balance",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestExpenseDeleteSupplierCredit:
    """Test expense deletion correctly reduces supplier credit - BUG FIX VERIFICATION"""
    
    def test_delete_credit_expense_reduces_supplier_balance(self, auth_headers):
        """Delete credit expense and verify supplier balance decreases (BUG FIX TEST)"""
        # Get suppliers
        suppliers_res = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        suppliers = suppliers_res.json()
        
        if not suppliers:
            pytest.skip("No suppliers available")
        
        supplier = suppliers[0]
        supplier_id = supplier["id"]
        initial_credit = supplier.get("current_credit", 0)
        
        # Create credit expense
        expense_data = {
            "category": "supplies",
            "description": "TEST_iter65_delete_expense_bugfix",
            "amount": 200,
            "payment_mode": "credit",
            "supplier_id": supplier_id,
            "date": datetime.now().isoformat()
        }
        
        expense_res = requests.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=auth_headers)
        assert expense_res.status_code == 200, f"Failed to create expense: {expense_res.text}"
        expense_id = expense_res.json()["id"]
        
        # Verify credit increased
        supplier_after_create = None
        suppliers_after = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        for s in suppliers_after:
            if s["id"] == supplier_id:
                supplier_after_create = s
                break
        
        credit_after_create = supplier_after_create.get("current_credit", 0)
        assert credit_after_create == initial_credit + 200, f"Credit should increase: {initial_credit} + 200 = {initial_credit + 200}, got {credit_after_create}"
        print(f"Credit after create: {credit_after_create}")
        
        # DELETE the expense
        delete_res = requests.delete(f"{BASE_URL}/api/expenses/{expense_id}", headers=auth_headers)
        assert delete_res.status_code == 200, f"Failed to delete expense: {delete_res.text}"
        
        # BUG FIX VERIFICATION: Credit should decrease back
        suppliers_after_delete = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        supplier_after_delete = None
        for s in suppliers_after_delete:
            if s["id"] == supplier_id:
                supplier_after_delete = s
                break
        
        credit_after_delete = supplier_after_delete.get("current_credit", 0)
        
        # This is the critical bug fix test - deleting expense should reduce credit
        assert credit_after_delete == initial_credit, \
            f"BUG: Deleting credit expense should reduce balance from {credit_after_create} back to {initial_credit}, got {credit_after_delete}"
        
        print(f"BUG FIX VERIFIED: Supplier credit correctly reduced from {credit_after_create} to {credit_after_delete}")


# ==================== RESERVATIONS TESTS ====================

class TestReservationsCRUD:
    """Test Table Reservations CRUD operations"""
    
    def test_get_tables_list(self, auth_headers):
        """GET /api/tables - List all tables"""
        response = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers)
        assert response.status_code == 200
        tables = response.json()
        assert isinstance(tables, list)
        print(f"Found {len(tables)} tables")
    
    def test_get_reservations_today(self, auth_headers):
        """GET /api/reservations/today - Get today's reservations"""
        response = requests.get(f"{BASE_URL}/api/reservations/today", headers=auth_headers)
        assert response.status_code == 200
        reservations = response.json()
        assert isinstance(reservations, list)
        print(f"Today's reservations: {len(reservations)}")
    
    def test_get_reservations_upcoming(self, auth_headers):
        """GET /api/reservations/upcoming - Get upcoming reservations"""
        response = requests.get(f"{BASE_URL}/api/reservations/upcoming?days=7", headers=auth_headers)
        assert response.status_code == 200
        reservations = response.json()
        assert isinstance(reservations, list)
        print(f"Upcoming reservations (7 days): {len(reservations)}")
    
    def test_get_reservations_stats(self, auth_headers):
        """GET /api/reservations/stats - Get reservation statistics"""
        response = requests.get(f"{BASE_URL}/api/reservations/stats", headers=auth_headers)
        assert response.status_code == 200
        stats = response.json()
        
        # Verify stats structure
        assert "today" in stats
        assert "weekly" in stats
        assert "popular_times" in stats
        
        today = stats["today"]
        assert "total" in today
        assert "confirmed" in today
        
        print(f"Today stats: total={today.get('total')}, confirmed={today.get('confirmed')}")
    
    def test_get_available_slots(self, auth_headers):
        """GET /api/reservations/available-slots - Get available time slots"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/reservations/available-slots?date={today}&party_size=4",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "date" in data
        assert "party_size" in data
        assert "available_slots" in data
        
        print(f"Available slots for {today}: {len(data['available_slots'])} time slots")
    
    def test_create_and_delete_reservation(self, auth_headers):
        """POST /api/reservations - Create and DELETE a reservation"""
        # Get a table first
        tables_res = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers)
        tables = tables_res.json()
        
        if not tables:
            pytest.skip("No tables available for reservation")
        
        # Find a table with capacity >= 2
        table = None
        for t in tables:
            if t.get("capacity", 0) >= 2:
                table = t
                break
        
        if not table:
            table = tables[0]  # Use first table if none with capacity >= 2
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        reservation_data = {
            "table_id": table["id"],
            "customer_name": "TEST_iter65_Guest",
            "customer_phone": "+966500000000",
            "customer_email": "test@iter65.com",
            "party_size": 2,
            "date": tomorrow,
            "time_slot": "19:00",
            "duration_minutes": 90,
            "special_requests": "Test reservation - please ignore",
            "occasion": "birthday"
        }
        
        response = requests.post(f"{BASE_URL}/api/reservations", json=reservation_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create reservation: {response.text}"
        reservation = response.json()
        
        # Verify reservation structure
        assert "id" in reservation
        assert "confirmation_code" in reservation
        assert reservation["customer_name"] == "TEST_iter65_Guest"
        assert reservation["status"] == "confirmed"
        
        print(f"Created reservation: {reservation['confirmation_code']}")
        
        # Delete the reservation
        delete_res = requests.delete(f"{BASE_URL}/api/reservations/{reservation['id']}", headers=auth_headers)
        assert delete_res.status_code == 200, f"Failed to delete reservation: {delete_res.text}"
        print("Reservation deleted successfully")


class TestReservationStatusLifecycle:
    """Test reservation status update lifecycle"""
    
    def test_status_transitions(self, auth_headers):
        """Test full status lifecycle: confirmed -> seated -> completed"""
        # Get tables
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers).json()
        if not tables:
            pytest.skip("No tables available")
        
        table = tables[0]
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Create reservation
        res = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": table["id"],
            "customer_name": "TEST_iter65_Lifecycle",
            "customer_phone": "+966500000001",
            "party_size": 2,
            "date": tomorrow,
            "time_slot": "20:00"
        }, headers=auth_headers)
        
        assert res.status_code == 200, f"Create failed: {res.text}"
        reservation = res.json()
        reservation_id = reservation["id"]
        
        # Test: confirmed (default status)
        assert reservation["status"] == "confirmed"
        print("Status: confirmed (default)")
        
        # Test: seated
        seat_res = requests.post(
            f"{BASE_URL}/api/reservations/{reservation_id}/status",
            json={"status": "seated"},
            headers=auth_headers
        )
        assert seat_res.status_code == 200
        print("Status updated: seated")
        
        # Test: completed
        complete_res = requests.post(
            f"{BASE_URL}/api/reservations/{reservation_id}/status",
            json={"status": "completed"},
            headers=auth_headers
        )
        assert complete_res.status_code == 200
        print("Status updated: completed")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reservations/{reservation_id}", headers=auth_headers)
    
    def test_status_cancel(self, auth_headers):
        """Test cancellation status"""
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers).json()
        if not tables:
            pytest.skip("No tables")
        
        table = tables[0]
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        res = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": table["id"],
            "customer_name": "TEST_iter65_Cancel",
            "customer_phone": "+966500000002",
            "party_size": 2,
            "date": tomorrow,
            "time_slot": "21:00"
        }, headers=auth_headers)
        
        reservation_id = res.json()["id"]
        
        # Cancel it
        cancel_res = requests.post(
            f"{BASE_URL}/api/reservations/{reservation_id}/status",
            json={"status": "cancelled"},
            headers=auth_headers
        )
        assert cancel_res.status_code == 200
        print("Status updated: cancelled")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reservations/{reservation_id}", headers=auth_headers)
    
    def test_status_no_show(self, auth_headers):
        """Test no-show status"""
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers).json()
        if not tables:
            pytest.skip("No tables")
        
        table = tables[0]
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        res = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": table["id"],
            "customer_name": "TEST_iter65_NoShow",
            "customer_phone": "+966500000003",
            "party_size": 2,
            "date": tomorrow,
            "time_slot": "21:30"
        }, headers=auth_headers)
        
        reservation_id = res.json()["id"]
        
        # Mark as no-show
        no_show_res = requests.post(
            f"{BASE_URL}/api/reservations/{reservation_id}/status",
            json={"status": "no_show"},
            headers=auth_headers
        )
        assert no_show_res.status_code == 200
        print("Status updated: no_show")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reservations/{reservation_id}", headers=auth_headers)
    
    def test_status_invalid(self, auth_headers):
        """Test invalid status returns 400"""
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers).json()
        if not tables:
            pytest.skip("No tables")
        
        table = tables[0]
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        res = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": table["id"],
            "customer_name": "TEST_iter65_Invalid",
            "customer_phone": "+966500000004",
            "party_size": 2,
            "date": tomorrow,
            "time_slot": "22:00"
        }, headers=auth_headers)
        
        reservation_id = res.json()["id"]
        
        # Try invalid status
        invalid_res = requests.post(
            f"{BASE_URL}/api/reservations/{reservation_id}/status",
            json={"status": "invalid_status_xyz"},
            headers=auth_headers
        )
        assert invalid_res.status_code == 400
        print("Invalid status correctly rejected")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reservations/{reservation_id}", headers=auth_headers)


class TestReservationUpdateDelete:
    """Test reservation update and delete operations"""
    
    def test_update_reservation(self, auth_headers):
        """PUT /api/reservations/{id} - Update reservation details"""
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers).json()
        if not tables:
            pytest.skip("No tables")
        
        table = tables[0]
        # Use a unique date to avoid conflicts
        test_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        
        res = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": table["id"],
            "customer_name": "TEST_iter65_Update",
            "customer_phone": "+966500000004",
            "party_size": 2,
            "date": test_date,
            "time_slot": "12:00"  # Use a different time slot
        }, headers=auth_headers)
        
        if res.status_code != 200:
            print(f"Create failed: {res.text}")
            pytest.skip("Could not create reservation for update test")
        
        reservation_id = res.json()["id"]
        
        # Update it
        update_res = requests.put(f"{BASE_URL}/api/reservations/{reservation_id}", json={
            "customer_name": "TEST_iter65_Updated_Name",
            "party_size": 4,
            "special_requests": "Updated request"
        }, headers=auth_headers)
        
        assert update_res.status_code == 200
        updated = update_res.json()
        assert updated["customer_name"] == "TEST_iter65_Updated_Name"
        assert updated["party_size"] == 4
        print("Reservation updated successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/reservations/{reservation_id}", headers=auth_headers)
    
    def test_delete_nonexistent_reservation(self, auth_headers):
        """DELETE /api/reservations/{id} - 404 for nonexistent"""
        response = requests.delete(f"{BASE_URL}/api/reservations/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404


class TestReservationEdgeCases:
    """Test reservation edge cases and validation"""
    
    def test_create_reservation_exceeds_capacity(self, auth_headers):
        """Party size exceeds table capacity returns 400"""
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers).json()
        if not tables:
            pytest.skip("No tables")
        
        # Find smallest capacity table
        table = min(tables, key=lambda t: t.get("capacity", 999))
        tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        response = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": table["id"],
            "customer_name": "TEST_iter65_TooLarge",
            "customer_phone": "+966500000006",
            "party_size": table.get("capacity", 4) + 10,  # Exceed capacity
            "date": tomorrow,
            "time_slot": "19:00"
        }, headers=auth_headers)
        
        assert response.status_code == 400
        assert "capacity" in response.json().get("detail", "").lower()
        print("Capacity validation working")
    
    def test_create_reservation_conflicting_slot(self, auth_headers):
        """Conflicting slot returns 400"""
        tables = requests.get(f"{BASE_URL}/api/tables", headers=auth_headers).json()
        if not tables:
            pytest.skip("No tables")
        
        table = tables[0]
        tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        # Create first reservation
        res1 = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": table["id"],
            "customer_name": "TEST_iter65_First",
            "customer_phone": "+966500000007",
            "party_size": 2,
            "date": tomorrow,
            "time_slot": "19:30"
        }, headers=auth_headers)
        
        first_id = res1.json().get("id")
        
        # Try to create conflicting reservation
        res2 = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": table["id"],
            "customer_name": "TEST_iter65_Conflict",
            "customer_phone": "+966500000008",
            "party_size": 2,
            "date": tomorrow,
            "time_slot": "19:30"  # Same slot
        }, headers=auth_headers)
        
        assert res2.status_code == 400
        print("Conflict validation working")
        
        # Cleanup first reservation
        if first_id:
            requests.delete(f"{BASE_URL}/api/reservations/{first_id}", headers=auth_headers)
    
    def test_create_reservation_invalid_table(self, auth_headers):
        """Invalid table returns 404"""
        tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        
        response = requests.post(f"{BASE_URL}/api/reservations", json={
            "table_id": "invalid-table-id-12345",
            "customer_name": "TEST_iter65_BadTable",
            "customer_phone": "+966500000009",
            "party_size": 2,
            "date": tomorrow,
            "time_slot": "19:00"
        }, headers=auth_headers)
        
        assert response.status_code == 404
        print("Invalid table validation working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
