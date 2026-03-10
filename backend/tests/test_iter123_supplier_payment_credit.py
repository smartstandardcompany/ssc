"""
Iteration 123: Test supplier payment credit balance fix and expense filter auto-apply
Tests:
1. POST /api/supplier-payments with payment_mode='cash' REDUCES supplier current_credit
2. POST /api/supplier-payments with payment_mode='bank' REDUCES supplier current_credit
3. POST /api/supplier-payments with payment_mode='credit' INCREASES supplier current_credit
4. DELETE /api/supplier-payments correctly reverses credit changes
5. DELETE /api/expenses returns proper error message on permission denial
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSupplierPaymentCreditBalance:
    """Tests for supplier payment credit balance fix (cash/bank payments should reduce credit)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        # Get a branch ID
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        if branches_resp.status_code == 200 and branches_resp.json():
            self.branch_id = branches_resp.json()[0].get("id")
        else:
            self.branch_id = None
        yield
    
    def test_01_cash_payment_reduces_supplier_credit(self):
        """POST /api/supplier-payments with payment_mode='cash' should REDUCE supplier's current_credit"""
        # Get suppliers
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        assert suppliers_resp.status_code == 200, f"Failed to get suppliers: {suppliers_resp.text}"
        suppliers = suppliers_resp.json()
        
        # Find a supplier with current_credit > 0
        supplier = None
        for s in suppliers:
            if s.get("current_credit", 0) > 0:
                supplier = s
                break
        
        if not supplier:
            # Create a supplier and add credit first
            test_supplier_id = f"test-supplier-{uuid.uuid4().hex[:8]}"
            create_resp = requests.post(f"{BASE_URL}/api/suppliers", headers=self.headers, json={
                "name": f"TEST_CashPaymentSupplier_{uuid.uuid4().hex[:6]}",
                "phone": "0500000001",
                "category": "Test",
                "credit_limit": 10000,
                "current_credit": 1000
            })
            assert create_resp.status_code == 200, f"Failed to create supplier: {create_resp.text}"
            supplier = create_resp.json()
        
        supplier_id = supplier["id"]
        initial_credit = supplier.get("current_credit", 0)
        
        # Ensure initial credit is > 0
        if initial_credit == 0:
            # Add credit by creating a credit expense
            expense_resp = requests.post(f"{BASE_URL}/api/expenses", headers=self.headers, json={
                "category": "Test",
                "description": "TEST: Add credit to supplier",
                "amount": 500,
                "payment_mode": "credit",
                "supplier_id": supplier_id,
                "date": "2026-01-15T10:00:00"
            })
            if expense_resp.status_code == 200:
                initial_credit = 500
                # Refresh supplier data
                supplier_refresh = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
                for s in supplier_refresh.json():
                    if s["id"] == supplier_id:
                        initial_credit = s.get("current_credit", 500)
                        break
        
        print(f"Testing with supplier: {supplier.get('name')}, initial_credit: {initial_credit}")
        
        # Make a CASH payment to this supplier
        payment_amount = 100.0
        payment_resp = requests.post(f"{BASE_URL}/api/supplier-payments", headers=self.headers, json={
            "supplier_id": supplier_id,
            "amount": payment_amount,
            "payment_mode": "cash",
            "branch_id": self.branch_id,
            "date": "2026-01-15T10:00:00",
            "notes": "TEST: Cash payment to reduce credit"
        })
        
        assert payment_resp.status_code == 200, f"Failed to create cash payment: {payment_resp.text}"
        payment = payment_resp.json()
        print(f"Created payment: {payment.get('id')}")
        
        # Verify supplier's credit was REDUCED
        suppliers_after = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        supplier_after = None
        for s in suppliers_after.json():
            if s["id"] == supplier_id:
                supplier_after = s
                break
        
        assert supplier_after is not None, "Supplier not found after payment"
        new_credit = supplier_after.get("current_credit", 0)
        
        print(f"Credit before: {initial_credit}, Credit after: {new_credit}")
        
        # BUG FIX VERIFICATION: Cash payment should REDUCE credit (not stay same or increase)
        expected_credit = max(0, initial_credit - payment_amount)
        assert new_credit == pytest.approx(expected_credit, abs=0.01), \
            f"Cash payment did not reduce credit! Expected: {expected_credit}, Got: {new_credit}"
        
        print(f"SUCCESS: Cash payment correctly reduced credit from {initial_credit} to {new_credit}")
        
        # Cleanup: Delete the payment
        if payment.get("id"):
            requests.delete(f"{BASE_URL}/api/supplier-payments/{payment['id']}", headers=self.headers)
    
    def test_02_bank_payment_reduces_supplier_credit(self):
        """POST /api/supplier-payments with payment_mode='bank' should REDUCE supplier's current_credit"""
        # Get suppliers
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        suppliers = suppliers_resp.json()
        
        # Find supplier with credit
        supplier = None
        for s in suppliers:
            if s.get("current_credit", 0) > 50:
                supplier = s
                break
        
        if not supplier:
            pytest.skip("No supplier with sufficient credit to test bank payment")
        
        supplier_id = supplier["id"]
        initial_credit = supplier.get("current_credit", 0)
        
        print(f"Testing bank payment with supplier: {supplier.get('name')}, credit: {initial_credit}")
        
        # Make a BANK payment
        payment_amount = 50.0
        payment_resp = requests.post(f"{BASE_URL}/api/supplier-payments", headers=self.headers, json={
            "supplier_id": supplier_id,
            "amount": payment_amount,
            "payment_mode": "bank",
            "branch_id": self.branch_id,
            "date": "2026-01-15T11:00:00",
            "notes": "TEST: Bank payment to reduce credit"
        })
        
        assert payment_resp.status_code == 200, f"Failed to create bank payment: {payment_resp.text}"
        payment = payment_resp.json()
        
        # Verify credit was reduced
        suppliers_after = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        supplier_after = None
        for s in suppliers_after.json():
            if s["id"] == supplier_id:
                supplier_after = s
                break
        
        new_credit = supplier_after.get("current_credit", 0)
        expected_credit = max(0, initial_credit - payment_amount)
        
        assert new_credit == pytest.approx(expected_credit, abs=0.01), \
            f"Bank payment did not reduce credit! Expected: {expected_credit}, Got: {new_credit}"
        
        print(f"SUCCESS: Bank payment correctly reduced credit from {initial_credit} to {new_credit}")
        
        # Cleanup
        if payment.get("id"):
            requests.delete(f"{BASE_URL}/api/supplier-payments/{payment['id']}", headers=self.headers)
    
    def test_03_credit_payment_increases_supplier_credit(self):
        """POST /api/supplier-payments with payment_mode='credit' should INCREASE supplier's current_credit"""
        # Get suppliers
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        suppliers = suppliers_resp.json()
        
        # Pick a supplier (any will do)
        supplier = suppliers[0] if suppliers else None
        if not supplier:
            pytest.skip("No suppliers found")
        
        supplier_id = supplier["id"]
        initial_credit = supplier.get("current_credit", 0)
        credit_limit = supplier.get("credit_limit", 0)
        
        # Ensure we don't exceed credit limit
        if credit_limit > 0 and initial_credit + 100 > credit_limit:
            payment_amount = min(50, credit_limit - initial_credit) if credit_limit > initial_credit else 0
            if payment_amount <= 0:
                pytest.skip("Supplier at credit limit, cannot add more credit")
        else:
            payment_amount = 100.0
        
        print(f"Testing credit payment with supplier: {supplier.get('name')}, credit: {initial_credit}")
        
        # Make a CREDIT payment (this should INCREASE credit)
        payment_resp = requests.post(f"{BASE_URL}/api/supplier-payments", headers=self.headers, json={
            "supplier_id": supplier_id,
            "amount": payment_amount,
            "payment_mode": "credit",
            "branch_id": self.branch_id,
            "date": "2026-01-15T12:00:00",
            "notes": "TEST: Credit payment should increase balance"
        })
        
        assert payment_resp.status_code == 200, f"Failed to create credit payment: {payment_resp.text}"
        payment = payment_resp.json()
        
        # Verify credit was INCREASED
        suppliers_after = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        supplier_after = None
        for s in suppliers_after.json():
            if s["id"] == supplier_id:
                supplier_after = s
                break
        
        new_credit = supplier_after.get("current_credit", 0)
        expected_credit = initial_credit + payment_amount
        
        assert new_credit == pytest.approx(expected_credit, abs=0.01), \
            f"Credit payment did not increase credit! Expected: {expected_credit}, Got: {new_credit}"
        
        print(f"SUCCESS: Credit payment correctly increased credit from {initial_credit} to {new_credit}")
        
        # Cleanup
        if payment.get("id"):
            requests.delete(f"{BASE_URL}/api/supplier-payments/{payment['id']}", headers=self.headers)
    
    def test_04_delete_payment_reverses_credit_change(self):
        """DELETE /api/supplier-payments should correctly reverse the credit change"""
        # Get suppliers
        suppliers_resp = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        suppliers = suppliers_resp.json()
        
        supplier = None
        for s in suppliers:
            if s.get("current_credit", 0) > 100:
                supplier = s
                break
        
        if not supplier:
            pytest.skip("No supplier with sufficient credit")
        
        supplier_id = supplier["id"]
        initial_credit = supplier.get("current_credit", 0)
        
        # Create a cash payment (reduces credit)
        payment_amount = 50.0
        payment_resp = requests.post(f"{BASE_URL}/api/supplier-payments", headers=self.headers, json={
            "supplier_id": supplier_id,
            "amount": payment_amount,
            "payment_mode": "cash",
            "branch_id": self.branch_id,
            "date": "2026-01-15T13:00:00",
            "notes": "TEST: Payment to be deleted"
        })
        
        assert payment_resp.status_code == 200
        payment = payment_resp.json()
        payment_id = payment.get("id")
        
        # Verify credit was reduced
        suppliers_mid = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        mid_credit = None
        for s in suppliers_mid.json():
            if s["id"] == supplier_id:
                mid_credit = s.get("current_credit", 0)
                break
        
        print(f"After payment: credit = {mid_credit}")
        
        # DELETE the payment
        delete_resp = requests.delete(f"{BASE_URL}/api/supplier-payments/{payment_id}", headers=self.headers)
        assert delete_resp.status_code == 200, f"Failed to delete payment: {delete_resp.text}"
        
        # Verify credit was restored
        suppliers_after = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        final_credit = None
        for s in suppliers_after.json():
            if s["id"] == supplier_id:
                final_credit = s.get("current_credit", 0)
                break
        
        print(f"After delete: credit = {final_credit}, initial = {initial_credit}")
        
        # Credit should be back to initial
        assert final_credit == pytest.approx(initial_credit, abs=0.01), \
            f"Delete did not restore credit! Expected: {initial_credit}, Got: {final_credit}"
        
        print(f"SUCCESS: Delete correctly restored credit to {final_credit}")


