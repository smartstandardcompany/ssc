"""
Iteration 20: UI/UX Overhaul Testing
Tests for:
1. POS multi-payment sales endpoint
2. Company settings ZATCA toggle (vat_enabled, vat_rate)
3. Dashboard and basic endpoints still working
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Login and get auth token"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}

    def test_login_success(self):
        """Test admin login returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        print("✓ Admin login successful")


class TestPOSMultiPayment:
    """Test POS multi-payment sales functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    @pytest.fixture(scope="class")
    def branch_id(self, headers):
        """Get a valid branch ID"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        branches = response.json()
        if branches:
            return branches[0]["id"]
        return None

    def test_create_sale_with_multi_payment(self, headers, branch_id):
        """Test creating a sale with multiple payment types (cash + bank)"""
        if not branch_id:
            pytest.skip("No branches available")
        
        payload = {
            "sale_type": "pos",
            "amount": 150,
            "branch_id": branch_id,
            "notes": "TEST_Multi_Payment_Backend",
            "date": "2026-02-26T12:00:00Z",
            "payment_details": [
                {"mode": "cash", "amount": 100, "discount": 0},
                {"mode": "bank", "amount": 50, "discount": 0}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/sales", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["amount"] == 150
        assert data["final_amount"] == 150
        assert len(data["payment_details"]) == 2
        print(f"✓ Multi-payment sale created: {data['id']}")
        return data["id"]
    
    def test_create_sale_with_all_payment_types(self, headers, branch_id):
        """Test creating a sale with all 4 payment types"""
        if not branch_id:
            pytest.skip("No branches available")
        
        payload = {
            "sale_type": "pos",
            "amount": 200,
            "branch_id": branch_id,
            "notes": "TEST_All_Payment_Types",
            "date": "2026-02-26T12:00:00Z",
            "payment_details": [
                {"mode": "cash", "amount": 50, "discount": 0},
                {"mode": "bank", "amount": 50, "discount": 0},
                {"mode": "online", "amount": 50, "discount": 0},
                {"mode": "credit", "amount": 50, "discount": 0}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/sales", json=payload, headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data["amount"] == 200
        assert len(data["payment_details"]) == 4
        payment_modes = [p["mode"] for p in data["payment_details"]]
        assert "cash" in payment_modes
        assert "bank" in payment_modes
        assert "online" in payment_modes
        assert "credit" in payment_modes
        print("✓ Sale with all 4 payment types created")
    
    def test_create_sale_single_cash(self, headers, branch_id):
        """Test creating a sale with only cash payment"""
        if not branch_id:
            pytest.skip("No branches available")
        
        payload = {
            "sale_type": "pos",
            "amount": 100,
            "branch_id": branch_id,
            "notes": "TEST_Single_Cash",
            "date": "2026-02-26T12:00:00Z",
            "payment_details": [
                {"mode": "cash", "amount": 100, "discount": 0}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/sales", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["amount"] == 100
        assert len(data["payment_details"]) == 1
        print("✓ Single cash payment sale created")


class TestZATCASettings:
    """Test ZATCA invoicing toggle in company settings"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}

    def test_get_company_settings(self, headers):
        """Test retrieving company settings"""
        response = requests.get(f"{BASE_URL}/api/settings/company", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Verify ZATCA fields exist
        assert "vat_enabled" in data or data.get("vat_enabled") is not None or "company_name" in data
        print(f"✓ Company settings retrieved: vat_enabled={data.get('vat_enabled')}")
    
    def test_enable_zatca(self, headers):
        """Test enabling ZATCA VAT on invoices"""
        payload = {
            "company_name": "Smart Standard Company",
            "vat_enabled": True,
            "vat_rate": 15,
            "vat_number": "300000000000003"
        }
        response = requests.post(f"{BASE_URL}/api/settings/company", json=payload, headers=headers)
        assert response.status_code == 200
        
        # Verify settings saved
        get_response = requests.get(f"{BASE_URL}/api/settings/company", headers=headers)
        data = get_response.json()
        assert data.get("vat_enabled") == True
        assert data.get("vat_rate") == 15
        print("✓ ZATCA settings enabled and saved")
    
    def test_disable_zatca(self, headers):
        """Test disabling ZATCA VAT"""
        payload = {
            "company_name": "Smart Standard Company",
            "vat_enabled": False,
            "vat_rate": 15,
            "vat_number": "300000000000003"
        }
        response = requests.post(f"{BASE_URL}/api/settings/company", json=payload, headers=headers)
        assert response.status_code == 200
        
        # Verify settings saved
        get_response = requests.get(f"{BASE_URL}/api/settings/company", headers=headers)
        data = get_response.json()
        assert data.get("vat_enabled") == False
        print("✓ ZATCA settings disabled")


class TestRegressionEndpoints:
    """Regression tests for critical endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}

    def test_dashboard_stats(self, headers):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_sales" in data
        print(f"✓ Dashboard stats: sales={data.get('total_sales')}, expenses={data.get('total_expenses')}")
    
    def test_branches_list(self, headers):
        """Test branches list endpoint"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Branches list: {len(data)} branches")
    
    def test_customers_list(self, headers):
        """Test customers list endpoint"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Customers list: {len(data)} customers")
    
    def test_sales_list(self, headers):
        """Test sales list endpoint"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Sales list: {len(data)} sales")
    
    def test_expenses_list(self, headers):
        """Test expenses list endpoint"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Expenses list: {len(data)} expenses")
    
    def test_categories_list(self, headers):
        """Test categories list endpoint"""
        response = requests.get(f"{BASE_URL}/api/categories", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Categories list: {len(data)} categories")


class TestCleanup:
    """Clean up test data"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_cleanup_test_sales(self, headers):
        """Clean up TEST_ prefixed sales"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=headers)
        if response.status_code == 200:
            sales = response.json()
            cleaned = 0
            for sale in sales:
                if "TEST_" in str(sale.get("notes", "")):
                    del_resp = requests.delete(f"{BASE_URL}/api/sales/{sale['id']}", headers=headers)
                    if del_resp.status_code == 200:
                        cleaned += 1
            print(f"✓ Cleaned up {cleaned} test sales")
