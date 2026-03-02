"""
Password Management Features - Iteration 57
Tests for: Admin reset password, Forgot password, Change password (forced), must_change_password flag
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


class TestPasswordManagement:
    """Password management endpoint tests"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Get admin token and create test user"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        self.admin_token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
        
        yield
        
        # Cleanup is done in individual tests where needed

    def test_01_api_health(self):
        """Test API is accessible"""
        response = self.session.get(f"{BASE_URL}/api/auth/seed-admin")
        assert response.status_code == 200
        print("API Health: PASS")

    def test_02_admin_login_returns_must_change_password_field(self):
        """Verify login response includes must_change_password field"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "must_change_password" in data, "must_change_password field missing from login response"
        assert isinstance(data["must_change_password"], bool)
        print(f"Login must_change_password field: {data['must_change_password']} - PASS")

    def test_03_create_test_user_for_password_reset(self):
        """Create a test user for password reset testing"""
        test_email = f"TEST_pwreset_{uuid.uuid4().hex[:8]}@test.com"
        response = self.session.post(f"{BASE_URL}/api/users", json={
            "email": test_email,
            "password": "originalpass123",
            "name": "Password Reset Test User",
            "role": "operator"
        })
        assert response.status_code == 200, f"Failed to create test user: {response.text}"
        user = response.json()
        assert user["email"] == test_email
        # Store for later tests
        self.__class__.test_user_id = user["id"]
        self.__class__.test_user_email = test_email
        print(f"Test user created: {test_email} - PASS")

    def test_04_admin_reset_password_success(self):
        """Admin can reset a user's password"""
        user_id = getattr(self.__class__, 'test_user_id', None)
        if not user_id:
            pytest.skip("Test user not created")
        
        response = self.session.put(f"{BASE_URL}/api/users/{user_id}/reset-password", json={
            "new_password": "newresetpass123",
            "must_change_on_login": True
        })
        assert response.status_code == 200, f"Reset failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "must" in data["message"].lower() or "reset" in data["message"].lower()
        print(f"Admin reset password: PASS - {data['message']}")

    def test_05_user_login_shows_must_change_password_true(self):
        """After admin reset with force change, user login should show must_change_password=true"""
        test_email = getattr(self.__class__, 'test_user_email', None)
        if not test_email:
            pytest.skip("Test user not created")
        
        # Login with new password
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "newresetpass123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["must_change_password"] == True, f"Expected must_change_password=True, got {data.get('must_change_password')}"
        self.__class__.test_user_token = data["access_token"]
        print("User login shows must_change_password=True - PASS")

    def test_06_user_can_change_password_forced(self):
        """User with must_change_password=true can change password without current password"""
        token = getattr(self.__class__, 'test_user_token', None)
        if not token:
            pytest.skip("Test user token not available")
        
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/auth/change-password", 
            headers=headers,
            json={
                "current_password": None,  # Not required for forced change
                "new_password": "finalpassword123"
            }
        )
        assert response.status_code == 200, f"Change password failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "success" in data["message"].lower()
        print("Forced password change: PASS")

    def test_07_after_change_must_change_password_is_false(self):
        """After changing password, must_change_password should be false"""
        test_email = getattr(self.__class__, 'test_user_email', None)
        if not test_email:
            pytest.skip("Test user not created")
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "finalpassword123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["must_change_password"] == False, f"Expected must_change_password=False after change, got {data.get('must_change_password')}"
        print("After change, must_change_password=False - PASS")

    def test_08_admin_reset_without_force_change(self):
        """Admin can reset password without forcing change on login"""
        user_id = getattr(self.__class__, 'test_user_id', None)
        if not user_id:
            pytest.skip("Test user not created")
        
        response = self.session.put(f"{BASE_URL}/api/users/{user_id}/reset-password", json={
            "new_password": "noforcedchange123",
            "must_change_on_login": False
        })
        assert response.status_code == 200, f"Reset failed: {response.text}"
        data = response.json()
        assert "does not need" in data["message"].lower() or "reset" in data["message"].lower()
        print(f"Admin reset without force: PASS - {data['message']}")

    def test_09_login_without_forced_change_shows_false(self):
        """Login after reset without force shows must_change_password=false"""
        test_email = getattr(self.__class__, 'test_user_email', None)
        if not test_email:
            pytest.skip("Test user not created")
        
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "noforcedchange123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data["must_change_password"] == False, f"Expected must_change_password=False, got {data.get('must_change_password')}"
        print("Login without forced change shows false - PASS")

    def test_10_reset_password_invalid_user(self):
        """Admin reset for non-existent user returns 404"""
        response = self.session.put(f"{BASE_URL}/api/users/nonexistent-user-id/reset-password", json={
            "new_password": "newpass123",
            "must_change_on_login": False
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Reset password invalid user - PASS (404)")

    def test_11_reset_password_short_password(self):
        """Admin reset with too short password returns 400"""
        user_id = getattr(self.__class__, 'test_user_id', None)
        if not user_id:
            pytest.skip("Test user not created")
        
        response = self.session.put(f"{BASE_URL}/api/users/{user_id}/reset-password", json={
            "new_password": "123",
            "must_change_on_login": False
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Reset with short password - PASS (400)")

    def test_12_forgot_password_endpoint(self):
        """Forgot password endpoint works (returns success for any email)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": ADMIN_EMAIL
        })
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        data = response.json()
        assert "message" in data
        # Should return success message without revealing if email exists
        assert "reset link" in data["message"].lower() or "email" in data["message"].lower()
        print(f"Forgot password endpoint: PASS - {data['message']}")

    def test_13_forgot_password_nonexistent_email(self):
        """Forgot password for non-existent email still returns success (prevent enumeration)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@email.com"
        })
        assert response.status_code == 200, f"Expected 200 even for non-existent email, got {response.status_code}"
        data = response.json()
        assert "message" in data
        print("Forgot password non-existent email (still 200 for security) - PASS")

    def test_14_validate_reset_token_invalid(self):
        """Invalid reset token returns valid=false"""
        response = requests.get(f"{BASE_URL}/api/auth/validate-reset-token/invalidtoken123")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] == False
        print("Validate invalid reset token - PASS")

    def test_15_reset_password_with_invalid_token(self):
        """Reset password with invalid token returns 400"""
        response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
            "token": "invalidtoken123",
            "new_password": "newpassword123"
        })
        assert response.status_code == 400
        print("Reset password invalid token - PASS (400)")

    def test_16_change_password_requires_current_for_non_forced(self):
        """User without must_change_password must provide current password"""
        test_email = getattr(self.__class__, 'test_user_email', None)
        if not test_email:
            pytest.skip("Test user not created")
        
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "noforcedchange123"
        })
        token = login_resp.json().get("access_token")
        
        # Try to change without current password
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers=headers,
            json={
                "current_password": None,
                "new_password": "anotherpassword"
            }
        )
        # Should fail because current_password required when not forced
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Change password requires current for non-forced - PASS (400)")

    def test_17_change_password_with_correct_current(self):
        """User can change password with correct current password"""
        test_email = getattr(self.__class__, 'test_user_email', None)
        if not test_email:
            pytest.skip("Test user not created")
        
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "noforcedchange123"
        })
        token = login_resp.json().get("access_token")
        
        # Change with current password
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers=headers,
            json={
                "current_password": "noforcedchange123",
                "new_password": "userchanged123"
            }
        )
        assert response.status_code == 200, f"Change password failed: {response.text}"
        print("Change password with current - PASS")

    def test_18_change_password_wrong_current(self):
        """Change password with wrong current password returns 401"""
        test_email = getattr(self.__class__, 'test_user_email', None)
        if not test_email:
            pytest.skip("Test user not created")
        
        # Login first
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "userchanged123"
        })
        token = login_resp.json().get("access_token")
        
        # Try with wrong current password
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        response = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers=headers,
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Change password wrong current - PASS (401)")

    def test_19_non_admin_cannot_reset_password(self):
        """Non-admin user cannot access reset password endpoint"""
        test_email = getattr(self.__class__, 'test_user_email', None)
        if not test_email:
            pytest.skip("Test user not created")
        
        # Login as test user
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "userchanged123"
        })
        token = login_resp.json().get("access_token")
        
        # Try to reset another user's password
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        response = requests.put(f"{BASE_URL}/api/users/some-user-id/reset-password",
            headers=headers,
            json={
                "new_password": "hackpassword123",
                "must_change_on_login": False
            }
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("Non-admin cannot reset password - PASS (403)")

    def test_20_cleanup_test_user(self):
        """Cleanup: Delete test user"""
        user_id = getattr(self.__class__, 'test_user_id', None)
        if not user_id:
            pytest.skip("No test user to cleanup")
        
        response = self.session.delete(f"{BASE_URL}/api/users/{user_id}")
        assert response.status_code == 200
        print("Test user cleanup - PASS")

    def test_21_verify_must_change_pw_badge_data(self):
        """Verify users endpoint returns must_change_password field"""
        # Get users list
        response = self.session.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        users = response.json()
        # Check that at least one user has must_change_password field defined
        for user in users:
            assert "must_change_password" in user or user.get("role") == "admin", \
                f"User {user.get('email')} missing must_change_password field"
        print("Users endpoint includes must_change_password field - PASS")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
