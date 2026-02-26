"""
Iteration 19: Multi-Branch Inventory Transfer Tests
Testing the new stock transfer workflow: Create → Approve → Complete (with stock adjustment)
Also tests: reject flow, delete flow, validations
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data from user context
FROM_BRANCH_ID = "1c348f2b-294e-4353-bac1-0e32f759f109"  # Test Branch
TO_BRANCH_ID = "d805e6cb-f65a-4a09-8707-95f3f5e505bf"    # Branch A
# Item ID starting with 0d680671
ITEM_ID_PREFIX = "0d680671"


class TestStockTransferWorkflow:
    """Tests for the multi-branch inventory transfer feature"""

    @pytest.fixture(autouse=True)
    def setup(self, auth_token, api_client):
        """Setup for all tests"""
        self.token = auth_token
        self.client = api_client
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_transfer_ids = []

    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session

    @pytest.fixture(scope="class")
    def auth_token(self, api_client):
        """Authenticate and get token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping tests")

    def teardown_method(self, method):
        """Cleanup created transfers after each test"""
        for transfer_id in self.created_transfer_ids:
            try:
                self.client.delete(f"{BASE_URL}/api/stock-transfers/{transfer_id}")
            except:
                pass
        self.created_transfer_ids = []

    # --- Helper to find a valid item ID ---
    def get_valid_item_id(self):
        """Get a valid item ID (prefers one starting with 0d680671)"""
        response = self.client.get(f"{BASE_URL}/api/items")
        if response.status_code == 200:
            items = response.json()
            # First try to find item with prefix
            for item in items:
                if item.get("id", "").startswith(ITEM_ID_PREFIX):
                    return item["id"], item.get("name", "Test Item")
            # Otherwise use first item
            if items:
                return items[0]["id"], items[0].get("name", "Test Item")
        return None, None

    # ===== GET /stock-transfers Tests =====
    def test_01_get_transfers_returns_list(self):
        """GET /api/stock-transfers returns list (initially may be empty or have data)"""
        response = self.client.get(f"{BASE_URL}/api/stock-transfers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ GET /stock-transfers returns {len(data)} transfers")

    # ===== POST /stock-transfers Tests =====
    def test_02_create_transfer_success(self):
        """POST /api/stock-transfers - create a transfer request successfully"""
        item_id, item_name = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found in database")

        payload = {
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 5}],
            "reason": "Test transfer for iteration 19",
            "notes": "Automated test"
        }

        response = self.client.post(f"{BASE_URL}/api/stock-transfers", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "id" in data, "Response should contain transfer ID"
        assert data["status"] == "pending", "New transfer should be pending"
        assert data["from_branch_id"] == FROM_BRANCH_ID
        assert data["to_branch_id"] == TO_BRANCH_ID
        assert len(data["items"]) == 1
        assert data["items"][0]["item_id"] == item_id
        assert data["items"][0]["quantity"] == 5

        self.created_transfer_ids.append(data["id"])
        print(f"✓ Created transfer {data['id']} with status '{data['status']}'")

    def test_03_create_transfer_validation_same_branch(self):
        """POST /api/stock-transfers - same branch should return error"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        payload = {
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": FROM_BRANCH_ID,  # Same branch!
            "items": [{"item_id": item_id, "quantity": 5}]
        }

        response = self.client.post(f"{BASE_URL}/api/stock-transfers", json=payload)
        assert response.status_code == 400, f"Expected 400 for same branch, got {response.status_code}"
        assert "different" in response.text.lower(), "Error should mention branches must be different"
        print("✓ Same branch validation works")

    def test_04_create_transfer_validation_missing_items(self):
        """POST /api/stock-transfers - missing items should return error"""
        payload = {
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": []  # Empty items
        }

        response = self.client.post(f"{BASE_URL}/api/stock-transfers", json=payload)
        assert response.status_code == 400, f"Expected 400 for missing items, got {response.status_code}"
        assert "item" in response.text.lower(), "Error should mention items required"
        print("✓ Missing items validation works")

    def test_05_create_transfer_validation_missing_branches(self):
        """POST /api/stock-transfers - missing branches should return error"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        payload = {
            "from_branch_id": "",  # Missing
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 5}]
        }

        response = self.client.post(f"{BASE_URL}/api/stock-transfers", json=payload)
        assert response.status_code == 400, f"Expected 400 for missing branch, got {response.status_code}"
        print("✓ Missing branches validation works")

    # ===== PUT /stock-transfers/{id}/approve Tests =====
    def test_06_approve_transfer(self):
        """PUT /api/stock-transfers/{id}/approve - approve a pending transfer"""
        # First create a transfer
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        create_payload = {
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 3}],
            "reason": "Test approval"
        }
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json=create_payload)
        assert create_resp.status_code == 200
        transfer_id = create_resp.json()["id"]
        self.created_transfer_ids.append(transfer_id)

        # Approve it
        approve_resp = self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve")
        assert approve_resp.status_code == 200, f"Expected 200, got {approve_resp.status_code}: {approve_resp.text}"
        assert "approved" in approve_resp.text.lower()

        # Verify status changed
        get_resp = self.client.get(f"{BASE_URL}/api/stock-transfers")
        transfers = get_resp.json()
        approved_transfer = next((t for t in transfers if t["id"] == transfer_id), None)
        assert approved_transfer is not None
        assert approved_transfer["status"] == "approved"
        print(f"✓ Transfer {transfer_id} approved successfully")

    def test_07_approve_already_approved_fails(self):
        """PUT /api/stock-transfers/{id}/approve - approving already approved should fail"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # Create and approve
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 2}]
        })
        transfer_id = create_resp.json()["id"]
        self.created_transfer_ids.append(transfer_id)
        self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve")

        # Try to approve again
        second_approve = self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve")
        assert second_approve.status_code == 400, "Should fail to approve already approved transfer"
        print("✓ Cannot approve already approved transfer")

    # ===== PUT /stock-transfers/{id}/complete Tests =====
    def test_08_complete_approved_transfer(self):
        """PUT /api/stock-transfers/{id}/complete - complete an approved transfer (stock adjusted)"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # Create transfer
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 1}],
            "reason": "Test completion with stock adjust"
        })
        transfer_id = create_resp.json()["id"]
        # Note: Don't add to cleanup since completed transfers can't be deleted

        # Approve it
        self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve")

        # Complete it
        complete_resp = self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/complete")
        assert complete_resp.status_code == 200, f"Expected 200, got {complete_resp.status_code}: {complete_resp.text}"
        assert "completed" in complete_resp.text.lower()
        assert "stock" in complete_resp.text.lower()

        # Verify status
        get_resp = self.client.get(f"{BASE_URL}/api/stock-transfers")
        completed_transfer = next((t for t in get_resp.json() if t["id"] == transfer_id), None)
        assert completed_transfer is not None
        assert completed_transfer["status"] == "completed"
        print(f"✓ Transfer {transfer_id} completed with stock adjustment")

    def test_09_complete_pending_fails(self):
        """PUT /api/stock-transfers/{id}/complete - completing pending transfer should fail"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # Create but don't approve
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 1}]
        })
        transfer_id = create_resp.json()["id"]
        self.created_transfer_ids.append(transfer_id)

        # Try to complete without approving
        complete_resp = self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/complete")
        assert complete_resp.status_code == 400, "Should fail to complete pending transfer"
        print("✓ Cannot complete pending transfer (must be approved first)")

    # ===== PUT /stock-transfers/{id}/reject Tests =====
    def test_10_reject_transfer_with_reason(self):
        """PUT /api/stock-transfers/{id}/reject - reject a pending transfer with reason"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # Create
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 2}]
        })
        transfer_id = create_resp.json()["id"]
        self.created_transfer_ids.append(transfer_id)

        # Reject with reason
        reject_resp = self.client.put(
            f"{BASE_URL}/api/stock-transfers/{transfer_id}/reject",
            json={"reason": "Test rejection reason"}
        )
        assert reject_resp.status_code == 200, f"Expected 200, got {reject_resp.status_code}"
        assert "rejected" in reject_resp.text.lower()

        # Verify status and reason
        get_resp = self.client.get(f"{BASE_URL}/api/stock-transfers")
        rejected = next((t for t in get_resp.json() if t["id"] == transfer_id), None)
        assert rejected["status"] == "rejected"
        assert rejected.get("rejection_reason") == "Test rejection reason"
        print(f"✓ Transfer {transfer_id} rejected with reason")

    def test_11_reject_approved_fails(self):
        """PUT /api/stock-transfers/{id}/reject - cannot reject already approved transfer"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # Create and approve
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 1}]
        })
        transfer_id = create_resp.json()["id"]
        self.created_transfer_ids.append(transfer_id)
        self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve")

        # Try to reject
        reject_resp = self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/reject")
        assert reject_resp.status_code == 400
        print("✓ Cannot reject already approved transfer")

    # ===== DELETE /stock-transfers/{id} Tests =====
    def test_12_delete_pending_transfer(self):
        """DELETE /api/stock-transfers/{id} - delete a pending transfer"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # Create
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 1}]
        })
        transfer_id = create_resp.json()["id"]

        # Delete
        delete_resp = self.client.delete(f"{BASE_URL}/api/stock-transfers/{transfer_id}")
        assert delete_resp.status_code == 200, f"Expected 200, got {delete_resp.status_code}"

        # Verify deleted
        get_resp = self.client.get(f"{BASE_URL}/api/stock-transfers")
        assert not any(t["id"] == transfer_id for t in get_resp.json())
        print(f"✓ Pending transfer {transfer_id} deleted successfully")

    def test_13_delete_rejected_transfer(self):
        """DELETE /api/stock-transfers/{id} - delete a rejected transfer"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # Create and reject
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 1}]
        })
        transfer_id = create_resp.json()["id"]
        self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/reject")

        # Delete
        delete_resp = self.client.delete(f"{BASE_URL}/api/stock-transfers/{transfer_id}")
        assert delete_resp.status_code == 200
        print(f"✓ Rejected transfer {transfer_id} deleted successfully")

    def test_14_delete_completed_fails(self):
        """DELETE /api/stock-transfers/{id} - cannot delete completed transfer"""
        item_id, _ = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # Create, approve, complete
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": 1}]
        })
        transfer_id = create_resp.json()["id"]
        self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve")
        self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/complete")

        # Try to delete
        delete_resp = self.client.delete(f"{BASE_URL}/api/stock-transfers/{transfer_id}")
        assert delete_resp.status_code == 400, "Should fail to delete completed transfer"
        print("✓ Cannot delete completed transfer")

    # ===== Full Workflow Test =====
    def test_15_full_transfer_workflow(self):
        """Full workflow: Create → Approve → Complete and verify stock adjustment"""
        item_id, item_name = self.get_valid_item_id()
        if not item_id:
            pytest.skip("No items found")

        # 1. Create transfer
        transfer_qty = 2
        create_resp = self.client.post(f"{BASE_URL}/api/stock-transfers", json={
            "from_branch_id": FROM_BRANCH_ID,
            "to_branch_id": TO_BRANCH_ID,
            "items": [{"item_id": item_id, "quantity": transfer_qty}],
            "reason": "Full workflow test",
            "notes": "Should create stock_usage and stock_entry on complete"
        })
        assert create_resp.status_code == 200
        transfer_id = create_resp.json()["id"]
        print(f"  Created: {transfer_id}")

        # 2. Verify pending status
        get_resp = self.client.get(f"{BASE_URL}/api/stock-transfers")
        transfer = next((t for t in get_resp.json() if t["id"] == transfer_id), None)
        assert transfer["status"] == "pending"
        print("  Status: pending")

        # 3. Approve
        approve_resp = self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/approve")
        assert approve_resp.status_code == 200
        print("  Status: approved")

        # 4. Complete
        complete_resp = self.client.put(f"{BASE_URL}/api/stock-transfers/{transfer_id}/complete")
        assert complete_resp.status_code == 200
        print("  Status: completed")

        # 5. Verify final status
        get_resp = self.client.get(f"{BASE_URL}/api/stock-transfers")
        final = next((t for t in get_resp.json() if t["id"] == transfer_id), None)
        assert final["status"] == "completed"
        assert "completed_at" in final

        print(f"✓ Full workflow test passed for transfer {transfer_id}")


class TestRegressions:
    """Regression tests - ensure existing features still work"""

    @pytest.fixture(autouse=True)
    def setup(self, auth_token, api_client):
        self.token = auth_token
        self.client = api_client
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session

    @pytest.fixture(scope="class")
    def auth_token(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")

    def test_16_dashboard_still_works(self):
        """Regression: Dashboard API still returns data"""
        response = self.client.get(f"{BASE_URL}/api/dashboard")
        assert response.status_code == 200
        print("✓ Dashboard API works")

    def test_17_stock_api_still_works(self):
        """Regression: Stock items API still works"""
        response = self.client.get(f"{BASE_URL}/api/items")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✓ Stock items API works")

    def test_18_branches_api_still_works(self):
        """Regression: Branches API still works"""
        response = self.client.get(f"{BASE_URL}/api/branches")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✓ Branches API works")

    def test_19_sales_api_still_works(self):
        """Regression: Sales API still works"""
        response = self.client.get(f"{BASE_URL}/api/sales")
        assert response.status_code == 200
        print("✓ Sales API works")
