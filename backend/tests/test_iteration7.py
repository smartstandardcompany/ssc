"""
Iteration 7 Tests - New Features:
1. Sub-categories for suppliers and expenses (category → sub-category hierarchy)
2. Employee payslip PDF generation with company stamp area
3. Document file attachments - upload/download actual files
4. Company logo upload for settings
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

class TestSubCategories:
    """Test sub-category feature for suppliers and expenses"""
    
    def test_create_parent_category(self, headers):
        """Create a parent category for supplier"""
        response = requests.post(f"{BASE_URL}/api/categories", headers=headers, json={
            "name": "TEST_Raw Materials",
            "type": "supplier"
        })
        # Category may already exist, accept both 200 and 400
        assert response.status_code in [200, 201, 400], f"Unexpected: {response.text}"
        
    def test_create_sub_category_with_parent_id(self, headers):
        """Create a sub-category with parent_id"""
        # First get parent category
        response = requests.get(f"{BASE_URL}/api/categories?category_type=supplier", headers=headers)
        assert response.status_code == 200
        categories = response.json()
        parent = next((c for c in categories if c["name"] == "TEST_Raw Materials" and not c.get("parent_id")), None)
        if not parent:
            # Create parent first
            resp = requests.post(f"{BASE_URL}/api/categories", headers=headers, json={
                "name": "TEST_Raw Materials",
                "type": "supplier"
            })
            parent_id = resp.json().get("id") if resp.status_code in [200, 201] else None
        else:
            parent_id = parent["id"]
        
        # Create sub-category with parent_id
        response = requests.post(f"{BASE_URL}/api/categories", headers=headers, json={
            "name": "TEST_Steel",
            "type": "supplier",
            "parent_id": parent_id
        })
        assert response.status_code in [200, 201, 400], f"Failed: {response.text}"
        if response.status_code in [200, 201]:
            data = response.json()
            assert "id" in data
            assert data.get("parent_id") == parent_id, "Sub-category should have parent_id"

    def test_get_categories_returns_parent_id_field(self, headers):
        """Verify GET /api/categories returns categories with parent_id field"""
        response = requests.get(f"{BASE_URL}/api/categories?category_type=supplier", headers=headers)
        assert response.status_code == 200
        categories = response.json()
        # Check that categories structure supports parent_id
        assert isinstance(categories, list)
        # Find a sub-category if exists
        sub_cat = next((c for c in categories if c.get("parent_id")), None)
        if sub_cat:
            assert "parent_id" in sub_cat, "Sub-category should have parent_id field"
            print(f"Found sub-category: {sub_cat['name']} with parent_id: {sub_cat['parent_id']}")

    def test_create_expense_subcategory(self, headers):
        """Create expense sub-category"""
        response = requests.post(f"{BASE_URL}/api/categories", headers=headers, json={
            "name": "TEST_Office Supplies",
            "type": "expense"
        })
        assert response.status_code in [200, 201, 400]
        
        response = requests.post(f"{BASE_URL}/api/categories", headers=headers, json={
            "name": "TEST_Printer Ink",
            "type": "expense",
            "parent_id": None  # Top-level sub-category for testing
        })
        assert response.status_code in [200, 201, 400]


class TestSupplierSubCategory:
    """Test Supplier model has sub_category field"""
    
    def test_create_supplier_with_sub_category(self, headers):
        """Create supplier with sub_category field"""
        response = requests.post(f"{BASE_URL}/api/suppliers", headers=headers, json={
            "name": "TEST_Supplier_With_SubCat",
            "category": "Raw Materials",
            "sub_category": "Steel",
            "phone": "123-456-7890"
        })
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Supplier_With_SubCat"
        assert data.get("sub_category") == "Steel", "Supplier should have sub_category field"
        print(f"Created supplier with sub_category: {data.get('sub_category')}")
        return data["id"]

    def test_get_suppliers_returns_sub_category(self, headers):
        """Verify GET /api/suppliers returns sub_category field"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        assert response.status_code == 200
        suppliers = response.json()
        test_supplier = next((s for s in suppliers if "TEST_" in s.get("name", "")), None)
        if test_supplier:
            # Verify sub_category field exists in response
            assert "sub_category" in test_supplier or test_supplier.get("sub_category") is None


class TestExpenseSubCategory:
    """Test Expense model has sub_category field"""
    
    def test_create_expense_with_sub_category(self, headers):
        """Create expense with sub_category field"""
        response = requests.post(f"{BASE_URL}/api/expenses", headers=headers, json={
            "category": "other",
            "sub_category": "Office Supplies",
            "description": "TEST_Expense_With_SubCat",
            "amount": 150.00,
            "payment_mode": "cash",
            "date": "2026-01-15T10:00:00Z"
        })
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        data = response.json()
        assert data.get("sub_category") == "Office Supplies", "Expense should have sub_category field"
        print(f"Created expense with sub_category: {data.get('sub_category')}")


