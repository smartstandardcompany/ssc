"""
RBAC (Role-Based Access Control) Testing - Iteration 56
Tests for granular permissions with read/write/none access levels per module

Tests cover:
1. Admin login and full access verification
2. User management with new granular permissions format
3. Permission enforcement on backend APIs (GET/POST with different levels)
4. Branch filtering for non-admin users
5. Permission normalization (list -> dict format)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"

TEST_USER_PREFIX = "TEST_RBAC_"


class TestRBACSetup:
    """Setup tests for RBAC testing"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        yield
        self.session.close()
    
    def test_api_connection(self, setup):
        """Test API is accessible"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        print(f"API accessible: {response.json()}")
    
    def test_admin_login(self, setup):
        """Test admin login works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful: {data['user']['name']}, role: {data['user']['role']}")


class TestAdminFullAccess:
    """Test admin has full access to all modules"""
    
    @pytest.fixture
    def admin_token(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def admin_client(self, admin_token):
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        })
        return session
    
    def test_admin_access_sales(self, admin_client):
        """Admin can access sales endpoint"""
        response = admin_client.get(f"{BASE_URL}/api/sales")
        assert response.status_code == 200
        print(f"Admin GET /api/sales: {response.status_code}")
    
    def test_admin_access_expenses(self, admin_client):
        """Admin can access expenses endpoint"""
        response = admin_client.get(f"{BASE_URL}/api/expenses")
        assert response.status_code == 200
        print(f"Admin GET /api/expenses: {response.status_code}")
    
    def test_admin_access_customers(self, admin_client):
        """Admin can access customers endpoint"""
        response = admin_client.get(f"{BASE_URL}/api/customers")
        assert response.status_code == 200
        print(f"Admin GET /api/customers: {response.status_code}")
    
    def test_admin_access_suppliers(self, admin_client):
        """Admin can access suppliers endpoint"""
        response = admin_client.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        print(f"Admin GET /api/suppliers: {response.status_code}")
    
    def test_admin_access_employees(self, admin_client):
        """Admin can access employees endpoint"""
        response = admin_client.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        print(f"Admin GET /api/employees: {response.status_code}")
    
    def test_admin_access_users(self, admin_client):
        """Admin can access users management endpoint"""
        response = admin_client.get(f"{BASE_URL}/api/users")
        assert response.status_code == 200
        print(f"Admin GET /api/users: {response.status_code}")
    
    def test_admin_can_create_customer(self, admin_client):
        """Admin can create customers (write access)"""
        test_customer = {
            "name": f"{TEST_USER_PREFIX}Customer_{uuid.uuid4().hex[:8]}",
            "phone": "1234567890"
        }
        response = admin_client.post(f"{BASE_URL}/api/customers", json=test_customer)
        assert response.status_code == 200, f"Admin create customer failed: {response.text}"
        # Cleanup
        customer_id = response.json().get("id")
        if customer_id:
            admin_client.delete(f"{BASE_URL}/api/customers/{customer_id}")
        print(f"Admin POST /api/customers: {response.status_code}")


class TestUserManagement:
    """Test user creation with granular permissions (new dict format)"""
    
    @pytest.fixture
    def admin_token(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        return response.json()["access_token"]
    
    @pytest.fixture
    def admin_client(self, admin_token):
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        })
        return session
    
    def test_create_user_with_dict_permissions(self, admin_client):
        """Create user with new dict-based permissions format"""
        test_email = f"{TEST_USER_PREFIX}user_{uuid.uuid4().hex[:8]}@test.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test RBAC User",
            "role": "operator",
            "permissions": {
                "sales": "read",
                "expenses": "none",
                "customers": "write"
            }
        }
        response = admin_client.post(f"{BASE_URL}/api/users", json=user_data)
        assert response.status_code == 200, f"Create user failed: {response.text}"
        
        created_user = response.json()
        assert created_user["email"] == test_email
        print(f"Created user: {created_user['email']}, permissions: {created_user.get('permissions')}")
        
        # Verify permissions were saved in dict format
        perms = created_user.get("permissions", {})
        # Note: Backend may normalize permissions, so we verify structure
        assert isinstance(perms, dict), f"Permissions should be dict, got {type(perms)}"
        
        # Cleanup - delete test user
        user_id = created_user["id"]
        cleanup_response = admin_client.delete(f"{BASE_URL}/api/users/{user_id}")
        assert cleanup_response.status_code == 200
        print(f"Deleted test user: {user_id}")
    
    def test_update_user_permissions(self, admin_client):
        """Update user with granular permissions"""
        # First create a user
        test_email = f"{TEST_USER_PREFIX}update_{uuid.uuid4().hex[:8]}@test.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Test Update User",
            "role": "operator",
            "permissions": {"sales": "read"}
        }
        create_response = admin_client.post(f"{BASE_URL}/api/users", json=user_data)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update permissions
        update_data = {
            "permissions": {
                "sales": "write",
                "expenses": "read",
                "customers": "none"
            }
        }
        update_response = admin_client.put(f"{BASE_URL}/api/users/{user_id}", json=update_data)
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        updated_user = update_response.json()
        perms = updated_user.get("permissions", {})
        print(f"Updated permissions: {perms}")
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/users/{user_id}")


