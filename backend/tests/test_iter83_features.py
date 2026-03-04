"""
Iteration 83 - Test new features:
1. Online platform sales in dashboard totals
2. PDF exports with branding (logo upload, company info)
3. VirtualizedTable integration into Sales, Stock, Expenses pages
4. Quick Help button on all pages
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Get authentication token for tests"""
    
    @pytest.fixture(scope='class')
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get('access_token')
        assert token, "No access_token in response"
        return token

class TestOnlinePlatformSales(TestAuth):
    """Test that online platform sales are correctly calculated in dashboard stats"""
    
    def test_dashboard_stats_includes_online_sales(self, auth_token):
        """Dashboard stats should return online_sales field with value > 0"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        assert 'online_sales' in data, "online_sales field missing from dashboard stats"
        assert data['online_sales'] > 0, f"online_sales should be > 0, got {data['online_sales']}"
        assert 'total_sales' in data
        assert 'cash_sales' in data
        assert 'bank_sales' in data
        print(f"Dashboard stats - online_sales: {data['online_sales']}, total_sales: {data['total_sales']}")

    def test_online_sale_submission(self, auth_token):
        """Test submitting an online platform sale"""
        # Get a branch ID first
        branches_resp = requests.get(
            f"{BASE_URL}/api/branches",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert branches_resp.status_code == 200
        branches = branches_resp.json()
        assert len(branches) > 0, "No branches found"
        branch_id = branches[0]['id']
        
        # Get a platform
        platforms_resp = requests.get(
            f"{BASE_URL}/api/platforms",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        platform_id = None
        if platforms_resp.status_code == 200 and platforms_resp.json():
            platform_id = platforms_resp.json()[0]['id']
        
        # Submit online sale
        sale_data = {
            "sale_type": "online",
            "branch_id": branch_id,
            "amount": 150.00,
            "discount": 0,
            "payment_mode": "online_platform",
            "payment_details": [{"mode": "online_platform", "amount": 150.00}],
            "date": "2026-01-15T10:00:00Z",
            "notes": "TEST_iter83_online_sale"
        }
        if platform_id:
            sale_data['platform_id'] = platform_id
        
        response = requests.post(
            f"{BASE_URL}/api/sales",
            headers={"Authorization": f"Bearer {auth_token}"},
            json=sale_data
        )
        assert response.status_code in [200, 201], f"Sale creation failed: {response.text}"
        
        sale = response.json()
        assert 'id' in sale
        print(f"Created online sale: {sale.get('id')}")
        
        # Cleanup
        delete_resp = requests.delete(
            f"{BASE_URL}/api/sales/{sale['id']}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Cleanup: Deleted test sale")


class TestBrandingSettings:
    """Test branding settings for PDF exports"""
    
    def test_get_branding(self):
        """GET /api/pdf-exports/branding should return branding config"""
        response = requests.get(f"{BASE_URL}/api/pdf-exports/branding")
        assert response.status_code == 200, f"Get branding failed: {response.text}"
        
        data = response.json()
        assert 'company_name' in data
        assert 'company_address' in data
        assert 'company_phone' in data
        assert 'company_email' in data
        assert 'primary_color' in data
        assert 'footer_text' in data
        assert 'logo_url' in data
        print(f"Branding config: company_name={data['company_name']}, primary_color={data['primary_color']}")
    
    def test_update_branding(self):
        """POST /api/pdf-exports/branding should update branding config"""
        new_config = {
            "company_name": "TEST_SSC Track",
            "company_address": "TEST Address",
            "company_phone": "+966 50 111 2222",
            "company_email": "test@ssc.com",
            "company_vat": "VAT999",
            "primary_color": "#059669",
            "footer_text": "TEST footer"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pdf-exports/branding",
            json=new_config
        )
        assert response.status_code == 200, f"Update branding failed: {response.text}"
        
        data = response.json()
        assert data['company_name'] == "TEST_SSC Track"
        print(f"Updated branding: {data['company_name']}")
        
        # Restore original
        original_config = {
            "company_name": "SSC Track",
            "company_address": "Riyadh, KSA",
            "company_phone": "+966 50 000 0000",
            "company_email": "info@ssc.com",
            "company_vat": "VAT123456",
            "primary_color": "#10B981",
            "footer_text": "Thank you for your business!"
        }
        requests.post(f"{BASE_URL}/api/pdf-exports/branding", json=original_config)
        print("Restored original branding")
    
    def test_upload_logo(self):
        """POST /api/pdf-exports/upload-logo should upload a logo image"""
        # Create a simple PNG image (1x1 pixel)
        import base64
        # Minimal valid PNG (1x1 transparent pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {'file': ('test_logo.png', io.BytesIO(png_data), 'image/png')}
        response = requests.post(
            f"{BASE_URL}/api/pdf-exports/upload-logo",
            files=files
        )
        assert response.status_code == 200, f"Upload logo failed: {response.text}"
        
        data = response.json()
        assert 'logo_url' in data
        assert data['logo_url'].startswith('/uploads/logos/')
        print(f"Uploaded logo: {data['logo_url']}")


class TestPDFGeneration:
    """Test PDF generation with branding"""
    
    def test_generate_sales_pdf(self):
        """POST /api/pdf-exports/generate with report_type=sales"""
        response = requests.post(
            f"{BASE_URL}/api/pdf-exports/generate",
            json={
                "report_type": "sales",
                "title": "Test Sales Report",
                "include_logo": True,
                "include_footer": True
            }
        )
        assert response.status_code == 200, f"Generate sales PDF failed: {response.text}"
        assert response.headers.get('content-type') == 'application/pdf'
        assert len(response.content) > 0
        print(f"Generated sales PDF: {len(response.content)} bytes")
    
    def test_generate_expenses_pdf(self):
        """POST /api/pdf-exports/generate with report_type=expenses"""
        response = requests.post(
            f"{BASE_URL}/api/pdf-exports/generate",
            json={
                "report_type": "expenses",
                "title": "Test Expenses Report"
            }
        )
        assert response.status_code == 200, f"Generate expenses PDF failed: {response.text}"
        assert response.headers.get('content-type') == 'application/pdf'
        print(f"Generated expenses PDF: {len(response.content)} bytes")
    
    def test_generate_pnl_pdf(self):
        """POST /api/pdf-exports/generate with report_type=pnl"""
        response = requests.post(
            f"{BASE_URL}/api/pdf-exports/generate",
            json={
                "report_type": "pnl",
                "title": "Test P&L Report"
            }
        )
        assert response.status_code == 200, f"Generate pnl PDF failed: {response.text}"
        assert response.headers.get('content-type') == 'application/pdf'
        print(f"Generated P&L PDF: {len(response.content)} bytes")
    
    def test_generate_supplier_statement_pdf_requires_supplier(self):
        """POST /api/pdf-exports/generate with report_type=supplier_statement needs supplier_id"""
        response = requests.post(
            f"{BASE_URL}/api/pdf-exports/generate",
            json={
                "report_type": "supplier_statement",
                "title": "Test Supplier Statement"
            }
        )
        # Should fail without supplier_id
        assert response.status_code == 400, f"Expected 400 without supplier_id: {response.text}"
        print("Correctly rejected supplier_statement without supplier_id")


class TestVirtualizedTableEndpoints(TestAuth):
    """Test the endpoints used by VirtualizedTable in Sales, Expenses, Stock pages"""
    
    def test_sales_list_endpoint(self, auth_token):
        """GET /api/sales should return sales data for VirtualizedTable"""
        response = requests.get(
            f"{BASE_URL}/api/sales",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get sales failed: {response.text}"
        
        data = response.json()
        # Can be list or {data: list}
        sales = data.get('data', data) if isinstance(data, dict) else data
        assert isinstance(sales, list), "Sales should return a list"
        print(f"Sales endpoint returns {len(sales)} records")
    
    def test_expenses_list_endpoint(self, auth_token):
        """GET /api/expenses should return expenses data for VirtualizedTable"""
        response = requests.get(
            f"{BASE_URL}/api/expenses",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get expenses failed: {response.text}"
        
        data = response.json()
        expenses = data.get('data', data) if isinstance(data, dict) else data
        assert isinstance(expenses, list), "Expenses should return a list"
        print(f"Expenses endpoint returns {len(expenses)} records")
    
    def test_stock_balance_endpoint(self, auth_token):
        """GET /api/stock/balance should return stock balance for VirtualizedTable"""
        response = requests.get(
            f"{BASE_URL}/api/stock/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get stock balance failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Stock balance should return a list"
        
        if len(data) > 0:
            # Verify expected fields for VirtualizedTable
            first_item = data[0]
            expected_fields = ['item_name', 'unit', 'stock_in', 'stock_used', 'balance', 'avg_cost', 'low_stock']
            for field in expected_fields:
                assert field in first_item, f"Stock balance missing field: {field}"
        
        print(f"Stock balance endpoint returns {len(data)} records")


class TestCleanup(TestAuth):
    """Cleanup test data"""
    
    def test_cleanup_test_sales(self, auth_token):
        """Remove TEST_ prefixed sales"""
        response = requests.get(
            f"{BASE_URL}/api/sales",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            sales = data.get('data', data) if isinstance(data, dict) else data
            for sale in sales:
                notes = sale.get('notes') or ''
                if notes.startswith('TEST_iter83'):
                    requests.delete(
                        f"{BASE_URL}/api/sales/{sale['id']}",
                        headers={"Authorization": f"Bearer {auth_token}"}
                    )
                    print(f"Deleted test sale: {sale['id']}")
        print("Cleanup completed")
