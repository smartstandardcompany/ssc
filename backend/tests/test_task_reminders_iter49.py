"""
Test Task Reminders Feature - Iteration 49
Tests all CRUD operations, acknowledge, history, presets, bulk creation, and my-reminders endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
EMPLOYEE_EMAIL = "ahmed@test.com"
EMPLOYEE_PASSWORD = "emp@123"


class TestTaskRemindersAPI:
    """Task Reminders API tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture(scope="class")
    def employee_token(self):
        """Get employee authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYEE_EMAIL,
            "password": EMPLOYEE_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Employee login failed: {response.text}")
        data = response.json()
        return data.get("access_token")
    
    @pytest.fixture
    def admin_client(self, admin_token):
        """Session with admin auth header"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        })
        return session
    
    @pytest.fixture
    def employee_client(self, employee_token):
        """Session with employee auth header"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {employee_token}"
        })
        return session
    
    # ============= PRESETS TESTS =============
    
    def test_get_presets_returns_4_roles(self, admin_client):
        """GET /api/task-reminders/presets returns 4 roles with templates"""
        response = admin_client.get(f"{BASE_URL}/api/task-reminders/presets")
        assert response.status_code == 200, f"Failed to get presets: {response.text}"
        
        data = response.json()
        # Should have cleaner, waiter, cashier, chef
        expected_roles = ["cleaner", "waiter", "cashier", "chef"]
        for role in expected_roles:
            assert role in data, f"Missing role: {role}"
            assert len(data[role]) > 0, f"No templates for role: {role}"
        print(f"✓ Presets returned for {len(data)} roles: {list(data.keys())}")
    
    def test_presets_have_required_fields(self, admin_client):
        """Each preset template has name, message, interval_hours"""
        response = admin_client.get(f"{BASE_URL}/api/task-reminders/presets")
        assert response.status_code == 200
        
        data = response.json()
        for role, templates in data.items():
            for template in templates:
                assert "name" in template, f"Missing name in {role} template"
                assert "message" in template, f"Missing message in {role} template"
                assert "interval_hours" in template, f"Missing interval_hours in {role} template"
        print("✓ All preset templates have required fields")
    
    # ============= CREATE REMINDER TESTS =============
    
    def test_create_single_reminder(self, admin_client):
        """POST /api/task-reminders creates a single reminder"""
        unique_name = f"TEST_Reminder_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "message": "Test reminder message",
            "target_type": "role",
            "target_value": "Waiter",
            "interval_hours": 1,
            "active_start_hour": 9,
            "active_end_hour": 18,
            "days_of_week": [0, 1, 2, 3, 4],
            "channels": ["in_app"],
            "enabled": True
        }
        
        response = admin_client.post(f"{BASE_URL}/api/task-reminders", json=payload)
        assert response.status_code == 200, f"Failed to create reminder: {response.text}"
        
        data = response.json()
        assert data["name"] == unique_name
        assert data["target_type"] == "role"
        assert data["target_value"] == "Waiter"
        assert "id" in data
        print(f"✓ Created reminder with ID: {data['id']}")
        
        # Store for cleanup
        return data["id"]
    
    def test_create_reminder_returns_all_fields(self, admin_client):
        """Created reminder returns all expected fields"""
        unique_name = f"TEST_FieldCheck_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "message": "Field check message",
            "target_type": "employee",
            "target_value": "emp-123",
            "interval_hours": 2.5,
            "active_start_hour": 8,
            "active_end_hour": 22,
            "days_of_week": [0, 1, 2, 3, 4, 5, 6],
            "channels": ["push", "in_app"],
            "enabled": False
        }
        
        response = admin_client.post(f"{BASE_URL}/api/task-reminders", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        expected_fields = ["id", "name", "message", "target_type", "target_value", 
                         "interval_hours", "active_start_hour", "active_end_hour",
                         "days_of_week", "channels", "enabled", "created_at"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        assert data["interval_hours"] == 2.5
        assert data["enabled"] == False
        print("✓ Created reminder has all expected fields")
    
    # ============= BULK CREATE TESTS =============
    
    def test_bulk_create_presets_for_role(self, admin_client):
        """POST /api/task-reminders/bulk creates presets for a role"""
        payload = {
            "role": "waiter",
            "target_type": "role",
            "target_value": "Waiter",
            "active_start_hour": 10,
            "active_end_hour": 20
        }
        
        response = admin_client.post(f"{BASE_URL}/api/task-reminders/bulk", json=payload)
        assert response.status_code == 200, f"Failed bulk create: {response.text}"
        
        data = response.json()
        assert "created" in data
        assert "reminders" in data
        assert data["created"] > 0
        assert len(data["reminders"]) == data["created"]
        print(f"✓ Bulk created {data['created']} reminders for waiter role")
    
    def test_bulk_create_invalid_role_fails(self, admin_client):
        """POST /api/task-reminders/bulk with invalid role returns 400"""
        payload = {
            "role": "invalid_role_xyz",
            "target_type": "role",
            "target_value": "InvalidRole"
        }
        
        response = admin_client.post(f"{BASE_URL}/api/task-reminders/bulk", json=payload)
        assert response.status_code == 400, f"Expected 400 for invalid role: {response.text}"
        print("✓ Invalid role correctly returns 400")
    
    # ============= LIST REMINDERS TESTS =============
    
    def test_list_all_reminders(self, admin_client):
        """GET /api/task-reminders lists all reminders"""
        response = admin_client.get(f"{BASE_URL}/api/task-reminders")
        assert response.status_code == 200, f"Failed to list reminders: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Listed {len(data)} reminders")
        
        if len(data) > 0:
            # Verify structure of first reminder
            reminder = data[0]
            assert "id" in reminder
            assert "name" in reminder
            assert "enabled" in reminder
    
    # ============= UPDATE REMINDER TESTS =============
    
    def test_update_reminder_toggle_enabled(self, admin_client):
        """PUT /api/task-reminders/{id} updates a reminder (toggle enabled)"""
        # First create a reminder
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:8]}"
        create_resp = admin_client.post(f"{BASE_URL}/api/task-reminders", json={
            "name": unique_name,
            "message": "Will be updated",
            "target_type": "role",
            "target_value": "Chef",
            "enabled": True
        })
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()["id"]
        
        # Update to disable
        update_resp = admin_client.put(f"{BASE_URL}/api/task-reminders/{reminder_id}", json={
            "enabled": False
        })
        assert update_resp.status_code == 200, f"Failed to update: {update_resp.text}"
        
        # Verify by fetching list
        list_resp = admin_client.get(f"{BASE_URL}/api/task-reminders")
        reminders = list_resp.json()
        updated = next((r for r in reminders if r["id"] == reminder_id), None)
        assert updated is not None
        assert updated["enabled"] == False
        print(f"✓ Updated reminder {reminder_id} - enabled toggled to False")
    
    def test_update_reminder_change_interval(self, admin_client):
        """PUT /api/task-reminders/{id} can update interval_hours"""
        # First create a reminder
        unique_name = f"TEST_Interval_{uuid.uuid4().hex[:8]}"
        create_resp = admin_client.post(f"{BASE_URL}/api/task-reminders", json={
            "name": unique_name,
            "message": "Interval test",
            "target_type": "role",
            "target_value": "Cashier",
            "interval_hours": 2
        })
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()["id"]
        
        # Update interval
        update_resp = admin_client.put(f"{BASE_URL}/api/task-reminders/{reminder_id}", json={
            "interval_hours": 4,
            "name": "Updated Interval Name"
        })
        assert update_resp.status_code == 200
        
        # Verify
        list_resp = admin_client.get(f"{BASE_URL}/api/task-reminders")
        updated = next((r for r in list_resp.json() if r["id"] == reminder_id), None)
        assert updated["interval_hours"] == 4
        assert updated["name"] == "Updated Interval Name"
        print("✓ Updated reminder interval_hours and name")
    
    def test_update_nonexistent_reminder_returns_404(self, admin_client):
        """PUT /api/task-reminders/{id} with invalid id returns 404"""
        response = admin_client.put(f"{BASE_URL}/api/task-reminders/nonexistent-id-xyz", json={
            "enabled": False
        })
        assert response.status_code == 404
        print("✓ Update nonexistent reminder returns 404")
    
    # ============= DELETE REMINDER TESTS =============
    
    def test_delete_reminder(self, admin_client):
        """DELETE /api/task-reminders/{id} deletes a reminder"""
        # First create a reminder to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:8]}"
        create_resp = admin_client.post(f"{BASE_URL}/api/task-reminders", json={
            "name": unique_name,
            "message": "Will be deleted",
            "target_type": "role",
            "target_value": "Cleaner"
        })
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()["id"]
        
        # Delete
        delete_resp = admin_client.delete(f"{BASE_URL}/api/task-reminders/{reminder_id}")
        assert delete_resp.status_code == 200, f"Failed to delete: {delete_resp.text}"
        
        # Verify deleted - should not appear in list
        list_resp = admin_client.get(f"{BASE_URL}/api/task-reminders")
        reminders = list_resp.json()
        deleted = next((r for r in reminders if r["id"] == reminder_id), None)
        assert deleted is None
        print(f"✓ Deleted reminder {reminder_id}")
    
    def test_delete_nonexistent_reminder_returns_404(self, admin_client):
        """DELETE /api/task-reminders/{id} with invalid id returns 404"""
        response = admin_client.delete(f"{BASE_URL}/api/task-reminders/nonexistent-id-xyz")
        assert response.status_code == 404
        print("✓ Delete nonexistent reminder returns 404")
    
    # ============= ACKNOWLEDGE TESTS =============
    
    def test_acknowledge_reminder(self, admin_client):
        """POST /api/task-reminders/{id}/acknowledge records acknowledgement"""
        # First create a reminder
        unique_name = f"TEST_Ack_{uuid.uuid4().hex[:8]}"
        create_resp = admin_client.post(f"{BASE_URL}/api/task-reminders", json={
            "name": unique_name,
            "message": "Acknowledge test",
            "target_type": "role",
            "target_value": "Waiter"
        })
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()["id"]
        
        # Acknowledge
        ack_resp = admin_client.post(f"{BASE_URL}/api/task-reminders/{reminder_id}/acknowledge")
        assert ack_resp.status_code == 200, f"Failed to acknowledge: {ack_resp.text}"
        
        data = ack_resp.json()
        assert "message" in data
        print(f"✓ Acknowledged reminder {reminder_id}")
    
    # ============= ACKNOWLEDGEMENTS LIST TESTS =============
    
    def test_get_acknowledgements_for_reminder(self, admin_client):
        """GET /api/task-reminders/acknowledgements/{id} returns ack list"""
        # First create and acknowledge a reminder
        unique_name = f"TEST_AckList_{uuid.uuid4().hex[:8]}"
        create_resp = admin_client.post(f"{BASE_URL}/api/task-reminders", json={
            "name": unique_name,
            "message": "Ack list test",
            "target_type": "role",
            "target_value": "Chef"
        })
        assert create_resp.status_code == 200
        reminder_id = create_resp.json()["id"]
        
        # Acknowledge it
        admin_client.post(f"{BASE_URL}/api/task-reminders/{reminder_id}/acknowledge")
        
        # Get acknowledgements
        ack_list_resp = admin_client.get(f"{BASE_URL}/api/task-reminders/acknowledgements/{reminder_id}")
        assert ack_list_resp.status_code == 200, f"Failed to get acks: {ack_list_resp.text}"
        
        data = ack_list_resp.json()
        assert isinstance(data, list)
        if len(data) > 0:
            ack = data[0]
            assert "employee_id" in ack or "employee_name" in ack
            assert "acknowledged_at" in ack
        print(f"✓ Got {len(data)} acknowledgements for reminder {reminder_id}")
    
    # ============= MY REMINDERS TESTS =============
    
    def test_get_my_reminders_employee(self, employee_client):
        """GET /api/task-reminders/my-reminders returns reminders for current employee"""
        response = employee_client.get(f"{BASE_URL}/api/task-reminders/my-reminders")
        assert response.status_code == 200, f"Failed to get my reminders: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Employee has {len(data)} assigned reminders")
        
        # If employee has reminders, check structure
        if len(data) > 0:
            reminder = data[0]
            assert "id" in reminder
            assert "name" in reminder
            assert "message" in reminder
    
    def test_get_my_reminders_admin(self, admin_client):
        """GET /api/task-reminders/my-reminders works for admin too"""
        response = admin_client.get(f"{BASE_URL}/api/task-reminders/my-reminders")
        # Should return 200 even if empty (admin may not have employee profile)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Admin my-reminders returned {len(data)} reminders")
    
    # ============= HISTORY TESTS =============
    
    def test_get_reminder_history(self, admin_client):
        """GET /api/task-reminders/history returns alert history"""
        response = admin_client.get(f"{BASE_URL}/api/task-reminders/history")
        assert response.status_code == 200, f"Failed to get history: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} history entries")
        
        # Check structure if not empty
        if len(data) > 0:
            entry = data[0]
            assert "reminder_id" in entry or "reminder_name" in entry
            assert "sent_at" in entry
    
    def test_get_reminder_history_with_limit(self, admin_client):
        """GET /api/task-reminders/history?limit=10 respects limit"""
        response = admin_client.get(f"{BASE_URL}/api/task-reminders/history?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 10
        print(f"✓ History with limit=10 returned {len(data)} entries")


class TestTaskRemindersCleanup:
    """Cleanup test-created reminders"""
    
    @pytest.fixture(scope="class")
    def admin_client(self):
        """Get admin client for cleanup"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed for cleanup")
        token = response.json().get("access_token")
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        return session
    
    def test_cleanup_test_reminders(self, admin_client):
        """Clean up TEST_ prefixed reminders"""
        response = admin_client.get(f"{BASE_URL}/api/task-reminders")
        if response.status_code != 200:
            pytest.skip("Could not fetch reminders for cleanup")
        
        reminders = response.json()
        test_reminders = [r for r in reminders if r.get("name", "").startswith("TEST_")]
        
        deleted = 0
        for reminder in test_reminders:
            del_resp = admin_client.delete(f"{BASE_URL}/api/task-reminders/{reminder['id']}")
            if del_resp.status_code == 200:
                deleted += 1
        
        print(f"✓ Cleaned up {deleted} test reminders")
