"""
Backend API Tests - Iteration 3 
Tests new features: branch-cashbank report, supplier-balance report with period filter,
export/data endpoint, branch selection for supplier payments & expenses
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestNewReportEndpoints:
    """Tests for new report endpoints added in iteration 3"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        # Login and get token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_branch_cashbank_report_endpoint(self):
        """Test /api/reports/branch-cashbank returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-cashbank", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        
        # If there's data, verify structure
        if len(data) > 0:
            first_item = data[0]
            expected_fields = [
                'branch_id', 'branch_name', 
                'sales_cash', 'sales_bank', 'sales_credit', 'sales_total',
                'expenses_cash', 'expenses_bank', 'expenses_total',
                'supplier_cash', 'supplier_bank', 'supplier_total'
            ]
            for field in expected_fields:
                assert field in first_item, f"Missing field: {field}"
            print(f"✓ Branch-cashbank report has correct structure with {len(data)} branches")
        else:
            print("✓ Branch-cashbank report endpoint works (no data)")
    
    def test_supplier_balance_report_all_time(self):
        """Test /api/reports/supplier-balance without period filter"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        
        if len(data) > 0:
            first = data[0]
            expected_fields = ['id', 'name', 'category', 'cash_paid', 'bank_paid', 
                              'credit_added', 'total_paid', 'total_expenses',
                              'current_credit', 'credit_limit', 'transaction_count']
            for field in expected_fields:
                assert field in first, f"Missing field: {field}"
            print(f"✓ Supplier balance report (all time) has {len(data)} suppliers")
        else:
            print("✓ Supplier balance endpoint works (no suppliers)")
    
    def test_supplier_balance_report_with_period_today(self):
        """Test /api/reports/supplier-balance?period=today"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance?period=today", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Supplier balance with period=today works: {len(data)} suppliers")
    
    def test_supplier_balance_report_with_period_month(self):
        """Test /api/reports/supplier-balance?period=month"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance?period=month", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Supplier balance with period=month works: {len(data)} suppliers")
    
    def test_supplier_balance_report_with_period_year(self):
        """Test /api/reports/supplier-balance?period=year"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance?period=year", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Supplier balance with period=year works: {len(data)} suppliers")


class TestGenericExportEndpoint:
    """Tests for /api/export/data endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        self.headers = {
            "Authorization": f"Bearer {data['access_token']}",
            "Content-Type": "application/json"
        }
    
    def test_export_sales_excel(self):
        """Test export/data with type=sales, format=excel"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "sales",
            "format": "excel"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        assert 'application/vnd.openxmlformats' in response.headers.get('content-type', '')
        print("✓ Export sales as Excel works")
    
    def test_export_sales_pdf(self):
        """Test export/data with type=sales, format=pdf"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "sales",
            "format": "pdf"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        assert 'application/pdf' in response.headers.get('content-type', '')
        print("✓ Export sales as PDF works")
    
    def test_export_expenses_excel(self):
        """Test export/data with type=expenses, format=excel"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "expenses",
            "format": "excel"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Export expenses as Excel works")
    
    def test_export_expenses_pdf(self):
        """Test export/data with type=expenses, format=pdf"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "expenses",
            "format": "pdf"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Export expenses as PDF works")
    
    def test_export_supplier_payments_excel(self):
        """Test export/data with type=supplier-payments, format=excel"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "supplier-payments",
            "format": "excel"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Export supplier-payments as Excel works")
    
    def test_export_supplier_payments_pdf(self):
        """Test export/data with type=supplier-payments, format=pdf"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "supplier-payments",
            "format": "pdf"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Export supplier-payments as PDF works")
    
    def test_export_customers_excel(self):
        """Test export/data with type=customers, format=excel"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "customers",
            "format": "excel"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Export customers as Excel works")
    
    def test_export_customers_pdf(self):
        """Test export/data with type=customers, format=pdf"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "customers",
            "format": "pdf"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Export customers as PDF works")
    
    def test_export_suppliers_excel(self):
        """Test export/data with type=suppliers, format=excel"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "suppliers",
            "format": "excel"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Export suppliers as Excel works")
    
    def test_export_suppliers_pdf(self):
        """Test export/data with type=suppliers, format=pdf"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "suppliers",
            "format": "pdf"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        print("✓ Export suppliers as PDF works")
    
    def test_export_invalid_type(self):
        """Test export/data with invalid type returns 400"""
        response = requests.post(f"{BASE_URL}/api/export/data", headers=self.headers, json={
            "type": "invalid_type",
            "format": "excel"
        })
        assert response.status_code == 400, "Expected 400 for invalid type"
        print("✓ Export with invalid type correctly rejected")


