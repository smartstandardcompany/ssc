"""
Test suite for Accounting Module APIs (Iteration 140)
- Chart of Accounts (CRUD, seeding, system account protection)
- Tax Rates (CRUD, default setting)
- Bills (CRUD, payment recording)
- Profit & Loss Report
- Currency Settings
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_headers():
    """Login and get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    # API returns access_token, not token
    token = response.json().get("access_token")
    assert token, f"No access_token in response: {response.json()}"
    return {"Authorization": f"Bearer {token}"}


class TestChartOfAccounts:
    """Tests for Chart of Accounts endpoints"""
    
    def test_get_accounts_loads_and_seeds(self, auth_headers):
        """Test GET /accounting/accounts - should load accounts and seed if empty"""
        response = requests.get(f"{BASE_URL}/api/accounting/accounts", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of accounts"
        # Should have seeded 23 default accounts
        assert len(data) >= 23, f"Expected at least 23 seeded accounts, got {len(data)}"
        # Check account structure
        if len(data) > 0:
            acc = data[0]
            assert "id" in acc
            assert "code" in acc
            assert "name" in acc
            assert "type" in acc
        print(f"SUCCESS: Loaded {len(data)} accounts")

    def test_accounts_grouped_by_type(self, auth_headers):
        """Verify accounts include all 5 types: asset, liability, equity, revenue, expense"""
        response = requests.get(f"{BASE_URL}/api/accounting/accounts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        types = set(acc.get("type") for acc in data)
        expected_types = {"asset", "liability", "equity", "revenue", "expense"}
        assert expected_types.issubset(types), f"Missing types. Found: {types}"
        print(f"SUCCESS: All 5 account types present: {types}")

    def test_create_account(self, auth_headers):
        """Test POST /accounting/accounts - create new account"""
        test_code = f"TEST-{datetime.now().strftime('%H%M%S')}"
        response = requests.post(f"{BASE_URL}/api/accounting/accounts", 
            headers=auth_headers,
            json={
                "code": test_code,
                "name": "Test Account",
                "type": "expense",
                "sub_type": "operating_expense",
                "description": "Test account for pytest"
            })
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("code") == test_code
        assert data.get("name") == "Test Account"
        assert data.get("type") == "expense"
        assert data.get("is_system") == False
        print(f"SUCCESS: Created account with code {test_code}")
        return data.get("id")

    def test_create_duplicate_account_fails(self, auth_headers):
        """Test POST /accounting/accounts - duplicate code should fail"""
        # Use an existing system code
        response = requests.post(f"{BASE_URL}/api/accounting/accounts",
            headers=auth_headers,
            json={
                "code": "1000",  # Cash - should already exist
                "name": "Duplicate Test",
                "type": "asset"
            })
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        print("SUCCESS: Duplicate account creation properly rejected")

    def test_update_account(self, auth_headers):
        """Test PUT /accounting/accounts/{id} - update account"""
        # First get an account to update (create one)
        test_code = f"UPD-{datetime.now().strftime('%H%M%S')}"
        create_resp = requests.post(f"{BASE_URL}/api/accounting/accounts",
            headers=auth_headers,
            json={"code": test_code, "name": "Update Test", "type": "expense"})
        assert create_resp.status_code == 200
        acc_id = create_resp.json().get("id")
        
        # Update it
        update_resp = requests.put(f"{BASE_URL}/api/accounting/accounts/{acc_id}",
            headers=auth_headers,
            json={"name": "Updated Name", "description": "Updated description"})
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert data.get("name") == "Updated Name"
        assert data.get("description") == "Updated description"
        print(f"SUCCESS: Updated account {acc_id}")

    def test_delete_non_system_account(self, auth_headers):
        """Test DELETE /accounting/accounts/{id} - delete non-system account"""
        # Create an account to delete
        test_code = f"DEL-{datetime.now().strftime('%H%M%S')}"
        create_resp = requests.post(f"{BASE_URL}/api/accounting/accounts",
            headers=auth_headers,
            json={"code": test_code, "name": "To Delete", "type": "expense"})
        assert create_resp.status_code == 200
        acc_id = create_resp.json().get("id")
        
        # Delete it
        delete_resp = requests.delete(f"{BASE_URL}/api/accounting/accounts/{acc_id}",
            headers=auth_headers)
        assert delete_resp.status_code == 200
        
        # Verify deleted (should not be in list)
        get_resp = requests.get(f"{BASE_URL}/api/accounting/accounts", headers=auth_headers)
        accounts = get_resp.json()
        assert not any(a.get("id") == acc_id for a in accounts), "Account still exists after delete"
        print(f"SUCCESS: Deleted account {acc_id}")

    def test_cannot_delete_system_account(self, auth_headers):
        """Test that system accounts cannot be deleted"""
        # Get a system account (like Cash - code 1000)
        get_resp = requests.get(f"{BASE_URL}/api/accounting/accounts", headers=auth_headers)
        accounts = get_resp.json()
        system_acc = next((a for a in accounts if a.get("is_system") and a.get("code") == "1000"), None)
        
        if system_acc:
            delete_resp = requests.delete(f"{BASE_URL}/api/accounting/accounts/{system_acc['id']}",
                headers=auth_headers)
            assert delete_resp.status_code == 400, f"Expected 400 for system account delete, got {delete_resp.status_code}"
            print("SUCCESS: System account deletion properly blocked")
        else:
            pytest.skip("No system account found to test")


class TestTaxRates:
    """Tests for Tax/VAT Rate endpoints"""
    
    def test_get_tax_rates_loads_and_seeds(self, auth_headers):
        """Test GET /accounting/tax-rates - should load and seed 4 defaults"""
        response = requests.get(f"{BASE_URL}/api/accounting/tax-rates", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 4, f"Expected at least 4 seeded tax rates, got {len(data)}"
        # Check for expected rates
        rate_names = [r.get("name") for r in data]
        assert "VAT 15%" in rate_names, "VAT 15% not found"
        print(f"SUCCESS: Loaded {len(data)} tax rates")

    def test_create_tax_rate(self, auth_headers):
        """Test POST /accounting/tax-rates - create new tax rate"""
        test_name = f"Test Tax {datetime.now().strftime('%H%M%S')}"
        response = requests.post(f"{BASE_URL}/api/accounting/tax-rates",
            headers=auth_headers,
            json={
                "name": test_name,
                "rate": 7.5,
                "type": "vat",
                "is_default": False,
                "description": "Test tax rate"
            })
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("name") == test_name
        assert data.get("rate") == 7.5
        print(f"SUCCESS: Created tax rate {test_name}")
        return data.get("id")

    def test_update_tax_rate(self, auth_headers):
        """Test PUT /accounting/tax-rates/{id} - update tax rate"""
        # Create one first
        create_resp = requests.post(f"{BASE_URL}/api/accounting/tax-rates",
            headers=auth_headers,
            json={"name": f"Update Tax {datetime.now().strftime('%H%M%S')}", "rate": 10, "type": "vat"})
        assert create_resp.status_code == 200
        rate_id = create_resp.json().get("id")
        
        # Update
        update_resp = requests.put(f"{BASE_URL}/api/accounting/tax-rates/{rate_id}",
            headers=auth_headers,
            json={"rate": 12, "description": "Updated rate"})
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert data.get("rate") == 12
        print(f"SUCCESS: Updated tax rate {rate_id}")

    def test_delete_tax_rate(self, auth_headers):
        """Test DELETE /accounting/tax-rates/{id}"""
        # Create one to delete
        create_resp = requests.post(f"{BASE_URL}/api/accounting/tax-rates",
            headers=auth_headers,
            json={"name": f"Delete Tax {datetime.now().strftime('%H%M%S')}", "rate": 5, "type": "vat"})
        assert create_resp.status_code == 200
        rate_id = create_resp.json().get("id")
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/accounting/tax-rates/{rate_id}",
            headers=auth_headers)
        assert delete_resp.status_code == 200
        print(f"SUCCESS: Deleted tax rate {rate_id}")


class TestBills:
    """Tests for Bills (Supplier Bills) endpoints"""
    
    def test_get_bills(self, auth_headers):
        """Test GET /accounting/bills"""
        response = requests.get(f"{BASE_URL}/api/accounting/bills", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "bills" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        print(f"SUCCESS: Bills endpoint returns {data.get('total')} bills")

    def test_create_bill(self, auth_headers):
        """Test POST /accounting/bills - create new bill"""
        due_date = (datetime.now() + timedelta(days=30)).isoformat()
        response = requests.post(f"{BASE_URL}/api/accounting/bills",
            headers=auth_headers,
            json={
                "supplier_name": "Test Supplier",
                "items": [
                    {"description": "Item 1", "quantity": 2, "unit_price": 100},
                    {"description": "Item 2", "quantity": 1, "unit_price": 50}
                ],
                "tax_rate": 15,
                "discount": 0,
                "due_date": due_date,
                "payment_terms": "net_30",
                "currency": "SAR"
            })
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify calculations
        expected_subtotal = 250  # (2*100) + (1*50)
        expected_tax = 37.5  # 250 * 0.15
        expected_total = 287.5  # 250 + 37.5
        
        assert data.get("subtotal") == expected_subtotal, f"Subtotal mismatch: {data.get('subtotal')}"
        assert data.get("tax_amount") == expected_tax, f"Tax mismatch: {data.get('tax_amount')}"
        assert data.get("total") == expected_total, f"Total mismatch: {data.get('total')}"
        assert data.get("status") == "unpaid"
        assert data.get("balance_due") == expected_total
        print(f"SUCCESS: Created bill with total {expected_total}")
        return data.get("id")

    def test_bill_status_filters(self, auth_headers):
        """Test bill status filtering (all, unpaid, partial, paid)"""
        for status in ["unpaid", "partial", "paid"]:
            response = requests.get(f"{BASE_URL}/api/accounting/bills?status={status}",
                headers=auth_headers)
            assert response.status_code == 200, f"Status filter '{status}' failed"
        print("SUCCESS: All status filters work")

    def test_record_payment_partial(self, auth_headers):
        """Test POST /accounting/bills/{id}/payment - partial payment"""
        # Create a bill first
        create_resp = requests.post(f"{BASE_URL}/api/accounting/bills",
            headers=auth_headers,
            json={
                "supplier_name": "Payment Test Supplier",
                "items": [{"description": "Test Item", "quantity": 1, "unit_price": 100}],
                "tax_rate": 15
            })
        assert create_resp.status_code == 200
        bill = create_resp.json()
        bill_id = bill.get("id")
        
        # Record partial payment
        pay_resp = requests.post(f"{BASE_URL}/api/accounting/bills/{bill_id}/payment",
            headers=auth_headers,
            json={"amount": 50, "method": "cash", "reference": "PAY-001"})
        assert pay_resp.status_code == 200
        data = pay_resp.json()
        
        assert data.get("status") == "partial"
        assert data.get("amount_paid") == 50
        assert len(data.get("payments", [])) == 1
        print(f"SUCCESS: Partial payment recorded for bill {bill_id}")

    def test_record_payment_full(self, auth_headers):
        """Test full payment marks bill as paid"""
        # Create a bill
        create_resp = requests.post(f"{BASE_URL}/api/accounting/bills",
            headers=auth_headers,
            json={
                "supplier_name": "Full Payment Test",
                "items": [{"description": "Item", "quantity": 1, "unit_price": 100}],
                "tax_rate": 0  # No tax for simpler calculation
            })
        assert create_resp.status_code == 200
        bill = create_resp.json()
        bill_id = bill.get("id")
        total = bill.get("total")
        
        # Pay full amount
        pay_resp = requests.post(f"{BASE_URL}/api/accounting/bills/{bill_id}/payment",
            headers=auth_headers,
            json={"amount": total, "method": "bank"})
        assert pay_resp.status_code == 200
        data = pay_resp.json()
        
        assert data.get("status") == "paid"
        assert data.get("balance_due") == 0
        print(f"SUCCESS: Full payment recorded, bill status is 'paid'")

    def test_delete_bill(self, auth_headers):
        """Test DELETE /accounting/bills/{id}"""
        # Create bill to delete
        create_resp = requests.post(f"{BASE_URL}/api/accounting/bills",
            headers=auth_headers,
            json={
                "supplier_name": "Delete Test",
                "items": [{"description": "X", "quantity": 1, "unit_price": 10}]
            })
        assert create_resp.status_code == 200
        bill_id = create_resp.json().get("id")
        
        # Delete
        delete_resp = requests.delete(f"{BASE_URL}/api/accounting/bills/{bill_id}",
            headers=auth_headers)
        assert delete_resp.status_code == 200
        print(f"SUCCESS: Deleted bill {bill_id}")


class TestProfitLoss:
    """Tests for Profit & Loss Report endpoint"""
    
    def test_get_profit_loss_default(self, auth_headers):
        """Test GET /accounting/profit-loss - default (current month)"""
        response = requests.get(f"{BASE_URL}/api/accounting/profit-loss", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check structure
        assert "period" in data
        assert "revenue" in data
        assert "cost_of_sales" in data
        assert "gross_profit" in data
        assert "operating_expenses" in data
        assert "net_profit" in data
        assert "gross_margin" in data
        assert "net_margin" in data
        assert "vat" in data
        
        print(f"SUCCESS: P&L report loaded - Net Profit: {data.get('net_profit')}")

    def test_profit_loss_with_date_range(self, auth_headers):
        """Test P&L with custom date range"""
        start = datetime.now().replace(day=1).strftime("%Y-%m-%d")
        end = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/accounting/profit-loss?start_date={start}&end_date={end}",
            headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("period", {}).get("start") == start
        assert data.get("period", {}).get("end") == end
        print(f"SUCCESS: P&L with date range {start} to {end}")

    def test_profit_loss_revenue_structure(self, auth_headers):
        """Test revenue section has correct structure"""
        response = requests.get(f"{BASE_URL}/api/accounting/profit-loss", headers=auth_headers)
        assert response.status_code == 200
        revenue = response.json().get("revenue", {})
        
        assert "sales" in revenue
        assert "sales_count" in revenue
        assert "by_method" in revenue
        assert "total" in revenue
        print(f"SUCCESS: Revenue structure correct - Total: {revenue.get('total')}")


class TestCurrencySettings:
    """Tests for Currency Settings endpoints"""
    
    def test_get_currencies(self, auth_headers):
        """Test GET /accounting/currencies"""
        response = requests.get(f"{BASE_URL}/api/accounting/currencies", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "available" in data
        assert "default" in data
        assert "enabled" in data
        
        # Should have 11 Middle East currencies
        assert len(data.get("available", [])) == 11
        
        # Check SAR is present
        currency_codes = [c.get("code") for c in data.get("available", [])]
        assert "SAR" in currency_codes
        assert "AED" in currency_codes
        print(f"SUCCESS: {len(data.get('available'))} currencies available")

    def test_update_currency_settings(self, auth_headers):
        """Test PUT /accounting/currencies"""
        response = requests.put(f"{BASE_URL}/api/accounting/currencies",
            headers=auth_headers,
            json={
                "default_currency": "SAR",
                "enabled_currencies": ["SAR", "AED", "USD"]
            })
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify update
        get_resp = requests.get(f"{BASE_URL}/api/accounting/currencies", headers=auth_headers)
        data = get_resp.json()
        assert "SAR" in data.get("enabled", [])
        assert "AED" in data.get("enabled", [])
        print("SUCCESS: Currency settings updated")


class TestAccountingSummary:
    """Tests for Accounting Summary endpoint"""
    
    def test_get_accounting_summary(self, auth_headers):
        """Test GET /accounting/summary"""
        response = requests.get(f"{BASE_URL}/api/accounting/summary", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "accounts_receivable" in data
        assert "accounts_payable" in data
        assert "overdue_bills" in data
        assert "month_revenue" in data
        assert "month_expenses" in data
        print(f"SUCCESS: Summary - AR: {data.get('accounts_receivable')}, AP: {data.get('accounts_payable')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
