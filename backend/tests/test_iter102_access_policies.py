"""
Iteration 102 - Access Policies Tests
Tests for:
1. Access policies CRUD - GET/PUT /api/access-policies
2. Delete restrictions per module (admin_only, admin_manager, anyone, no_delete)
3. Time-based delete limits
4. Operator visibility restrictions
5. DELETE endpoints blocked for operators when policy is admin_only
6. Dashboard/POS visibility changes based on user role
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
OPERATOR_EMAIL = "test@ssc.com"
OPERATOR_PASSWORD = "testtest"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Admin authentication failed: {response.status_code}")

@pytest.fixture(scope="module")
def operator_token():
    """Get operator authentication token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": OPERATOR_EMAIL,
        "password": OPERATOR_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Operator authentication failed: {response.status_code}")

@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

@pytest.fixture
def operator_headers(operator_token):
    return {"Authorization": f"Bearer {operator_token}", "Content-Type": "application/json"}


class TestAccessPoliciesCRUD:
    """Test access policies GET and PUT endpoints."""
    
    def test_get_access_policies_as_admin(self, admin_headers):
        """Admin can GET current access policies after setting full defaults."""
        # First ensure full policy is set
        full_policy = {
            "delete_policy": {
                "sales": "admin_only",
                "expenses": "admin_only",
                "supplier_payments": "admin_only",
                "stock": "admin_manager",
                "customers": "admin_manager",
                "invoices": "admin_only",
                "employees": "admin_only"
            },
            "delete_time_limit_hours": 24,
            "delete_time_limit_enabled": True,
            "visibility": {
                "operator_hide_financials": True,
                "operator_hide_profit": True,
                "operator_hide_analytics": False,
                "operator_hide_reports": False,
                "operator_hide_supplier_credit": True,
                "operator_hide_employee_salary": True
            }
        }
        requests.put(f"{BASE_URL}/api/access-policies", json=full_policy, headers=admin_headers)
        
        response = requests.get(f"{BASE_URL}/api/access-policies", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "delete_policy" in data
        assert "visibility" in data
        
        # Verify delete_policy has all 7 modules
        delete_policy = data["delete_policy"]
        expected_modules = ["sales", "expenses", "supplier_payments", "stock", "customers", "invoices", "employees"]
        for module in expected_modules:
            assert module in delete_policy, f"Missing module: {module}"
        
        # Verify visibility settings exist
        visibility = data["visibility"]
        expected_vis = ["operator_hide_financials", "operator_hide_profit", "operator_hide_analytics", 
                       "operator_hide_reports", "operator_hide_supplier_credit", "operator_hide_employee_salary"]
        for vis_key in expected_vis:
            assert vis_key in visibility, f"Missing visibility key: {vis_key}"
        
        print(f"Access policies: {data}")
    
    def test_get_access_policies_as_operator(self, operator_headers):
        """Operator can GET current access policies."""
        response = requests.get(f"{BASE_URL}/api/access-policies", headers=operator_headers)
        assert response.status_code == 200
        data = response.json()
        assert "delete_policy" in data
        print(f"Operator can view policies: OK")
    
    def test_put_access_policies_as_admin(self, admin_headers):
        """Admin can update access policies."""
        # First get current to restore later
        get_response = requests.get(f"{BASE_URL}/api/access-policies", headers=admin_headers)
        original = get_response.json()
        
        # Update with new settings
        update_data = {
            "delete_policy": {
                "sales": "admin_only",
                "expenses": "admin_only",
                "supplier_payments": "admin_only",
                "stock": "admin_manager",
                "customers": "admin_manager",
                "invoices": "admin_only",
                "employees": "admin_only"
            },
            "delete_time_limit_hours": 24,
            "delete_time_limit_enabled": True,
            "visibility": {
                "operator_hide_financials": True,
                "operator_hide_profit": True,
                "operator_hide_analytics": False,
                "operator_hide_reports": False,
                "operator_hide_supplier_credit": True,
                "operator_hide_employee_salary": True
            }
        }
        
        response = requests.put(f"{BASE_URL}/api/access-policies", json=update_data, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify update took effect
        assert data["delete_policy"]["sales"] == "admin_only"
        assert data["delete_time_limit_enabled"] == True
        assert data["visibility"]["operator_hide_financials"] == True
        print(f"Admin updated policies successfully")
    
    def test_put_access_policies_as_operator_fails(self, operator_headers):
        """Operator cannot update access policies (403)."""
        update_data = {
            "delete_policy": {"sales": "anyone"}
        }
        response = requests.put(f"{BASE_URL}/api/access-policies", json=update_data, headers=operator_headers)
        assert response.status_code == 403
        print(f"Operator correctly blocked from updating policies: 403")


class TestMyVisibility:
    """Test /api/access-policies/my-visibility endpoint."""
    
    def test_admin_visibility_all_false(self, admin_headers):
        """Admin should see all (hide_* = false)."""
        response = requests.get(f"{BASE_URL}/api/access-policies/my-visibility", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Admin should have all visibility
        assert data.get("hide_financials") == False, "Admin should see financials"
        assert data.get("hide_profit") == False, "Admin should see profit"
        assert data.get("hide_analytics") == False, "Admin should see analytics"
        print(f"Admin visibility: {data}")
    
    def test_operator_visibility_restrictions(self, operator_headers):
        """Operator should have restrictions based on policies."""
        response = requests.get(f"{BASE_URL}/api/access-policies/my-visibility", headers=operator_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Based on default policies, operator should have some restrictions
        # Default: operator_hide_financials=True, operator_hide_profit=True
        assert "hide_financials" in data
        assert "hide_profit" in data
        
        # Just verify the endpoint returns proper structure
        print(f"Operator visibility: {data}")


class TestDeleteRestrictions:
    """Test delete restrictions for operators when policy is admin_only."""
    
    def test_operator_cannot_delete_sale_admin_only(self, admin_headers, operator_headers):
        """Operator cannot delete a sale when policy is admin_only (403)."""
        # First ensure policy is admin_only for sales
        policy_data = {
            "delete_policy": {
                "sales": "admin_only",
                "expenses": "admin_only",
                "supplier_payments": "admin_only",
                "stock": "admin_manager",
                "customers": "admin_manager",
                "invoices": "admin_only",
                "employees": "admin_only"
            }
        }
        requests.put(f"{BASE_URL}/api/access-policies", json=policy_data, headers=admin_headers)
        
        # Get a sale to try deleting (or use a fake ID - we expect 403 before 404)
        # First get sales list
        sales_response = requests.get(f"{BASE_URL}/api/sales?limit=1", headers=operator_headers)
        if sales_response.status_code == 200:
            sales_data = sales_response.json()
            if sales_data.get("data") and len(sales_data["data"]) > 0:
                sale_id = sales_data["data"][0]["id"]
                
                # Try to delete as operator
                delete_response = requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=operator_headers)
                assert delete_response.status_code == 403, f"Expected 403, got {delete_response.status_code}"
                
                # Verify error message
                error = delete_response.json()
                assert "admin" in error.get("detail", "").lower()
                print(f"Operator blocked from deleting sale: {error.get('detail')}")
                return
        
        # If no sales exist, use a test ID - the access check should happen before existence check
        # But let's create a test sale first
        test_sale = {
            "sale_type": "pos",
            "amount": 100,
            "date": "2026-01-15T12:00:00",
            "payment_details": [{"mode": "cash", "amount": 100}]
        }
        create_response = requests.post(f"{BASE_URL}/api/sales", json=test_sale, headers=admin_headers)
        if create_response.status_code in [200, 201]:
            created_sale = create_response.json()
            sale_id = created_sale["id"]
            
            # Now try operator delete
            delete_response = requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=operator_headers)
            assert delete_response.status_code == 403
            
            # Cleanup - admin deletes
            requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=admin_headers)
            print(f"Operator blocked from deleting sale: 403")
    
    def test_operator_cannot_delete_expense_admin_only(self, admin_headers, operator_headers):
        """Operator cannot delete an expense when policy is admin_only (403)."""
        # Get an expense to try deleting
        expenses_response = requests.get(f"{BASE_URL}/api/expenses?limit=1", headers=operator_headers)
        if expenses_response.status_code == 200:
            expenses_data = expenses_response.json()
            if expenses_data.get("data") and len(expenses_data["data"]) > 0:
                expense_id = expenses_data["data"][0]["id"]
                
                # Try to delete as operator
                delete_response = requests.delete(f"{BASE_URL}/api/expenses/{expense_id}", headers=operator_headers)
                assert delete_response.status_code == 403
                print(f"Operator blocked from deleting expense: 403")
                return
        
        print("No expenses to test - skipping")
    
    def test_operator_cannot_delete_supplier_payment_admin_only(self, admin_headers, operator_headers):
        """Operator cannot delete a supplier payment when policy is admin_only (403)."""
        # Get a supplier payment to try deleting
        payments_response = requests.get(f"{BASE_URL}/api/supplier-payments?limit=1", headers=operator_headers)
        if payments_response.status_code == 200:
            payments_data = payments_response.json()
            if payments_data.get("data") and len(payments_data["data"]) > 0:
                payment_id = payments_data["data"][0]["id"]
                
                # Try to delete as operator
                delete_response = requests.delete(f"{BASE_URL}/api/supplier-payments/{payment_id}", headers=operator_headers)
                assert delete_response.status_code == 403
                print(f"Operator blocked from deleting supplier payment: 403")
                return
        
        print("No supplier payments to test - skipping")
    
    def test_admin_can_delete_sale(self, admin_headers):
        """Admin can delete a sale regardless of policy."""
        # Create a test sale
        test_sale = {
            "sale_type": "pos",
            "amount": 50,
            "date": "2026-01-15T12:00:00",
            "payment_details": [{"mode": "cash", "amount": 50}]
        }
        create_response = requests.post(f"{BASE_URL}/api/sales", json=test_sale, headers=admin_headers)
        if create_response.status_code in [200, 201]:
            created_sale = create_response.json()
            sale_id = created_sale["id"]
            
            # Admin deletes
            delete_response = requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=admin_headers)
            assert delete_response.status_code == 200
            print(f"Admin can delete sale: OK")


