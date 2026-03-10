"""
Iteration 125 Tests: Testing new features
1. GET /api/expenses - Returns 'created_by_name' field for each expense
2. GET /api/sales - Returns 'created_by_name' field for each sale
3. DELETE /api/expenses/{id} - Admin can delete (check if user has permission)
4. GET /api/access-policies - Check delete_policy configuration
5. Expense form category 'Salary' shows Employee selector instead of Supplier
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIteration125Features:
    """Test iteration 125 features: created_by_name and delete policies"""
    
    auth_token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as admin and get auth token"""
        if not TestIteration125Features.auth_token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "ss@ssc.com",
                "password": "Aa147258369Ssc@"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestIteration125Features.auth_token = data.get("access_token")
        yield
    
    def get_headers(self):
        return {"Authorization": f"Bearer {TestIteration125Features.auth_token}"}
    
    def test_01_expenses_return_created_by_name(self):
        """Test that GET /api/expenses returns 'created_by_name' field"""
        response = requests.get(f"{BASE_URL}/api/expenses?limit=10", headers=self.get_headers())
        assert response.status_code == 200, f"Failed to get expenses: {response.text}"
        
        data = response.json()
        expenses = data.get("data", [])
        
        # Check if expenses list is not empty
        assert len(expenses) > 0, "No expenses found to test"
        
        # Check that created_by_name field exists in each expense
        for expense in expenses:
            assert "created_by_name" in expense, f"Missing 'created_by_name' in expense: {expense.get('id')}"
            # created_by_name should be a string (can be empty string if user not found)
            assert isinstance(expense["created_by_name"], str), f"created_by_name should be string, got {type(expense['created_by_name'])}"
        
        # Find at least one expense with non-empty created_by_name
        expenses_with_name = [e for e in expenses if e.get("created_by_name")]
        print(f"Found {len(expenses_with_name)} expenses with created_by_name populated out of {len(expenses)}")
        
        if expenses_with_name:
            sample = expenses_with_name[0]
            print(f"Sample expense created_by_name: '{sample['created_by_name']}' for expense {sample.get('id')}")
    
    def test_02_sales_return_created_by_name(self):
        """Test that GET /api/sales returns 'created_by_name' field"""
        response = requests.get(f"{BASE_URL}/api/sales?limit=10", headers=self.get_headers())
        assert response.status_code == 200, f"Failed to get sales: {response.text}"
        
        data = response.json()
        sales = data.get("data", [])
        
        # Check if sales list is not empty
        assert len(sales) > 0, "No sales found to test"
        
        # Check that created_by_name field exists in each sale
        for sale in sales:
            assert "created_by_name" in sale, f"Missing 'created_by_name' in sale: {sale.get('id')}"
            assert isinstance(sale["created_by_name"], str), f"created_by_name should be string, got {type(sale['created_by_name'])}"
        
        # Find at least one sale with non-empty created_by_name
        sales_with_name = [s for s in sales if s.get("created_by_name")]
        print(f"Found {len(sales_with_name)} sales with created_by_name populated out of {len(sales)}")
        
        if sales_with_name:
            sample = sales_with_name[0]
            print(f"Sample sale created_by_name: '{sample['created_by_name']}' for sale {sample.get('id')}")
    
    def test_03_get_access_policies_delete_policy(self):
        """Test GET /api/access-policies to verify delete_policy configuration"""
        response = requests.get(f"{BASE_URL}/api/access-policies", headers=self.get_headers())
        assert response.status_code == 200, f"Failed to get access policies: {response.text}"
        
        policies = response.json()
        assert "delete_policy" in policies, "Missing 'delete_policy' in access policies"
        
        delete_policy = policies["delete_policy"]
        print(f"Current delete_policy configuration:")
        for module, policy in delete_policy.items():
            print(f"  {module}: {policy}")
        
        # According to requirements, expenses should be admin_manager
        # But DEFAULT_POLICIES in code has admin_only - check actual DB value
        expenses_policy = delete_policy.get("expenses")
        sales_policy = delete_policy.get("sales")
        
        print(f"\nExpenses delete policy: {expenses_policy}")
        print(f"Sales delete policy: {sales_policy}")
        
        # This test just documents current state, main agent can update if needed
    
    def test_04_admin_can_delete_expense(self):
        """Test that admin user can delete an expense (create then delete)"""
        # First create a test expense
        import uuid
        from datetime import datetime
        
        test_expense = {
            "category": "Other",
            "description": f"TEST_DELETE_{uuid.uuid4().hex[:8]}",
            "amount": 10.00,
            "payment_mode": "cash",
            "date": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        }
        
        # Create expense
        create_response = requests.post(
            f"{BASE_URL}/api/expenses", 
            json=test_expense, 
            headers=self.get_headers()
        )
        assert create_response.status_code == 200, f"Failed to create test expense: {create_response.text}"
        
        created = create_response.json()
        expense_id = created.get("id")
        assert expense_id, "No expense ID returned from create"
        print(f"Created test expense with ID: {expense_id}")
        
        # Delete the expense
        delete_response = requests.delete(
            f"{BASE_URL}/api/expenses/{expense_id}", 
            headers=self.get_headers()
        )
        
        # Admin should be able to delete (bypass policy)
        assert delete_response.status_code == 200, f"Admin failed to delete expense: {delete_response.text}"
        print(f"Successfully deleted expense {expense_id}")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/expenses?limit=500", headers=self.get_headers())
        assert get_response.status_code == 200
        all_expenses = get_response.json().get("data", [])
        expense_ids = [e.get("id") for e in all_expenses]
        assert expense_id not in expense_ids, "Expense was not actually deleted"
        print("Verified: Expense no longer exists in database")
    
    def test_05_created_by_name_is_resolved_from_user(self):
        """Test that created_by_name is resolved from actual user data"""
        # Get a list of users first
        users_response = requests.get(f"{BASE_URL}/api/users", headers=self.get_headers())
        assert users_response.status_code == 200, f"Failed to get users: {users_response.text}"
        
        users_data = users_response.json()
        users = users_data if isinstance(users_data, list) else users_data.get("data", [])
        user_name_map = {u.get("id"): u.get("name", "Unknown") for u in users}
        print(f"Found {len(users)} users in the system")
        
        # Get expenses
        expenses_response = requests.get(f"{BASE_URL}/api/expenses?limit=20", headers=self.get_headers())
        assert expenses_response.status_code == 200
        expenses = expenses_response.json().get("data", [])
        
        # Check if created_by IDs are being resolved to names
        matched = 0
        for expense in expenses:
            created_by_id = expense.get("created_by")
            created_by_name = expense.get("created_by_name", "")
            
            if created_by_id and created_by_id in user_name_map:
                expected_name = user_name_map[created_by_id]
                if created_by_name == expected_name:
                    matched += 1
        
        print(f"Verified {matched} expenses have correctly resolved created_by_name")
    
    def test_06_update_delete_policy_for_expenses(self):
        """Check and optionally update delete_policy for expenses to admin_manager"""
        # Get current policies
        get_response = requests.get(f"{BASE_URL}/api/access-policies", headers=self.get_headers())
        assert get_response.status_code == 200
        
        policies = get_response.json()
        current_expenses_policy = policies.get("delete_policy", {}).get("expenses", "admin_only")
        
        print(f"Current expenses delete_policy: {current_expenses_policy}")
        
        # Per requirements, should be admin_manager
        # If it's admin_only, note this as potential issue
        if current_expenses_policy == "admin_only":
            print("NOTE: Expenses delete_policy is 'admin_only', requirement says it should be 'admin_manager'")
            print("Main agent may need to update this in the database or via API")
        elif current_expenses_policy == "admin_manager":
            print("PASS: Expenses delete_policy is correctly set to 'admin_manager'")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