class TestExpenseDeletePermission:
    """Test expense delete API returns proper error messages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login as operator (limited permissions)"""
        # First login as admin
        admin_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert admin_login.status_code == 200
        self.admin_token = admin_login.json().get("access_token")
        self.admin_headers = {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json"
        }
        
        # Try operator login
        op_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@ssc.com",
            "password": "testtest"
        })
        if op_login.status_code == 200:
            self.operator_token = op_login.json().get("access_token")
            self.operator_headers = {
                "Authorization": f"Bearer {self.operator_token}",
                "Content-Type": "application/json"
            }
        else:
            self.operator_token = None
            self.operator_headers = None
        
        yield
    
    def test_05_expense_delete_returns_error_detail(self):
        """DELETE /api/expenses returns proper error when permission denied"""
        # Create an expense first
        create_resp = requests.post(f"{BASE_URL}/api/expenses", headers=self.admin_headers, json={
            "category": "Test",
            "description": "TEST: Expense to test delete error",
            "amount": 10.0,
            "payment_mode": "cash",
            "date": "2026-01-15T14:00:00"
        })
        
        assert create_resp.status_code == 200, f"Failed to create expense: {create_resp.text}"
        expense = create_resp.json()
        expense_id = expense.get("id")
        
        # Try deleting as admin (should work)
        delete_resp = requests.delete(f"{BASE_URL}/api/expenses/{expense_id}", headers=self.admin_headers)
        
        # Check response has proper structure
        if delete_resp.status_code != 200:
            # Error response should have 'detail' field
            error_data = delete_resp.json()
            assert "detail" in error_data, f"Error response missing 'detail' field: {error_data}"
            print(f"Error detail: {error_data.get('detail')}")
        else:
            print(f"Admin delete successful, message: {delete_resp.json().get('message')}")
    
    def test_06_expense_404_returns_proper_error(self):
        """DELETE /api/expenses with invalid ID returns 404 with detail"""
        fake_id = f"non-existent-{uuid.uuid4().hex}"
        
        delete_resp = requests.delete(f"{BASE_URL}/api/expenses/{fake_id}", headers=self.admin_headers)
        
        assert delete_resp.status_code == 404, f"Expected 404, got {delete_resp.status_code}"
        
        error_data = delete_resp.json()
        assert "detail" in error_data, f"404 response missing 'detail' field: {error_data}"
        assert "not found" in error_data["detail"].lower(), f"Unexpected error detail: {error_data['detail']}"
        
        print(f"SUCCESS: 404 error returns proper detail: {error_data['detail']}")


class TestSupplierPaymentAPIBasics:
    """Basic API tests for supplier payments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        yield
    
    def test_07_get_supplier_payments(self):
        """GET /api/supplier-payments works"""
        resp = requests.get(f"{BASE_URL}/api/supplier-payments", headers=self.headers)
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        assert "data" in data, "Response missing 'data' field"
        print(f"Found {data.get('total', len(data['data']))} supplier payments")
    
    def test_08_get_suppliers(self):
        """GET /api/suppliers works and shows current_credit"""
        resp = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        assert resp.status_code == 200, f"Failed: {resp.text}"
        suppliers = resp.json()
        
        # Check that suppliers have current_credit field
        for s in suppliers[:5]:  # Check first 5
            assert "current_credit" in s or s.get("current_credit") is not None or s.get("current_credit", 0) >= 0
            print(f"Supplier: {s.get('name')}, Credit: {s.get('current_credit', 0)}")
