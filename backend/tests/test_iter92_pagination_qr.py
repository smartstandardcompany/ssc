"""
Iteration 92 - Tests for pagination features on stock/entries, stock/usage, supplier-payments endpoints
Also tests public order tracking with URL params for QR code support
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPaginationEndpoints:
    """Test pagination on stock entries, stock usage, and supplier payments endpoints"""
    
    @pytest.fixture(scope='class')
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope='class')
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

    def test_stock_entries_pagination_returns_correct_structure(self, auth_headers):
        """GET /api/stock/entries?page=1&limit=5 returns paginated response with {data, total, page, limit, pages}"""
        response = requests.get(f"{BASE_URL}/api/stock/entries?page=1&limit=5", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify pagination structure
        assert "data" in data, "Response should have 'data' field"
        assert "total" in data, "Response should have 'total' field"
        assert "page" in data, "Response should have 'page' field"
        assert "limit" in data, "Response should have 'limit' field"
        assert "pages" in data, "Response should have 'pages' field"
        
        # Verify values
        assert data["page"] == 1
        assert data["limit"] == 5
        assert isinstance(data["data"], list)
        assert len(data["data"]) <= 5  # Should not exceed limit
        assert data["total"] >= 0
        assert data["pages"] >= 1 if data["total"] > 0 else data["pages"] == 1
        
    def test_stock_entries_pagination_page_2(self, auth_headers):
        """GET /api/stock/entries?page=2&limit=5 returns second page"""
        response = requests.get(f"{BASE_URL}/api/stock/entries?page=2&limit=5", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 2
        assert data["limit"] == 5
        # Page 2 should have less or equal items than page 1 (if there are enough records)
        
    def test_stock_usage_pagination_returns_correct_structure(self, auth_headers):
        """GET /api/stock/usage?page=1&limit=5 returns paginated response"""
        response = requests.get(f"{BASE_URL}/api/stock/usage?page=1&limit=5", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify pagination structure
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "pages" in data
        
        # Verify values
        assert data["page"] == 1
        assert data["limit"] == 5
        assert isinstance(data["data"], list)
        assert len(data["data"]) <= 5

    def test_stock_usage_pagination_page_2(self, auth_headers):
        """GET /api/stock/usage?page=2&limit=5 returns second page"""
        response = requests.get(f"{BASE_URL}/api/stock/usage?page=2&limit=5", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 2
        assert data["limit"] == 5
        
    def test_supplier_payments_pagination_returns_correct_structure(self, auth_headers):
        """GET /api/supplier-payments?page=1&limit=5 returns paginated response"""
        response = requests.get(f"{BASE_URL}/api/supplier-payments?page=1&limit=5", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify pagination structure
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "pages" in data
        
        # Verify values
        assert data["page"] == 1
        assert data["limit"] == 5
        assert isinstance(data["data"], list)
        
    def test_supplier_payments_supplier_filter(self, auth_headers):
        """GET /api/supplier-payments supports supplier_id filter"""
        # First get a supplier ID from suppliers list
        suppliers_res = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        if suppliers_res.status_code == 200 and suppliers_res.json():
            supplier_id = suppliers_res.json()[0]["id"]
            
            response = requests.get(f"{BASE_URL}/api/supplier-payments?supplier_id={supplier_id}", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            # If there are results, they should all be for this supplier
            for payment in data["data"]:
                assert payment.get("supplier_id") == supplier_id or payment.get("supplier_id") is None
        else:
            pytest.skip("No suppliers found to test filter")


class TestPublicOrderTracking:
    """Test public order tracking endpoint (no auth required)"""
    
    def test_public_order_tracking_endpoint_exists(self):
        """GET /api/order-tracking/order/{id} endpoint exists and accessible without auth"""
        # Try with a non-existent order to verify endpoint exists
        response = requests.get(f"{BASE_URL}/api/order-tracking/order/test-123")
        # Should return 404 (not 401/403) meaning endpoint exists but order not found
        assert response.status_code == 404, f"Expected 404 for non-existent order, got {response.status_code}"
        data = response.json()
        assert "detail" in data or "message" in data
        
    def test_order_tracking_returns_404_for_invalid_order(self):
        """Order tracking returns 404 with helpful message for invalid orders"""
        response = requests.get(f"{BASE_URL}/api/order-tracking/order/invalid-order-id")
        assert response.status_code == 404
        data = response.json()
        # Should have a user-friendly message
        assert "detail" in data


class TestStockPageDataFormat:
    """Test that stock page data is returned in expected format"""
    
    @pytest.fixture(scope='class')
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope='class')
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_stock_entries_data_has_required_fields(self, auth_headers):
        """Stock entries data should have required fields"""
        response = requests.get(f"{BASE_URL}/api/stock/entries?page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if data["data"]:
            entry = data["data"][0]
            # Verify entry has expected fields
            assert "id" in entry
            assert "item_id" in entry
            assert "item_name" in entry
            assert "quantity" in entry
            assert "date" in entry
            
    def test_stock_usage_data_has_required_fields(self, auth_headers):
        """Stock usage data should have required fields"""
        response = requests.get(f"{BASE_URL}/api/stock/usage?page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        if data["data"]:
            usage = data["data"][0]
            # Verify usage has expected fields
            assert "id" in usage
            assert "item_id" in usage
            assert "item_name" in usage
            assert "quantity" in usage
            assert "date" in usage
            
    def test_stock_balance_returns_array(self, auth_headers):
        """Stock balance endpoint should still return array (not paginated)"""
        response = requests.get(f"{BASE_URL}/api/stock/balance", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Balance endpoint should return array directly
        assert isinstance(data, list)


class TestRegressionEndpoints:
    """Regression tests to ensure existing endpoints still work"""
    
    @pytest.fixture(scope='class')
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope='class')
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_items_endpoint_works(self, auth_headers):
        """GET /api/items should work"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_suppliers_endpoint_works(self, auth_headers):
        """GET /api/suppliers should work"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        
    def test_branches_endpoint_works(self, auth_headers):
        """GET /api/branches should work"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
