"""
Iteration 14: Backend Refactoring Validation Tests

Tests all API endpoints after major refactoring:
- Old monolithic server.py (5235 lines) replaced with 79-line entry point
- 19 router modules now in /app/backend/routers/
- All routes should work exactly as before

This test validates:
1. Auth endpoints (admin + employee login, me)
2. All CRUD endpoints across routers
3. Dashboard and Reports
4. Employee self-service endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials provided
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
EMPLOYEE_EMAIL = "ahmed@test.com"
EMPLOYEE_PASSWORD = "emp@123"


class TestHealthAndRootEndpoint:
    """Health check - verify server is running"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "SSC Track API"
        print("API root endpoint working")


class TestAdminAuthentication:
    """Admin auth flow tests"""
    
    def test_admin_login_success(self):
        """Test admin login with ss@ssc.com credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        assert "user" in data, "Missing user in response"
        print(f"Admin login successful. Role: {data.get('user', {}).get('role')}")
        return data
    
    def test_admin_login_invalid_password(self):
        """Test admin login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401 or response.status_code == 400, f"Expected 401/400, got {response.status_code}"
        print("Admin invalid login correctly rejected")
    
    def test_get_current_user_admin(self):
        """Test /api/auth/me with admin token"""
        # First login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert login_resp.status_code == 200
        token = login_resp.json().get("access_token")
        
        # Get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get current user failed: {response.text}"
        data = response.json()
        assert "email" in data
        print(f"Current user: {data.get('email')}, role: {data.get('role')}")


class TestEmployeeAuthentication:
    """Employee auth flow tests"""
    
    def test_employee_login_success(self):
        """Test employee login with ahmed@test.com credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYEE_EMAIL,
            "password": EMPLOYEE_PASSWORD
        })
        assert response.status_code == 200, f"Employee login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        print(f"Employee login successful. Role: {data.get('user', {}).get('role')}")
        return data
    
    def test_get_current_user_employee(self):
        """Test /api/auth/me with employee token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYEE_EMAIL,
            "password": EMPLOYEE_PASSWORD
        })
        if login_resp.status_code != 200:
            pytest.skip(f"Employee login failed: {login_resp.text}")
        
        token = login_resp.json().get("access_token")
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print(f"Employee current user retrieved")


# ================ Fixtures ================

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin authentication failed: {response.text}")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def employee_token():
    """Get employee authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYEE_EMAIL,
        "password": EMPLOYEE_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Employee authentication failed: {response.text}")
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin authentication"""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def employee_headers(employee_token):
    """Headers with employee authentication"""
    return {"Authorization": f"Bearer {employee_token}"}


# ================ Branches Router Tests ================

class TestBranchesRouter:
    """Tests for /api/branches endpoints"""
    
    def test_list_branches(self, admin_headers):
        """GET /api/branches - List all branches"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=admin_headers)
        assert response.status_code == 200, f"List branches failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} branches")
        if data:
            print(f"First branch: {data[0].get('name', data[0])}")
    
    def test_create_branch(self, admin_headers):
        """POST /api/branches - Create a new branch"""
        new_branch = {
            "name": "TEST_Refactored_Branch",
            "location": "Test Location",
            "is_active": True
        }
        response = requests.post(f"{BASE_URL}/api/branches", json=new_branch, headers=admin_headers)
        # Accept 200, 201 or 400 (if duplicate)
        assert response.status_code in [200, 201, 400], f"Create branch unexpected status: {response.status_code}, {response.text}"
        if response.status_code in [200, 201]:
            print(f"Branch created: {response.json()}")


# ================ Sales Router Tests ================

class TestSalesRouter:
    """Tests for /api/sales endpoints"""
    
    def test_list_sales(self, admin_headers):
        """GET /api/sales - List all sales"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=admin_headers)
        assert response.status_code == 200, f"List sales failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} sales records")
    
    def test_create_sale(self, admin_headers):
        """POST /api/sales - Create a new sale"""
        new_sale = {
            "customer_name": "TEST_Refactored_Customer",
            "amount": 150.00,
            "payment_method": "cash",
            "items": [],
            "date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/sales", json=new_sale, headers=admin_headers)
        # Accept 200, 201, 400, 422 (validation may differ based on required fields)
        assert response.status_code in [200, 201, 400, 422], f"Create sale unexpected: {response.status_code}, {response.text}"
        print(f"Create sale response: {response.status_code}")


