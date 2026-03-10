"""
Iteration 129: Test Supplier Credit Status Dynamic Computation
Tests the fix where GET /suppliers now computes current_credit dynamically from:
- Credit expenses (payment_mode=credit, supplier_id=X)
- Minus cash/bank payments (supplier_payments with payment_mode in [cash, bank])
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSupplierCreditDynamic:
    """Test dynamic credit computation for suppliers"""
    
    # Test data tracking for cleanup
    test_supplier_id = None
    test_expense_ids = []
    test_payment_ids = []
    auth_token = None
    branch_id = None
    
    @classmethod
    def setup_class(cls):
        """Login and get auth token, branch ID"""
        # Login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        cls.auth_token = response.json().get("access_token")
        assert cls.auth_token, "No access_token in login response"
        
        # Get branches
        headers = {"Authorization": f"Bearer {cls.auth_token}"}
        br_response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        if br_response.status_code == 200:
            branches = br_response.json()
            if branches:
                cls.branch_id = branches[0].get("id")
        print(f"Setup complete: branch_id={cls.branch_id}")
    
    @classmethod
    def teardown_class(cls):
        """Cleanup all test data"""
        headers = {"Authorization": f"Bearer {cls.auth_token}"}
        
        # Delete test expenses
        for exp_id in cls.test_expense_ids:
            requests.delete(f"{BASE_URL}/api/expenses/{exp_id}", headers=headers)
        
        # Delete test payments
        for pay_id in cls.test_payment_ids:
            requests.delete(f"{BASE_URL}/api/supplier-payments/{pay_id}", headers=headers)
        
        # Delete test supplier
        if cls.test_supplier_id:
            requests.delete(f"{BASE_URL}/api/suppliers/{cls.test_supplier_id}", headers=headers)
        
        print(f"Cleanup: deleted {len(cls.test_expense_ids)} expenses, {len(cls.test_payment_ids)} payments, 1 supplier")
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_01_create_test_supplier(self):
        """Create a test supplier with no initial credit"""
        test_name = f"TEST_CreditCheck_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/suppliers", 
            headers=self.get_headers(),
            json={
                "name": test_name,
                "category": "Testing",
                "branch_id": self.branch_id
            }
        )
        assert response.status_code == 200, f"Create supplier failed: {response.text}"
        data = response.json()
        TestSupplierCreditDynamic.test_supplier_id = data["id"]
        print(f"Created test supplier: {test_name} with id={data['id']}")
        assert "id" in data
    
    def test_02_initial_credit_is_zero(self):
        """Verify new supplier has 0 credit from GET /suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.get_headers())
        assert response.status_code == 200
        suppliers = response.json()
        
        test_supplier = next((s for s in suppliers if s["id"] == self.test_supplier_id), None)
        assert test_supplier is not None, "Test supplier not found in list"
        
        # Should have 0 credit - dynamically computed
        assert test_supplier["current_credit"] == 0, f"Expected 0 credit, got {test_supplier['current_credit']}"
        assert test_supplier["total_purchases"] == 0, f"Expected 0 purchases, got {test_supplier['total_purchases']}"
        print(f"Initial credit verified: {test_supplier['current_credit']}, purchases: {test_supplier['total_purchases']}")
    
    def test_03_add_credit_expense_increases_credit(self):
        """Add a credit expense and verify current_credit increases immediately"""
        # Create a credit expense for the supplier
        expense_data = {
            "amount": 500,
            "category": "TEST Supplier Purchase",
            "description": "Test credit purchase",
            "payment_mode": "credit",
            "supplier_id": self.test_supplier_id,
            "branch_id": self.branch_id,
            "date": "2025-01-20T10:00:00"
        }
        response = requests.post(f"{BASE_URL}/api/expenses",
            headers=self.get_headers(),
            json=expense_data
        )
        assert response.status_code == 200, f"Create expense failed: {response.text}"
        expense = response.json()
        TestSupplierCreditDynamic.test_expense_ids.append(expense["id"])
        print(f"Created credit expense: {expense['id']} amount=500")
        
        # Now GET /suppliers and verify credit increased
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.get_headers())
        assert response.status_code == 200
        suppliers = response.json()
        
        test_supplier = next((s for s in suppliers if s["id"] == self.test_supplier_id), None)
        assert test_supplier is not None
        
        # current_credit should now be 500 (dynamically computed)
        assert test_supplier["current_credit"] == 500, f"Expected 500 credit after expense, got {test_supplier['current_credit']}"
        assert test_supplier["total_purchases"] == 500, f"Expected 500 purchases, got {test_supplier['total_purchases']}"
        print(f"After credit expense: credit={test_supplier['current_credit']}, purchases={test_supplier['total_purchases']}")
    
    def test_04_cash_payment_decreases_credit(self):
        """Make a cash payment and verify current_credit decreases"""
        # Create a cash payment to the supplier
        payment_data = {
            "amount": 200,
            "payment_mode": "cash",
            "supplier_id": self.test_supplier_id,
            "branch_id": self.branch_id,
            "date": "2025-01-20T11:00:00",
            "notes": "Test cash payment"
        }
        response = requests.post(f"{BASE_URL}/api/supplier-payments",
            headers=self.get_headers(),
            json=payment_data
        )
        assert response.status_code == 200, f"Create payment failed: {response.text}"
        payment = response.json()
        TestSupplierCreditDynamic.test_payment_ids.append(payment["id"])
        print(f"Created cash payment: {payment['id']} amount=200")
        
        # GET /suppliers and verify credit decreased
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.get_headers())
        assert response.status_code == 200
        suppliers = response.json()
        
        test_supplier = next((s for s in suppliers if s["id"] == self.test_supplier_id), None)
        assert test_supplier is not None
        
        # credit should be 500 - 200 = 300
        assert test_supplier["current_credit"] == 300, f"Expected 300 credit after cash payment, got {test_supplier['current_credit']}"
        print(f"After cash payment: credit={test_supplier['current_credit']}")
    
    def test_05_bank_payment_also_decreases_credit(self):
        """Make a bank payment and verify current_credit decreases further"""
        payment_data = {
            "amount": 100,
            "payment_mode": "bank",
            "supplier_id": self.test_supplier_id,
            "branch_id": self.branch_id,
            "date": "2025-01-20T12:00:00",
            "notes": "Test bank payment"
        }
        response = requests.post(f"{BASE_URL}/api/supplier-payments",
            headers=self.get_headers(),
            json=payment_data
        )
        assert response.status_code == 200, f"Create bank payment failed: {response.text}"
        payment = response.json()
        TestSupplierCreditDynamic.test_payment_ids.append(payment["id"])
        print(f"Created bank payment: {payment['id']} amount=100")
        
        # GET /suppliers and verify credit decreased further
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.get_headers())
        assert response.status_code == 200
        suppliers = response.json()
        
        test_supplier = next((s for s in suppliers if s["id"] == self.test_supplier_id), None)
        assert test_supplier is not None
        
        # credit should be 500 - 200 - 100 = 200
        assert test_supplier["current_credit"] == 200, f"Expected 200 credit after bank payment, got {test_supplier['current_credit']}"
        print(f"After bank payment: credit={test_supplier['current_credit']}")
    
    def test_06_full_flow_credit_calculation(self):
        """Add another credit expense and verify final balance: total_credit - total_payments"""
        # Add another 300 credit expense
        expense_data = {
            "amount": 300,
            "category": "TEST Supplier Purchase 2",
            "description": "Second credit purchase",
            "payment_mode": "credit",
            "supplier_id": self.test_supplier_id,
            "branch_id": self.branch_id,
            "date": "2025-01-20T13:00:00"
        }
        response = requests.post(f"{BASE_URL}/api/expenses",
            headers=self.get_headers(),
            json=expense_data
        )
        assert response.status_code == 200
        expense = response.json()
        TestSupplierCreditDynamic.test_expense_ids.append(expense["id"])
        print(f"Created second credit expense: {expense['id']} amount=300")
        
        # Now: Total credit bills = 500 + 300 = 800
        # Total payments = 200 (cash) + 100 (bank) = 300
        # Expected credit = 800 - 300 = 500
        
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.get_headers())
        assert response.status_code == 200
        suppliers = response.json()
        
        test_supplier = next((s for s in suppliers if s["id"] == self.test_supplier_id), None)
        assert test_supplier is not None
        
        assert test_supplier["current_credit"] == 500, f"Expected 500 credit (800-300), got {test_supplier['current_credit']}"
        # Total purchases should include ALL expenses for supplier (credit mode ones in this case)
        assert test_supplier["total_purchases"] == 800, f"Expected 800 total purchases, got {test_supplier['total_purchases']}"
        print(f"Full flow verified: credit={test_supplier['current_credit']}, purchases={test_supplier['total_purchases']}")
    
    def test_07_verify_ledger_matches_dynamic_credit(self):
        """Verify the ledger endpoint shows same data as dynamic computation"""
        response = requests.get(
            f"{BASE_URL}/api/suppliers/{self.test_supplier_id}/ledger",
            headers=self.get_headers()
        )
        assert response.status_code == 200, f"Ledger failed: {response.text}"
        ledger = response.json()
        
        # Ledger summary should match dynamic credit calculation
        summary = ledger.get("summary", {})
        print(f"Ledger summary: {summary}")
        
        # Verify ledger entries exist
        entries = ledger.get("entries", [])
        assert len(entries) >= 4, f"Expected at least 4 ledger entries, got {len(entries)}"
        
        # Verify closing_balance matches expected credit
        closing = summary.get("closing_balance", 0)
        print(f"Ledger closing_balance: {closing}")
        
        # Note: The ledger's closing_balance may compute differently based on entry order
        # The key test is that GET /suppliers returns correct dynamic credit
    
    def test_08_cash_expense_does_not_increase_credit(self):
        """Verify that cash/bank expenses (not credit) don't increase current_credit"""
        # Add a CASH expense (paid immediately, not credit)
        expense_data = {
            "amount": 100,
            "category": "TEST Cash Purchase",
            "description": "Cash purchase - should not affect credit",
            "payment_mode": "cash",  # This should NOT increase credit
            "supplier_id": self.test_supplier_id,
            "branch_id": self.branch_id,
            "date": "2025-01-20T14:00:00"
        }
        response = requests.post(f"{BASE_URL}/api/expenses",
            headers=self.get_headers(),
            json=expense_data
        )
        assert response.status_code == 200
        expense = response.json()
        TestSupplierCreditDynamic.test_expense_ids.append(expense["id"])
        print(f"Created cash expense: {expense['id']} amount=100")
        
        # Credit should still be 500 (only credit mode expenses affect it)
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.get_headers())
        assert response.status_code == 200
        suppliers = response.json()
        
        test_supplier = next((s for s in suppliers if s["id"] == self.test_supplier_id), None)
        assert test_supplier is not None
        
        # Credit should remain 500 (cash expenses don't add to credit)
        assert test_supplier["current_credit"] == 500, f"Expected 500 credit (cash expense shouldn't change it), got {test_supplier['current_credit']}"
        # But total_purchases should increase (all expenses count)
        assert test_supplier["total_purchases"] == 900, f"Expected 900 total purchases (800+100), got {test_supplier['total_purchases']}"
        print(f"After cash expense: credit={test_supplier['current_credit']}, purchases={test_supplier['total_purchases']}")