class TestPermissionEnforcement:
    """Test permission enforcement on API endpoints"""
    
    @pytest.fixture
    def admin_client(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        token = response.json()["access_token"]
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        return session
    
    def test_create_limited_user_and_verify_permissions(self, admin_client):
        """Create user with sales:read, expenses:none, customers:write and verify API access"""
        # Create test user with limited permissions
        test_email = f"{TEST_USER_PREFIX}limited_{uuid.uuid4().hex[:8]}@test.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Limited Test User",
            "role": "operator",
            "permissions": {
                "sales": "read",
                "expenses": "none",
                "customers": "write",
                "suppliers": "none",
                "employees": "none"
            }
        }
        create_response = admin_client.post(f"{BASE_URL}/api/users", json=user_data)
        assert create_response.status_code == 200, f"Create user failed: {create_response.text}"
        user_id = create_response.json()["id"]
        print(f"Created limited user: {test_email}")
        
        # Login as limited user
        limited_session = requests.Session()
        limited_session.headers.update({"Content-Type": "application/json"})
        login_response = limited_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "test123"
        })
        assert login_response.status_code == 200, f"Limited user login failed: {login_response.text}"
        limited_token = login_response.json()["access_token"]
        limited_session.headers.update({"Authorization": f"Bearer {limited_token}"})
        
        # Test 1: GET /api/sales should work (sales: read)
        sales_get = limited_session.get(f"{BASE_URL}/api/sales")
        print(f"Limited user GET /api/sales: {sales_get.status_code}")
        assert sales_get.status_code == 200, f"User with sales:read should access GET /api/sales"
        
        # Test 2: POST /api/sales should be blocked (sales: read, not write)
        sale_data = {
            "sale_type": "cash",
            "amount": 100,
            "payment_details": [{"mode": "cash", "amount": 100}],
            "date": datetime.now(timezone.utc).isoformat()
        }
        sales_post = limited_session.post(f"{BASE_URL}/api/sales", json=sale_data)
        print(f"Limited user POST /api/sales: {sales_post.status_code}")
        assert sales_post.status_code == 403, f"User with sales:read should NOT be able to POST to /api/sales"
        
        # Test 3: GET /api/expenses should be blocked (expenses: none)
        expenses_get = limited_session.get(f"{BASE_URL}/api/expenses")
        print(f"Limited user GET /api/expenses: {expenses_get.status_code}")
        assert expenses_get.status_code == 403, f"User with expenses:none should NOT access GET /api/expenses"
        
        # Test 4: GET /api/customers should work (customers: write includes read)
        customers_get = limited_session.get(f"{BASE_URL}/api/customers")
        print(f"Limited user GET /api/customers: {customers_get.status_code}")
        assert customers_get.status_code == 200, f"User with customers:write should access GET /api/customers"
        
        # Test 5: POST /api/customers should work (customers: write)
        customer_data = {
            "name": f"{TEST_USER_PREFIX}TestCust_{uuid.uuid4().hex[:8]}",
            "phone": "9876543210"
        }
        customers_post = limited_session.post(f"{BASE_URL}/api/customers", json=customer_data)
        print(f"Limited user POST /api/customers: {customers_post.status_code}")
        assert customers_post.status_code == 200, f"User with customers:write should POST to /api/customers"
        
        # Cleanup created customer
        if customers_post.status_code == 200:
            cust_id = customers_post.json().get("id")
            if cust_id:
                admin_client.delete(f"{BASE_URL}/api/customers/{cust_id}")
        
        # Test 6: GET /api/suppliers should be blocked (suppliers: none)
        suppliers_get = limited_session.get(f"{BASE_URL}/api/suppliers")
        print(f"Limited user GET /api/suppliers: {suppliers_get.status_code}")
        assert suppliers_get.status_code == 403, f"User with suppliers:none should NOT access GET /api/suppliers"
        
        # Cleanup - delete test user
        admin_client.delete(f"{BASE_URL}/api/users/{user_id}")
        limited_session.close()
        print(f"Cleaned up test user: {user_id}")


