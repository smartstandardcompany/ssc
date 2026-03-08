"""
Iteration 109 Tests: Bank Account Summary Auto-calculation and Sales Form Changes
Features tested:
1. GET /api/bank-accounts/summary - Auto-calculated totals per bank account
2. Sales form no longer has bank_account_id field
3. Dashboard Bank Account Summary widget 
4. Branch Dues drill-down detail endpoint
5. Bank Accounts CRUD still works
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Auth failed: {response.text}"
    data = response.json()
    return data.get("access_token") or data.get("token")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestBankAccountSummary:
    """Test auto-calculated bank account summary endpoint"""
    
    def test_get_bank_accounts_summary_endpoint_exists(self, auth_headers):
        """GET /api/bank-accounts/summary should return 200"""
        response = requests.get(f"{BASE_URL}/api/bank-accounts/summary", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASSED: /api/bank-accounts/summary endpoint exists and returns 200")
    
    def test_summary_response_structure(self, auth_headers):
        """Verify summary response has correct structure"""
        response = requests.get(f"{BASE_URL}/api/bank-accounts/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level fields
        assert "accounts" in data, "Missing 'accounts' field"
        assert "total_bank_incoming" in data, "Missing 'total_bank_incoming' field"
        assert "total_bank_outgoing" in data, "Missing 'total_bank_outgoing' field"
        assert "total_bank_net" in data, "Missing 'total_bank_net' field"
        
        print(f"PASSED: Summary structure correct - accounts: {len(data['accounts'])}, "
              f"total_incoming: {data['total_bank_incoming']}, total_outgoing: {data['total_bank_outgoing']}, "
              f"total_net: {data['total_bank_net']}")
    
    def test_each_account_has_required_fields(self, auth_headers):
        """Each bank account in summary should have required fields"""
        response = requests.get(f"{BASE_URL}/api/bank-accounts/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["accounts"]) > 0:
            acc = data["accounts"][0]
            required_fields = ["id", "name", "bank_name", "account_number", "assigned_branch", 
                             "is_default", "incoming", "outgoing", "net", "sales_count"]
            for field in required_fields:
                assert field in acc, f"Missing field '{field}' in account"
            print(f"PASSED: Account has all required fields: {required_fields}")
            print(f"  Sample account: {acc['name']} - In: {acc['incoming']}, Out: {acc['outgoing']}, Net: {acc['net']}")
        else:
            print("INFO: No bank accounts found in summary")
    
    def test_summary_totals_are_numeric(self, auth_headers):
        """Verify totals are numeric values"""
        response = requests.get(f"{BASE_URL}/api/bank-accounts/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data["total_bank_incoming"], (int, float))
        assert isinstance(data["total_bank_outgoing"], (int, float))
        assert isinstance(data["total_bank_net"], (int, float))
        
        # Verify net = incoming - outgoing
        expected_net = round(data["total_bank_incoming"] - data["total_bank_outgoing"], 2)
        actual_net = round(data["total_bank_net"], 2)
        assert expected_net == actual_net, f"Net mismatch: expected {expected_net}, got {actual_net}"
        
        print(f"PASSED: Totals are numeric and net calculation is correct")


class TestBranchDuesDetail:
    """Test branch dues drill-down detail endpoint"""
    
    def test_branch_dues_detail_endpoint_exists(self, auth_headers):
        """GET /api/reports/branch-dues-detail should return 200"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-dues-detail", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("PASSED: /api/reports/branch-dues-detail endpoint exists")
    
    def test_branch_dues_detail_structure(self, auth_headers):
        """Verify response structure has entries and total"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-dues-detail", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "entries" in data, "Missing 'entries' field"
        assert "total" in data, "Missing 'total' field"
        assert isinstance(data["entries"], list)
        
        print(f"PASSED: Branch dues detail structure correct - {data['total']} total entries")
    
    def test_entry_fields_if_entries_exist(self, auth_headers):
        """If entries exist, verify each entry has required fields"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-dues-detail", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["entries"]) > 0:
            entry = data["entries"][0]
            required_fields = ["type", "from_branch", "to_branch", "amount", "description", "date"]
            for field in required_fields:
                assert field in entry, f"Missing field '{field}' in entry"
            print(f"PASSED: Entry has required fields. Sample: {entry['type']} from {entry['from_branch']} to {entry['to_branch']}")
        else:
            print("INFO: No cross-branch transactions found")


