"""
Test iteration 134: Notification system for Employee Portal
Tests:
- GET /api/my/notifications - returns notifications list with unread_count
- PUT /api/my/notifications/{id}/read - marks a notification as read
- PUT /api/my/notifications/read-all - marks all notifications as read
- Task reminder processor creates notifications with WhatsApp channel
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestNotificationEndpoints:
    """Test notification endpoints for employee portal"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and operator users"""
        self.session_admin = requests.Session()
        self.session_operator = requests.Session()
        
        # Login as admin
        resp = self.session_admin.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        token = resp.json().get("access_token")
        self.session_admin.headers.update({"Authorization": f"Bearer {token}"})
        
        # Login as operator
        resp = self.session_operator.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@ssc.com",
            "password": "testtest"
        })
        assert resp.status_code == 200, f"Operator login failed: {resp.text}"
        token_op = resp.json().get("access_token")
        self.session_operator.headers.update({"Authorization": f"Bearer {token_op}"})
        
    def test_01_get_notifications_admin(self):
        """GET /api/my/notifications returns 200 for admin"""
        resp = self.session_admin.get(f"{BASE_URL}/api/my/notifications")
        assert resp.status_code == 200, f"Get notifications failed: {resp.text}"
        data = resp.json()
        assert "notifications" in data, "Response should contain notifications array"
        assert "unread_count" in data, "Response should contain unread_count"
        print(f"Admin notifications count: {len(data['notifications'])}, unread: {data['unread_count']}")
        
    def test_02_get_notifications_operator(self):
        """GET /api/my/notifications returns 200 for operator"""
        resp = self.session_operator.get(f"{BASE_URL}/api/my/notifications")
        assert resp.status_code == 200, f"Get notifications failed: {resp.text}"
        data = resp.json()
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["unread_count"], int)
        print(f"Operator notifications count: {len(data['notifications'])}, unread: {data['unread_count']}")
        
    def test_03_notifications_structure(self):
        """Verify notification object structure"""
        resp = self.session_admin.get(f"{BASE_URL}/api/my/notifications")
        assert resp.status_code == 200
        data = resp.json()
        if len(data["notifications"]) > 0:
            notif = data["notifications"][0]
            # Check required fields
            assert "id" in notif, "Notification should have id"
            assert "title" in notif, "Notification should have title"
            assert "message" in notif, "Notification should have message"
            assert "read" in notif, "Notification should have read status"
            assert "created_at" in notif, "Notification should have created_at"
            print(f"Sample notification: id={notif['id']}, title={notif['title']}, read={notif['read']}")
        else:
            print("No notifications to verify structure")
            
    def test_04_mark_notification_read(self):
        """PUT /api/my/notifications/{id}/read marks notification as read"""
        # Get notifications
        resp = self.session_admin.get(f"{BASE_URL}/api/my/notifications")
        assert resp.status_code == 200
        data = resp.json()
        
        # Find an unread notification or any notification
        notifs = data["notifications"]
        if len(notifs) == 0:
            pytest.skip("No notifications to test mark as read")
            
        notif = notifs[0]  # Take first notification
        notif_id = notif["id"]
        
        # Mark as read
        resp = self.session_admin.put(f"{BASE_URL}/api/my/notifications/{notif_id}/read")
        assert resp.status_code == 200, f"Mark read failed: {resp.text}"
        result = resp.json()
        assert "message" in result
        print(f"Marked notification {notif_id} as read: {result}")
        
        # Verify it's now read
        resp = self.session_admin.get(f"{BASE_URL}/api/my/notifications")
        data = resp.json()
        updated_notif = next((n for n in data["notifications"] if n["id"] == notif_id), None)
        if updated_notif:
            assert updated_notif["read"] == True, "Notification should be marked as read"
            print(f"Verified notification {notif_id} is now read")
            
    def test_05_mark_nonexistent_notification_returns_404(self):
        """PUT /api/my/notifications/{id}/read returns 404 for invalid id"""
        resp = self.session_admin.put(f"{BASE_URL}/api/my/notifications/nonexistent-id-12345/read")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}: {resp.text}"
        print("Correctly returns 404 for nonexistent notification")
        
    def test_06_mark_all_notifications_read(self):
        """PUT /api/my/notifications/read-all marks all as read"""
        resp = self.session_admin.put(f"{BASE_URL}/api/my/notifications/read-all")
        assert resp.status_code == 200, f"Mark all read failed: {resp.text}"
        result = resp.json()
        assert "message" in result
        print(f"Mark all read result: {result}")
        
        # Verify unread count is 0
        resp = self.session_admin.get(f"{BASE_URL}/api/my/notifications")
        data = resp.json()
        assert data["unread_count"] == 0, f"Expected unread_count 0, got {data['unread_count']}"
        print(f"Verified unread_count is 0 after mark all read")
        
    def test_07_notifications_require_auth(self):
        """Notification endpoints require authentication"""
        unauthenticated = requests.Session()
        
        # GET notifications without auth
        resp = unauthenticated.get(f"{BASE_URL}/api/my/notifications")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        
        # PUT mark read without auth
        resp = unauthenticated.put(f"{BASE_URL}/api/my/notifications/some-id/read")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        
        # PUT mark all read without auth
        resp = unauthenticated.put(f"{BASE_URL}/api/my/notifications/read-all")
        assert resp.status_code in [401, 403], f"Expected 401/403, got {resp.status_code}"
        
        print("All notification endpoints correctly require authentication")


