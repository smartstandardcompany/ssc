"""
Test Iteration 126: Supplier credit balance not updating correctly after payments
Root cause: When adding a credit bill, only an expense was created but the supplier's 
current_credit was NEVER updated. 

Fix: Bill submission now creates BOTH an expense (POST /expenses) AND a supplier payment 
(POST /supplier-payments), which correctly updates the credit balance.

Test cases:
1. POST /api/supplier-payments with payment_mode='credit' should INCREASE supplier current_credit
2. POST /api/supplier-payments with payment_mode='cash' should DECREASE supplier current_credit
3. POST /api/supplier-payments with payment_mode='bank' should DECREASE supplier current_credit
4. DELETE /api/supplier-payments should correctly reverse the credit change
5. Full flow: Check initial credit → Add credit bill → Pay cash → Verify final balance
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSupplierCreditBalance:
    """Test supplier credit balance update functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - authenticate and get a supplier"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get suppliers to find SSC supplier
        suppliers_resp = self.session.get(f"{BASE_URL}/api/suppliers")
        assert suppliers_resp.status_code == 200
        suppliers = suppliers_resp.json()
        
        # Find SSC supplier or use first one
        self.supplier = None
        for s in suppliers:
            if s.get("name") == "SSC" or s.get("id", "").startswith("e202c41f"):
                self.supplier = s
                break
        if not self.supplier and suppliers:
            self.supplier = suppliers[0]
        
        # Store initial credit for comparison
        if self.supplier:
            self.initial_credit = self.supplier.get("current_credit", 0)
            self.supplier_id = self.supplier["id"]
        
        # Get branches
        branches_resp = self.session.get(f"{BASE_URL}/api/branches")
        if branches_resp.status_code == 200 and branches_resp.json():
            self.branch_id = branches_resp.json()[0].get("id")
        else:
            self.branch_id = None
        
        yield
        
        # Cleanup - no cleanup needed as we use small amounts
    
    def _get_supplier_credit(self):
        """Helper to get current supplier credit"""
        resp = self.session.get(f"{BASE_URL}/api/suppliers")
        assert resp.status_code == 200
        suppliers = resp.json()
        for s in suppliers:
            if s.get("id") == self.supplier_id:
                return s.get("current_credit", 0)
        return 0
    
    def test_01_credit_payment_mode_increases_credit(self):
        """POST /api/supplier-payments with payment_mode='credit' should INCREASE supplier current_credit"""
        if not self.supplier:
            pytest.skip("No supplier available")
        
        initial_credit = self._get_supplier_credit()
        test_amount = 10.0  # Small test amount
        
        # Create supplier payment with credit mode
        payment_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": test_amount,
            "payment_mode": "credit",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_credit_increase"
        })
        
        assert payment_resp.status_code == 200, f"Failed to create payment: {payment_resp.text}"
        payment_data = payment_resp.json()
        payment_id = payment_data.get("id")
        
        # Verify credit increased
        new_credit = self._get_supplier_credit()
        expected_credit = initial_credit + test_amount
        
        print(f"Initial credit: {initial_credit}, New credit: {new_credit}, Expected: {expected_credit}")
        assert abs(new_credit - expected_credit) < 0.01, \
            f"Credit should have increased. Initial: {initial_credit}, New: {new_credit}, Expected: {expected_credit}"
        
        # Cleanup - delete the test payment
        if payment_id:
            delete_resp = self.session.delete(f"{BASE_URL}/api/supplier-payments/{payment_id}")
            print(f"Cleanup delete status: {delete_resp.status_code}")
    
    def test_02_cash_payment_mode_decreases_credit(self):
        """POST /api/supplier-payments with payment_mode='cash' should DECREASE supplier current_credit"""
        if not self.supplier:
            pytest.skip("No supplier available")
        
        initial_credit = self._get_supplier_credit()
        
        # First add credit so we have something to pay
        add_credit_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": 20.0,
            "payment_mode": "credit",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_setup_credit"
        })
        assert add_credit_resp.status_code == 200
        setup_payment_id = add_credit_resp.json().get("id")
        
        credit_after_add = self._get_supplier_credit()
        test_amount = 10.0
        
        # Now pay with cash (should decrease credit)
        payment_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": test_amount,
            "payment_mode": "cash",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_cash_payment"
        })
        
        assert payment_resp.status_code == 200, f"Failed to create cash payment: {payment_resp.text}"
        cash_payment_id = payment_resp.json().get("id")
        
        # Verify credit decreased
        new_credit = self._get_supplier_credit()
        expected_credit = credit_after_add - test_amount
        
        print(f"Credit after add: {credit_after_add}, After cash payment: {new_credit}, Expected: {expected_credit}")
        assert abs(new_credit - expected_credit) < 0.01, \
            f"Credit should have decreased. After add: {credit_after_add}, New: {new_credit}, Expected: {expected_credit}"
        
        # Cleanup
        if cash_payment_id:
            self.session.delete(f"{BASE_URL}/api/supplier-payments/{cash_payment_id}")
        if setup_payment_id:
            self.session.delete(f"{BASE_URL}/api/supplier-payments/{setup_payment_id}")
    
    def test_03_bank_payment_mode_decreases_credit(self):
        """POST /api/supplier-payments with payment_mode='bank' should DECREASE supplier current_credit"""
        if not self.supplier:
            pytest.skip("No supplier available")
        
        # First add credit
        add_credit_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": 20.0,
            "payment_mode": "credit",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_setup_bank"
        })
        assert add_credit_resp.status_code == 200
        setup_payment_id = add_credit_resp.json().get("id")
        
        credit_after_add = self._get_supplier_credit()
        test_amount = 10.0
        
        # Pay with bank (should decrease credit)
        payment_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": test_amount,
            "payment_mode": "bank",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_bank_payment"
        })
        
        assert payment_resp.status_code == 200, f"Failed to create bank payment: {payment_resp.text}"
        bank_payment_id = payment_resp.json().get("id")
        
        # Verify credit decreased
        new_credit = self._get_supplier_credit()
        expected_credit = credit_after_add - test_amount
        
        print(f"Credit after add: {credit_after_add}, After bank payment: {new_credit}, Expected: {expected_credit}")
        assert abs(new_credit - expected_credit) < 0.01, \
            f"Credit should have decreased. After add: {credit_after_add}, New: {new_credit}, Expected: {expected_credit}"
        
        # Cleanup
        if bank_payment_id:
            self.session.delete(f"{BASE_URL}/api/supplier-payments/{bank_payment_id}")
        if setup_payment_id:
            self.session.delete(f"{BASE_URL}/api/supplier-payments/{setup_payment_id}")
    
    def test_04_delete_credit_payment_reverses_increase(self):
        """DELETE /api/supplier-payments should reverse credit mode payment (decrease credit)"""
        if not self.supplier:
            pytest.skip("No supplier available")
        
        initial_credit = self._get_supplier_credit()
        test_amount = 15.0
        
        # Create credit payment
        payment_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": test_amount,
            "payment_mode": "credit",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_delete_reversal"
        })
        assert payment_resp.status_code == 200
        payment_id = payment_resp.json().get("id")
        
        credit_after_add = self._get_supplier_credit()
        assert abs(credit_after_add - (initial_credit + test_amount)) < 0.01, \
            "Credit should have increased after add"
        
        # Delete the payment
        delete_resp = self.session.delete(f"{BASE_URL}/api/supplier-payments/{payment_id}")
        assert delete_resp.status_code == 200, f"Delete failed: {delete_resp.text}"
        
        # Verify credit is back to original
        final_credit = self._get_supplier_credit()
        print(f"Initial: {initial_credit}, After add: {credit_after_add}, After delete: {final_credit}")
        assert abs(final_credit - initial_credit) < 0.01, \
            f"Credit should be back to initial. Initial: {initial_credit}, Final: {final_credit}"
    
    def test_05_delete_cash_payment_reverses_decrease(self):
        """DELETE /api/supplier-payments should reverse cash payment (increase credit back)"""
        if not self.supplier:
            pytest.skip("No supplier available")
        
        # First add credit
        add_credit_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": 30.0,
            "payment_mode": "credit",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_setup_delete_cash"
        })
        assert add_credit_resp.status_code == 200
        setup_payment_id = add_credit_resp.json().get("id")
        
        credit_after_add = self._get_supplier_credit()
        test_amount = 10.0
        
        # Create cash payment
        cash_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": test_amount,
            "payment_mode": "cash",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_cash_to_delete"
        })
        assert cash_resp.status_code == 200
        cash_payment_id = cash_resp.json().get("id")
        
        credit_after_cash = self._get_supplier_credit()
        expected_after_cash = credit_after_add - test_amount
        assert abs(credit_after_cash - expected_after_cash) < 0.01
        
        # Delete the cash payment - should restore credit
        delete_resp = self.session.delete(f"{BASE_URL}/api/supplier-payments/{cash_payment_id}")
        assert delete_resp.status_code == 200
        
        # Verify credit is restored
        final_credit = self._get_supplier_credit()
        print(f"After add: {credit_after_add}, After cash: {credit_after_cash}, After delete: {final_credit}")
        assert abs(final_credit - credit_after_add) < 0.01, \
            f"Credit should be back to before cash payment. Expected: {credit_after_add}, Got: {final_credit}"
        
        # Cleanup
        if setup_payment_id:
            self.session.delete(f"{BASE_URL}/api/supplier-payments/{setup_payment_id}")
    
    def test_06_full_flow_credit_then_cash_then_verify(self):
        """Full flow: Add credit bill → Pay with cash → Verify final balance"""
        if not self.supplier:
            pytest.skip("No supplier available")
        
        initial_credit = self._get_supplier_credit()
        credit_amount = 25.0
        cash_payment = 10.0
        
        print(f"Step 0: Initial credit = {initial_credit}")
        
        # Step 1: Add a credit bill (simulating purchase on credit)
        credit_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": credit_amount,
            "payment_mode": "credit",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_full_flow_credit_bill"
        })
        assert credit_resp.status_code == 200
        credit_payment_id = credit_resp.json().get("id")
        
        credit_after_bill = self._get_supplier_credit()
        expected_after_bill = initial_credit + credit_amount
        print(f"Step 1: After credit bill, credit = {credit_after_bill} (expected {expected_after_bill})")
        assert abs(credit_after_bill - expected_after_bill) < 0.01, \
            f"Credit should increase by {credit_amount}"
        
        # Step 2: Pay some cash to reduce credit
        cash_resp = self.session.post(f"{BASE_URL}/api/supplier-payments", json={
            "supplier_id": self.supplier_id,
            "amount": cash_payment,
            "payment_mode": "cash",
            "branch_id": self.branch_id,
            "date": datetime.now().isoformat(),
            "notes": "TEST_iter126_full_flow_cash_payment"
        })
        assert cash_resp.status_code == 200
        cash_payment_id = cash_resp.json().get("id")
        
        credit_after_cash = self._get_supplier_credit()
        expected_after_cash = credit_after_bill - cash_payment
        print(f"Step 2: After cash payment, credit = {credit_after_cash} (expected {expected_after_cash})")
        assert abs(credit_after_cash - expected_after_cash) < 0.01, \
            f"Credit should decrease by {cash_payment}"
        
        # Step 3: Verify final balance
        final_expected = initial_credit + credit_amount - cash_payment
        print(f"Step 3: Final credit = {credit_after_cash}, Expected = {final_expected}")
        assert abs(credit_after_cash - final_expected) < 0.01, \
            f"Final credit mismatch. Expected: {final_expected}, Got: {credit_after_cash}"
        
        # Cleanup
        if cash_payment_id:
            self.session.delete(f"{BASE_URL}/api/supplier-payments/{cash_payment_id}")
        if credit_payment_id:
            self.session.delete(f"{BASE_URL}/api/supplier-payments/{credit_payment_id}")
        
        # Verify cleanup restored original credit
        restored_credit = self._get_supplier_credit()
        print(f"After cleanup: credit = {restored_credit} (original was {initial_credit})")
        assert abs(restored_credit - initial_credit) < 0.01, \
            "Credit should be restored after cleanup"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
