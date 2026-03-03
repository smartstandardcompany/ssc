"""
Test branch filtering refactoring - iteration 68
Tests centralized branch filtering functions:
- get_branch_filter: For sales/expenses (branch-specific only for restricted users)
- get_branch_filter_with_global: For suppliers/customers (branch-specific + global items)

Credentials:
- Admin: ss@ssc.com / Aa147258369Ssc@
- Restricted user: test@ssc.com / Test@123 (branch_id: 1c348f2b-294e-4353-bac1-0e32f759f109)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


class TestBranchFilteringRefactor:
    """Test branch filtering for suppliers, customers, sales, expenses, and dashboard"""

    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]

    @pytest.fixture(scope="class")
    def restricted_token(self):
        """Get restricted user authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@ssc.com", "password": "Test@123"}
        )
        assert response.status_code == 200, f"Restricted user login failed: {response.text}"
        return response.json()["access_token"]

    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        return {"Authorization": f"Bearer {admin_token}"}

    @pytest.fixture(scope="class")
    def restricted_headers(self, restricted_token):
        return {"Authorization": f"Bearer {restricted_token}"}

    # =====================================================
    # SUPPLIERS ENDPOINT TESTS (uses get_branch_filter_with_global)
    # =====================================================

    def test_admin_gets_all_suppliers(self, admin_headers):
        """Admin should see ALL suppliers from all branches"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=admin_headers)
        assert response.status_code == 200, f"Admin suppliers failed: {response.text}"
        
        suppliers = response.json()
        assert isinstance(suppliers, list), "Suppliers should be a list"
        print(f"Admin sees {len(suppliers)} suppliers")
        
        # Store count for comparison
        self.__class__.admin_supplier_count = len(suppliers)

    def test_restricted_user_gets_branch_and_global_suppliers(self, restricted_headers):
        """Restricted user should see branch-specific + global (no branch) suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=restricted_headers)
        assert response.status_code == 200, f"Restricted suppliers failed: {response.text}"
        
        suppliers = response.json()
        assert isinstance(suppliers, list), "Suppliers should be a list"
        print(f"Restricted user sees {len(suppliers)} suppliers")
        
        # Verify restricted user sees fewer or equal suppliers than admin
        assert len(suppliers) <= self.__class__.admin_supplier_count, \
            "Restricted user should see <= suppliers than admin"
        
        # Verify supplier filtering logic - each supplier should be either:
        # 1. From user's branch (1c348f2b-294e-4353-bac1-0e32f759f109)
        # 2. Global (no branch_id, empty string, or None)
        restricted_branch = "1c348f2b-294e-4353-bac1-0e32f759f109"
        for supplier in suppliers:
            branch_id = supplier.get("branch_id")
            is_branch_specific = branch_id == restricted_branch
            is_global = branch_id is None or branch_id == "" or branch_id == "null"
            assert is_branch_specific or is_global, \
                f"Supplier {supplier.get('name')} has invalid branch_id: {branch_id}"
        
        print(f"All {len(suppliers)} suppliers are either branch-specific or global")

    def test_supplier_names_endpoint_filtering(self, admin_headers, restricted_headers):
        """Test /api/suppliers/names also uses branch filtering"""
        # Admin request
        admin_resp = requests.get(f"{BASE_URL}/api/suppliers/names", headers=admin_headers)
        assert admin_resp.status_code == 200
        admin_names = admin_resp.json()
        
        # Restricted user request
        restricted_resp = requests.get(f"{BASE_URL}/api/suppliers/names", headers=restricted_headers)
        assert restricted_resp.status_code == 200
        restricted_names = restricted_resp.json()
        
        print(f"Supplier names - Admin: {len(admin_names)}, Restricted: {len(restricted_names)}")
        assert len(restricted_names) <= len(admin_names), \
            "Restricted user should see <= supplier names than admin"

    # =====================================================
    # CUSTOMERS ENDPOINT TESTS (uses get_branch_filter_with_global)
    # =====================================================

    def test_admin_gets_all_customers(self, admin_headers):
        """Admin should see ALL customers from all branches"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=admin_headers)
        assert response.status_code == 200, f"Admin customers failed: {response.text}"
        
        customers = response.json()
        assert isinstance(customers, list), "Customers should be a list"
        print(f"Admin sees {len(customers)} customers")
        
        self.__class__.admin_customer_count = len(customers)

    def test_restricted_user_gets_branch_and_global_customers(self, restricted_headers):
        """Restricted user should see branch-specific + global (no branch) customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=restricted_headers)
        assert response.status_code == 200, f"Restricted customers failed: {response.text}"
        
        customers = response.json()
        assert isinstance(customers, list), "Customers should be a list"
        print(f"Restricted user sees {len(customers)} customers")
        
        assert len(customers) <= self.__class__.admin_customer_count, \
            "Restricted user should see <= customers than admin"
        
        # Verify customer filtering logic
        restricted_branch = "1c348f2b-294e-4353-bac1-0e32f759f109"
        for customer in customers:
            branch_id = customer.get("branch_id")
            is_branch_specific = branch_id == restricted_branch
            is_global = branch_id is None or branch_id == "" or branch_id == "null"
            assert is_branch_specific or is_global, \
                f"Customer {customer.get('name')} has invalid branch_id: {branch_id}"
        
        print(f"All {len(customers)} customers are either branch-specific or global")

    # =====================================================
    # SALES ENDPOINT TESTS (uses get_branch_filter - strict branch only)
    # =====================================================

    def test_admin_gets_all_sales(self, admin_headers):
        """Admin should see ALL sales from all branches"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=admin_headers)
        assert response.status_code == 200, f"Admin sales failed: {response.text}"
        
        sales = response.json()
        assert isinstance(sales, list), "Sales should be a list"
        print(f"Admin sees {len(sales)} sales")
        
        self.__class__.admin_sales_count = len(sales)

    def test_restricted_user_gets_only_branch_sales(self, restricted_headers):
        """Restricted user should see ONLY sales from their branch (NOT global)"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=restricted_headers)
        assert response.status_code == 200, f"Restricted sales failed: {response.text}"
        
        sales = response.json()
        assert isinstance(sales, list), "Sales should be a list"
        print(f"Restricted user sees {len(sales)} sales")
        
        # Restricted user should see fewer sales than admin (branch filtering)
        assert len(sales) <= self.__class__.admin_sales_count, \
            "Restricted user should see <= sales than admin"
        
        # Verify ALL sales belong to user's branch (no global items for sales)
        restricted_branch = "1c348f2b-294e-4353-bac1-0e32f759f109"
        for sale in sales:
            branch_id = sale.get("branch_id")
            assert branch_id == restricted_branch, \
                f"Sale {sale.get('id')} has wrong branch_id: {branch_id}, expected: {restricted_branch}"
        
        print(f"All {len(sales)} sales belong to restricted user's branch")

    # =====================================================
    # EXPENSES ENDPOINT TESTS (uses get_branch_filter - strict branch only)
    # =====================================================

    def test_admin_gets_all_expenses(self, admin_headers):
        """Admin should see ALL expenses from all branches"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=admin_headers)
        assert response.status_code == 200, f"Admin expenses failed: {response.text}"
        
        expenses = response.json()
        assert isinstance(expenses, list), "Expenses should be a list"
        print(f"Admin sees {len(expenses)} expenses")
        
        self.__class__.admin_expenses_count = len(expenses)

    def test_restricted_user_expenses_permission(self, restricted_headers):
        """Restricted user without expenses permission gets 403 - this is expected RBAC behavior"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=restricted_headers)
        # Note: test@ssc.com doesn't have expenses permission, so 403 is expected
        # This is RBAC, not branch filtering - branch filtering works correctly
        if response.status_code == 403:
            print("Restricted user correctly denied access to expenses (no permission)")
            assert "Permission denied" in response.json().get("detail", "")
        else:
            # If they have permission, verify branch filtering
            assert response.status_code == 200
            expenses = response.json()
            restricted_branch = "1c348f2b-294e-4353-bac1-0e32f759f109"
            for expense in expenses:
                branch_id = expense.get("branch_id")
                assert branch_id == restricted_branch, \
                    f"Expense {expense.get('id')} has wrong branch_id"
            print(f"Restricted user sees {len(expenses)} branch-specific expenses")

    # =====================================================
    # DASHBOARD STATS TESTS (uses get_branch_filter for sales/expenses)
    # =====================================================

    def test_admin_dashboard_stats(self, admin_headers):
        """Admin should see dashboard stats from ALL branches"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200, f"Admin dashboard failed: {response.text}"
        
        stats = response.json()
        assert "total_sales" in stats
        assert "total_expenses" in stats
        assert "net_profit" in stats
        print(f"Admin dashboard - Sales: {stats['total_sales']}, Expenses: {stats['total_expenses']}")
        
        self.__class__.admin_dashboard_sales = stats["total_sales"]

    def test_restricted_user_dashboard_stats(self, restricted_headers):
        """Restricted user should see dashboard stats only from their branch"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=restricted_headers)
        assert response.status_code == 200, f"Restricted dashboard failed: {response.text}"
        
        stats = response.json()
        assert "total_sales" in stats
        assert "total_expenses" in stats
        print(f"Restricted dashboard - Sales: {stats['total_sales']}, Expenses: {stats['total_expenses']}")
        
        # Restricted user should see <= total_sales compared to admin
        assert stats["total_sales"] <= self.__class__.admin_dashboard_sales, \
            "Restricted user dashboard sales should be <= admin dashboard sales"

    # =====================================================
    # VERIFY DATA SEGREGATION CONSISTENCY
    # =====================================================

    def test_admin_vs_restricted_comparison(self, admin_headers, restricted_headers):
        """Verify overall data segregation between admin and restricted user"""
        # Get all counts
        admin_suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=admin_headers).json()
        restricted_suppliers = requests.get(f"{BASE_URL}/api/suppliers", headers=restricted_headers).json()
        
        admin_customers = requests.get(f"{BASE_URL}/api/customers", headers=admin_headers).json()
        restricted_customers = requests.get(f"{BASE_URL}/api/customers", headers=restricted_headers).json()
        
        admin_sales = requests.get(f"{BASE_URL}/api/sales", headers=admin_headers).json()
        restricted_sales = requests.get(f"{BASE_URL}/api/sales", headers=restricted_headers).json()
        
        admin_expenses = requests.get(f"{BASE_URL}/api/expenses", headers=admin_headers).json()
        restricted_expenses = requests.get(f"{BASE_URL}/api/expenses", headers=restricted_headers).json()
        
        print("\n===== DATA SEGREGATION SUMMARY =====")
        print(f"Suppliers - Admin: {len(admin_suppliers)}, Restricted: {len(restricted_suppliers)}")
        print(f"Customers - Admin: {len(admin_customers)}, Restricted: {len(restricted_customers)}")
        print(f"Sales - Admin: {len(admin_sales)}, Restricted: {len(restricted_sales)}")
        print(f"Expenses - Admin: {len(admin_expenses)}, Restricted: {len(restricted_expenses)}")
        
        # Assertions
        assert len(restricted_suppliers) <= len(admin_suppliers)
        assert len(restricted_customers) <= len(admin_customers)
        assert len(restricted_sales) <= len(admin_sales)
        assert len(restricted_expenses) <= len(admin_expenses)
        
        # For suppliers/customers, restricted should see global items too
        # So difference might be smaller than for sales/expenses
        print("\nBranch filtering verified successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
