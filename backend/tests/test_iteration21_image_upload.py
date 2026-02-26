"""
Iteration 21: Invoice Image Upload Feature Tests
Tests:
- POST /api/invoices/{id}/upload-image - upload an image to invoice
- GET /api/invoices/images/{filename} - serve uploaded image
- DELETE /api/invoices/{id}/image - remove image from invoice
- GET /api/invoices - returns image_url field for invoices with images
"""
import pytest
import requests
import os
from io import BytesIO
from PIL import Image

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"

# Test invoice with existing image (INV-00009)
TEST_INVOICE_ID = "1921e44c-7ed3-4565-bfd6-68b2a6942dd5"
TEST_IMAGE_FILENAME = "1921e44c-7ed3-4565-bfd6-68b2a6942dd5_de1a25c7.png"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


def generate_test_image():
    """Generate a simple test PNG image using Pillow"""
    img = Image.new('RGB', (100, 100), color='red')
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer


class TestImageUploadBackend:
    """Tests for Invoice Image Upload Backend APIs"""

    def test_01_admin_login(self):
        """Verify admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Admin login successful: {data['user']['email']}")

    def test_02_get_invoices_returns_image_url(self, auth_headers):
        """GET /api/invoices - verify image_url field is returned for invoices with images"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        invoices = response.json()
        assert isinstance(invoices, list)
        
        # Find the test invoice with existing image
        test_invoice = next((inv for inv in invoices if inv.get('id') == TEST_INVOICE_ID), None)
        
        if test_invoice:
            assert 'image_url' in test_invoice, "image_url field missing from invoice response"
            if test_invoice.get('image_url'):
                assert '/api/invoices/images/' in test_invoice['image_url'], "Invalid image_url format"
                print(f"Found test invoice {test_invoice['invoice_number']} with image_url: {test_invoice['image_url']}")
            else:
                print(f"Test invoice found but no image attached: {test_invoice['invoice_number']}")
        else:
            print(f"Test invoice {TEST_INVOICE_ID} not found, checking other invoices")
            # Check if any invoice has image_url field
            has_image_url_field = any('image_url' in inv for inv in invoices)
            assert has_image_url_field, "No invoice has image_url field"
        
        print(f"GET /api/invoices returned {len(invoices)} invoices")

    def test_03_get_existing_image(self):
        """GET /api/invoices/images/{filename} - verify existing image can be served"""
        # This test checks if the pre-uploaded test image can be retrieved
        response = requests.get(f"{BASE_URL}/api/invoices/images/{TEST_IMAGE_FILENAME}")
        
        if response.status_code == 200:
            assert response.headers.get('content-type', '').startswith('image/'), "Response is not an image"
            print(f"Existing image retrieved successfully: {TEST_IMAGE_FILENAME}")
        elif response.status_code == 404:
            print(f"Test image not found (may have been deleted): {TEST_IMAGE_FILENAME}")
            pytest.skip("Pre-uploaded test image not found")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")

    def test_04_get_nonexistent_image_returns_404(self):
        """GET /api/invoices/images/{filename} - verify 404 for non-existent image"""
        response = requests.get(f"{BASE_URL}/api/invoices/images/nonexistent_image_xyz123.png")
        assert response.status_code == 404, f"Expected 404 for non-existent image, got {response.status_code}"
        print("Non-existent image correctly returns 404")

    def test_05_upload_image_to_invoice(self, auth_headers):
        """POST /api/invoices/{id}/upload-image - upload new image to an invoice"""
        # First, get a list of invoices to find one without an image
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        invoices = response.json()
        
        # Find an invoice without an image, or use test invoice
        target_invoice = next((inv for inv in invoices if not inv.get('image_url')), None)
        if not target_invoice and invoices:
            target_invoice = invoices[0]  # Use first invoice if all have images
        
        if not target_invoice:
            pytest.skip("No invoices available for upload test")
        
        invoice_id = target_invoice['id']
        print(f"Testing image upload to invoice: {target_invoice.get('invoice_number')}")
        
        # Generate test image
        test_image = generate_test_image()
        files = {'file': ('test_upload.png', test_image, 'image/png')}
        
        # Upload image (don't include Content-Type header when using files)
        upload_response = requests.post(
            f"{BASE_URL}/api/invoices/{invoice_id}/upload-image",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        data = upload_response.json()
        assert 'image_url' in data, "Response missing image_url"
        assert 'message' in data, "Response missing message"
        assert '/api/invoices/images/' in data['image_url'], "Invalid image_url format"
        
        print(f"Image uploaded successfully: {data['image_url']}")
        
        # Store for later tests
        pytest.uploaded_invoice_id = invoice_id
        pytest.uploaded_image_url = data['image_url']

    def test_06_verify_uploaded_image_accessible(self, auth_headers):
        """Verify the uploaded image can be retrieved"""
        if not hasattr(pytest, 'uploaded_image_url'):
            pytest.skip("No image was uploaded in previous test")
        
        # Extract filename from URL
        filename = pytest.uploaded_image_url.split('/')[-1]
        
        response = requests.get(f"{BASE_URL}/api/invoices/images/{filename}")
        assert response.status_code == 200, f"Could not retrieve uploaded image: {response.status_code}"
        assert response.headers.get('content-type', '').startswith('image/'), "Response is not an image"
        print(f"Uploaded image is accessible at: {pytest.uploaded_image_url}")

    def test_07_verify_invoice_has_image_url(self, auth_headers):
        """GET /api/invoices - verify invoice now has image_url after upload"""
        if not hasattr(pytest, 'uploaded_invoice_id'):
            pytest.skip("No invoice was updated in previous test")
        
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        invoices = response.json()
        
        invoice = next((inv for inv in invoices if inv['id'] == pytest.uploaded_invoice_id), None)
        assert invoice is not None, "Could not find uploaded invoice"
        assert invoice.get('image_url') == pytest.uploaded_image_url, "Invoice image_url doesn't match uploaded URL"
        print(f"Invoice {invoice['invoice_number']} has correct image_url: {invoice['image_url']}")

    def test_08_upload_invalid_file_type(self, auth_headers):
        """POST /api/invoices/{id}/upload-image - verify rejection of non-image files"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        invoices = response.json()
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice_id = invoices[0]['id']
        
        # Try to upload a text file
        files = {'file': ('test.txt', BytesIO(b'This is not an image'), 'text/plain')}
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/{invoice_id}/upload-image",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid file type, got {response.status_code}"
        print("Invalid file type correctly rejected with 400")

    def test_09_delete_invoice_image(self, auth_headers):
        """DELETE /api/invoices/{id}/image - remove image from invoice"""
        if not hasattr(pytest, 'uploaded_invoice_id'):
            pytest.skip("No invoice was updated in previous test")
        
        invoice_id = pytest.uploaded_invoice_id
        
        response = requests.delete(
            f"{BASE_URL}/api/invoices/{invoice_id}/image",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert 'message' in data, "Response missing message"
        print(f"Image deleted from invoice: {invoice_id}")

    def test_10_verify_image_removed_from_invoice(self, auth_headers):
        """Verify invoice no longer has image_url after deletion"""
        if not hasattr(pytest, 'uploaded_invoice_id'):
            pytest.skip("No invoice was updated in previous test")
        
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        invoices = response.json()
        
        invoice = next((inv for inv in invoices if inv['id'] == pytest.uploaded_invoice_id), None)
        assert invoice is not None, "Could not find invoice"
        assert invoice.get('image_url') is None, f"Invoice should have no image_url after deletion, got: {invoice.get('image_url')}"
        print(f"Invoice {invoice['invoice_number']} correctly has no image_url after deletion")

    def test_11_upload_image_to_nonexistent_invoice(self, auth_headers):
        """POST /api/invoices/{id}/upload-image - verify 404 for non-existent invoice"""
        fake_invoice_id = "00000000-0000-0000-0000-000000000000"
        test_image = generate_test_image()
        files = {'file': ('test.png', test_image, 'image/png')}
        
        response = requests.post(
            f"{BASE_URL}/api/invoices/{fake_invoice_id}/upload-image",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent invoice, got {response.status_code}"
        print("Upload to non-existent invoice correctly returns 404")

    def test_12_delete_image_from_nonexistent_invoice(self, auth_headers):
        """DELETE /api/invoices/{id}/image - verify 404 for non-existent invoice"""
        fake_invoice_id = "00000000-0000-0000-0000-000000000000"
        
        response = requests.delete(
            f"{BASE_URL}/api/invoices/{fake_invoice_id}/image",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent invoice, got {response.status_code}"
        print("Delete from non-existent invoice correctly returns 404")

    def test_13_replace_existing_image(self, auth_headers):
        """Upload a new image to replace an existing one"""
        # First upload an image
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        invoices = response.json()
        
        if not invoices:
            pytest.skip("No invoices available")
        
        invoice_id = invoices[0]['id']
        
        # First upload
        test_image1 = generate_test_image()
        files1 = {'file': ('first.png', test_image1, 'image/png')}
        
        response1 = requests.post(
            f"{BASE_URL}/api/invoices/{invoice_id}/upload-image",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files1
        )
        assert response1.status_code == 200
        first_url = response1.json()['image_url']
        print(f"First image uploaded: {first_url}")
        
        # Second upload (replace)
        test_image2 = Image.new('RGB', (100, 100), color='blue')  # Different color
        buffer2 = BytesIO()
        test_image2.save(buffer2, format='PNG')
        buffer2.seek(0)
        files2 = {'file': ('second.png', buffer2, 'image/png')}
        
        response2 = requests.post(
            f"{BASE_URL}/api/invoices/{invoice_id}/upload-image",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files2
        )
        assert response2.status_code == 200
        second_url = response2.json()['image_url']
        print(f"Second image uploaded (replaced): {second_url}")
        
        # Verify the URL changed
        assert second_url != first_url, "Image URL should change after replacement"
        
        # Verify new image is accessible
        filename = second_url.split('/')[-1]
        get_response = requests.get(f"{BASE_URL}/api/invoices/images/{filename}")
        assert get_response.status_code == 200
        print("Image replacement successful - new image is accessible")
        
        # Clean up - delete the image
        requests.delete(f"{BASE_URL}/api/invoices/{invoice_id}/image", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
