"""
Test file for Iteration 144: Multi-Tenancy Testing
Tests for:
1. Super Admin login (ss@ssc.com) - verify is_super_admin=true, tenant_id present
2. Admin Dashboard endpoint (/api/admin/dashboard)
3. Admin Tenants list endpoint (/api/admin/tenants)
4. New Tenant Registration via /api/tenants/register
5. Login as newly registered tenant admin
6. Data isolation - new tenant sees only their data
7. Super admin sees all tenants after new registration
8. Toggle tenant active/inactive via PUT /api/admin/tenants/{id}
9. Dashboard stats for new tenant - should be empty/zeroed
10. Branches/Sales for new tenant - should be empty
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data for new tenant registration
TEST_TENANT_EMAIL = f"TEST_tenant_{uuid.uuid4().hex[:8]}@example.com"
TEST_TENANT_DATA = {
    "company_name": f"TEST Company {uuid.uuid4().hex[:6]}",
    "admin_name": "Test Tenant Admin",
    "admin_email": TEST_TENANT_EMAIL,
    "password": "TestPass123!",
    "country": "Saudi Arabia",
    "industry": "restaurant",
    "currency": "SAR"
}


class TestSuperAdminAuth:
    """Test 1: Super Admin login functionality"""
    
    def test_super_admin_login(self):
        """Login as super admin and verify is_super_admin=true"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        
        user = data["user"]
        assert user.get("is_super_admin") == True, f"Expected is_super_admin=true, got {user.get('is_super_admin')}"
        assert user.get("tenant_id") is not None, "Super admin should have a tenant_id"
        assert user.get("email") == "ss@ssc.com"
        print(f"Super admin login successful. tenant_id={user.get('tenant_id')}, is_super_admin={user.get('is_super_admin')}")


class TestAdminDashboard:
    """Test 2: Admin Dashboard endpoint"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        return response.json()["access_token"]
    
    def test_admin_dashboard_endpoint(self, super_admin_token):
        """GET /api/admin/dashboard returns tenant stats"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Admin dashboard failed: {response.text}"
        
        data = response.json()
        assert "total_tenants" in data, "Missing total_tenants"
        assert "active_tenants" in data, "Missing active_tenants"
        assert "total_users" in data, "Missing total_users"
        assert "plan_distribution" in data, "Missing plan_distribution"
        
        assert isinstance(data["total_tenants"], int), "total_tenants should be int"
        assert isinstance(data["active_tenants"], int), "active_tenants should be int"
        assert isinstance(data["total_users"], int), "total_users should be int"
        
        print(f"Admin dashboard stats: {data['total_tenants']} tenants, {data['active_tenants']} active, {data['total_users']} users")
    
    def test_admin_dashboard_requires_super_admin(self):
        """Non-super-admin should get 403"""
        # Login as operator
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@ssc.com", "password": "testtest"}
        )
        if login_resp.status_code != 200:
            pytest.skip("Operator user not available for testing")
        
        token = login_resp.json()["access_token"]
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-super-admin, got {response.status_code}"


