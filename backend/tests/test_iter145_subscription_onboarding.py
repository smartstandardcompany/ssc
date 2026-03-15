"""
Iteration 145: Subscription Page, Onboarding Wizard, Employee→User Auto-Creation Tests

Tests:
1. Subscription API - GET /api/tenants/subscription
2. Subscription API - PUT /api/tenants/subscription/change-plan (incl. downgrade protection)
3. Onboarding API - PUT /api/tenants/onboarding
4. New tenant registration + onboarding_completed=false check
5. Employee→User auto-creation - POST /api/employees with email
6. New tenant data isolation (regression)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "ss@ssc.com"
SUPER_ADMIN_PASSWORD = "Aa147258369Ssc@"
OPERATOR_EMAIL = "test@ssc.com"
OPERATOR_PASSWORD = "testtest"


@pytest.fixture(scope="module")
def super_admin_token():
    """Login as super admin and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Super admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def operator_token():
    """Login as operator and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": OPERATOR_EMAIL,
        "password": OPERATOR_PASSWORD
    })
    assert response.status_code == 200, f"Operator login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def new_tenant_data():
    """Register a new tenant for testing onboarding flow"""
    unique_id = str(uuid.uuid4())[:8]
    payload = {
        "company_name": f"TEST_Onboarding_Company_{unique_id}",
        "admin_name": f"Test Admin {unique_id}",
        "admin_email": f"test_onboard_{unique_id}@example.com",
        "password": "TestPass123!",
        "country": "Saudi Arabia"
    }
    response = requests.post(f"{BASE_URL}/api/tenants/register", json=payload)
    assert response.status_code == 200, f"Tenant registration failed: {response.text}"
    data = response.json()
    return {
        "token": data["access_token"],
        "tenant": data["tenant"],
        "user": data["user"],
        "email": payload["admin_email"],
        "password": payload["password"]
    }


class TestSubscriptionAPI:
    """Test Subscription Endpoints"""

    def test_get_subscription_super_admin(self, super_admin_token):
        """Test GET /api/tenants/subscription - returns plan, usage stats, available_plans"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get subscription failed: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "plan" in data, "Missing 'plan' field"
        assert "plan_details" in data, "Missing 'plan_details' field"
        assert "usage" in data, "Missing 'usage' field"
        assert "available_plans" in data, "Missing 'available_plans' field"
        
        # Check usage structure
        usage = data["usage"]
        assert "users" in usage, "Missing 'users' in usage"
        assert "branches" in usage, "Missing 'branches' in usage"
        assert "max_users" in usage, "Missing 'max_users' in usage"
        assert "max_branches" in usage, "Missing 'max_branches' in usage"
        
        # Check available_plans contains all 3 plans
        plans = data["available_plans"]
        assert "starter" in plans, "Missing 'starter' plan"
        assert "business" in plans, "Missing 'business' plan"
        assert "enterprise" in plans, "Missing 'enterprise' plan"
        
        print(f"PASS: Subscription API returns plan={data['plan']}, usage={usage}")

    def test_get_subscription_operator(self, operator_token):
        """Test GET /api/tenants/subscription for operator"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/subscription",
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 200, f"Get subscription failed: {response.text}"
        data = response.json()
        assert "plan" in data
        print(f"PASS: Operator can view subscription, plan={data['plan']}")

    def test_change_plan_invalid_plan(self, super_admin_token):
        """Test PUT /api/tenants/subscription/change-plan with invalid plan"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/subscription/change-plan",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"plan": "invalid_plan"}
        )
        assert response.status_code == 400, f"Expected 400 for invalid plan, got {response.status_code}"
        print("PASS: Invalid plan returns 400")

    def test_downgrade_protection(self, super_admin_token):
        """Test downgrade protection - super admin has 6 branches, can't downgrade to starter (max 1)"""
        # First get current subscription to verify branch count
        sub_response = requests.get(
            f"{BASE_URL}/api/tenants/subscription",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert sub_response.status_code == 200
        sub_data = sub_response.json()
        branch_count = sub_data["usage"]["branches"]
        
        if branch_count > 1:
            # Try to downgrade to starter (max 1 branch)
            response = requests.put(
                f"{BASE_URL}/api/tenants/subscription/change-plan",
                headers={"Authorization": f"Bearer {super_admin_token}"},
                json={"plan": "starter"}
            )
            # Should fail because we have more branches than starter allows
            assert response.status_code == 400, f"Expected 400 for downgrade, got {response.status_code}"
            assert "branches" in response.text.lower() or "downgrade" in response.text.lower(), \
                f"Error should mention branches/downgrade: {response.text}"
            print(f"PASS: Downgrade protection works - {branch_count} branches > starter max (1)")
        else:
            print(f"SKIP: Branch count ({branch_count}) <= 1, can't test downgrade protection")

    def test_change_plan_requires_admin(self, operator_token):
        """Test that operators cannot change plan (admin only)"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/subscription/change-plan",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={"plan": "business"}
        )
        assert response.status_code == 403, f"Expected 403 for non-admin, got {response.status_code}"
        print("PASS: Plan change requires admin role")


class TestOnboardingAPI:
    """Test Onboarding Wizard Endpoints"""

    def test_new_tenant_onboarding_not_completed(self, new_tenant_data):
        """Test that new tenant has onboarding_completed=false"""
        tenant = new_tenant_data["tenant"]
        assert tenant.get("onboarding_completed") == False, \
            f"New tenant should have onboarding_completed=false, got {tenant.get('onboarding_completed')}"
        print(f"PASS: New tenant has onboarding_completed=false")

    def test_get_current_tenant(self, new_tenant_data):
        """Test GET /api/tenants/current for new tenant"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/current",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"}
        )
        assert response.status_code == 200, f"Get current tenant failed: {response.text}"
        data = response.json()
        assert "tenant" in data, "Missing 'tenant' field"
        assert data["tenant"]["onboarding_completed"] == False
        print("PASS: GET /api/tenants/current returns tenant with onboarding status")

    def test_update_onboarding_profile(self, new_tenant_data):
        """Test PUT /api/tenants/onboarding to update tenant profile"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/onboarding",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"},
            json={
                "city": "Riyadh",
                "phone": "+966501234567",
                "industry": "restaurant"
            }
        )
        assert response.status_code == 200, f"Update onboarding failed: {response.text}"
        data = response.json()
        assert data.get("city") == "Riyadh", f"City not updated: {data}"
        assert data.get("phone") == "+966501234567", f"Phone not updated: {data}"
        print("PASS: Onboarding profile update works")

    def test_complete_onboarding(self, new_tenant_data):
        """Test PUT /api/tenants/onboarding with onboarding_completed=true"""
        response = requests.put(
            f"{BASE_URL}/api/tenants/onboarding",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"},
            json={"onboarding_completed": True}
        )
        assert response.status_code == 200, f"Complete onboarding failed: {response.text}"
        data = response.json()
        assert data.get("onboarding_completed") == True, \
            f"onboarding_completed should be True, got {data.get('onboarding_completed')}"
        print("PASS: Onboarding can be marked as complete")


class TestEmployeeUserAutoCreation:
    """Test Employee → User Auto-Creation Bug Fix"""

    def test_create_employee_with_email_creates_user(self, new_tenant_data):
        """Test POST /api/employees with email creates a user automatically"""
        unique_id = str(uuid.uuid4())[:8]
        employee_email = f"test_emp_{unique_id}@company.com"
        
        # Create employee with email
        response = requests.post(
            f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"},
            json={
                "name": f"Test Employee {unique_id}",
                "email": employee_email,
                "phone": "+966509876543",
                "job_title": "Cashier",
                "salary": 5000
            }
        )
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        emp_data = response.json()
        
        # Verify employee was created
        assert emp_data.get("name") == f"Test Employee {unique_id}"
        assert emp_data.get("email") == employee_email
        
        # Check if user_id was assigned (meaning user was auto-created)
        assert emp_data.get("user_id") is not None, \
            f"Employee should have user_id set (auto-creation), got None. Employee: {emp_data}"
        
        print(f"PASS: Employee created with user_id={emp_data.get('user_id')}")
        
        # Verify the user exists
        users_response = requests.get(
            f"{BASE_URL}/api/users",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"}
        )
        assert users_response.status_code == 200
        users = users_response.json()
        user_emails = [u.get("email") for u in users]
        assert employee_email in user_emails, f"User with email {employee_email} not found in users list"
        print(f"PASS: User with email {employee_email} found in users list")

    def test_create_employee_without_email(self, new_tenant_data):
        """Test POST /api/employees without email does not create user"""
        unique_id = str(uuid.uuid4())[:8]
        
        response = requests.post(
            f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"},
            json={
                "name": f"Test Employee NoEmail {unique_id}",
                "phone": "+966509876544",
                "job_title": "Helper",
                "salary": 3000
            }
        )
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        emp_data = response.json()
        
        # Employee without email should not have user_id
        assert emp_data.get("user_id") is None, \
            f"Employee without email should not have user_id, got {emp_data.get('user_id')}"
        print("PASS: Employee without email does not auto-create user")


class TestNewTenantDataIsolation:
    """Regression: Test tenant data isolation for new tenants"""

    def test_new_tenant_sees_empty_branches(self, new_tenant_data):
        """New tenant should see empty branches list"""
        response = requests.get(
            f"{BASE_URL}/api/branches",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"}
        )
        assert response.status_code == 200, f"Get branches failed: {response.text}"
        branches = response.json()
        assert len(branches) == 0, f"New tenant should see 0 branches, got {len(branches)}"
        print("PASS: New tenant sees 0 branches")

    def test_new_tenant_sees_empty_sales(self, new_tenant_data):
        """New tenant should see empty sales list"""
        response = requests.get(
            f"{BASE_URL}/api/sales",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"}
        )
        assert response.status_code == 200, f"Get sales failed: {response.text}"
        data = response.json()
        # Sales endpoint returns {"data": [...], "pagination": {...}}
        sales = data.get("data", data) if isinstance(data, dict) else data
        if isinstance(sales, list):
            assert len(sales) == 0, f"New tenant should see 0 sales, got {len(sales)}"
        print("PASS: New tenant sees 0 sales")

    def test_new_tenant_subscription_starter_plan(self, new_tenant_data):
        """New tenant should start on starter plan"""
        response = requests.get(
            f"{BASE_URL}/api/tenants/subscription",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"}
        )
        assert response.status_code == 200, f"Get subscription failed: {response.text}"
        data = response.json()
        assert data.get("plan") == "starter", f"New tenant should be on starter plan, got {data.get('plan')}"
        print(f"PASS: New tenant on starter plan")


class TestSidebarNavigation:
    """Test sidebar navigation - Subscription visible for admin, Platform Admin for super admin only"""

    def test_super_admin_sees_platform_admin_link(self, super_admin_token):
        """Super admin user should have is_super_admin=true"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Get me failed: {response.text}"
        user = response.json()
        assert user.get("is_super_admin") == True, f"Super admin should have is_super_admin=true"
        print("PASS: Super admin has is_super_admin=true (Platform Admin link visible)")

    def test_regular_admin_no_super_admin_flag(self, new_tenant_data):
        """Regular admin should not have is_super_admin=true"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"}
        )
        assert response.status_code == 200, f"Get me failed: {response.text}"
        user = response.json()
        assert user.get("is_super_admin") != True, f"Regular admin should not have is_super_admin=true"
        print("PASS: Regular admin does not have is_super_admin flag")


class TestOnboardingWizardSteps:
    """Test creating branch, employee, tax via onboarding wizard APIs"""

    def test_create_branch_during_onboarding(self, new_tenant_data):
        """Test creating first branch during onboarding (Step 1)"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/branches",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"},
            json={
                "name": f"TEST_Branch_{unique_id}",
                "location": "Riyadh",
                "phone": "+966501234567"
            }
        )
        assert response.status_code == 200, f"Create branch failed: {response.text}"
        branch = response.json()
        assert branch.get("name") == f"TEST_Branch_{unique_id}"
        print(f"PASS: Branch created during onboarding: {branch.get('name')}")

    def test_create_tax_rate_during_onboarding(self, new_tenant_data):
        """Test creating tax rate during onboarding (Step 3)"""
        response = requests.post(
            f"{BASE_URL}/api/accounting/tax-rates",
            headers={"Authorization": f"Bearer {new_tenant_data['token']}"},
            json={
                "name": "VAT",
                "rate": 15.0,
                "type": "vat",
                "is_default": True
            }
        )
        assert response.status_code == 200, f"Create tax rate failed: {response.text}"
        tax = response.json()
        assert tax.get("name") == "VAT"
        assert tax.get("rate") == 15.0
        print(f"PASS: Tax rate created during onboarding: {tax.get('name')} at {tax.get('rate')}%")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
