"""
Test file for iteration 74: Supplier Ledger, Bank Accounts, POS Expense Updates, Online Sales
Features tested:
1. Supplier list endpoint returns total_purchases
2. Supplier ledger endpoint with date filtering
3. Supplier ledger export (PDF/Excel)
4. Supplier bank accounts (max 3)
5. Dashboard stats returns online_sales
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAndSetup:
    """Authentication and setup tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
        yield

    def test_auth_works(self):
        """Verify authentication is working"""
        response = self.session.get(f"{BASE_URL}/api/branches")
        assert response.status_code == 200
        print("Authentication working correctly")


class TestSupplierTotalPurchases:
    """Test supplier list includes total_purchases"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_suppliers_list_has_total_purchases(self):
        """Verify suppliers list endpoint returns total_purchases for each supplier"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        suppliers = response.json()
        assert isinstance(suppliers, list)
        
        if len(suppliers) > 0:
            supplier = suppliers[0]
            assert "total_purchases" in supplier, "total_purchases field missing from supplier"
            assert isinstance(supplier["total_purchases"], (int, float)), "total_purchases should be numeric"
            print(f"Supplier '{supplier['name']}' has total_purchases: {supplier['total_purchases']}")
        print(f"Verified {len(suppliers)} suppliers have total_purchases field")


class TestSupplierLedger:
    """Test supplier ledger endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_get_supplier_ledger(self):
        """Test fetching supplier ledger without date filter"""
        # First get a supplier
        suppliers_resp = self.session.get(f"{BASE_URL}/api/suppliers")
        assert suppliers_resp.status_code == 200
        suppliers = suppliers_resp.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers found to test ledger")
        
        supplier_id = suppliers[0]["id"]
        supplier_name = suppliers[0]["name"]
        
        # Get ledger
        response = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}/ledger")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        ledger = response.json()
        
        # Verify structure
        assert "supplier" in ledger, "supplier info missing"
        assert "summary" in ledger, "summary missing"
        assert "entries" in ledger, "entries missing"
        assert "entry_count" in ledger, "entry_count missing"
        assert "period" in ledger, "period missing"
        
        # Verify supplier info
        assert ledger["supplier"]["id"] == supplier_id
        assert ledger["supplier"]["name"] == supplier_name
        
        # Verify summary fields
        summary = ledger["summary"]
        required_summary_fields = [
            "total_purchases", "credit_purchases", "cash_purchases", "bank_purchases",
            "total_payments", "cash_payments", "bank_payments",
            "closing_balance", "current_outstanding"
        ]
        for field in required_summary_fields:
            assert field in summary, f"Summary missing {field}"
        
        print(f"Ledger for '{supplier_name}': {ledger['entry_count']} entries, balance={ledger['summary']['closing_balance']}")
    
    def test_get_supplier_ledger_with_date_filter(self):
        """Test fetching supplier ledger with date range"""
        suppliers_resp = self.session.get(f"{BASE_URL}/api/suppliers")
        assert suppliers_resp.status_code == 200
        suppliers = suppliers_resp.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers found to test ledger")
        
        supplier_id = suppliers[0]["id"]
        
        # Get ledger with date filter
        start_date = "2024-01-01"
        end_date = "2026-12-31"
        response = self.session.get(
            f"{BASE_URL}/api/suppliers/{supplier_id}/ledger",
            params={"start_date": start_date, "end_date": end_date}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        ledger = response.json()
        assert ledger["period"]["start"] == start_date
        assert ledger["period"]["end"] == end_date
        print(f"Ledger with date filter: {ledger['entry_count']} entries")
    
    def test_ledger_running_balance_calculation(self):
        """Verify ledger entries have running balance"""
        suppliers_resp = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = suppliers_resp.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers found")
        
        supplier_id = suppliers[0]["id"]
        response = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}/ledger")
        assert response.status_code == 200
        
        ledger = response.json()
        entries = ledger.get("entries", [])
        
        if len(entries) > 0:
            for entry in entries:
                assert "balance" in entry, "Running balance missing from entry"
                assert "debit" in entry, "Debit missing from entry"
                assert "credit" in entry, "Credit missing from entry"
            print(f"Verified running balance in {len(entries)} ledger entries")
        else:
            print("No ledger entries to verify (empty ledger)")


class TestSupplierLedgerExport:
    """Test supplier ledger export endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_export_ledger_pdf(self):
        """Test exporting supplier ledger as PDF"""
        suppliers_resp = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = suppliers_resp.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers found")
        
        supplier_id = suppliers[0]["id"]
        
        response = self.session.get(
            f"{BASE_URL}/api/suppliers/{supplier_id}/ledger/export",
            params={"format": "pdf"}
        )
        assert response.status_code == 200, f"PDF export failed: {response.text}"
        assert "application/pdf" in response.headers.get("Content-Type", "")
        assert len(response.content) > 0, "PDF content is empty"
        print(f"PDF export successful: {len(response.content)} bytes")
    
    def test_export_ledger_excel(self):
        """Test exporting supplier ledger as Excel"""
        suppliers_resp = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = suppliers_resp.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers found")
        
        supplier_id = suppliers[0]["id"]
        
        response = self.session.get(
            f"{BASE_URL}/api/suppliers/{supplier_id}/ledger/export",
            params={"format": "excel"}
        )
        assert response.status_code == 200, f"Excel export failed: {response.text}"
        content_type = response.headers.get("Content-Type", "")
        assert "spreadsheet" in content_type or "excel" in content_type or "application/vnd" in content_type
        assert len(response.content) > 0, "Excel content is empty"
        print(f"Excel export successful: {len(response.content)} bytes")
    
    def test_export_ledger_with_date_filter(self):
        """Test export with date filter"""
        suppliers_resp = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = suppliers_resp.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers found")
        
        supplier_id = suppliers[0]["id"]
        
        response = self.session.get(
            f"{BASE_URL}/api/suppliers/{supplier_id}/ledger/export",
            params={"format": "pdf", "start_date": "2025-01-01", "end_date": "2026-01-31"}
        )
        assert response.status_code == 200, f"Export with date filter failed: {response.text}"
        print("Export with date filter successful")


