"""
Iteration 8 Backend Tests
Tests for:
1. Supplier/expense empty branch_id handling (stores null, not empty string)
2. Customer balance tracking endpoints (/api/customers-balance, /api/customers/{id}/balance)
3. Credit report includes discount and final_amount fields
4. Document type categories (POST /api/categories with type=document)
5. Credit sale calculation with credit payment mode
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://expense-tracker-pro-50.preview.emergentagent.com"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - cannot run tests")

@pytest.fixture
def api_client(auth_token):
    """Authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


# ============ TEST 1: Login =============
class TestLogin:
    def test_login_with_test_credentials(self):
        """Test login with test@example.com / password123"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@example.com"
        print(f"✓ Login successful, role: {data['user']['role']}")


# ============ TEST 2: Supplier Empty branch_id Handling =============
class TestSupplierEmptyBranchId:
    def test_post_supplier_empty_branch_id_stores_null(self, api_client):
        """POST /api/suppliers with empty branch_id stores null (not empty string)"""
        response = api_client.post(f"{BASE_URL}/api/suppliers", json={
            "name": "TEST_Supplier_Empty_Branch",
            "branch_id": "",  # Empty string should be converted to null
            "category": "",
            "sub_category": "",
            "phone": "",
            "email": ""
        })
        assert response.status_code == 200, f"Create supplier failed: {response.text}"
        data = response.json()
        
        # Branch ID should be null, not empty string
        assert data.get("branch_id") is None, f"Expected branch_id to be null, got: {data.get('branch_id')}"
        assert data.get("category") is None, f"Expected category to be null, got: {data.get('category')}"
        assert data.get("sub_category") is None, f"Expected sub_category to be null, got: {data.get('sub_category')}"
        print(f"✓ Supplier created with branch_id=null (not empty string)")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/suppliers/{data['id']}")


# ============ TEST 3: Expense Empty branch_id and supplier_id Handling =============
class TestExpenseEmptyIds:
    def test_post_expense_empty_branch_supplier_stores_null(self, api_client):
        """POST /api/expenses with empty branch_id/supplier_id stores null"""
        response = api_client.post(f"{BASE_URL}/api/expenses", json={
            "category": "utilities",
            "sub_category": "",  # Empty string should be converted to null
            "description": "TEST_Expense_Empty_IDs",
            "amount": 100.00,
            "payment_mode": "cash",
            "branch_id": "",  # Empty string should be converted to null
            "supplier_id": "",  # Empty string should be converted to null
            "date": datetime.now(timezone.utc).isoformat()
        })
        assert response.status_code == 200, f"Create expense failed: {response.text}"
        data = response.json()
        
        # IDs should be null, not empty string
        assert data.get("branch_id") is None, f"Expected branch_id to be null, got: {data.get('branch_id')}"
        assert data.get("supplier_id") is None, f"Expected supplier_id to be null, got: {data.get('supplier_id')}"
        assert data.get("sub_category") is None, f"Expected sub_category to be null, got: {data.get('sub_category')}"
        print(f"✓ Expense created with branch_id=null, supplier_id=null (not empty strings)")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/expenses/{data['id']}")


# ============ TEST 4: Customer Balance Endpoints =============
class TestCustomerBalance:
    def test_get_customers_balance_returns_cash_bank_credit(self, api_client):
        """GET /api/customers-balance returns cash/bank/credit per customer"""
        response = api_client.get(f"{BASE_URL}/api/customers-balance")
        assert response.status_code == 200, f"Get customers-balance failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of customer balances"
        
        # Check that response has required fields
        if len(data) > 0:
            customer = data[0]
            required_fields = ["id", "name", "total_sales", "cash", "bank", "credit_balance"]
            for field in required_fields:
                assert field in customer, f"Missing field '{field}' in customer balance"
            print(f"✓ GET /api/customers-balance returns {len(data)} customers with balance fields")
            print(f"  Sample: {customer['name']} - Total Sales: ${customer['total_sales']}, Credit Balance: ${customer['credit_balance']}")
        else:
            print("✓ GET /api/customers-balance returns empty list (no customers)")

    def test_get_single_customer_balance(self, api_client):
        """GET /api/customers/{id}/balance returns detailed customer balance"""
        # First get a customer
        cust_response = api_client.get(f"{BASE_URL}/api/customers")
        assert cust_response.status_code == 200
        customers = cust_response.json()
        
        if len(customers) == 0:
            pytest.skip("No customers to test individual balance")
        
        customer_id = customers[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/customers/{customer_id}/balance")
        assert response.status_code == 200, f"Get customer balance failed: {response.text}"
        data = response.json()
        
        # Check required fields
        required_fields = ["customer_id", "customer_name", "total_sales", "total_cash", "total_bank", 
                         "total_credit_given", "total_credit_received", "credit_balance"]
        for field in required_fields:
            assert field in data, f"Missing field '{field}' in customer balance detail"
        
        print(f"✓ GET /api/customers/{customer_id}/balance works")
        print(f"  {data['customer_name']}: Sales=${data['total_sales']}, Credit Balance=${data['credit_balance']}")


# ============ TEST 5: Credit Report with Discount and Final Amount =============
class TestCreditReportDiscountFields:
    def test_credit_sales_report_includes_discount_final_amount(self, api_client):
        """GET /api/reports/credit-sales includes discount and final_amount fields"""
        response = api_client.get(f"{BASE_URL}/api/reports/credit-sales")
        assert response.status_code == 200, f"Get credit sales report failed: {response.text}"
        data = response.json()
        
        assert "credit_sales" in data, "Missing 'credit_sales' field in report"
        assert "summary" in data, "Missing 'summary' field in report"
        
        if len(data["credit_sales"]) > 0:
            sale = data["credit_sales"][0]
            assert "discount" in sale, "Missing 'discount' field in credit sale"
            assert "final_amount" in sale, "Missing 'final_amount' field in credit sale"
            assert "total_amount" in sale, "Missing 'total_amount' field in credit sale"
            print(f"✓ Credit sales report includes discount and final_amount fields")
            print(f"  Sample: Total=${sale['total_amount']}, Discount=${sale['discount']}, Final=${sale['final_amount']}")
        else:
            print("✓ Credit sales report structure is correct (no credit sales yet)")


# ============ TEST 6: Document Type Category =============
class TestDocumentTypeCategory:
    def test_post_category_type_document(self, api_client):
        """POST /api/categories type=document creates document type category"""
        unique_name = f"TEST_DocType_{datetime.now().timestamp()}"
        
        response = api_client.post(f"{BASE_URL}/api/categories", json={
            "name": unique_name,
            "type": "document",
            "description": "Test document type category"
        })
        assert response.status_code == 200, f"Create document category failed: {response.text}"
        data = response.json()
        
        assert data["type"] == "document", f"Expected type 'document', got: {data['type']}"
        assert data["name"] == unique_name
        print(f"✓ Created document type category: {unique_name}")
        
        # Verify it appears in categories list with type filter
        list_response = api_client.get(f"{BASE_URL}/api/categories?category_type=document")
        assert list_response.status_code == 200
        categories = list_response.json()
        found = any(c["id"] == data["id"] for c in categories)
        assert found, "Created category not found in document categories list"
        print(f"✓ Document category appears in filtered list")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/categories/{data['id']}")


# ============ TEST 7: Credit Sale Calculation with Credit Payment Mode =============
class TestCreditSaleCalculation:
    def test_sale_credit_amount_calculated_correctly(self, api_client):
        """Sale credit_amount calculated correctly with credit payment mode"""
        # First create a test customer
        cust_response = api_client.post(f"{BASE_URL}/api/customers", json={
            "name": "TEST_Credit_Customer",
            "phone": "1234567890"
        })
        assert cust_response.status_code == 200
        customer_id = cust_response.json()["id"]
        
        try:
            # Create a sale with credit payment
            sale_response = api_client.post(f"{BASE_URL}/api/sales", json={
                "sale_type": "online",
                "customer_id": customer_id,
                "amount": 1000.00,
                "discount": 100.00,
                "payment_details": [
                    {"mode": "cash", "amount": 200.00},
                    {"mode": "credit", "amount": 700.00}  # Final amount = 900, so 700 is credit
                ],
                "date": datetime.now(timezone.utc).isoformat()
            })
            assert sale_response.status_code == 200, f"Create sale failed: {sale_response.text}"
            sale = sale_response.json()
            
            # Verify credit calculation
            assert sale["amount"] == 1000.00, f"Expected amount 1000, got: {sale['amount']}"
            assert sale["discount"] == 100.00, f"Expected discount 100, got: {sale['discount']}"
            assert sale["final_amount"] == 900.00, f"Expected final_amount 900, got: {sale['final_amount']}"
            assert sale["credit_amount"] == 700.00, f"Expected credit_amount 700, got: {sale['credit_amount']}"
            assert sale["credit_received"] == 0, f"Expected credit_received 0, got: {sale['credit_received']}"
            
            print(f"✓ Credit sale calculation correct:")
            print(f"  Amount: ${sale['amount']}, Discount: ${sale['discount']}, Final: ${sale['final_amount']}")
            print(f"  Credit Amount: ${sale['credit_amount']}, Credit Received: ${sale['credit_received']}")
            
            # Cleanup sale
            api_client.delete(f"{BASE_URL}/api/sales/{sale['id']}")
        finally:
            # Cleanup customer
            api_client.delete(f"{BASE_URL}/api/customers/{customer_id}")

    def test_sale_all_credit_payment(self, api_client):
        """Sale with 100% credit - credit_amount equals final_amount"""
        # First create a test customer
        cust_response = api_client.post(f"{BASE_URL}/api/customers", json={
            "name": "TEST_AllCredit_Customer",
            "phone": "9876543210"
        })
        assert cust_response.status_code == 200
        customer_id = cust_response.json()["id"]
        
        try:
            # Create a sale with only credit payment (no cash/bank)
            sale_response = api_client.post(f"{BASE_URL}/api/sales", json={
                "sale_type": "online",
                "customer_id": customer_id,
                "amount": 500.00,
                "discount": 50.00,
                "payment_details": [
                    {"mode": "credit", "amount": 450.00}  # 100% credit
                ],
                "date": datetime.now(timezone.utc).isoformat()
            })
            assert sale_response.status_code == 200, f"Create sale failed: {sale_response.text}"
            sale = sale_response.json()
            
            # Verify 100% credit
            assert sale["final_amount"] == 450.00
            assert sale["credit_amount"] == 450.00, f"Expected credit_amount 450, got: {sale['credit_amount']}"
            print(f"✓ 100% credit sale: credit_amount (${sale['credit_amount']}) equals final_amount (${sale['final_amount']})")
            
            # Cleanup sale
            api_client.delete(f"{BASE_URL}/api/sales/{sale['id']}")
        finally:
            # Cleanup customer
            api_client.delete(f"{BASE_URL}/api/customers/{customer_id}")


# ============ TEST 8: Receive Credit for Customer Sale =============
class TestReceiveCreditPayment:
    def test_receive_credit_updates_balance(self, api_client):
        """POST /api/sales/{id}/receive-credit updates credit_received"""
        # Create customer
        cust_response = api_client.post(f"{BASE_URL}/api/customers", json={
            "name": "TEST_ReceiveCredit_Customer"
        })
        assert cust_response.status_code == 200
        customer_id = cust_response.json()["id"]
        
        try:
            # Create credit sale
            sale_response = api_client.post(f"{BASE_URL}/api/sales", json={
                "sale_type": "online",
                "customer_id": customer_id,
                "amount": 300.00,
                "discount": 0,
                "payment_details": [{"mode": "credit", "amount": 300.00}],
                "date": datetime.now(timezone.utc).isoformat()
            })
            assert sale_response.status_code == 200
            sale = sale_response.json()
            sale_id = sale["id"]
            
            # Receive partial credit payment
            receive_response = api_client.post(f"{BASE_URL}/api/sales/{sale_id}/receive-credit", json={
                "payment_mode": "cash",
                "amount": 100.00
            })
            assert receive_response.status_code == 200, f"Receive credit failed: {receive_response.text}"
            
            # Verify the sale updated
            sales_list = api_client.get(f"{BASE_URL}/api/sales").json()
            updated_sale = next((s for s in sales_list if s["id"] == sale_id), None)
            assert updated_sale is not None
            assert updated_sale["credit_received"] == 100.00, f"Expected credit_received 100, got: {updated_sale['credit_received']}"
            
            print(f"✓ Receive credit payment works: credit_received = ${updated_sale['credit_received']}")
            
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/sales/{sale_id}")
        finally:
            api_client.delete(f"{BASE_URL}/api/customers/{customer_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
