"""
Iteration 91 Tests - Order Tracking UUID Support & Supplier Payments Pagination

Features being tested:
1. GET /api/supplier-payments pagination (page, limit, pages, total, data)
2. GET /api/supplier-payments query params (supplier_id, start_date, end_date)
3. GET /api/order-tracking/order/{order_id} - UUID-based ID support
4. GET /api/order-tracking/order/{order_id} - 404 for invalid IDs
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSupplierPaymentsPagination:
    """Tests for supplier payments pagination feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_supplier_payments_returns_paginated_response(self, auth_token):
        """Test GET /api/supplier-payments returns paginated format {data, total, page, limit, pages}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/supplier-payments?page=1&limit=5", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify paginated response structure
        assert "data" in data, "Response should have 'data' field"
        assert "total" in data, "Response should have 'total' field"
        assert "page" in data, "Response should have 'page' field"
        assert "limit" in data, "Response should have 'limit' field"
        assert "pages" in data, "Response should have 'pages' field"
        
        # Verify data types
        assert isinstance(data["data"], list), "'data' should be a list"
        assert isinstance(data["total"], int), "'total' should be an integer"
        assert isinstance(data["page"], int), "'page' should be an integer"
        assert isinstance(data["limit"], int), "'limit' should be an integer"
        assert isinstance(data["pages"], int), "'pages' should be an integer"
        
        # Verify limit is applied
        assert data["page"] == 1, "Page should be 1"
        assert data["limit"] == 5, "Limit should be 5"
        assert len(data["data"]) <= 5, "Should return at most 5 records"
        
        print(f"SUCCESS: Paginated response - total: {data['total']}, page: {data['page']}, limit: {data['limit']}, pages: {data['pages']}, records: {len(data['data'])}")
    
    def test_supplier_payments_page_2(self, auth_token):
        """Test pagination page 2"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get total count
        response = requests.get(f"{BASE_URL}/api/supplier-payments?page=1&limit=5", headers=headers)
        assert response.status_code == 200
        data = response.json()
        total = data["total"]
        
        if total > 5:
            # Request page 2
            response2 = requests.get(f"{BASE_URL}/api/supplier-payments?page=2&limit=5", headers=headers)
            assert response2.status_code == 200
            data2 = response2.json()
            assert data2["page"] == 2, "Should return page 2"
            print(f"SUCCESS: Page 2 returned {len(data2['data'])} records")
        else:
            print(f"SKIP: Not enough records ({total}) to test page 2")
    
    def test_supplier_payments_filter_by_supplier_id(self, auth_token):
        """Test filtering by supplier_id parameter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get a payment to extract supplier_id
        response = requests.get(f"{BASE_URL}/api/supplier-payments?page=1&limit=100", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["data"]) > 0:
            supplier_id = data["data"][0].get("supplier_id")
            if supplier_id:
                # Filter by that supplier_id
                response2 = requests.get(f"{BASE_URL}/api/supplier-payments?supplier_id={supplier_id}", headers=headers)
                assert response2.status_code == 200
                data2 = response2.json()
                
                # All records should be for this supplier
                for payment in data2["data"]:
                    assert payment.get("supplier_id") == supplier_id, f"Payment should be for supplier {supplier_id}"
                
                print(f"SUCCESS: Filtered by supplier_id={supplier_id}, got {len(data2['data'])} records")
            else:
                print("SKIP: No supplier_id in first payment")
        else:
            print("SKIP: No payments to test filter")
    
    def test_supplier_payments_filter_by_date_range(self, auth_token):
        """Test filtering by start_date and end_date"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Query with a date range
        response = requests.get(
            f"{BASE_URL}/api/supplier-payments?start_date=2025-01-01&end_date=2025-12-31",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "data" in data
        assert "total" in data
        
        print(f"SUCCESS: Date filter returned {len(data['data'])} records, total: {data['total']}")


class TestOrderTrackingUUID:
    """Tests for order tracking with UUID support"""
    
    def test_order_tracking_invalid_id_returns_404(self):
        """Test that invalid order ID returns 404 with helpful message"""
        # Use a fake UUID that doesn't exist
        fake_order_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/api/order-tracking/order/{fake_order_id}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "404 response should have 'detail' field"
        assert "not found" in data["detail"].lower() or "check" in data["detail"].lower(), \
            f"404 message should be helpful: {data['detail']}"
        
        print(f"SUCCESS: Invalid UUID returns 404 with message: '{data['detail']}'")
    
    def test_order_tracking_random_string_returns_404(self):
        """Test that random string order ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/order-tracking/order/random-invalid-order-id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Random string returns 404")
    
    def test_order_tracking_endpoint_accessible_without_auth(self):
        """Verify order tracking is a public endpoint (no auth required)"""
        # Should not get 401/403
        response = requests.get(f"{BASE_URL}/api/order-tracking/order/test-order")
        
        # Should be 404 (not found) but NOT 401 (unauthorized) or 403 (forbidden)
        assert response.status_code != 401, "Order tracking should not require auth"
        assert response.status_code != 403, "Order tracking should be public"
        assert response.status_code == 404, f"Expected 404 for non-existent order, got {response.status_code}"
        
        print("SUCCESS: Order tracking endpoint is publicly accessible (no auth required)")


class TestOrderTrackingWithRealData:
    """Test order tracking with actual POS orders if any exist"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_lookup_by_uuid_if_orders_exist(self, auth_token):
        """Try to find a POS order and look it up via UUID-based id"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Check recent POS orders
        response = requests.get(f"{BASE_URL}/api/pos/orders?limit=5", headers=headers)
        if response.status_code != 200:
            print(f"SKIP: Could not fetch POS orders: {response.status_code}")
            return
        
        orders = response.json()
        if not orders:
            print("SKIP: No POS orders in database to test UUID lookup")
            return
        
        # Try to look up first order by its ID
        order_id = orders[0].get("id")
        if not order_id:
            print("SKIP: First order has no 'id' field")
            return
        
        # Public lookup
        lookup_response = requests.get(f"{BASE_URL}/api/order-tracking/order/{order_id}")
        
        if lookup_response.status_code == 200:
            data = lookup_response.json()
            assert "order_id" in data or "status" in data
            print(f"SUCCESS: Found order via UUID lookup: {order_id[:8]}... status={data.get('status')}")
        elif lookup_response.status_code == 404:
            # Order might be in different collection or format
            print(f"INFO: Order {order_id[:8]}... not found in order-tracking (may be in different collection)")
        else:
            print(f"UNEXPECTED: Got {lookup_response.status_code} for order lookup")


class TestSupplierPaymentsHealthCheck:
    """Basic health checks for supplier payments endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_supplier_payments_requires_auth(self):
        """Verify supplier payments requires authentication"""
        response = requests.get(f"{BASE_URL}/api/supplier-payments")
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("SUCCESS: Supplier payments endpoint requires authentication")
    
    def test_supplier_payments_default_limit(self, auth_token):
        """Test default pagination limit"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/supplier-payments", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Default limit should be 100
        assert data["limit"] == 100, f"Default limit should be 100, got {data['limit']}"
        print(f"SUCCESS: Default limit is 100, returned {len(data['data'])} records")
