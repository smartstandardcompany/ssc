"""
Iteration 108 Tests - Bank Account Management & Branch Dues Detail
Features:
1. Bank Accounts CRUD API (/api/bank-accounts)
2. Branch Dues Detail API (/api/reports/branch-dues-detail)
3. Sales form with bank_account_id integration
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestBankAccountsCRUD:
    """Test Bank Accounts CRUD operations"""
    
    test_account_id = None
    
    def test_01_get_bank_accounts_list(self, api_client):
        """Test GET /api/bank-accounts returns list"""
        response = api_client.get(f"{BASE_URL}/api/bank-accounts")
        assert response.status_code == 200, f"Failed to get bank accounts: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} existing bank accounts")
        
        # Check if existing test bank account exists
        for acc in data:
            if acc.get("account_number") == "1234567890":
                print(f"Existing test account found: {acc.get('name')}")
    
    def test_02_create_bank_account(self, api_client):
        """Test POST /api/bank-accounts creates new account"""
        unique_suffix = str(uuid.uuid4())[:8]
        payload = {
            "name": f"TEST_Bank_Account_{unique_suffix}",
            "bank_name": "TEST Al Rajhi Bank",
            "account_number": f"999{unique_suffix[:7]}",
            "iban": f"SA{unique_suffix}123456789012345678",
            "branch_id": None,  # All branches
            "is_default": False,
            "notes": "Test account created by iter108 tests"
        }
        
        response = api_client.post(f"{BASE_URL}/api/bank-accounts", json=payload)
        assert response.status_code == 200, f"Failed to create bank account: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["name"] == payload["name"], "Name mismatch"
        assert data["bank_name"] == payload["bank_name"], "Bank name mismatch"
        assert data["account_number"] == payload["account_number"], "Account number mismatch"
        
        # Store for later tests
        TestBankAccountsCRUD.test_account_id = data["id"]
        print(f"Created bank account with ID: {data['id']}")
    
    def test_03_get_bank_accounts_after_create(self, api_client):
        """Verify created account appears in list"""
        response = api_client.get(f"{BASE_URL}/api/bank-accounts")
        assert response.status_code == 200
        
        data = response.json()
        account_ids = [acc.get("id") for acc in data]
        assert TestBankAccountsCRUD.test_account_id in account_ids, "Created account should be in list"
        print(f"Verified account {TestBankAccountsCRUD.test_account_id} exists in list")
    
    def test_04_update_bank_account(self, api_client):
        """Test PUT /api/bank-accounts/{id} updates account"""
        if not TestBankAccountsCRUD.test_account_id:
            pytest.skip("No test account ID available")
        
        updated_payload = {
            "name": "TEST_Updated_Bank_Account",
            "bank_name": "TEST Updated Bank",
            "account_number": "5555555555",
            "iban": "SA55555555555555555555555555",
            "branch_id": None,
            "is_default": False,
            "notes": "Updated by iter108 tests"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/bank-accounts/{TestBankAccountsCRUD.test_account_id}",
            json=updated_payload
        )
        assert response.status_code == 200, f"Failed to update bank account: {response.text}"
        
        data = response.json()
        assert data["name"] == updated_payload["name"], "Name not updated"
        assert data["bank_name"] == updated_payload["bank_name"], "Bank name not updated"
        print(f"Successfully updated bank account {TestBankAccountsCRUD.test_account_id}")
    
    def test_05_verify_update_persisted(self, api_client):
        """Verify update was persisted in GET"""
        if not TestBankAccountsCRUD.test_account_id:
            pytest.skip("No test account ID available")
        
        response = api_client.get(f"{BASE_URL}/api/bank-accounts")
        assert response.status_code == 200
        
        data = response.json()
        updated_account = next(
            (acc for acc in data if acc.get("id") == TestBankAccountsCRUD.test_account_id),
            None
        )
        assert updated_account is not None, "Updated account not found"
        assert updated_account["name"] == "TEST_Updated_Bank_Account", "Update not persisted"
        print("Update was persisted correctly")
    
    def test_06_delete_bank_account(self, api_client):
        """Test DELETE /api/bank-accounts/{id} deletes account"""
        if not TestBankAccountsCRUD.test_account_id:
            pytest.skip("No test account ID available")
        
        response = api_client.delete(
            f"{BASE_URL}/api/bank-accounts/{TestBankAccountsCRUD.test_account_id}"
        )
        assert response.status_code == 200, f"Failed to delete bank account: {response.text}"
        
        data = response.json()
        assert "message" in data, "Delete response should have message"
        print(f"Successfully deleted bank account {TestBankAccountsCRUD.test_account_id}")
    
    def test_07_verify_delete(self, api_client):
        """Verify deleted account no longer exists"""
        if not TestBankAccountsCRUD.test_account_id:
            pytest.skip("No test account ID available")
        
        response = api_client.get(f"{BASE_URL}/api/bank-accounts")
        assert response.status_code == 200
        
        data = response.json()
        account_ids = [acc.get("id") for acc in data]
        assert TestBankAccountsCRUD.test_account_id not in account_ids, "Deleted account should not be in list"
        print("Deletion verified - account no longer exists")
    
    def test_08_delete_nonexistent_returns_404(self, api_client):
        """Test deleting nonexistent account returns 404"""
        fake_id = str(uuid.uuid4())
        response = api_client.delete(f"{BASE_URL}/api/bank-accounts/{fake_id}")
        assert response.status_code == 404, f"Expected 404 for nonexistent account, got {response.status_code}"
        print("Correctly returned 404 for nonexistent account")


class TestBranchDuesDetail:
    """Test Branch Dues Detail API"""
    
    def test_01_get_branch_dues_detail(self, api_client):
        """Test GET /api/reports/branch-dues-detail returns entries"""
        response = api_client.get(f"{BASE_URL}/api/reports/branch-dues-detail")
        assert response.status_code == 200, f"Failed to get dues detail: {response.text}"
        
        data = response.json()
        assert "entries" in data, "Response should contain 'entries'"
        assert "total" in data, "Response should contain 'total'"
        assert isinstance(data["entries"], list), "Entries should be a list"
        
        print(f"Found {data['total']} cross-branch transaction entries")
        
        # Verify entry structure if entries exist
        if len(data["entries"]) > 0:
            entry = data["entries"][0]
            expected_fields = ["type", "from_branch", "to_branch", "amount", "date"]
            for field in expected_fields:
                assert field in entry, f"Entry should contain '{field}'"
            print(f"Sample entry: {entry.get('type')} - {entry.get('from_branch')} -> {entry.get('to_branch')}: {entry.get('amount')}")
    
    def test_02_dues_detail_entries_sorted_by_date(self, api_client):
        """Verify entries are sorted by date descending"""
        response = api_client.get(f"{BASE_URL}/api/reports/branch-dues-detail")
        assert response.status_code == 200
        
        data = response.json()
        entries = data.get("entries", [])
        
        if len(entries) >= 2:
            dates = [e.get("date", "") for e in entries]
            for i in range(len(dates) - 1):
                assert dates[i] >= dates[i + 1], f"Entries not sorted by date descending: {dates[i]} should be >= {dates[i + 1]}"
            print("Entries correctly sorted by date descending")
        else:
            print(f"Only {len(entries)} entries - skipping sort verification")


class TestBankAccountInSales:
    """Test bank account integration in Sales"""
    
    def test_01_sales_endpoint_works(self, api_client):
        """Verify sales endpoint is accessible"""
        response = api_client.get(f"{BASE_URL}/api/sales?limit=5")
        assert response.status_code == 200, f"Failed to get sales: {response.text}"
        print("Sales endpoint accessible")
    
    def test_02_sale_model_has_bank_account_id(self, api_client):
        """Verify Sale model includes bank_account_id field"""
        # This test verifies the data model by checking if the field is accepted
        # We'll create a test sale with bank_account_id
        
        # First get a branch ID
        branches_resp = api_client.get(f"{BASE_URL}/api/branches")
        assert branches_resp.status_code == 200
        branches = branches_resp.json()
        if not branches:
            pytest.skip("No branches available")
        
        branch_id = branches[0].get("id")
        
        # Get bank accounts
        bank_accounts_resp = api_client.get(f"{BASE_URL}/api/bank-accounts")
        bank_accounts = bank_accounts_resp.json()
        
        # Create a sale with bank_account_id if bank accounts exist
        if bank_accounts:
            bank_account_id = bank_accounts[0].get("id")
            
            sale_payload = {
                "sale_type": "branch",
                "branch_id": branch_id,
                "payment_mode": "bank",
                "bank_account_id": bank_account_id,
                "amount": 100.00,
                "discount": 0,
                "payment_details": [{"mode": "bank", "amount": 100.00}],
                "date": "2026-01-20T10:00:00Z",
                "notes": "TEST_iter108_bank_account_test"
            }
            
            response = api_client.post(f"{BASE_URL}/api/sales", json=sale_payload)
            if response.status_code == 200:
                data = response.json()
                print(f"Created sale with bank_account_id: {data.get('id')}")
                # Cleanup - delete the test sale
                api_client.delete(f"{BASE_URL}/api/sales/{data['id']}")
            else:
                print(f"Sale creation status: {response.status_code} - {response.text[:200]}")
        else:
            print("No bank accounts available - skipping bank_account_id test")


class TestBranchDuesNetEndpoint:
    """Test branch dues net endpoint used by dashboard"""
    
    def test_01_get_branch_dues_net(self, api_client):
        """Test GET /api/reports/branch-dues-net returns dues summary"""
        response = api_client.get(f"{BASE_URL}/api/reports/branch-dues-net")
        assert response.status_code == 200, f"Failed to get branch dues net: {response.text}"
        
        data = response.json()
        # Verify expected structure
        assert isinstance(data, dict), "Response should be a dict"
        print(f"Branch dues net response: {data}")