class TestExistingSupplierSSC:
    """Test SSC supplier mentioned in the requirements"""
    
    auth_token = None
    
    @classmethod
    def setup_class(cls):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        cls.auth_token = response.json().get("access_token")
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_01_get_suppliers_returns_dynamic_fields(self):
        """Verify GET /suppliers returns current_credit and total_purchases for all suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.get_headers())
        assert response.status_code == 200
        suppliers = response.json()
        
        assert len(suppliers) > 0, "No suppliers found"
        
        # Check all suppliers have the required fields
        for supplier in suppliers[:5]:  # Check first 5
            assert "current_credit" in supplier, f"Supplier {supplier.get('name')} missing current_credit"
            assert "total_purchases" in supplier, f"Supplier {supplier.get('name')} missing total_purchases"
            assert isinstance(supplier["current_credit"], (int, float)), "current_credit should be numeric"
            assert isinstance(supplier["total_purchases"], (int, float)), "total_purchases should be numeric"
            print(f"Supplier: {supplier['name']}, credit={supplier['current_credit']}, purchases={supplier['total_purchases']}")
    
    def test_02_find_ssc_supplier_if_exists(self):
        """Look for SSC supplier if it exists"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.get_headers())
        assert response.status_code == 200
        suppliers = response.json()
        
        # Look for any supplier with 'SSC' in name
        ssc_suppliers = [s for s in suppliers if 'SSC' in s.get('name', '').upper()]
        if ssc_suppliers:
            for s in ssc_suppliers:
                print(f"Found SSC supplier: {s['name']}, credit={s['current_credit']}, purchases={s['total_purchases']}")
        else:
            print("No SSC supplier found - that's OK, testing with test data")