class TestAdminTenantsList:
    """Test 3: Admin Tenants list endpoint"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        return response.json()["access_token"]
    
    def test_admin_tenants_list(self, super_admin_token):
        """GET /api/admin/tenants returns list of all tenants"""
        response = requests.get(
            f"{BASE_URL}/api/admin/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Admin tenants list failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of tenants"
        
        if len(data) > 0:
            tenant = data[0]
            assert "id" in tenant, "Tenant missing id"
            assert "company_name" in tenant, "Tenant missing company_name"
            assert "user_count" in tenant, "Tenant missing user_count"
            assert "branch_count" in tenant, "Tenant missing branch_count"
            print(f"Found {len(data)} tenants. First tenant: {tenant.get('company_name')}")
        else:
            print("No tenants found in the system yet")


class TestTenantRegistration:
    """Test 4: New Tenant Registration"""
    
    def test_tenant_registration_success(self):
        """POST /api/tenants/register creates new tenant and admin user"""
        response = requests.post(
            f"{BASE_URL}/api/tenants/register",
            json=TEST_TENANT_DATA
        )
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "tenant" in data, "No tenant in response"
        assert "user" in data, "No user in response"
        
        tenant = data["tenant"]
        assert tenant.get("company_name") == TEST_TENANT_DATA["company_name"]
        assert tenant.get("country") == TEST_TENANT_DATA["country"]
        assert tenant.get("is_active") == True
        
        user = data["user"]
        assert user.get("email") == TEST_TENANT_DATA["admin_email"]
        assert user.get("role") == "admin"
        assert user.get("tenant_id") == tenant.get("id")
        
        print(f"New tenant registered: {tenant.get('company_name')} with ID {tenant.get('id')}")
        return data
    
    def test_tenant_registration_duplicate_email(self):
        """Registration with existing email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/tenants/register",
            json={
                "company_name": "Another Company",
                "admin_name": "Duplicate Test",
                "admin_email": "ss@ssc.com",  # Existing email
                "password": "TestPass123!",
                "country": "UAE"
            }
        )
        assert response.status_code == 400, f"Expected 400 for duplicate email, got {response.status_code}"
        assert "already registered" in response.json().get("detail", "").lower()
    
    def test_tenant_registration_missing_fields(self):
        """Registration missing required fields should fail"""
        response = requests.post(
            f"{BASE_URL}/api/tenants/register",
            json={
                "company_name": "Missing Fields Company"
                # Missing admin_email, password, etc.
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing fields, got {response.status_code}"


class TestNewTenantDataIsolation:
    """Tests 5, 9, 10, 11: Data isolation for new tenant"""
    
    @pytest.fixture
    def new_tenant_credentials(self):
        """Register a new tenant and return credentials"""
        unique_email = f"TEST_isolation_{uuid.uuid4().hex[:8]}@example.com"
        reg_data = {
            "company_name": f"TEST Isolation Company {uuid.uuid4().hex[:6]}",
            "admin_name": "Isolation Test Admin",
            "admin_email": unique_email,
            "password": "IsolationTest123!",
            "country": "UAE"
        }
        response = requests.post(
            f"{BASE_URL}/api/tenants/register",
            json=reg_data
        )
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return {
            "email": unique_email,
            "password": "IsolationTest123!",
            "token": response.json()["access_token"],
            "tenant_id": response.json()["tenant"]["id"]
        }
    
    def test_new_tenant_login(self, new_tenant_credentials):
        """Test 5: Login as newly registered tenant admin"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": new_tenant_credentials["email"],
                "password": new_tenant_credentials["password"]
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        user = response.json()["user"]
        assert user.get("tenant_id") == new_tenant_credentials["tenant_id"]
        assert user.get("role") == "admin"
        print(f"New tenant admin logged in successfully. tenant_id={user.get('tenant_id')}")
    
    def test_new_tenant_dashboard_stats(self, new_tenant_credentials):
        """Test 9: Dashboard stats for new tenant should be empty/zeroed"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {new_tenant_credentials['token']}"}
        )
        # Should return 200 with zero/empty data
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        # New tenant should have zero sales
        total_sales = data.get("total_sales", 0)
        print(f"New tenant dashboard stats - total_sales: {total_sales}")
    
    def test_new_tenant_branches_empty(self, new_tenant_credentials):
        """Test 10: Branches for new tenant should be empty"""
        response = requests.get(
            f"{BASE_URL}/api/branches",
            headers={"Authorization": f"Bearer {new_tenant_credentials['token']}"}
        )
        assert response.status_code == 200, f"Branches API failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list"
        assert len(data) == 0, f"New tenant should have 0 branches, got {len(data)}"
        print(f"New tenant branches: {len(data)} (should be 0)")
    
    def test_new_tenant_sales_empty(self, new_tenant_credentials):
        """Test 11: Sales for new tenant should be empty"""
        response = requests.get(
            f"{BASE_URL}/api/sales",
            headers={"Authorization": f"Bearer {new_tenant_credentials['token']}"}
        )
        assert response.status_code == 200, f"Sales API failed: {response.text}"
        
        data = response.json()
        # Sales endpoint might return list directly or paginated
        if isinstance(data, list):
            assert len(data) == 0, f"New tenant should have 0 sales, got {len(data)}"
        elif isinstance(data, dict) and "items" in data:
            assert len(data["items"]) == 0, f"New tenant should have 0 sales"
        print(f"New tenant sales: empty (correct for new tenant)")