class TestBankAccountsCRUD:
    """Test Bank Accounts CRUD still works correctly"""
    
    def test_get_bank_accounts(self, auth_headers):
        """GET /api/bank-accounts should return list"""
        response = requests.get(f"{BASE_URL}/api/bank-accounts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"PASSED: GET /api/bank-accounts returns {len(data)} accounts")
    
    def test_create_update_delete_bank_account(self, auth_headers):
        """Test full CRUD cycle for bank account"""
        # CREATE
        create_payload = {
            "name": "TEST_Bank_Account_Iter109",
            "bank_name": "Test Bank",
            "account_number": "9999999109",
            "iban": "SA1234567890",
            "branch_id": None,
            "is_default": False,
            "notes": "Test account for iteration 109"
        }
        create_res = requests.post(f"{BASE_URL}/api/bank-accounts", json=create_payload, headers=auth_headers)
        assert create_res.status_code == 200, f"Create failed: {create_res.text}"
        created = create_res.json()
        assert "id" in created
        account_id = created["id"]
        print(f"PASSED: Created bank account {account_id}")
        
        # VERIFY via GET
        get_res = requests.get(f"{BASE_URL}/api/bank-accounts", headers=auth_headers)
        assert get_res.status_code == 200
        accounts = get_res.json()
        found = any(a["id"] == account_id for a in accounts)
        assert found, "Created account not found in list"
        print(f"PASSED: Verified account exists in list")
        
        # UPDATE
        update_payload = {
            "name": "TEST_Bank_Account_Iter109_Updated",
            "bank_name": "Updated Bank",
            "account_number": "9999999109",
            "iban": "SA9876543210",
            "branch_id": None,
            "is_default": False,
            "notes": "Updated notes"
        }
        update_res = requests.put(f"{BASE_URL}/api/bank-accounts/{account_id}", json=update_payload, headers=auth_headers)
        assert update_res.status_code == 200, f"Update failed: {update_res.text}"
        updated = update_res.json()
        assert updated["name"] == "TEST_Bank_Account_Iter109_Updated"
        print(f"PASSED: Updated bank account")
        
        # DELETE
        delete_res = requests.delete(f"{BASE_URL}/api/bank-accounts/{account_id}", headers=auth_headers)
        assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
        print(f"PASSED: Deleted bank account")
        
        # VERIFY deletion
        get_res2 = requests.get(f"{BASE_URL}/api/bank-accounts", headers=auth_headers)
        accounts2 = get_res2.json()
        not_found = not any(a["id"] == account_id for a in accounts2)
        assert not_found, "Account still exists after delete"
        print(f"PASSED: Verified account deleted from list")


class TestBranchDuesNet:
    """Test branch dues net endpoint for dashboard"""
    
    def test_branch_dues_net_endpoint(self, auth_headers):
        """GET /api/reports/branch-dues-net should return 200"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-dues-net", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Should have dues/paybacks structure
        assert "dues" in data or "total_dues" in data, "Missing dues data"
        print(f"PASSED: Branch dues net endpoint works")


class TestSalesEndpoint:
    """Test that sales endpoint works without bank_account_id"""
    
    def test_get_sales(self, auth_headers):
        """GET /api/sales should return sales data"""
        response = requests.get(f"{BASE_URL}/api/sales?page=1&limit=5", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "data" in data or isinstance(data, list)
        print(f"PASSED: GET /api/sales returns data")
    
    def test_sales_no_bank_account_id_field_required(self, auth_headers):
        """Verify sales can be created without bank_account_id (removed from form)"""
        # First get a branch
        branches_res = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert branches_res.status_code == 200
        branches = branches_res.json()
        if not branches:
            pytest.skip("No branches available for test")
        
        branch_id = branches[0]["id"]
        
        # Create sale with bank payment but NO bank_account_id field
        # Note: amount field is still required by backend (sum of payment_details)
        sale_payload = {
            "sale_type": "branch",
            "branch_id": branch_id,
            "amount": 100.00,  # Required by backend model
            "payment_details": [{"mode": "bank", "amount": 100.00}],
            "discount": 0,
            "date": "2026-01-15T10:00:00Z",
            "notes": "TEST_Sale_No_BankAccountId_Iter109"
        }
        
        create_res = requests.post(f"{BASE_URL}/api/sales", json=sale_payload, headers=auth_headers)
        # Should succeed without bank_account_id
        assert create_res.status_code == 200, f"Sale creation failed: {create_res.text}"
        created = create_res.json()
        sale_id = created.get("id")
        
        # Verify no bank_account_id is required or returned
        # The key point is: sale was created successfully without specifying bank_account_id
        print(f"PASSED: Sale created successfully without bank_account_id field - ID: {sale_id}")
        
        # Cleanup: delete the test sale
        if sale_id:
            del_res = requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=auth_headers)
            print(f"INFO: Cleaned up test sale")


class TestDashboardStats:
    """Test dashboard stats endpoint"""
    
    def test_dashboard_stats(self, auth_headers):
        """GET /api/dashboard/stats should return stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check some key fields exist
        assert "total_sales" in data
        assert "total_expenses" in data
        print(f"PASSED: Dashboard stats endpoint works - Sales: {data['total_sales']}, Expenses: {data['total_expenses']}")
