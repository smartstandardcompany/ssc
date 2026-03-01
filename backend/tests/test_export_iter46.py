"""
Iteration 46: Export Endpoints Tests
Testing POST /api/export/data with type=loans, attendance, leaves
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture
def authenticated_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestExportLoans:
    """Export loans endpoint tests"""
    
    def test_export_loans_excel(self, authenticated_client):
        """Test exporting loans as Excel"""
        response = authenticated_client.post(f"{BASE_URL}/api/export/data", json={
            "type": "loans",
            "format": "excel"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        # Check content type is Excel
        content_type = response.headers.get("content-type", "")
        assert "spreadsheetml" in content_type or "octet-stream" in content_type, f"Expected Excel content type, got {content_type}"
        # Check content disposition suggests xlsx file
        content_disp = response.headers.get("content-disposition", "")
        assert "loans" in content_disp.lower() or "xlsx" in content_disp.lower(), f"Expected loans report filename, got {content_disp}"
        print(f"✓ Loans Excel export returned 200 with proper headers")
    
    def test_export_loans_pdf(self, authenticated_client):
        """Test exporting loans as PDF"""
        response = authenticated_client.post(f"{BASE_URL}/api/export/data", json={
            "type": "loans",
            "format": "pdf"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        content_type = response.headers.get("content-type", "")
        assert "pdf" in content_type.lower() or "octet-stream" in content_type.lower(), f"Expected PDF content type, got {content_type}"
        print(f"✓ Loans PDF export returned 200 with proper headers")


class TestExportAttendance:
    """Export attendance endpoint tests"""
    
    def test_export_attendance_excel(self, authenticated_client):
        """Test exporting attendance as Excel"""
        response = authenticated_client.post(f"{BASE_URL}/api/export/data", json={
            "type": "attendance",
            "format": "excel"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        content_type = response.headers.get("content-type", "")
        assert "spreadsheetml" in content_type or "octet-stream" in content_type, f"Expected Excel content type, got {content_type}"
        print(f"✓ Attendance Excel export returned 200 with proper headers")
    
    def test_export_attendance_pdf(self, authenticated_client):
        """Test exporting attendance as PDF"""
        response = authenticated_client.post(f"{BASE_URL}/api/export/data", json={
            "type": "attendance",
            "format": "pdf"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        content_type = response.headers.get("content-type", "")
        assert "pdf" in content_type.lower() or "octet-stream" in content_type.lower(), f"Expected PDF content type, got {content_type}"
        print(f"✓ Attendance PDF export returned 200 with proper headers")


class TestExportLeaves:
    """Export leaves endpoint tests"""
    
    def test_export_leaves_excel(self, authenticated_client):
        """Test exporting leaves as Excel"""
        response = authenticated_client.post(f"{BASE_URL}/api/export/data", json={
            "type": "leaves",
            "format": "excel"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        content_type = response.headers.get("content-type", "")
        assert "spreadsheetml" in content_type or "octet-stream" in content_type, f"Expected Excel content type, got {content_type}"
        print(f"✓ Leaves Excel export returned 200 with proper headers")
    
    def test_export_leaves_pdf(self, authenticated_client):
        """Test exporting leaves as PDF"""
        response = authenticated_client.post(f"{BASE_URL}/api/export/data", json={
            "type": "leaves",
            "format": "pdf"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        content_type = response.headers.get("content-type", "")
        assert "pdf" in content_type.lower() or "octet-stream" in content_type.lower(), f"Expected PDF content type, got {content_type}"
        print(f"✓ Leaves PDF export returned 200 with proper headers")


class TestExportInvalidType:
    """Test invalid export type handling"""
    
    def test_export_invalid_type(self, authenticated_client):
        """Test exporting with invalid type returns 400"""
        response = authenticated_client.post(f"{BASE_URL}/api/export/data", json={
            "type": "invalid_type",
            "format": "excel"
        })
        assert response.status_code == 400, f"Expected 400 for invalid type, got {response.status_code}"
        print(f"✓ Invalid export type correctly returns 400")


class TestOrderStatusEndpoint:
    """Test the order-status API endpoint"""
    
    def test_order_status_active_endpoint(self, authenticated_client):
        """Test GET /api/order-status/active returns data"""
        response = authenticated_client.get(f"{BASE_URL}/api/order-status/active")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        # Should return object with preparing and ready arrays
        assert "preparing" in data, "Response should have 'preparing' key"
        assert "ready" in data, "Response should have 'ready' key"
        assert isinstance(data["preparing"], list), "preparing should be a list"
        assert isinstance(data["ready"], list), "ready should be a list"
        print(f"✓ Order status endpoint returns valid structure: {len(data['preparing'])} preparing, {len(data['ready'])} ready")
