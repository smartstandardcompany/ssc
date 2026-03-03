"""
Test suite for P1 features: Barcode generation and updated_at timestamps
Iteration 69 - SSC Track ERP
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBarcodeFeatures:
    """Test barcode generation endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_items_for_barcode(self):
        """Test GET /api/barcode/items returns list of active items"""
        response = requests.get(f"{BASE_URL}/api/barcode/items", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        if len(data) > 0:
            item = data[0]
            assert "id" in item, "Item should have id"
            assert "name" in item, "Item should have name"
            assert "unit_price" in item, "Item should have unit_price"
            print(f"Found {len(data)} items for barcode generation")
    
    def test_barcode_preview_returns_png(self):
        """Test GET /api/barcode/item/{item_id}/preview returns PNG image"""
        # First get an item
        items_response = requests.get(f"{BASE_URL}/api/barcode/items", headers=self.headers)
        items = items_response.json()
        if not items:
            pytest.skip("No items available for barcode testing")
        
        item_id = items[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/barcode/item/{item_id}/preview", 
            headers=self.headers
        )
        assert response.status_code == 200, f"Preview failed: {response.text}"
        assert response.headers.get("content-type") == "image/png", \
            f"Expected image/png, got {response.headers.get('content-type')}"
        assert len(response.content) > 0, "Response should have content"
        print(f"Barcode preview for item {items[0]['name']} returned {len(response.content)} bytes")
    
    def test_barcode_download_returns_png_with_attachment(self):
        """Test GET /api/barcode/item/{item_id} returns PNG with attachment header"""
        items_response = requests.get(f"{BASE_URL}/api/barcode/items", headers=self.headers)
        items = items_response.json()
        if not items:
            pytest.skip("No items available for barcode testing")
        
        item_id = items[0]["id"]
        response = requests.get(
            f"{BASE_URL}/api/barcode/item/{item_id}", 
            headers=self.headers
        )
        assert response.status_code == 200, f"Download failed: {response.text}"
        assert response.headers.get("content-type") == "image/png", \
            f"Expected image/png, got {response.headers.get('content-type')}"
        content_disposition = response.headers.get("content-disposition", "")
        assert "attachment" in content_disposition, "Should have attachment disposition"
        assert ".png" in content_disposition, "Filename should have .png extension"
        print(f"Barcode download has proper attachment header: {content_disposition}")
    
    def test_barcode_preview_not_found(self):
        """Test GET /api/barcode/item/{item_id}/preview returns 404 for non-existent item"""
        response = requests.get(
            f"{BASE_URL}/api/barcode/item/non-existent-id/preview", 
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_batch_barcode_pdf_generation(self):
        """Test POST /api/barcode/batch returns PDF with multiple labels"""
        items_response = requests.get(f"{BASE_URL}/api/barcode/items", headers=self.headers)
        items = items_response.json()
        if len(items) < 2:
            pytest.skip("Need at least 2 items for batch testing")
        
        item_ids = [items[0]["id"], items[1]["id"]]
        response = requests.post(
            f"{BASE_URL}/api/barcode/batch",
            headers=self.headers,
            json={"item_ids": item_ids, "labels_per_item": 1}
        )
        assert response.status_code == 200, f"Batch failed: {response.text}"
        assert response.headers.get("content-type") == "application/pdf", \
            f"Expected application/pdf, got {response.headers.get('content-type')}"
        assert len(response.content) > 0, "PDF should have content"
        print(f"Batch barcode PDF generated with {len(response.content)} bytes")
    
    def test_batch_barcode_empty_items(self):
        """Test POST /api/barcode/batch returns 400 with empty item_ids"""
        response = requests.post(
            f"{BASE_URL}/api/barcode/batch",
            headers=self.headers,
            json={"item_ids": [], "labels_per_item": 1}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_batch_barcode_no_items_found(self):
        """Test POST /api/barcode/batch returns 404 with non-existent item_ids"""
        response = requests.post(
            f"{BASE_URL}/api/barcode/batch",
            headers=self.headers,
            json={"item_ids": ["fake-id-1", "fake-id-2"], "labels_per_item": 1}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestUpdatedAtTimestamps:
    """Test updated_at timestamps on update operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_customer_update_adds_updated_at(self):
        """Test PUT /api/customers/{id} adds updated_at timestamp"""
        # First get a customer
        response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        assert response.status_code == 200
        customers = response.json()
        if not customers:
            pytest.skip("No customers available")
        
        customer = customers[0]
        customer_id = customer["id"]
        original_name = customer.get("name", "Test Customer")
        
        # Update the customer
        update_data = {
            "name": original_name,
            "phone": customer.get("phone", ""),
            "email": customer.get("email"),
            "notes": f"Updated at test {time.time()}"
        }
        update_response = requests.put(
            f"{BASE_URL}/api/customers/{customer_id}",
            headers=self.headers,
            json=update_data
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify updated_at by fetching the customer again
        verify_response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        updated_customer = next((c for c in verify_response.json() if c["id"] == customer_id), None)
        assert updated_customer is not None, "Customer not found after update"
        assert "updated_at" in updated_customer, "updated_at field should be present after update"
        print(f"Customer {customer_id} updated_at: {updated_customer.get('updated_at')}")
    
    def test_supplier_update_adds_updated_at(self):
        """Test PUT /api/suppliers/{id} adds updated_at timestamp"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        assert response.status_code == 200
        suppliers = response.json()
        if not suppliers:
            pytest.skip("No suppliers available")
        
        supplier = suppliers[0]
        supplier_id = supplier["id"]
        
        # Update the supplier
        update_data = {
            "name": supplier.get("name", "Test Supplier"),
            "phone": supplier.get("phone"),
            "email": supplier.get("email"),
            "category": supplier.get("category"),
            "sub_category": supplier.get("sub_category"),
            "credit_limit": supplier.get("credit_limit", 0),
            "branch_id": supplier.get("branch_id")
        }
        update_response = requests.put(
            f"{BASE_URL}/api/suppliers/{supplier_id}",
            headers=self.headers,
            json=update_data
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        # Verify updated_at
        verify_response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        updated_supplier = next((s for s in verify_response.json() if s["id"] == supplier_id), None)
        assert updated_supplier is not None, "Supplier not found after update"
        assert "updated_at" in updated_supplier, "updated_at field should be present after update"
        print(f"Supplier {supplier_id} updated_at: {updated_supplier.get('updated_at')}")
    
    def test_sale_credit_receive_adds_updated_at(self):
        """Test POST /api/sales/{id}/receive-credit adds updated_at timestamp"""
        # Get sales with credit
        response = requests.get(f"{BASE_URL}/api/sales", headers=self.headers)
        assert response.status_code == 200
        sales = response.json()
        
        # Find a sale with remaining credit
        sale_with_credit = None
        for sale in sales:
            remaining = sale.get("credit_amount", 0) - sale.get("credit_received", 0)
            if remaining > 0:
                sale_with_credit = sale
                break
        
        if not sale_with_credit:
            pytest.skip("No sales with remaining credit found")
        
        sale_id = sale_with_credit["id"]
        remaining_credit = sale_with_credit["credit_amount"] - sale_with_credit["credit_received"]
        pay_amount = min(remaining_credit, 10)  # Pay a small amount
        
        # Receive credit payment
        payment_response = requests.post(
            f"{BASE_URL}/api/sales/{sale_id}/receive-credit",
            headers=self.headers,
            json={"amount": pay_amount, "payment_mode": "cash", "discount": 0}
        )
        assert payment_response.status_code == 200, f"Credit receive failed: {payment_response.text}"
        
        # Verify updated_at by fetching the sale
        verify_response = requests.get(f"{BASE_URL}/api/sales", headers=self.headers)
        updated_sale = next((s for s in verify_response.json() if s["id"] == sale_id), None)
        assert updated_sale is not None, "Sale not found after credit receive"
        assert "updated_at" in updated_sale, "updated_at field should be present after credit receive"
        print(f"Sale {sale_id} updated_at after credit receive: {updated_sale.get('updated_at')}")


class TestBarcodeUnauthorized:
    """Test barcode endpoints require authentication"""
    
    def test_barcode_items_requires_auth(self):
        """Test GET /api/barcode/items returns 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/barcode/items")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_barcode_preview_requires_auth(self):
        """Test barcode preview requires authentication"""
        response = requests.get(f"{BASE_URL}/api/barcode/item/test-id/preview")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_batch_barcode_requires_auth(self):
        """Test batch barcode generation requires authentication"""
        response = requests.post(f"{BASE_URL}/api/barcode/batch", json={"item_ids": ["test"]})
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