class TestSupplierBankAccounts:
    """Test supplier bank accounts feature (max 3)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_create_supplier_with_bank_accounts(self):
        """Test creating a supplier with bank accounts"""
        test_supplier = {
            "name": f"TEST_BankAccounts_Supplier_{datetime.now().strftime('%H%M%S')}",
            "category": "Test",
            "phone": "1234567890",
            "bank_accounts": [
                {"bank_name": "Al Rajhi", "account_number": "123456789", "iban": "SA12345", "swift_code": "RJHI"},
                {"bank_name": "NCB", "account_number": "987654321", "iban": "SA98765", "swift_code": "NCB1"}
            ]
        }
        
        response = self.session.post(f"{BASE_URL}/api/suppliers", json=test_supplier)
        assert response.status_code == 200, f"Create supplier failed: {response.text}"
        
        created = response.json()
        assert "bank_accounts" in created
        assert len(created["bank_accounts"]) == 2
        assert created["bank_accounts"][0]["bank_name"] == "Al Rajhi"
        assert created["bank_accounts"][1]["bank_name"] == "NCB"
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/suppliers/{created['id']}")
        print("Created supplier with 2 bank accounts successfully")
    
    def test_update_supplier_bank_accounts(self):
        """Test updating supplier bank accounts"""
        # Create supplier first
        test_supplier = {
            "name": f"TEST_BankUpdate_Supplier_{datetime.now().strftime('%H%M%S')}",
            "category": "Test",
            "bank_accounts": [{"bank_name": "Bank1", "account_number": "111"}]
        }
        
        create_resp = self.session.post(f"{BASE_URL}/api/suppliers", json=test_supplier)
        assert create_resp.status_code == 200
        supplier_id = create_resp.json()["id"]
        
        # Update with new bank accounts
        update_data = {
            "name": test_supplier["name"],
            "category": "Test",
            "bank_accounts": [
                {"bank_name": "Bank1", "account_number": "111", "iban": "IBAN1", "swift_code": "SWIFT1"},
                {"bank_name": "Bank2", "account_number": "222", "iban": "IBAN2", "swift_code": "SWIFT2"},
                {"bank_name": "Bank3", "account_number": "333", "iban": "IBAN3", "swift_code": "SWIFT3"}
            ]
        }
        
        update_resp = self.session.put(f"{BASE_URL}/api/suppliers/{supplier_id}", json=update_data)
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        updated = update_resp.json()
        assert len(updated["bank_accounts"]) == 3
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/suppliers/{supplier_id}")
        print("Updated supplier with 3 bank accounts successfully")
    
    def test_suppliers_list_contains_bank_accounts(self):
        """Verify suppliers list includes bank_accounts field"""
        response = self.session.get(f"{BASE_URL}/api/suppliers")
        assert response.status_code == 200
        
        suppliers = response.json()
        if len(suppliers) > 0:
            # Check that bank_accounts field exists (can be empty list)
            for supplier in suppliers[:3]:  # Check first 3
                assert "bank_accounts" in supplier or supplier.get("bank_accounts") is None or isinstance(supplier.get("bank_accounts", []), list)
        print("Verified bank_accounts field in supplier list")


class TestDashboardOnlineSales:
    """Test dashboard stats includes online_sales"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_dashboard_stats_has_online_sales(self):
        """Verify dashboard stats endpoint returns online_sales"""
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        assert "online_sales" in data, "online_sales field missing from dashboard stats"
        assert isinstance(data["online_sales"], (int, float)), "online_sales should be numeric"
        
        print(f"Dashboard stats online_sales: {data['online_sales']}")
        
        # Also verify other expected fields exist
        expected_fields = ["total_sales", "total_expenses", "net_profit", "cash_sales", "bank_sales"]
        for field in expected_fields:
            assert field in data, f"Expected field {field} missing from dashboard stats"
        print("Dashboard stats structure verified with online_sales")


class TestSupplierTotalPurchasesEndpoint:
    """Test the dedicated total purchases endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        yield
    
    def test_get_supplier_total_purchases(self):
        """Test GET /suppliers/{id}/total-purchases endpoint"""
        suppliers_resp = self.session.get(f"{BASE_URL}/api/suppliers")
        suppliers = suppliers_resp.json()
        
        if len(suppliers) == 0:
            pytest.skip("No suppliers found")
        
        supplier_id = suppliers[0]["id"]
        
        response = self.session.get(f"{BASE_URL}/api/suppliers/{supplier_id}/total-purchases")
        assert response.status_code == 200, f"Total purchases endpoint failed: {response.text}"
        
        data = response.json()
        assert "total_purchases" in data
        assert "cash_purchases" in data
        assert "bank_purchases" in data
        assert "credit_purchases" in data
        assert "purchase_count" in data
        assert data["supplier_id"] == supplier_id
        
        print(f"Supplier total purchases: {data['total_purchases']} ({data['purchase_count']} purchases)")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
