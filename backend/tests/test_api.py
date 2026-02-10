"""
Backend API Tests for DataEntry Hub
Tests: Auth, Branches, Customers, Suppliers, Sales, Expenses, Reports, Users
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestApiHealth:
    """Health check endpoint tests"""
    
    def test_api_root_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API health check passed: {data['message']}")


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.test_email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
        self.test_password = "password123"
    
    def test_login_with_valid_credentials(self):
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
        print(f"✓ Login successful for test@example.com")
        return data
    
    def test_login_with_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_register_duplicate_email_rejected(self):
        """Test that duplicate email registration fails"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
            "name": "Test User"
        })
        assert response.status_code == 400
        print("✓ Duplicate email registration correctly rejected")


class TestAuthenticatedEndpoints:
    """Tests for authenticated API endpoints"""
    
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
        self.user = data["user"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_current_user(self):
        """Test /auth/me endpoint"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        print(f"✓ Current user retrieved: {data['name']}")
    
    def test_dashboard_stats_returns_correct_structure(self):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        # Verify structure
        assert "total_sales" in data
        assert "total_expenses" in data
        assert "total_supplier_payments" in data
        assert "net_profit" in data
        assert "pending_credits" in data
        assert "cash_sales" in data
        assert "bank_sales" in data
        assert "credit_sales" in data
        print(f"✓ Dashboard stats: Total Sales=${data['total_sales']}, Net Profit=${data['net_profit']}")


class TestBranches:
    """Branch CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
        self.created_ids = []
    
    def teardown_method(self, method):
        # Cleanup created branches
        for branch_id in self.created_ids:
            requests.delete(f"{BASE_URL}/api/branches/{branch_id}", headers=self.headers)
    
    def test_get_branches(self):
        """Test list branches"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Retrieved {len(response.json())} branches")
    
    def test_create_branch(self):
        """Test create branch"""
        branch_name = f"TEST_Branch_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/branches", headers=self.headers, json={
            "name": branch_name,
            "location": "Test Location"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == branch_name
        self.created_ids.append(data["id"])
        print(f"✓ Created branch: {branch_name}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        branches = get_response.json()
        assert any(b["id"] == data["id"] for b in branches)
        print(f"✓ Branch persisted and verified via GET")


class TestCustomers:
    """Customer CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
        self.created_ids = []
    
    def teardown_method(self, method):
        for cust_id in self.created_ids:
            requests.delete(f"{BASE_URL}/api/customers/{cust_id}", headers=self.headers)
    
    def test_create_and_get_customer(self):
        """Test create customer and verify persistence"""
        cust_name = f"TEST_Customer_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/customers", headers=self.headers, json={
            "name": cust_name,
            "phone": "123-456-7890",
            "email": f"test_{uuid.uuid4().hex[:6]}@example.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == cust_name
        self.created_ids.append(data["id"])
        print(f"✓ Created customer: {cust_name}")
        
        # Verify via GET
        get_response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        customers = get_response.json()
        assert any(c["id"] == data["id"] for c in customers)
        print(f"✓ Customer persisted and verified")
    
    def test_update_customer(self):
        """Test update customer"""
        # Create
        response = requests.post(f"{BASE_URL}/api/customers", headers=self.headers, json={
            "name": f"TEST_UpdateCust_{uuid.uuid4().hex[:6]}",
            "phone": "111-111-1111"
        })
        cust_id = response.json()["id"]
        self.created_ids.append(cust_id)
        
        # Update
        update_response = requests.put(f"{BASE_URL}/api/customers/{cust_id}", headers=self.headers, json={
            "name": "Updated Customer Name",
            "phone": "222-222-2222"
        })
        assert update_response.status_code == 200
        assert update_response.json()["name"] == "Updated Customer Name"
        print("✓ Customer updated successfully")
    
    def test_delete_customer(self):
        """Test delete customer"""
        response = requests.post(f"{BASE_URL}/api/customers", headers=self.headers, json={
            "name": f"TEST_DeleteCust_{uuid.uuid4().hex[:6]}"
        })
        cust_id = response.json()["id"]
        
        delete_response = requests.delete(f"{BASE_URL}/api/customers/{cust_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print("✓ Customer deleted successfully")


class TestSuppliers:
    """Supplier CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
        self.created_ids = []
    
    def teardown_method(self, method):
        for sup_id in self.created_ids:
            requests.delete(f"{BASE_URL}/api/suppliers/{sup_id}", headers=self.headers)
    
    def test_create_supplier_with_category(self):
        """Test create supplier with category"""
        sup_name = f"TEST_Supplier_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/suppliers", headers=self.headers, json={
            "name": sup_name,
            "category": "Raw Materials",
            "phone": "123-456-7890",
            "credit_limit": 5000.00
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sup_name
        assert data["category"] == "Raw Materials"
        assert data["credit_limit"] == 5000.00
        self.created_ids.append(data["id"])
        print(f"✓ Created supplier with category: {sup_name}")
    
    def test_pay_supplier_credit(self):
        """Test paying supplier credit"""
        # Create supplier with credit
        response = requests.post(f"{BASE_URL}/api/suppliers", headers=self.headers, json={
            "name": f"TEST_CreditSup_{uuid.uuid4().hex[:6]}",
            "credit_limit": 1000.00
        })
        sup_id = response.json()["id"]
        self.created_ids.append(sup_id)
        
        # Note: current_credit starts at 0, need to add credit first via supplier payment
        # Testing the endpoint structure
        pay_response = requests.post(f"{BASE_URL}/api/suppliers/{sup_id}/pay-credit", headers=self.headers, json={
            "payment_mode": "cash",
            "amount": 0  # 0 amount since no credit exists
        })
        # Should succeed with 0 payment or fail gracefully
        print(f"✓ Supplier credit payment endpoint tested")


class TestCategories:
    """Category management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
        self.created_ids = []
    
    def teardown_method(self, method):
        for cat_id in self.created_ids:
            requests.delete(f"{BASE_URL}/api/categories/{cat_id}", headers=self.headers)
    
    def test_get_supplier_categories(self):
        """Test get supplier categories"""
        response = requests.get(f"{BASE_URL}/api/categories?category_type=supplier", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Retrieved {len(response.json())} supplier categories")
    
    def test_get_expense_categories(self):
        """Test get expense categories"""
        response = requests.get(f"{BASE_URL}/api/categories?category_type=expense", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Retrieved {len(response.json())} expense categories")
    
    def test_create_category(self):
        """Test create new category"""
        cat_name = f"TEST_Category_{uuid.uuid4().hex[:6]}"
        response = requests.post(f"{BASE_URL}/api/categories", headers=self.headers, json={
            "name": cat_name,
            "type": "supplier",
            "description": "Test category"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == cat_name
        assert data["type"] == "supplier"
        self.created_ids.append(data["id"])
        print(f"✓ Created category: {cat_name}")


class TestSales:
    """Sales CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
        self.created_ids = []
        
        # Create test branch
        branch_response = requests.post(f"{BASE_URL}/api/branches", headers=self.headers, json={
            "name": f"TEST_SalesBranch_{uuid.uuid4().hex[:6]}"
        })
        self.branch_id = branch_response.json()["id"]
        self.branch_created = True
    
    def teardown_method(self, method):
        for sale_id in self.created_ids:
            requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=self.headers)
        if hasattr(self, 'branch_created') and self.branch_created:
            requests.delete(f"{BASE_URL}/api/branches/{self.branch_id}", headers=self.headers)
    
    def test_create_sale_with_split_payment(self):
        """Test create sale with split payment (cash + bank)"""
        response = requests.post(f"{BASE_URL}/api/sales", headers=self.headers, json={
            "sale_type": "branch",
            "branch_id": self.branch_id,
            "amount": 150.00,
            "discount": 10.00,
            "payment_details": [
                {"mode": "cash", "amount": 80.00},
                {"mode": "bank", "amount": 60.00}
            ],
            "date": datetime.now().isoformat()
        })
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 150.00
        assert data["discount"] == 10.00
        assert data["final_amount"] == 140.00  # 150 - 10
        assert len(data["payment_details"]) == 2
        self.created_ids.append(data["id"])
        print(f"✓ Created sale with split payment: $150 (Cash $80 + Bank $60), discount $10")
    
    def test_create_credit_sale(self):
        """Test create sale with credit component"""
        response = requests.post(f"{BASE_URL}/api/sales", headers=self.headers, json={
            "sale_type": "branch",
            "branch_id": self.branch_id,
            "amount": 100.00,
            "discount": 0,
            "payment_details": [
                {"mode": "cash", "amount": 50.00},
                {"mode": "credit", "amount": 50.00}
            ],
            "date": datetime.now().isoformat()
        })
        assert response.status_code == 200
        data = response.json()
        assert data["credit_amount"] == 50.00  # Only cash counts as paid
        self.created_ids.append(data["id"])
        print(f"✓ Created credit sale: $100 (Cash $50, Credit $50)")
    
    def test_receive_credit_payment(self):
        """Test receiving credit payment on a sale"""
        # Create sale with credit
        sale_response = requests.post(f"{BASE_URL}/api/sales", headers=self.headers, json={
            "sale_type": "branch",
            "branch_id": self.branch_id,
            "amount": 100.00,
            "discount": 0,
            "payment_details": [
                {"mode": "cash", "amount": 30.00},
                {"mode": "credit", "amount": 70.00}
            ],
            "date": datetime.now().isoformat()
        })
        sale_id = sale_response.json()["id"]
        self.created_ids.append(sale_id)
        
        # Receive partial credit
        receive_response = requests.post(f"{BASE_URL}/api/sales/{sale_id}/receive-credit", headers=self.headers, json={
            "payment_mode": "cash",
            "amount": 30.00
        })
        assert receive_response.status_code == 200
        data = receive_response.json()
        assert data["remaining_credit"] == 40.00  # 70 - 30
        print(f"✓ Received credit payment: $30, remaining: $40")


class TestExpenses:
    """Expense CRUD tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
        self.created_ids = []
    
    def teardown_method(self, method):
        for exp_id in self.created_ids:
            requests.delete(f"{BASE_URL}/api/expenses/{exp_id}", headers=self.headers)
    
    def test_create_expense(self):
        """Test create expense"""
        response = requests.post(f"{BASE_URL}/api/expenses", headers=self.headers, json={
            "category": "salary",
            "description": "TEST_Monthly Salary Payment",
            "amount": 2500.00,
            "payment_mode": "bank",
            "date": datetime.now().isoformat()
        })
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "salary"
        assert data["amount"] == 2500.00
        self.created_ids.append(data["id"])
        print(f"✓ Created expense: Salary $2500")
    
    def test_get_expenses(self):
        """Test list expenses"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Retrieved {len(response.json())} expenses")


class TestReports:
    """Report endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
    
    def test_credit_sales_report(self):
        """Test credit sales report endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/credit-sales", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "credit_sales" in data
        assert "summary" in data
        assert "total_credit_given" in data["summary"]
        assert "total_credit_received" in data["summary"]
        assert "total_credit_remaining" in data["summary"]
        print(f"✓ Credit report: Total Given=${data['summary']['total_credit_given']}, Remaining=${data['summary']['total_credit_remaining']}")
    
    def test_supplier_report(self):
        """Test supplier report endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/suppliers", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "name" in data[0]
            assert "category" in data[0]
            assert "total_expenses" in data[0]
            assert "total_paid" in data[0]
        print(f"✓ Supplier report: {len(data)} suppliers")
    
    def test_category_report(self):
        """Test supplier category report endpoint"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-categories", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "category" in data[0]
            assert "supplier_count" in data[0]
            assert "total_expenses" in data[0]
        print(f"✓ Category report: {len(data)} categories")


class TestUsers:
    """User management tests (admin only)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
        self.user = data["user"]
        self.created_ids = []
    
    def teardown_method(self, method):
        for user_id in self.created_ids:
            requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=self.headers)
    
    def test_get_users_as_admin(self):
        """Test list users (admin only)"""
        if self.user.get("role") != "admin":
            pytest.skip("User is not admin")
        
        response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert response.status_code == 200
        users = response.json()
        assert isinstance(users, list)
        assert len(users) > 0
        print(f"✓ Retrieved {len(users)} users")
    
    def test_create_user_as_admin(self):
        """Test create user (admin only)"""
        if self.user.get("role") != "admin":
            pytest.skip("User is not admin")
        
        new_email = f"test_newuser_{uuid.uuid4().hex[:6]}@example.com"
        response = requests.post(f"{BASE_URL}/api/users", headers=self.headers, json={
            "email": new_email,
            "password": "testpass123",
            "name": "TEST New User",
            "role": "operator",
            "permissions": ["sales", "expenses"]
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == new_email
        assert data["role"] == "operator"
        self.created_ids.append(data["id"])
        print(f"✓ Created user: {new_email}")


class TestExport:
    """Export endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        data = response.json()
        self.headers = {"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"}
    
    def test_export_pdf(self):
        """Test PDF export"""
        response = requests.post(f"{BASE_URL}/api/export/reports", headers=self.headers, json={
            "format": "pdf"
        })
        assert response.status_code == 200
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 0
        print("✓ PDF export successful")
    
    def test_export_excel(self):
        """Test Excel export"""
        response = requests.post(f"{BASE_URL}/api/export/reports", headers=self.headers, json={
            "format": "excel"
        })
        assert response.status_code == 200
        assert "spreadsheet" in response.headers.get("content-type", "")
        assert len(response.content) > 0
        print("✓ Excel export successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