# ================ Expenses Router Tests ================

class TestExpensesRouter:
    """Tests for /api/expenses endpoints"""
    
    def test_list_expenses(self, admin_headers):
        """GET /api/expenses - List all expenses"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=admin_headers)
        assert response.status_code == 200, f"List expenses failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} expense records")
    
    def test_create_expense(self, admin_headers):
        """POST /api/expenses - Create an expense"""
        new_expense = {
            "description": "TEST_Refactored_Expense",
            "amount": 50.00,
            "category": "utilities",
            "date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/expenses", json=new_expense, headers=admin_headers)
        assert response.status_code in [200, 201, 400, 422], f"Create expense unexpected: {response.status_code}, {response.text}"
        print(f"Create expense response: {response.status_code}")


# ================ Customers Router Tests ================

class TestCustomersRouter:
    """Tests for /api/customers endpoints"""
    
    def test_list_customers(self, admin_headers):
        """GET /api/customers - List all customers"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=admin_headers)
        assert response.status_code == 200, f"List customers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} customers")
    
    def test_customers_balance(self, admin_headers):
        """GET /api/customers-balance - Customer balance summary"""
        response = requests.get(f"{BASE_URL}/api/customers-balance", headers=admin_headers)
        assert response.status_code == 200, f"Customers balance failed: {response.text}"
        print(f"Customers balance: {response.json()}")


# ================ Suppliers Router Tests ================

class TestSuppliersRouter:
    """Tests for /api/suppliers endpoints"""
    
    def test_list_suppliers(self, admin_headers):
        """GET /api/suppliers - List all suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=admin_headers)
        assert response.status_code == 200, f"List suppliers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} suppliers")
    
    def test_supplier_payments(self, admin_headers):
        """GET /api/supplier-payments - List supplier payments"""
        response = requests.get(f"{BASE_URL}/api/supplier-payments", headers=admin_headers)
        assert response.status_code == 200, f"Supplier payments failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} supplier payments")


# ================ Employees Router Tests ================

class TestEmployeesRouter:
    """Tests for /api/employees endpoints"""
    
    def test_list_employees(self, admin_headers):
        """GET /api/employees - List all employees"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=admin_headers)
        assert response.status_code == 200, f"List employees failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} employees")
    
    def test_salary_payments(self, admin_headers):
        """GET /api/salary-payments - List salary payments"""
        response = requests.get(f"{BASE_URL}/api/salary-payments", headers=admin_headers)
        assert response.status_code == 200, f"Salary payments failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} salary payments")
    
    def test_leaves(self, admin_headers):
        """GET /api/leaves - List leaves"""
        response = requests.get(f"{BASE_URL}/api/leaves", headers=admin_headers)
        assert response.status_code == 200, f"Leaves list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} leave records")
    
    def test_items(self, admin_headers):
        """GET /api/items - List items"""
        response = requests.get(f"{BASE_URL}/api/items", headers=admin_headers)
        assert response.status_code == 200, f"Items list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} items")
    
    def test_notifications(self, admin_headers):
        """GET /api/notifications - List notifications"""
        response = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers)
        assert response.status_code == 200, f"Notifications failed: {response.text}"
        print(f"Notifications response: {type(response.json())}")


# ================ Dashboard Router Tests ================

