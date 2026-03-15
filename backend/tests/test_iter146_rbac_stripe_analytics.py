"""
Iteration 146: RBAC Role Templates, Stripe Payments, Tenant Analytics Dashboard
Tests for:
- GET/POST/PUT/DELETE /api/role-templates
- GET /api/admin/analytics (super admin only)
- POST /api/payments/checkout, GET /api/payments/history
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
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def super_admin_token(api_client):
    """Get super admin auth token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": SUPER_ADMIN_EMAIL,
        "password": SUPER_ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Super admin login failed: {response.status_code}")


@pytest.fixture(scope="module")
def operator_token(api_client):
    """Get operator auth token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": OPERATOR_EMAIL,
        "password": OPERATOR_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Operator login failed: {response.status_code}")


@pytest.fixture(scope="module")
def admin_client(api_client, super_admin_token):
    """Session with super admin auth header"""
    api_client.headers.update({"Authorization": f"Bearer {super_admin_token}"})
    return api_client


# ═══════════════════════════════════════════════════════════════════
# ROLE TEMPLATES CRUD TESTS
# ═══════════════════════════════════════════════════════════════════

class TestRoleTemplatesGet:
    """GET /api/role-templates - returns 4 default templates"""

    def test_get_role_templates_returns_system_templates(self, api_client, super_admin_token):
        """Should return Manager, Cashier, Viewer, Employee templates"""
        response = api_client.get(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Response should be a list"
        
        # Should have at least 4 system templates
        template_names = [t.get("name") for t in templates]
        expected_names = ["Manager", "Cashier", "Viewer", "Employee"]
        for name in expected_names:
            assert name in template_names, f"Missing system template: {name}"
        
        # Check structure of a template
        for t in templates:
            assert "id" in t, "Template missing id"
            assert "name" in t, "Template missing name"
            assert "permissions" in t, "Template missing permissions"
            assert "is_system" in t, "Template missing is_system flag"
            if t["name"] in expected_names:
                assert t["is_system"] is True, f"{t['name']} should be a system template"

    def test_get_role_templates_requires_admin(self, api_client, operator_token):
        """Operators should not access role templates"""
        response = api_client.get(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for operator, got {response.status_code}"


class TestRoleTemplatesCreate:
    """POST /api/role-templates - create custom role template"""

    def test_create_custom_role_template(self, api_client, super_admin_token):
        """Should create custom role with name, description, permissions"""
        unique_name = f"TEST_CustomRole_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "description": "A custom test role",
            "permissions": {
                "dashboard": "read",
                "sales": "write",
                "invoices": "none",
                "customers": "read"
            }
        }
        response = api_client.post(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == unique_name
        assert data["description"] == "A custom test role"
        assert data["permissions"]["sales"] == "write"
        assert data["is_system"] is False, "Custom template should not be system template"
        assert "id" in data
        
        # Store for cleanup
        TestRoleTemplatesCreate.created_template_id = data["id"]

    def test_create_role_template_name_required(self, api_client, super_admin_token):
        """Should reject template without name"""
        response = api_client.post(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"description": "No name provided", "permissions": {}}
        )
        assert response.status_code == 400, f"Expected 400 for missing name, got {response.status_code}"

    def test_create_duplicate_name_rejected(self, api_client, super_admin_token):
        """Should reject duplicate template name"""
        # First create
        unique_name = f"TEST_DuplicateRole_{uuid.uuid4().hex[:8]}"
        api_client.post(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"name": unique_name, "permissions": {}}
        )
        # Try duplicate
        response = api_client.post(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"name": unique_name, "permissions": {}}
        )
        assert response.status_code == 400, f"Expected 400 for duplicate name, got {response.status_code}"


class TestRoleTemplatesUpdate:
    """PUT /api/role-templates/{id} - update template permissions"""

    def test_update_role_template_permissions(self, api_client, super_admin_token):
        """Should update a template's permissions"""
        # First create a template
        unique_name = f"TEST_UpdateRole_{uuid.uuid4().hex[:8]}"
        create_res = api_client.post(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"name": unique_name, "permissions": {"dashboard": "read"}}
        )
        template_id = create_res.json()["id"]
        
        # Update it
        update_res = api_client.put(
            f"{BASE_URL}/api/role-templates/{template_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "description": "Updated description",
                "permissions": {"dashboard": "write", "sales": "write"}
            }
        )
        assert update_res.status_code == 200, f"Expected 200, got {update_res.status_code}: {update_res.text}"
        
        data = update_res.json()
        assert data["description"] == "Updated description"
        assert data["permissions"]["dashboard"] == "write"
        assert data["permissions"]["sales"] == "write"

    def test_update_nonexistent_template_404(self, api_client, super_admin_token):
        """Should return 404 for non-existent template"""
        response = api_client.put(
            f"{BASE_URL}/api/role-templates/nonexistent-id-12345",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"name": "Test"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestRoleTemplatesDelete:
    """DELETE /api/role-templates/{id} - delete custom templates"""

    def test_delete_custom_template(self, api_client, super_admin_token):
        """Should delete a custom template"""
        # First create
        unique_name = f"TEST_DeleteRole_{uuid.uuid4().hex[:8]}"
        create_res = api_client.post(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={"name": unique_name, "permissions": {}}
        )
        template_id = create_res.json()["id"]
        
        # Delete it
        delete_res = api_client.delete(
            f"{BASE_URL}/api/role-templates/{template_id}",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert delete_res.status_code == 200, f"Expected 200, got {delete_res.status_code}: {delete_res.text}"
        assert delete_res.json().get("success") is True

    def test_cannot_delete_system_template(self, api_client, super_admin_token):
        """Should block deleting system templates like Manager, Cashier"""
        # Get templates to find a system one
        get_res = api_client.get(
            f"{BASE_URL}/api/role-templates",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        templates = get_res.json()
        system_template = next((t for t in templates if t.get("is_system")), None)
        
        if system_template:
            delete_res = api_client.delete(
                f"{BASE_URL}/api/role-templates/{system_template['id']}",
                headers={"Authorization": f"Bearer {super_admin_token}"}
            )
            assert delete_res.status_code == 400, f"Expected 400 when deleting system template, got {delete_res.status_code}"
            assert "Cannot delete system" in delete_res.json().get("detail", "")


# ═══════════════════════════════════════════════════════════════════
# TENANT ANALYTICS TESTS (Super Admin Only)
# ═══════════════════════════════════════════════════════════════════

class TestTenantAnalytics:
    """GET /api/admin/analytics - platform analytics for super admin"""

    def test_get_analytics_super_admin(self, api_client, super_admin_token):
        """Super admin should get MRR, tenants, growth, revenue data"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required fields
        assert "total_tenants" in data, "Missing total_tenants"
        assert "active_tenants" in data, "Missing active_tenants"
        assert "mrr" in data, "Missing mrr"
        assert "arr" in data, "Missing arr"
        assert "plan_distribution" in data, "Missing plan_distribution"
        assert "revenue_by_plan" in data, "Missing revenue_by_plan"
        assert "monthly_growth" in data, "Missing monthly_growth"
        assert "status_distribution" in data, "Missing status_distribution"
        assert "top_tenants" in data, "Missing top_tenants"
        
        # Validate types
        assert isinstance(data["total_tenants"], int), "total_tenants should be int"
        assert isinstance(data["mrr"], (int, float)), "mrr should be numeric"
        assert isinstance(data["monthly_growth"], list), "monthly_growth should be list"
        assert isinstance(data["top_tenants"], list), "top_tenants should be list"

    def test_get_analytics_regular_admin_forbidden(self, api_client, operator_token):
        """Regular admin/operator should not access analytics"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for non-super admin, got {response.status_code}"

    def test_analytics_monthly_growth_structure(self, api_client, super_admin_token):
        """Monthly growth should have proper structure"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        data = response.json()
        
        if data["monthly_growth"]:
            month_data = data["monthly_growth"][0]
            assert "month" in month_data, "month field missing in growth data"
            assert "new_tenants" in month_data, "new_tenants field missing"
            assert "total_tenants" in month_data, "total_tenants field missing"

    def test_analytics_revenue_by_plan_structure(self, api_client, super_admin_token):
        """Revenue by plan should have plan, count, price, mrr"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/analytics",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        data = response.json()
        
        if data["revenue_by_plan"]:
            plan_data = data["revenue_by_plan"][0]
            assert "plan" in plan_data, "plan field missing"
            assert "count" in plan_data, "count field missing"
            assert "mrr" in plan_data, "mrr field missing"


# ═══════════════════════════════════════════════════════════════════
# STRIPE PAYMENTS TESTS
# ═══════════════════════════════════════════════════════════════════

class TestStripeCheckout:
    """POST /api/payments/checkout - create Stripe checkout session"""

    def test_create_checkout_session_starter(self, api_client, super_admin_token):
        """Should create checkout session for starter plan"""
        response = api_client.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "plan": "starter",
                "origin_url": "https://ssc-saas-build.preview.emergentagent.com"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data, "Response should contain checkout url"
        assert "session_id" in data, "Response should contain session_id"
        assert data["url"].startswith("https://"), "URL should be https"

    def test_create_checkout_session_business(self, api_client, super_admin_token):
        """Should create checkout session for business plan"""
        response = api_client.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "plan": "business",
                "origin_url": "https://ssc-saas-build.preview.emergentagent.com"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data
        assert "session_id" in data

    def test_checkout_invalid_plan_rejected(self, api_client, super_admin_token):
        """Should reject invalid plan names"""
        response = api_client.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "plan": "invalid_plan_xyz",
                "origin_url": "https://example.com"
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid plan, got {response.status_code}"

    def test_checkout_requires_admin(self, api_client, operator_token):
        """Operators should not create checkout sessions"""
        response = api_client.post(
            f"{BASE_URL}/api/payments/checkout",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={"plan": "starter", "origin_url": "https://example.com"}
        )
        assert response.status_code == 403, f"Expected 403 for operator, got {response.status_code}"


class TestPaymentHistory:
    """GET /api/payments/history - payment transactions for tenant"""

    def test_get_payment_history(self, api_client, super_admin_token):
        """Should return list of payment transactions"""
        response = api_client.get(
            f"{BASE_URL}/api/payments/history",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Payment history should be a list"
        
        # If there are transactions, verify structure
        if data:
            txn = data[0]
            assert "id" in txn, "Transaction missing id"
            assert "plan" in txn, "Transaction missing plan"
            assert "amount" in txn, "Transaction missing amount"
            assert "payment_status" in txn, "Transaction missing payment_status"

    def test_payment_history_requires_admin(self, api_client, operator_token):
        """Operators should not access payment history"""
        response = api_client.get(
            f"{BASE_URL}/api/payments/history",
            headers={"Authorization": f"Bearer {operator_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for operator, got {response.status_code}"


# ═══════════════════════════════════════════════════════════════════
# REGRESSION: Login + Dashboard still works
# ═══════════════════════════════════════════════════════════════════

class TestRegression:
    """Regression tests for existing functionality"""

    def test_login_super_admin_still_works(self, api_client):
        """Super admin should still be able to login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.status_code}"
        data = response.json()
        assert "access_token" in data or "token" in data, "Login response missing token"
        assert data["user"]["is_super_admin"] is True

    def test_login_operator_still_works(self, api_client):
        """Operator should still be able to login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.status_code}"

    def test_dashboard_endpoint_accessible(self, api_client, super_admin_token):
        """Dashboard endpoints should be accessible"""
        response = api_client.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        # Should be 200 or 404 if no stats, but not 500
        assert response.status_code in [200, 404], f"Dashboard stats error: {response.status_code}"

    def test_branches_endpoint_accessible(self, api_client, super_admin_token):
        """Branches endpoint should be accessible"""
        response = api_client.get(
            f"{BASE_URL}/api/branches",
            headers={"Authorization": f"Bearer {super_admin_token}"}
        )
        assert response.status_code == 200, f"Branches endpoint failed: {response.status_code}"