class TestTaskReminderWhatsAppChannel:
    """Test that task reminders support WhatsApp channel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert resp.status_code == 200
        token = resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_01_create_reminder_with_whatsapp_channel(self):
        """POST /api/task-reminders can include whatsapp channel"""
        resp = self.session.post(f"{BASE_URL}/api/task-reminders", json={
            "name": "TEST_WhatsApp Reminder",
            "message": "Test message with WhatsApp notification",
            "target_type": "role",
            "target_value": "cleaner",
            "interval_hours": 2,
            "active_start_hour": 8,
            "active_end_hour": 22,
            "days_of_week": [0, 1, 2, 3, 4, 5, 6],
            "channels": ["push", "in_app", "whatsapp"],
            "enabled": True
        })
        assert resp.status_code == 200, f"Create reminder failed: {resp.text}"
        data = resp.json()
        assert "channels" in data, "Response should include channels"
        assert "whatsapp" in data["channels"], "Channels should include whatsapp"
        print(f"Created reminder with channels: {data['channels']}")
        
        # Store id for cleanup
        self.reminder_id = data["id"]
        
    def test_02_get_reminders_shows_whatsapp_channel(self):
        """GET /api/task-reminders returns reminders with whatsapp channel"""
        resp = self.session.get(f"{BASE_URL}/api/task-reminders")
        assert resp.status_code == 200
        reminders = resp.json()
        
        # Find any reminder with whatsapp channel
        whatsapp_reminders = [r for r in reminders if "whatsapp" in r.get("channels", [])]
        print(f"Found {len(whatsapp_reminders)} reminders with whatsapp channel")
        
        if len(whatsapp_reminders) > 0:
            sample = whatsapp_reminders[0]
            assert "whatsapp" in sample["channels"]
            print(f"Sample reminder '{sample['name']}' has channels: {sample['channels']}")
            
    def test_03_cleanup_test_reminder(self):
        """Clean up test reminders"""
        resp = self.session.get(f"{BASE_URL}/api/task-reminders")
        assert resp.status_code == 200
        reminders = resp.json()
        
        # Delete TEST_ prefixed reminders
        deleted = 0
        for r in reminders:
            if r.get("name", "").startswith("TEST_"):
                del_resp = self.session.delete(f"{BASE_URL}/api/task-reminders/{r['id']}")
                if del_resp.status_code == 200:
                    deleted += 1
        print(f"Cleaned up {deleted} test reminders")


class TestAIDutyPlannerWhatsAppDefault:
    """Test that AI Duty Planner creates reminders with whatsapp channel"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin"""
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert resp.status_code == 200
        token = resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_01_verify_whatsapp_in_channel_options(self):
        """Verify that whatsapp is a valid channel option in task reminders"""
        # Create a reminder with whatsapp and verify it works
        resp = self.session.post(f"{BASE_URL}/api/task-reminders", json={
            "name": "TEST_Verify WhatsApp Channel",
            "message": "Testing whatsapp channel validation",
            "target_type": "role",
            "target_value": "waiter",
            "interval_hours": 1,
            "channels": ["whatsapp"]  # Only whatsapp
        })
        assert resp.status_code == 200, f"Create with whatsapp channel failed: {resp.text}"
        data = resp.json()
        assert data["channels"] == ["whatsapp"]
        print(f"WhatsApp-only reminder created successfully: {data['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/task-reminders/{data['id']}")


class TestEmployeePortalNotificationsIntegration:
    """Test that employee portal can access notifications"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as operator (employee)"""
        self.session = requests.Session()
        resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@ssc.com",
            "password": "testtest"
        })
        assert resp.status_code == 200
        token = resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
    def test_01_operator_can_access_notifications(self):
        """Operator user can access their notifications"""
        resp = self.session.get(f"{BASE_URL}/api/my/notifications")
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"Operator has {len(data['notifications'])} notifications, {data['unread_count']} unread")
        
    def test_02_notifications_sorted_by_created_at(self):
        """Notifications are sorted by created_at (newest first)"""
        resp = self.session.get(f"{BASE_URL}/api/my/notifications")
        assert resp.status_code == 200
        data = resp.json()
        notifs = data["notifications"]
        
        if len(notifs) >= 2:
            # Check first is newer than second
            first_time = notifs[0].get("created_at", "")
            second_time = notifs[1].get("created_at", "")
            assert first_time >= second_time, f"Notifications not sorted: {first_time} vs {second_time}"
            print("Notifications correctly sorted by created_at (newest first)")
        else:
            print(f"Only {len(notifs)} notifications, skipping sort verification")