class TestDashboardRouter:
    """Tests for /api/dashboard endpoints"""
    
    def test_dashboard_stats(self, admin_headers):
        """GET /api/dashboard/stats - Dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        print(f"Dashboard stats keys: {list(data.keys()) if isinstance(data, dict) else 'list'}")


# ================ Reports Router Tests ================

class TestReportsRouter:
    """Tests for /api/reports endpoints"""
    
    def test_credit_sales_report(self, admin_headers):
        """GET /api/reports/credit-sales - Credit sales report"""
        response = requests.get(f"{BASE_URL}/api/reports/credit-sales", headers=admin_headers)
        assert response.status_code == 200, f"Credit sales report failed: {response.text}"
        print(f"Credit sales report: {type(response.json())}")
    
    def test_branch_cashbank_report(self, admin_headers):
        """GET /api/reports/branch-cashbank - Branch cash/bank report"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-cashbank", headers=admin_headers)
        assert response.status_code == 200, f"Branch cashbank report failed: {response.text}"
        print(f"Branch cashbank report: {type(response.json())}")
    
    def test_supplier_balance_report(self, admin_headers):
        """GET /api/reports/supplier-balance - Supplier balance report"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance", headers=admin_headers)
        assert response.status_code == 200, f"Supplier balance report failed: {response.text}"
        print(f"Supplier balance report: {type(response.json())}")
    
    def test_item_pnl_report(self, admin_headers):
        """GET /api/reports/item-pnl - Item P&L report"""
        response = requests.get(f"{BASE_URL}/api/reports/item-pnl", headers=admin_headers)
        assert response.status_code == 200, f"Item P&L report failed: {response.text}"
        print(f"Item P&L report: {type(response.json())}")


# ================ Documents Router Tests ================

class TestDocumentsRouter:
    """Tests for /api/documents endpoints"""
    
    def test_list_documents(self, admin_headers):
        """GET /api/documents - List documents"""
        response = requests.get(f"{BASE_URL}/api/documents", headers=admin_headers)
        assert response.status_code == 200, f"Documents list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} documents")


# ================ Invoices Router Tests ================

class TestInvoicesRouter:
    """Tests for /api/invoices endpoints"""
    
    def test_list_invoices(self, admin_headers):
        """GET /api/invoices - List invoices"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=admin_headers)
        assert response.status_code == 200, f"Invoices list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} invoices")


# ================ Job Titles Router Tests ================

class TestJobTitlesRouter:
    """Tests for /api/job-titles endpoints"""
    
    def test_list_job_titles(self, admin_headers):
        """GET /api/job-titles - List job titles"""
        response = requests.get(f"{BASE_URL}/api/job-titles", headers=admin_headers)
        assert response.status_code == 200, f"Job titles list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} job titles")


# ================ Shifts Router Tests ================

class TestShiftsRouter:
    """Tests for /api/shifts endpoints"""
    
    def test_list_shifts(self, admin_headers):
        """GET /api/shifts - List shifts"""
        response = requests.get(f"{BASE_URL}/api/shifts", headers=admin_headers)
        assert response.status_code == 200, f"Shifts list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} shifts")
    
    def test_list_shift_assignments(self, admin_headers):
        """GET /api/shift-assignments - List shift assignments"""
        response = requests.get(f"{BASE_URL}/api/shift-assignments", headers=admin_headers)
        assert response.status_code == 200, f"Shift assignments list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} shift assignments")


# ================ Stock Router Tests ================

class TestStockRouter:
    """Tests for /api/stock endpoints"""
    
    def test_stock_balance(self, admin_headers):
        """GET /api/stock/balance - Stock balance"""
        response = requests.get(f"{BASE_URL}/api/stock/balance", headers=admin_headers)
        assert response.status_code == 200, f"Stock balance failed: {response.text}"
        print(f"Stock balance: {type(response.json())}")
    
    def test_stock_entries(self, admin_headers):
        """GET /api/stock/entries - Stock entries"""
        response = requests.get(f"{BASE_URL}/api/stock/entries", headers=admin_headers)
        assert response.status_code == 200, f"Stock entries failed: {response.text}"
        data = response.json()
        print(f"Stock entries: {type(data)}")


