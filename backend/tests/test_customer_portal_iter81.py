"""
Customer Portal API Tests - Iteration 81
Tests for Customer Portal P1 features:
- Customer login and registration
- Profile, orders, statements, invoices, loyalty endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Generate unique test email to avoid conflicts
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@test.com"
TEST_PASSWORD = "test123"
TEST_NAME = "Test Customer Portal User"

class TestCustomerPortalRegistration:
    """Customer Portal registration tests"""
    
    @pytest.fixture(scope="class")
    def registered_customer(self):
        """Register a new customer and return token + data"""
        response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME,
            "phone": "+966501234567"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        return data
    
    def test_register_new_customer(self, registered_customer):
        """Test customer registration creates a new customer with portal access"""
        assert "token" in registered_customer
        assert registered_customer["token"].startswith("cust_")
        assert "customer" in registered_customer
        assert registered_customer["customer"]["email"] == TEST_EMAIL.lower()
        assert registered_customer["customer"]["name"] == TEST_NAME
        print(f"SUCCESS: Customer registered with ID {registered_customer['customer']['id']}")
    
    def test_register_duplicate_email_fails(self, registered_customer):
        """Test registering with same email fails"""
        response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": TEST_EMAIL,
            "password": "newpassword123",
            "name": "Duplicate User"
        })
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        assert "already exists" in response.json().get("detail", "").lower()
        print("SUCCESS: Duplicate registration blocked as expected")


class TestCustomerPortalLogin:
    """Customer Portal login tests"""
    
    @pytest.fixture(scope="class")
    def customer_token(self):
        """Register and get token for authenticated tests"""
        # First register
        test_email = f"login_test_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": test_email,
            "password": TEST_PASSWORD,
            "name": "Login Test User"
        })
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        
        # Now login
        login_response = requests.post(f"{BASE_URL}/api/customer-portal/login", json={
            "email": test_email,
            "password": TEST_PASSWORD
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        data = login_response.json()
        return data["token"], test_email
    
    def test_login_success(self, customer_token):
        """Test successful login returns token"""
        token, email = customer_token
        assert token is not None
        assert token.startswith("cust_")
        print(f"SUCCESS: Login successful for {email}")
    
    def test_login_invalid_password(self):
        """Test login with wrong password fails"""
        # Use a fresh email
        test_email = f"wrongpwd_{uuid.uuid4().hex[:8]}@test.com"
        # Register first
        requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": test_email,
            "password": TEST_PASSWORD,
            "name": "Wrong Password Test"
        })
        
        # Try login with wrong password
        response = requests.post(f"{BASE_URL}/api/customer-portal/login", json={
            "email": test_email,
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Invalid password rejected")
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent email fails"""
        response = requests.post(f"{BASE_URL}/api/customer-portal/login", json={
            "email": "nonexistent@nowhere.com",
            "password": "anypassword"
        })
        assert response.status_code == 401
        print("SUCCESS: Non-existent user login rejected")


class TestCustomerPortalProfile:
    """Customer Portal profile endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for profile tests"""
        test_email = f"profile_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": test_email,
            "password": TEST_PASSWORD,
            "name": "Profile Test User"
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_get_profile_success(self, auth_token):
        """Test getting customer profile with valid token"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/profile?token={auth_token}")
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "email" in data
        assert "credit_balance" in data
        assert "loyalty_points" in data
        assert "loyalty_tier" in data
        print(f"SUCCESS: Profile fetched - {data['name']}, tier: {data['loyalty_tier']}")
    
    def test_get_profile_invalid_token(self):
        """Test getting profile with invalid token fails"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/profile?token=invalid_token")
        assert response.status_code == 401
        print("SUCCESS: Invalid token rejected for profile")


class TestCustomerPortalOrders:
    """Customer Portal orders endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        test_email = f"orders_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": test_email,
            "password": TEST_PASSWORD,
            "name": "Orders Test User"
        })
        return response.json()["token"]
    
    def test_get_orders(self, auth_token):
        """Test getting customer orders"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/orders?token={auth_token}")
        assert response.status_code == 200, f"Orders fetch failed: {response.text}"
        
        data = response.json()
        assert "orders" in data
        assert "total" in data
        assert "page" in data
        assert "total_pages" in data
        assert isinstance(data["orders"], list)
        print(f"SUCCESS: Orders fetched - {data['total']} total orders")
    
    def test_get_orders_pagination(self, auth_token):
        """Test orders pagination"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/orders?token={auth_token}&page=1&limit=5")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 5
        print("SUCCESS: Orders pagination working")


class TestCustomerPortalStatements:
    """Customer Portal statements endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        test_email = f"statements_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": test_email,
            "password": TEST_PASSWORD,
            "name": "Statements Test User"
        })
        return response.json()["token"]
    
    def test_get_statements(self, auth_token):
        """Test getting customer statements"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/statements?token={auth_token}")
        assert response.status_code == 200, f"Statements fetch failed: {response.text}"
        
        data = response.json()
        assert "customer_name" in data
        assert "current_balance" in data
        assert "transactions" in data
        assert isinstance(data["transactions"], list)
        print(f"SUCCESS: Statements fetched - balance: {data['current_balance']}")
    
    def test_get_statements_with_date_filter(self, auth_token):
        """Test statements with date filtering"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/statements?token={auth_token}&start_date=2025-01-01&end_date=2026-12-31")
        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert data["period"]["start"] == "2025-01-01"
        print("SUCCESS: Statements date filtering working")


class TestCustomerPortalInvoices:
    """Customer Portal invoices endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        test_email = f"invoices_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": test_email,
            "password": TEST_PASSWORD,
            "name": "Invoices Test User"
        })
        return response.json()["token"]
    
    def test_get_invoices(self, auth_token):
        """Test getting customer invoices"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/invoices?token={auth_token}")
        assert response.status_code == 200, f"Invoices fetch failed: {response.text}"
        
        data = response.json()
        assert "invoices" in data
        assert "total" in data
        assert "page" in data
        assert isinstance(data["invoices"], list)
        print(f"SUCCESS: Invoices fetched - {data['total']} total invoices")


class TestCustomerPortalLoyalty:
    """Customer Portal loyalty endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        test_email = f"loyalty_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": test_email,
            "password": TEST_PASSWORD,
            "name": "Loyalty Test User"
        })
        return response.json()["token"]
    
    def test_get_loyalty_info(self, auth_token):
        """Test getting customer loyalty information"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/loyalty?token={auth_token}")
        assert response.status_code == 200, f"Loyalty fetch failed: {response.text}"
        
        data = response.json()
        assert "current_points" in data
        assert "current_tier" in data
        assert "points_to_next_tier" in data
        assert "history" in data
        print(f"SUCCESS: Loyalty info fetched - {data['current_points']} points, tier: {data['current_tier']}")


class TestCustomerPortalLogout:
    """Customer Portal logout tests"""
    
    def test_logout(self):
        """Test customer logout invalidates token"""
        # Register first
        test_email = f"logout_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/customer-portal/register", json={
            "email": test_email,
            "password": TEST_PASSWORD,
            "name": "Logout Test User"
        })
        token = reg_response.json()["token"]
        
        # Logout
        logout_response = requests.post(f"{BASE_URL}/api/customer-portal/logout?token={token}")
        assert logout_response.status_code == 200
        assert "logged out" in logout_response.json().get("message", "").lower()
        
        # Try to use token after logout - should fail
        profile_response = requests.get(f"{BASE_URL}/api/customer-portal/profile?token={token}")
        assert profile_response.status_code == 401, "Token should be invalidated after logout"
        print("SUCCESS: Logout invalidated token correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