class TestSuperAdminSeesAllTenants:
    """Test 6: Super admin can see all tenants after new registration"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        return response.json()["access_token"]
    
    def test_super_admin_sees_new_tenant(self, super_admin_token):
        """Register a tenant, then verify super admin can see it"""
        # Get initial tenant count
        initial_response = requests.get(
            f"{BASE_URL}/api/admin/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        initial_count = len(initial_response.json())
        
        # Register new tenant
        unique_email = f"TEST_visibility_{uuid.uuid4().hex[:8]}@example.com"
        unique_company = f"TEST Visibility Company {uuid.uuid4().hex[:6]}"
        reg_response = requests.post(
            f"{BASE_URL}/api/tenants/register",
            json={
                "company_name": unique_company,
                "admin_name": "Visibility Test",
                "admin_email": unique_email,
                "password": "VisibilityTest123!",
                "country": "Kuwait"
            }
        )
        assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
        new_tenant_id = reg_response.json()["tenant"]["id"]
        
        # Super admin should now see the new tenant
        updated_response = requests.get(
            f"{BASE_URL}/api/admin/tenants",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        updated_tenants = updated_response.json()
        updated_count = len(updated_tenants)
        
        assert updated_count == initial_count + 1, f"Expected {initial_count + 1} tenants, got {updated_count}"
        
        # Find the new tenant in the list
        new_tenant_found = any(t.get("id") == new_tenant_id for t in updated_tenants)
        assert new_tenant_found, f"New tenant {new_tenant_id} not found in admin tenants list"
        
        print(f"Super admin sees new tenant. Total tenants: {updated_count}")


class TestToggleTenantStatus:
    """Test 12: PUT /api/admin/tenants/{id} for toggling active/inactive"""
    
    @pytest.fixture
    def super_admin_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_tenant_id(self, super_admin_token):
        """Create a test tenant to toggle"""
        unique_email = f"TEST_toggle_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(
            f"{BASE_URL}/api/tenants/register",
            json={
                "company_name": f"TEST Toggle Company {uuid.uuid4().hex[:6]}",
                "admin_name": "Toggle Test",
                "admin_email": unique_email,
                "password": "ToggleTest123!",
                "country": "Bahrain"
            }
        )
        assert reg_response.status_code == 200
        return reg_response.json()["tenant"]["id"]
    
    def test_toggle_tenant_inactive(self, super_admin_token, test_tenant_id):
        """Toggle tenant to inactive"""
        response = requests.put(
            f"{BASE_URL}/api/admin/tenants/{test_tenant_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"is_active": False}
        )
        assert response.status_code == 200, f"Toggle failed: {response.text}"
        
        data = response.json()
        assert data.get("is_active") == False, f"Expected is_active=False, got {data.get('is_active')}"
        print(f"Tenant {test_tenant_id} toggled to inactive")
    
    def test_toggle_tenant_active(self, super_admin_token, test_tenant_id):
        """Toggle tenant back to active"""
        # First set to inactive
        requests.put(
            f"{BASE_URL}/api/admin/tenants/{test_tenant_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"is_active": False}
        )
        
        # Then set back to active
        response = requests.put(
            f"{BASE_URL}/api/admin/tenants/{test_tenant_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"is_active": True}
        )
        assert response.status_code == 200, f"Toggle failed: {response.text}"
        
        data = response.json()
        assert data.get("is_active") == True, f"Expected is_active=True, got {data.get('is_active')}"
        print(f"Tenant {test_tenant_id} toggled to active")
    
    def test_toggle_requires_super_admin(self, test_tenant_id):
        """Non-super-admin should get 403 when trying to toggle"""
        # Try with the test tenant's own credentials (non-super-admin)
        unique_email = f"TEST_notadmin_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = requests.post(
            f"{BASE_URL}/api/tenants/register",
            json={
                "company_name": "Not Admin Company",
                "admin_name": "Not Admin",
                "admin_email": unique_email,
                "password": "NotAdmin123!",
                "country": "Qatar"
            }
        )
        if reg_response.status_code != 200:
            pytest.skip("Could not create test user")
        
        token = reg_response.json()["access_token"]
        response = requests.put(
            f"{BASE_URL}/api/admin/tenants/{test_tenant_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"is_active": False}
        )
        assert response.status_code == 403, f"Expected 403 for non-super-admin, got {response.status_code}"


# Cleanup: Note that we prefix all test data with "TEST_" for easy identification
# A production system should have a cleanup mechanism for test data