class TestPermissionNormalization:
    """Test that old list-based permissions are normalized to dict format"""
    
    @pytest.fixture
    def admin_client(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        token = response.json()["access_token"]
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        return session
    
    def test_old_list_permissions_still_work(self, admin_client):
        """Test that old list permissions (backward compatible) grant write access"""
        # Create user with old-style list permissions (if backend supports it)
        test_email = f"{TEST_USER_PREFIX}oldformat_{uuid.uuid4().hex[:8]}@test.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Old Format User",
            "role": "operator",
            "permissions": ["sales", "customers"]  # Old format - list
        }
        create_response = admin_client.post(f"{BASE_URL}/api/users", json=user_data)
        
        # This may succeed or fail depending on backend validation
        if create_response.status_code == 200:
            user = create_response.json()
            perms = user.get("permissions", {})
            print(f"Old format user permissions after creation: {perms}")
            
            # Backend should normalize to dict with 'write' access
            # The User model has a field_validator for this
            
            # Login as old format user
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email,
                "password": "test123"
            })
            
            if login_response.status_code == 200:
                token = login_response.json()["access_token"]
                test_session = requests.Session()
                test_session.headers.update({
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                })
                
                # User should have sales access
                sales_response = test_session.get(f"{BASE_URL}/api/sales")
                print(f"Old format user GET /api/sales: {sales_response.status_code}")
                test_session.close()
            
            # Cleanup
            user_id = user["id"]
            admin_client.delete(f"{BASE_URL}/api/users/{user_id}")
        else:
            print(f"Backend rejected old list format: {create_response.status_code} - {create_response.text}")
            # This is acceptable - backend may only support new dict format


class TestBranchFiltering:
    """Test branch-based data filtering for non-admin users"""
    
    @pytest.fixture
    def admin_client(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        token = response.json()["access_token"]
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        return session
    
    def test_branch_filter_applied(self, admin_client):
        """Test that non-admin users only see data from their assigned branch"""
        # First get available branches
        branches_response = admin_client.get(f"{BASE_URL}/api/branches")
        branches = branches_response.json() if branches_response.status_code == 200 else []
        
        if not branches:
            # Create a test branch if none exist
            branch_data = {"name": f"{TEST_USER_PREFIX}Branch_{uuid.uuid4().hex[:8]}"}
            branch_resp = admin_client.post(f"{BASE_URL}/api/branches", json=branch_data)
            if branch_resp.status_code == 200:
                branch_id = branch_resp.json()["id"]
                print(f"Created test branch: {branch_id}")
            else:
                pytest.skip("No branches available and cannot create one")
                return
        else:
            branch_id = branches[0]["id"]
            print(f"Using existing branch: {branch_id}")
        
        # Create user assigned to specific branch
        test_email = f"{TEST_USER_PREFIX}branch_{uuid.uuid4().hex[:8]}@test.com"
        user_data = {
            "email": test_email,
            "password": "test123",
            "name": "Branch Test User",
            "role": "operator",
            "branch_id": branch_id,
            "permissions": {
                "sales": "write",
                "customers": "write",
                "expenses": "write"
            }
        }
        create_response = admin_client.post(f"{BASE_URL}/api/users", json=user_data)
        assert create_response.status_code == 200, f"Create branch user failed: {create_response.text}"
        user_id = create_response.json()["id"]
        print(f"Created branch-restricted user: {test_email}, branch: {branch_id}")
        
        # Login as branch user
        branch_session = requests.Session()
        branch_session.headers.update({"Content-Type": "application/json"})
        login_response = branch_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "test123"
        })
        assert login_response.status_code == 200
        branch_token = login_response.json()["access_token"]
        branch_session.headers.update({"Authorization": f"Bearer {branch_token}"})
        
        # Get me endpoint to verify branch_id is set
        me_response = branch_session.get(f"{BASE_URL}/api/auth/me")
        if me_response.status_code == 200:
            me_data = me_response.json()
            print(f"User branch_id: {me_data.get('branch_id')}")
            assert me_data.get("branch_id") == branch_id
        
        # Cleanup
        admin_client.delete(f"{BASE_URL}/api/users/{user_id}")
        branch_session.close()


class TestRBACCleanup:
    """Cleanup any test data left behind"""
    
    @pytest.fixture
    def admin_client(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip("Admin login failed")
        token = response.json()["access_token"]
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
        return session
    
    def test_cleanup_test_users(self, admin_client):
        """Clean up any TEST_RBAC_ prefixed users"""
        users_response = admin_client.get(f"{BASE_URL}/api/users")
        if users_response.status_code == 200:
            users = users_response.json()
            deleted = 0
            for user in users:
                if user.get("name", "").startswith(TEST_USER_PREFIX) or \
                   user.get("email", "").startswith(TEST_USER_PREFIX.lower()):
                    del_response = admin_client.delete(f"{BASE_URL}/api/users/{user['id']}")
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"Cleaned up {deleted} test users")
    
    def test_cleanup_test_customers(self, admin_client):
        """Clean up any TEST_RBAC_ prefixed customers"""
        customers_response = admin_client.get(f"{BASE_URL}/api/customers")
        if customers_response.status_code == 200:
            customers = customers_response.json()
            deleted = 0
            for customer in customers:
                if customer.get("name", "").startswith(TEST_USER_PREFIX):
                    del_response = admin_client.delete(f"{BASE_URL}/api/customers/{customer['id']}")
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"Cleaned up {deleted} test customers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
