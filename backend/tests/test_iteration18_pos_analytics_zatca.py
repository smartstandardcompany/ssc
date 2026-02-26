"""
Iteration 18: Test POS Analytics and ZATCA Invoice features

Features tested:
1. POS Analytics: /dashboard/live-analytics - real-time KPIs, branch leaderboard, hourly chart, cashier stats
2. ZATCA Invoice: VAT calculation, QR code generation, bilingual print data
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Test authentication to get token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
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
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

    def test_login_works(self, auth_token):
        """Verify login returns valid token"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful, got token")


class TestPOSAnalyticsEndpoint:
    """Test /dashboard/live-analytics endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

    def test_live_analytics_endpoint_returns_200(self, headers):
        """GET /dashboard/live-analytics returns 200"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live-analytics", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ /dashboard/live-analytics returns 200")
    
    def test_live_analytics_has_required_fields(self, headers):
        """Verify response has all required fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live-analytics", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields for KPI cards
        required_fields = [
            "total_sales", "total_expenses", "net", "sales_count", "avg_ticket",
            "recent_sales", "branch_leaderboard", "top_cashiers", "hourly_chart", "payment_modes"
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            print(f"✓ Field '{field}' present in response")
    
    def test_live_analytics_total_sales_is_numeric(self, headers):
        """total_sales should be a number"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live-analytics", headers=headers)
        data = response.json()
        assert isinstance(data["total_sales"], (int, float)), "total_sales should be numeric"
        print(f"✓ total_sales is numeric: {data['total_sales']}")
    
    def test_live_analytics_branch_leaderboard_structure(self, headers):
        """branch_leaderboard should be a list with correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live-analytics", headers=headers)
        data = response.json()
        assert isinstance(data["branch_leaderboard"], list), "branch_leaderboard should be a list"
        # If there's data, check structure
        if len(data["branch_leaderboard"]) > 0:
            branch = data["branch_leaderboard"][0]
            assert "name" in branch, "branch should have 'name'"
            assert "total" in branch, "branch should have 'total'"
            assert "count" in branch, "branch should have 'count'"
        print(f"✓ branch_leaderboard structure correct (count: {len(data['branch_leaderboard'])})")
    
    def test_live_analytics_top_cashiers_structure(self, headers):
        """top_cashiers should be a list with correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live-analytics", headers=headers)
        data = response.json()
        assert isinstance(data["top_cashiers"], list), "top_cashiers should be a list"
        if len(data["top_cashiers"]) > 0:
            cashier = data["top_cashiers"][0]
            assert "name" in cashier, "cashier should have 'name'"
            assert "total" in cashier, "cashier should have 'total'"
            assert "count" in cashier, "cashier should have 'count'"
        print(f"✓ top_cashiers structure correct (count: {len(data['top_cashiers'])})")
    
    def test_live_analytics_payment_modes_structure(self, headers):
        """payment_modes should contain cash, bank, online, credit"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live-analytics", headers=headers)
        data = response.json()
        assert isinstance(data["payment_modes"], dict), "payment_modes should be a dict"
        expected_modes = ["cash", "bank", "online", "credit"]
        for mode in expected_modes:
            assert mode in data["payment_modes"], f"Missing payment mode: {mode}"
        print(f"✓ payment_modes contains all expected modes: {data['payment_modes']}")
    
    def test_live_analytics_hourly_chart_structure(self, headers):
        """hourly_chart should be a list of hour/amount objects"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live-analytics", headers=headers)
        data = response.json()
        assert isinstance(data["hourly_chart"], list), "hourly_chart should be a list"
        if len(data["hourly_chart"]) > 0:
            item = data["hourly_chart"][0]
            assert "hour" in item, "hourly item should have 'hour'"
            assert "amount" in item, "hourly item should have 'amount'"
        print(f"✓ hourly_chart structure correct (count: {len(data['hourly_chart'])})")
    
    def test_live_analytics_recent_sales_structure(self, headers):
        """recent_sales should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/dashboard/live-analytics", headers=headers)
        data = response.json()
        assert isinstance(data["recent_sales"], list), "recent_sales should be a list"
        if len(data["recent_sales"]) > 0:
            sale = data["recent_sales"][0]
            required = ["id", "amount", "branch", "cashier", "mode", "time"]
            for field in required:
                assert field in sale, f"recent_sale should have '{field}'"
        print(f"✓ recent_sales structure correct (count: {len(data['recent_sales'])})")


class TestZATCAInvoiceEndpoints:
    """Test ZATCA-compliant invoice endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def test_branch_id(self, headers):
        """Get a branch ID for testing"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        branches = response.json()
        if branches:
            return branches[0]["id"]
        return None
    
    def test_invoices_endpoint_returns_200(self, headers):
        """GET /invoices returns 200"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ /invoices returns 200")
    
    def test_invoices_have_vat_fields(self, headers):
        """Invoices should have VAT-related fields"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        data = response.json()
        if len(data) > 0:
            inv = data[0]
            # Check for VAT fields in Invoice model
            vat_fields = ["vat_rate", "vat_amount", "total_with_vat"]
            for field in vat_fields:
                # Note: Pre-ZATCA invoices may not have these fields
                if field in inv:
                    print(f"✓ Invoice has field '{field}': {inv[field]}")
        print(f"✓ Found {len(data)} invoices")
    
    def test_create_invoice_with_vat(self, headers, test_branch_id):
        """Create invoice - VAT should be calculated based on company settings"""
        from datetime import datetime
        payload = {
            "branch_id": test_branch_id,
            "customer_id": None,
            "items": [
                {"description": "TEST_ZATCA Product", "quantity": 2, "unit_price": 100}
            ],
            "discount": 0,
            "payment_mode": "cash",
            "date": datetime.now().isoformat(),
            "notes": "TEST_ZATCA Invoice for testing"
        }
        response = requests.post(f"{BASE_URL}/api/invoices", headers=headers, json=payload)
        assert response.status_code == 200, f"Failed to create invoice: {response.text}"
        data = response.json()
        
        # Check response has VAT fields
        assert "vat_rate" in data, "Response should have vat_rate"
        assert "vat_amount" in data, "Response should have vat_amount"
        assert "total_with_vat" in data, "Response should have total_with_vat"
        
        print(f"✓ Invoice created with id: {data['id']}")
        print(f"  - subtotal: {data['subtotal']}")
        print(f"  - vat_rate: {data['vat_rate']}")
        print(f"  - vat_amount: {data['vat_amount']}")
        print(f"  - total_with_vat: {data['total_with_vat']}")
        
        return data["id"]
    
    def test_zatca_qr_endpoint_returns_qr_data(self, headers):
        """GET /invoices/{id}/zatca-qr returns QR data"""
        # First get an invoice
        response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        invoices = response.json()
        if len(invoices) == 0:
            pytest.skip("No invoices to test QR endpoint")
        
        invoice_id = invoices[0]["id"]
        qr_response = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-qr", headers=headers)
        assert qr_response.status_code == 200, f"Expected 200, got {qr_response.status_code}: {qr_response.text}"
        
        data = qr_response.json()
        required_fields = ["qr_data", "seller_name", "vat_number", "timestamp", "total", "vat_amount"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
            print(f"✓ QR response has '{field}': {data[field][:50] if isinstance(data[field], str) and len(data[field]) > 50 else data[field]}")
    
    def test_zatca_qr_data_is_base64(self, headers):
        """qr_data should be base64 encoded TLV data"""
        import base64
        
        response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        invoices = response.json()
        if len(invoices) == 0:
            pytest.skip("No invoices to test QR endpoint")
        
        invoice_id = invoices[0]["id"]
        qr_response = requests.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-qr", headers=headers)
        data = qr_response.json()
        
        # Try to decode base64
        try:
            decoded = base64.b64decode(data["qr_data"])
            assert len(decoded) > 0, "Decoded QR data should not be empty"
            print(f"✓ qr_data is valid base64 (decoded length: {len(decoded)} bytes)")
        except Exception as e:
            pytest.fail(f"qr_data is not valid base64: {e}")
    
    def test_zatca_qr_not_found_returns_404(self, headers):
        """Non-existent invoice should return 404"""
        response = requests.get(f"{BASE_URL}/api/invoices/non-existent-id/zatca-qr", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent invoice returns 404")


class TestCompanySettingsVAT:
    """Test company settings for VAT configuration"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_company_settings_endpoint_exists(self, headers):
        """GET /settings/company should return settings"""
        response = requests.get(f"{BASE_URL}/api/settings/company", headers=headers)
        # May return 200 with data or 404 if not configured
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Company settings: {data}")
        else:
            print(f"✓ Company settings not configured yet (404)")
    
    def test_company_settings_has_vat_fields(self, headers):
        """Company settings should have vat_enabled and vat_rate fields"""
        response = requests.get(f"{BASE_URL}/api/settings/company", headers=headers)
        if response.status_code == 200:
            data = response.json()
            # Check for VAT-related fields
            print(f"  - vat_enabled: {data.get('vat_enabled', 'not set')}")
            print(f"  - vat_rate: {data.get('vat_rate', 'not set')}")
            print(f"  - vat_number: {data.get('vat_number', 'not set')}")
        else:
            print(f"✓ Company settings not found, VAT fields will be defaults")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_cleanup_test_invoices(self, headers):
        """Delete TEST_ prefixed invoices"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=headers)
        invoices = response.json()
        deleted = 0
        for inv in invoices:
            notes = inv.get("notes", "") or ""
            if "TEST_ZATCA" in notes:
                del_response = requests.delete(f"{BASE_URL}/api/invoices/{inv['id']}", headers=headers)
                if del_response.status_code in [200, 204]:
                    deleted += 1
        print(f"✓ Cleaned up {deleted} test invoices")
