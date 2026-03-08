"""
Test cases for SSC Track ERP new features:
1. Missing data alerts API
2. Expense bill upload API
3. Cross-branch expense/supplier payment fields
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Test login to get auth token"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class") 
    def operator_token(self):
        """Get operator auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@ssc.com",
            "password": "testtest"
        })
        assert response.status_code == 200, f"Operator login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]


class TestMissingDataAlerts(TestAuthentication):
    """Test GET /api/dashboard/missing-data-alerts endpoint"""
    
    def test_missing_data_alerts_returns_200(self, admin_token):
        """Test that missing data alerts endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/missing-data-alerts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
    
    def test_missing_data_alerts_structure(self, admin_token):
        """Test that response has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/missing-data-alerts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check response structure
        assert "alerts" in data, "Response should contain 'alerts' field"
        assert "check_dates" in data, "Response should contain 'check_dates' field"
        assert isinstance(data["alerts"], list), "'alerts' should be a list"
        assert isinstance(data["check_dates"], list), "'check_dates' should be a list"
        assert len(data["check_dates"]) == 2, "Should have 2 check dates (yesterday and today)"
    
    def test_missing_data_alert_item_structure(self, admin_token):
        """Test that each alert item has correct fields"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/missing-data-alerts",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        
        if data["alerts"]:
            alert = data["alerts"][0]
            assert "branch_id" in alert, "Alert should have branch_id"
            assert "branch_name" in alert, "Alert should have branch_name"
            assert "date" in alert, "Alert should have date"
            assert "missing" in alert, "Alert should have missing field"
            assert "is_today" in alert, "Alert should have is_today"
            assert "message" in alert, "Alert should have message"
            assert isinstance(alert["missing"], list), "'missing' should be a list"


class TestExpenseBillUpload(TestAuthentication):
    """Test POST /api/expenses/upload-bill endpoint"""
    
    def test_upload_bill_with_image(self, admin_token):
        """Test uploading an image file as bill"""
        # Create a simple test image (1x1 pixel PNG)
        import base64
        # Minimal valid PNG
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test_bill.png", png_data, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/expenses/upload-bill",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        assert response.status_code == 200, f"Upload failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "bill_url" in data, "Response should contain 'bill_url'"
        assert data["bill_url"].startswith("/uploads/bills/"), "bill_url should start with /uploads/bills/"
    
    def test_upload_bill_rejects_invalid_file_type(self, admin_token):
        """Test that invalid file types are rejected"""
        files = {"file": ("test.txt", b"Hello World", "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/expenses/upload-bill",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files
        )
        assert response.status_code == 400, "Should reject non-image/pdf files"


class TestExpenseWithBranches(TestAuthentication):
    """Test expense creation with cross-branch fields"""
    
    def test_get_branches(self, admin_token):
        """Get branches for testing"""
        response = requests.get(
            f"{BASE_URL}/api/branches",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        return response.json()
    
    def test_create_expense_with_expense_for_branch(self, admin_token):
        """Test creating expense with expense_for_branch_id"""
        # First get branches
        branches_response = requests.get(
            f"{BASE_URL}/api/branches",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        branches = branches_response.json()
        
        if len(branches) >= 2:
            branch1 = branches[0]["id"]
            branch2 = branches[1]["id"]
            
            expense_data = {
                "category": "test_expense",
                "description": "TEST_Cross branch expense",
                "amount": 100.50,
                "payment_mode": "cash",
                "branch_id": branch1,
                "expense_for_branch_id": branch2,
                "date": "2026-01-15T10:00:00Z"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/expenses",
                headers={"Authorization": f"Bearer {admin_token}"},
                json=expense_data
            )
            assert response.status_code == 200, f"Create expense failed: {response.text}"
            data = response.json()
            assert data["branch_id"] == branch1
            assert data["expense_for_branch_id"] == branch2
            
            # Cleanup
            requests.delete(
                f"{BASE_URL}/api/expenses/{data['id']}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
    
    def test_create_expense_without_invoice(self, admin_token):
        """Test creating expense without invoice upload (optional field)"""
        expense_data = {
            "category": "utilities",
            "description": "TEST_Expense without invoice",
            "amount": 50.00,
            "payment_mode": "cash",
            "date": "2026-01-15T10:00:00Z"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/expenses",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=expense_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["bill_image_url"] is None or data.get("bill_image_url") == ""
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/expenses/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )


class TestSupplierPaymentWithBranches(TestAuthentication):
    """Test supplier payment with cross-branch fields"""
    
    def test_get_suppliers(self, admin_token):
        """Get suppliers for testing"""
        response = requests.get(
            f"{BASE_URL}/api/suppliers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        return response.json()
    
    def test_create_supplier_payment_with_expense_for_branch(self, admin_token):
        """Test creating supplier payment with expense_for_branch_id"""
        # Get branches
        branches_response = requests.get(
            f"{BASE_URL}/api/branches",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        branches = branches_response.json()
        
        # Get suppliers
        suppliers_response = requests.get(
            f"{BASE_URL}/api/suppliers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        suppliers = suppliers_response.json()
        
        if len(branches) >= 2 and suppliers:
            branch1 = branches[0]["id"]
            branch2 = branches[1]["id"]
            supplier_id = suppliers[0]["id"]
            
            payment_data = {
                "supplier_id": supplier_id,
                "amount": 200.00,
                "payment_mode": "cash",
                "branch_id": branch1,
                "expense_for_branch_id": branch2,
                "date": "2026-01-15T10:00:00Z",
                "notes": "TEST_Cross branch supplier payment"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/supplier-payments",
                headers={"Authorization": f"Bearer {admin_token}"},
                json=payment_data
            )
            assert response.status_code == 200, f"Create payment failed: {response.text}"
            data = response.json()
            assert data["branch_id"] == branch1
            assert data.get("expense_for_branch_id") == branch2
            
            # Cleanup
            requests.delete(
                f"{BASE_URL}/api/supplier-payments/{data['id']}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )


class TestDashboardStats(TestAuthentication):
    """Test dashboard stats endpoint"""
    
    def test_dashboard_stats_returns_200(self, admin_token):
        """Test dashboard stats endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200


class TestExpensesGet(TestAuthentication):
    """Test GET /api/expenses endpoint"""
    
    def test_get_expenses(self, admin_token):
        """Test fetching expenses list"""
        response = requests.get(
            f"{BASE_URL}/api/expenses",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data or isinstance(data, list)


class TestSupplierPaymentsGet(TestAuthentication):
    """Test GET /api/supplier-payments endpoint"""
    
    def test_get_supplier_payments(self, admin_token):
        """Test fetching supplier payments list"""
        response = requests.get(
            f"{BASE_URL}/api/supplier-payments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data or isinstance(data, list)