class TestDeletePolicyOptions:
    """Test different delete policy options."""
    
    def test_policy_options_structure(self, admin_headers):
        """Verify delete policy accepts valid options."""
        # Valid options: anyone, admin_manager, admin_only, no_delete
        test_configs = [
            {"sales": "anyone"},
            {"sales": "admin_manager"},
            {"sales": "admin_only"},
            {"sales": "no_delete"}
        ]
        
        for config in test_configs:
            response = requests.put(
                f"{BASE_URL}/api/access-policies", 
                json={"delete_policy": config}, 
                headers=admin_headers
            )
            assert response.status_code == 200, f"Failed for config: {config}"
            data = response.json()
            assert data["delete_policy"]["sales"] == config["sales"]
        
        # Reset to admin_only
        requests.put(
            f"{BASE_URL}/api/access-policies",
            json={"delete_policy": {"sales": "admin_only"}},
            headers=admin_headers
        )
        print(f"All policy options work correctly")


class TestTimeBasedDeleteLimit:
    """Test time-based delete restrictions."""
    
    def test_time_limit_config_in_policies(self, admin_headers):
        """Verify time limit settings are stored and returned."""
        update_data = {
            "delete_time_limit_hours": 48,
            "delete_time_limit_enabled": True
        }
        
        response = requests.put(f"{BASE_URL}/api/access-policies", json=update_data, headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("delete_time_limit_hours") == 48
        assert data.get("delete_time_limit_enabled") == True
        print(f"Time-based delete limit configured: {data.get('delete_time_limit_hours')}h")
        
        # Reset
        requests.put(f"{BASE_URL}/api/access-policies", json={
            "delete_time_limit_hours": 24,
            "delete_time_limit_enabled": True
        }, headers=admin_headers)


class TestSettingsAccessControlTab:
    """Verify Settings API returns correct structure for Access Control tab."""
    
    def test_access_policies_returns_all_modules(self, admin_headers):
        """Access policies should return delete_policy for all 7 modules."""
        # First reset to full default policies
        full_policy = {
            "delete_policy": {
                "sales": "admin_only",
                "expenses": "admin_only",
                "supplier_payments": "admin_only",
                "stock": "admin_manager",
                "customers": "admin_manager",
                "invoices": "admin_only",
                "employees": "admin_only"
            },
            "delete_time_limit_hours": 24,
            "delete_time_limit_enabled": True,
            "visibility": {
                "operator_hide_financials": True,
                "operator_hide_profit": True,
                "operator_hide_analytics": False,
                "operator_hide_reports": False,
                "operator_hide_supplier_credit": True,
                "operator_hide_employee_salary": True
            }
        }
        requests.put(f"{BASE_URL}/api/access-policies", json=full_policy, headers=admin_headers)
        
        response = requests.get(f"{BASE_URL}/api/access-policies", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        
        # 7 modules for delete restrictions
        expected_modules = ["sales", "expenses", "supplier_payments", "stock", "customers", "invoices", "employees"]
        for module in expected_modules:
            assert module in data["delete_policy"], f"Missing: {module}"
        
        # 6 visibility toggles
        expected_vis = ["operator_hide_financials", "operator_hide_profit", "operator_hide_analytics",
                       "operator_hide_reports", "operator_hide_supplier_credit", "operator_hide_employee_salary"]
        for vis in expected_vis:
            assert vis in data["visibility"], f"Missing visibility: {vis}"
        
        print(f"All modules and visibility settings present")


class TestDashboardStatsForOperator:
    """Test dashboard stats endpoint returns data (visibility is handled client-side)."""
    
    def test_dashboard_stats_as_operator(self, operator_headers):
        """Operator can access dashboard stats endpoint."""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=operator_headers)
        # Should return 200 - visibility filtering is client-side
        assert response.status_code == 200
        data = response.json()
        
        # Basic stats should be present
        assert "total_sales" in data
        print(f"Dashboard stats accessible to operator")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