class TestBranchSelectionInPayments:
    """Tests for branch_id field in supplier payments and expenses"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        self.headers = {
            "Authorization": f"Bearer {data['access_token']}",
            "Content-Type": "application/json"
        }
        self.created_supplier_ids = []
        self.created_payment_ids = []
        self.created_expense_ids = []
        self.created_branch_ids = []
    
    def teardown_method(self, method):
        # Cleanup
        for pid in self.created_payment_ids:
            requests.delete(f"{BASE_URL}/api/supplier-payments/{pid}", headers=self.headers)
        for eid in self.created_expense_ids:
            requests.delete(f"{BASE_URL}/api/expenses/{eid}", headers=self.headers)
        for sid in self.created_supplier_ids:
            requests.delete(f"{BASE_URL}/api/suppliers/{sid}", headers=self.headers)
        for bid in self.created_branch_ids:
            requests.delete(f"{BASE_URL}/api/branches/{bid}", headers=self.headers)
    
    def test_supplier_payment_with_branch_id(self):
        """Test creating supplier payment with branch_id"""
        # Create a branch first
        branch_res = requests.post(f"{BASE_URL}/api/branches", headers=self.headers, json={
            "name": f"TEST_PaymentBranch_{uuid.uuid4().hex[:6]}",
            "location": "Test Location"
        })
        assert branch_res.status_code == 200
        branch_id = branch_res.json()["id"]
        self.created_branch_ids.append(branch_id)
        
        # Create a supplier
        sup_res = requests.post(f"{BASE_URL}/api/suppliers", headers=self.headers, json={
            "name": f"TEST_Supplier_{uuid.uuid4().hex[:6]}",
            "credit_limit": 5000
        })
        assert sup_res.status_code == 200
        sup_id = sup_res.json()["id"]
        self.created_supplier_ids.append(sup_id)
        
        # Create supplier payment with branch_id
        payment_res = requests.post(f"{BASE_URL}/api/supplier-payments", headers=self.headers, json={
            "supplier_id": sup_id,
            "amount": 100.50,
            "payment_mode": "cash",
            "branch_id": branch_id,
            "date": datetime.now().isoformat(),
            "notes": "Test payment with branch"
        })
        assert payment_res.status_code == 200, f"Failed: {payment_res.text}"
        payment_data = payment_res.json()
        assert payment_data["branch_id"] == branch_id
        self.created_payment_ids.append(payment_data["id"])
        print(f"✓ Created supplier payment with branch_id: {branch_id}")
    
    def test_supplier_payment_without_branch_id(self):
        """Test creating supplier payment without branch_id (null)"""
        # Create a supplier
        sup_res = requests.post(f"{BASE_URL}/api/suppliers", headers=self.headers, json={
            "name": f"TEST_Supplier_{uuid.uuid4().hex[:6]}",
            "credit_limit": 5000
        })
        assert sup_res.status_code == 200
        sup_id = sup_res.json()["id"]
        self.created_supplier_ids.append(sup_id)
        
        # Create supplier payment without branch_id
        payment_res = requests.post(f"{BASE_URL}/api/supplier-payments", headers=self.headers, json={
            "supplier_id": sup_id,
            "amount": 75.00,
            "payment_mode": "bank",
            "date": datetime.now().isoformat()
        })
        assert payment_res.status_code == 200, f"Failed: {payment_res.text}"
        payment_data = payment_res.json()
        assert payment_data.get("branch_id") is None
        self.created_payment_ids.append(payment_data["id"])
        print("✓ Created supplier payment without branch_id")
    
    def test_expense_with_branch_id(self):
        """Test creating expense with branch_id"""
        # Create a branch first
        branch_res = requests.post(f"{BASE_URL}/api/branches", headers=self.headers, json={
            "name": f"TEST_ExpBranch_{uuid.uuid4().hex[:6]}",
            "location": "Test Location"
        })
        assert branch_res.status_code == 200
        branch_id = branch_res.json()["id"]
        self.created_branch_ids.append(branch_id)
        
        # Create expense with branch_id
        expense_res = requests.post(f"{BASE_URL}/api/expenses", headers=self.headers, json={
            "category": "rent",
            "description": "Test expense with branch",
            "amount": 500.00,
            "payment_mode": "cash",
            "branch_id": branch_id,
            "date": datetime.now().isoformat()
        })
        assert expense_res.status_code == 200, f"Failed: {expense_res.text}"
        expense_data = expense_res.json()
        assert expense_data["branch_id"] == branch_id
        self.created_expense_ids.append(expense_data["id"])
        print(f"✓ Created expense with branch_id: {branch_id}")
    
    def test_expense_without_branch_id(self):
        """Test creating expense without branch_id (null)"""
        expense_res = requests.post(f"{BASE_URL}/api/expenses", headers=self.headers, json={
            "category": "salary",
            "description": "Test expense without branch",
            "amount": 200.00,
            "payment_mode": "bank",
            "date": datetime.now().isoformat()
        })
        assert expense_res.status_code == 200, f"Failed: {expense_res.text}"
        expense_data = expense_res.json()
        assert expense_data.get("branch_id") is None
        self.created_expense_ids.append(expense_data["id"])
        print("✓ Created expense without branch_id")


class TestPaySupplierCreditWithBranch:
    """Test pay supplier credit endpoint with branch_id"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        self.headers = {
            "Authorization": f"Bearer {data['access_token']}",
            "Content-Type": "application/json"
        }
        self.created_supplier_ids = []
        self.created_branch_ids = []
    
    def teardown_method(self, method):
        for sid in self.created_supplier_ids:
            requests.delete(f"{BASE_URL}/api/suppliers/{sid}", headers=self.headers)
        for bid in self.created_branch_ids:
            requests.delete(f"{BASE_URL}/api/branches/{bid}", headers=self.headers)
    
    def test_pay_credit_with_branch_id(self):
        """Test paying supplier credit with branch_id specified"""
        # Create branch
        branch_res = requests.post(f"{BASE_URL}/api/branches", headers=self.headers, json={
            "name": f"TEST_CreditBranch_{uuid.uuid4().hex[:6]}"
        })
        assert branch_res.status_code == 200
        branch_id = branch_res.json()["id"]
        self.created_branch_ids.append(branch_id)
        
        # Create supplier with some credit
        sup_res = requests.post(f"{BASE_URL}/api/suppliers", headers=self.headers, json={
            "name": f"TEST_CreditSup_{uuid.uuid4().hex[:6]}",
            "credit_limit": 1000.00
        })
        assert sup_res.status_code == 200
        sup_id = sup_res.json()["id"]
        self.created_supplier_ids.append(sup_id)
        
        # Add credit to supplier via supplier-payment with mode=credit
        credit_res = requests.post(f"{BASE_URL}/api/supplier-payments", headers=self.headers, json={
            "supplier_id": sup_id,
            "amount": 500.00,
            "payment_mode": "credit",
            "date": datetime.now().isoformat()
        })
        assert credit_res.status_code == 200, f"Failed to add credit: {credit_res.text}"
        
        # Verify supplier now has credit
        sup_after = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        supplier = next((s for s in sup_after.json() if s["id"] == sup_id), None)
        assert supplier is not None
        assert supplier["current_credit"] == 500.00, f"Expected 500.00 credit, got {supplier['current_credit']}"
        
        # Pay off some credit with branch_id
        pay_res = requests.post(f"{BASE_URL}/api/suppliers/{sup_id}/pay-credit", headers=self.headers, json={
            "payment_mode": "cash",
            "amount": 200.00,
            "branch_id": branch_id
        })
        assert pay_res.status_code == 200, f"Failed to pay credit: {pay_res.text}"
        pay_data = pay_res.json()
        assert pay_data["remaining_credit"] == 300.00
        print(f"✓ Paid supplier credit with branch_id, remaining: $300.00")


class TestExistingReportEndpoints:
    """Test existing report endpoints still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
    
    def test_credit_sales_report(self):
        """Test /api/reports/credit-sales endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/credit-sales", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "credit_sales" in data
        assert "summary" in data
        print("✓ Credit sales report works")
    
    def test_supplier_report(self):
        """Test /api/reports/suppliers endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/suppliers", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        assert isinstance(response.json(), list)
        print("✓ Supplier report works")
    
    def test_supplier_categories_report(self):
        """Test /api/reports/supplier-categories endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-categories", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        assert isinstance(response.json(), list)
        print("✓ Supplier categories report works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