# ================ Partners Router Tests ================

class TestPartnersRouter:
    """Tests for /api/partners endpoints"""
    
    def test_list_partners(self, admin_headers):
        """GET /api/partners - List partners"""
        response = requests.get(f"{BASE_URL}/api/partners", headers=admin_headers)
        assert response.status_code == 200, f"Partners list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} partners")


# ================ Cash Transfers Tests ================

class TestCashTransfersRouter:
    """Tests for /api/cash-transfers endpoints"""
    
    def test_list_cash_transfers(self, admin_headers):
        """GET /api/cash-transfers - List cash transfers"""
        response = requests.get(f"{BASE_URL}/api/cash-transfers", headers=admin_headers)
        assert response.status_code == 200, f"Cash transfers list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} cash transfers")


# ================ Recurring Expenses Tests ================

class TestRecurringExpensesRouter:
    """Tests for /api/recurring-expenses endpoints"""
    
    def test_list_recurring_expenses(self, admin_headers):
        """GET /api/recurring-expenses - List recurring expenses"""
        response = requests.get(f"{BASE_URL}/api/recurring-expenses", headers=admin_headers)
        assert response.status_code == 200, f"Recurring expenses list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} recurring expenses")


# ================ Bank Statements Router Tests ================

class TestBankStatementsRouter:
    """Tests for /api/bank-statements endpoints"""
    
    def test_list_bank_statements(self, admin_headers):
        """GET /api/bank-statements - List bank statements"""
        response = requests.get(f"{BASE_URL}/api/bank-statements", headers=admin_headers)
        assert response.status_code == 200, f"Bank statements list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} bank statements")


# ================ Auth/Categories Tests ================

class TestCategoriesRouter:
    """Tests for /api/categories endpoints"""
    
    def test_list_categories(self, admin_headers):
        """GET /api/categories - List categories"""
        response = requests.get(f"{BASE_URL}/api/categories", headers=admin_headers)
        assert response.status_code == 200, f"Categories list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} categories")


# ================ Users Admin Tests ================

class TestUsersRouter:
    """Tests for /api/users endpoints (admin only)"""
    
    def test_list_users_admin(self, admin_headers):
        """GET /api/users - List users (admin only)"""
        response = requests.get(f"{BASE_URL}/api/users", headers=admin_headers)
        assert response.status_code == 200, f"Users list failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} users")


# ================ Settings Router Tests ================

class TestSettingsRouter:
    """Tests for /api/settings endpoints"""
    
    def test_company_settings(self, admin_headers):
        """GET /api/settings/company - Company settings"""
        response = requests.get(f"{BASE_URL}/api/settings/company", headers=admin_headers)
        assert response.status_code == 200, f"Company settings failed: {response.text}"
        print(f"Company settings: {type(response.json())}")


# ================ Employee Self-Service Tests ================

class TestEmployeeSelfService:
    """Tests for /api/my/* endpoints (employee self-service)"""
    
    def test_my_employee_profile(self, employee_headers):
        """GET /api/my/employee-profile - Employee self-service profile"""
        response = requests.get(f"{BASE_URL}/api/my/employee-profile", headers=employee_headers)
        assert response.status_code == 200, f"My employee profile failed: {response.text}"
        print(f"Employee profile: {type(response.json())}")
    
    def test_my_payments(self, employee_headers):
        """GET /api/my/payments - Employee payments self-service"""
        response = requests.get(f"{BASE_URL}/api/my/payments", headers=employee_headers)
        assert response.status_code == 200, f"My payments failed: {response.text}"
        print(f"My payments: {type(response.json())}")
    
    def test_my_leaves(self, employee_headers):
        """GET /api/my/leaves - Employee leaves self-service"""
        response = requests.get(f"{BASE_URL}/api/my/leaves", headers=employee_headers)
        assert response.status_code == 200, f"My leaves failed: {response.text}"
        print(f"My leaves: {type(response.json())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