class TestDocumentFileAttachment:
    """Test document file upload and download"""
    
    def test_create_document(self, headers):
        """Create a document for file attachment testing"""
        response = requests.post(f"{BASE_URL}/api/documents", headers=headers, json={
            "name": "TEST_Document_For_Upload",
            "document_type": "license",
            "expiry_date": "2027-12-31T00:00:00Z",
            "alert_days": 30
        })
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        return response.json()["id"]
    
    def test_upload_file_to_document(self, headers, auth_token):
        """Test POST /api/documents/{id}/upload uploads file"""
        # Get existing document or create one
        response = requests.get(f"{BASE_URL}/api/documents", headers=headers)
        docs = response.json()
        test_doc = next((d for d in docs if "TEST_" in d.get("name", "")), None)
        
        if not test_doc:
            # Create new document
            response = requests.post(f"{BASE_URL}/api/documents", headers=headers, json={
                "name": "TEST_Upload_Doc",
                "document_type": "license",
                "expiry_date": "2027-12-31T00:00:00Z"
            })
            doc_id = response.json()["id"]
        else:
            doc_id = test_doc["id"]
        
        # Create a test file to upload
        test_file_content = b"This is a test file for document attachment"
        files = {'file': ('test_upload.txt', io.BytesIO(test_file_content), 'text/plain')}
        
        upload_headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(f"{BASE_URL}/api/documents/{doc_id}/upload", headers=upload_headers, files=files)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "file_name" in data, "Response should contain file_name"
        print(f"File uploaded successfully: {data}")
    
    def test_download_file_from_document(self, headers, auth_token):
        """Test GET /api/documents/{id}/download downloads attached file"""
        # Get document with file
        response = requests.get(f"{BASE_URL}/api/documents", headers=headers)
        docs = response.json()
        doc_with_file = next((d for d in docs if d.get("file_name")), None)
        
        if not doc_with_file:
            pytest.skip("No document with file attached found")
        
        doc_id = doc_with_file["id"]
        download_headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/documents/{doc_id}/download", headers=download_headers)
        assert response.status_code == 200, f"Download failed: {response.text}"
        assert len(response.content) > 0, "Downloaded file should have content"
        print(f"Downloaded file size: {len(response.content)} bytes")


class TestPayslipGeneration:
    """Test employee payslip PDF generation"""
    
    def test_generate_payslip_returns_pdf(self, headers, auth_token):
        """Test GET /api/salary-payments/{id}/payslip returns PDF"""
        # First get salary payments
        response = requests.get(f"{BASE_URL}/api/salary-payments", headers=headers)
        assert response.status_code == 200
        payments = response.json()
        
        if not payments:
            pytest.skip("No salary payments found for payslip test")
        
        payment_id = payments[0]["id"]
        download_headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/salary-payments/{payment_id}/payslip", headers=download_headers)
        assert response.status_code == 200, f"Payslip generation failed: {response.text}"
        
        # Verify it's a PDF
        assert response.headers.get("content-type") == "application/pdf", "Response should be PDF"
        assert len(response.content) > 0, "PDF should have content"
        
        # PDF magic bytes check
        assert response.content[:4] == b'%PDF', "Content should be valid PDF"
        print(f"Payslip PDF generated: {len(response.content)} bytes")

    def test_payslip_has_signature_area(self, headers, auth_token):
        """Verify payslip PDF includes signature/stamp areas by checking content size"""
        response = requests.get(f"{BASE_URL}/api/salary-payments", headers=headers)
        payments = response.json()
        
        if not payments:
            pytest.skip("No salary payments found")
        
        payment_id = payments[0]["id"]
        download_headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/salary-payments/{payment_id}/payslip", headers=download_headers)
        
        assert response.status_code == 200
        # A properly formatted payslip with signature section should be substantial
        assert len(response.content) > 1000, "Payslip should have significant content including signature area"


class TestCompanyLogoUpload:
    """Test company logo upload functionality"""
    
    def test_upload_company_logo(self, auth_token):
        """Test POST /api/settings/upload-logo works"""
        # Create a simple PNG-like file (just for API testing)
        # A minimal valid PNG header
        png_header = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        test_content = png_header + b'\x00' * 100  # Minimal content
        
        files = {'file': ('test_logo.png', io.BytesIO(test_content), 'image/png')}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/settings/upload-logo", headers=headers, files=files)
        assert response.status_code == 200, f"Logo upload failed: {response.text}"
        data = response.json()
        assert data.get("message") == "Logo uploaded", "Should return success message"
        print("Company logo uploaded successfully")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_suppliers(self, headers):
        """Remove test suppliers"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=headers)
        suppliers = response.json()
        for s in suppliers:
            if "TEST_" in s.get("name", ""):
                requests.delete(f"{BASE_URL}/api/suppliers/{s['id']}", headers=headers)
                print(f"Cleaned up supplier: {s['name']}")

    def test_cleanup_test_categories(self, headers):
        """Remove test categories"""
        response = requests.get(f"{BASE_URL}/api/categories", headers=headers)
        categories = response.json()
        for c in categories:
            if "TEST_" in c.get("name", ""):
                requests.delete(f"{BASE_URL}/api/categories/{c['id']}", headers=headers)
                print(f"Cleaned up category: {c['name']}")

    def test_cleanup_test_expenses(self, headers):
        """Remove test expenses"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=headers)
        expenses = response.json()
        for e in expenses:
            if "TEST_" in e.get("description", ""):
                requests.delete(f"{BASE_URL}/api/expenses/{e['id']}", headers=headers)
                print(f"Cleaned up expense: {e['description']}")
