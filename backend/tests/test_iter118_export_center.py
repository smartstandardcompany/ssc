"""
Test Export Center Feature - Iteration 118
Tests for the new Data Export Dashboard feature at /export-center
Covers: report-types API, history API, generate API for various report types
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

# Test credentials
TEST_EMAIL = "ss@ssc.com"
TEST_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    data = response.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture
def auth_headers(auth_token):
    """Get headers with authorization token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestExportCenterReportTypes:
    """Tests for GET /api/export-center/report-types endpoint"""

    def test_get_report_types_returns_200(self, auth_headers):
        """Test that report types endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/export-center/report-types",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_report_types_returns_8_types(self, auth_headers):
        """Test that exactly 8 report types are returned"""
        response = requests.get(
            f"{BASE_URL}/api/export-center/report-types",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 8, f"Expected 8 report types, got {len(data)}"

    def test_get_report_types_structure(self, auth_headers):
        """Test that each report type has required fields"""
        response = requests.get(
            f"{BASE_URL}/api/export-center/report-types",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        expected_ids = ["sales", "expenses", "supplier_payments", "profit_loss", 
                       "daily_summary", "customers", "employees", "stock"]
        
        for report_type in data:
            assert "id" in report_type, "Report type should have 'id'"
            assert "name" in report_type, "Report type should have 'name'"
            assert "description" in report_type, "Report type should have 'description'"
            assert "icon" in report_type, "Report type should have 'icon'"
            assert "color" in report_type, "Report type should have 'color'"
        
        # Check all expected report types are present
        actual_ids = [rt["id"] for rt in data]
        for expected_id in expected_ids:
            assert expected_id in actual_ids, f"Missing report type: {expected_id}"


class TestExportCenterHistory:
    """Tests for GET /api/export-center/history endpoint"""

    def test_get_history_returns_200(self, auth_headers):
        """Test that history endpoint returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/export-center/history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_get_history_returns_list(self, auth_headers):
        """Test that history returns a list"""
        response = requests.get(
            f"{BASE_URL}/api/export-center/history",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Response should be a list"


class TestExportCenterGenerate:
    """Tests for POST /api/export-center/generate endpoint - Export Generation"""

    def test_generate_sales_excel_export(self, auth_headers):
        """Test generating sales report in Excel format"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "sales",
                "format": "excel",
                "start_date": today,
                "end_date": today,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        # Check content type for Excel
        content_type = response.headers.get("content-type", "")
        assert "spreadsheetml" in content_type or "octet-stream" in content_type, f"Expected Excel content type, got {content_type}"
        # Check content disposition header
        content_disp = response.headers.get("content-disposition", "")
        assert "sales_report" in content_disp.lower() or "attachment" in content_disp.lower(), f"Expected attachment disposition, got {content_disp}"

    def test_generate_expenses_pdf_export(self, auth_headers):
        """Test generating expenses report in PDF format"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "expenses",
                "format": "pdf",
                "start_date": today,
                "end_date": today,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        # Check content type for PDF
        content_type = response.headers.get("content-type", "")
        assert "pdf" in content_type, f"Expected PDF content type, got {content_type}"

    def test_generate_profit_loss_export(self, auth_headers):
        """Test generating profit & loss report"""
        # Use this month date range
        today = datetime.now()
        first_of_month = today.replace(day=1).strftime("%Y-%m-%d")
        today_str = today.strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "profit_loss",
                "format": "excel",
                "start_date": first_of_month,
                "end_date": today_str,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_generate_daily_summary_export(self, auth_headers):
        """Test generating daily summary report"""
        # Last 30 days
        today = datetime.now()
        thirty_days_ago = (today - timedelta(days=30)).strftime("%Y-%m-%d")
        today_str = today.strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "daily_summary",
                "format": "excel",
                "start_date": thirty_days_ago,
                "end_date": today_str,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_generate_customers_export(self, auth_headers):
        """Test generating customers report"""
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "customers",
                "format": "excel",
                "start_date": None,
                "end_date": None,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_generate_employees_export(self, auth_headers):
        """Test generating employees report"""
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "employees",
                "format": "pdf",
                "start_date": None,
                "end_date": None,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        # Check content type for PDF
        content_type = response.headers.get("content-type", "")
        assert "pdf" in content_type, f"Expected PDF content type, got {content_type}"

    def test_generate_stock_export(self, auth_headers):
        """Test generating inventory/stock report"""
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "stock",
                "format": "excel",
                "start_date": None,
                "end_date": None,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_generate_supplier_payments_export(self, auth_headers):
        """Test generating supplier payments report"""
        today = datetime.now()
        first_of_month = today.replace(day=1).strftime("%Y-%m-%d")
        today_str = today.strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "supplier_payments",
                "format": "excel",
                "start_date": first_of_month,
                "end_date": today_str,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_generate_invalid_report_type_returns_400(self, auth_headers):
        """Test that invalid report type returns 400 error"""
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "invalid_type",
                "format": "excel",
                "start_date": None,
                "end_date": None,
                "branch_id": None
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid report type, got {response.status_code}"

    def test_generate_all_time_sales_export(self, auth_headers):
        """Test generating sales report with all time (no date range)"""
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "sales",
                "format": "excel",
                "start_date": None,
                "end_date": None,
                "branch_id": None
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"


class TestExportCenterHistoryAfterGeneration:
    """Test that export history is updated after generating exports"""

    def test_history_updated_after_export(self, auth_headers):
        """Test that history shows new entry after export"""
        # First, generate an export
        today = datetime.now().strftime("%Y-%m-%d")
        gen_response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            headers=auth_headers,
            json={
                "report_type": "sales",
                "format": "excel",
                "start_date": today,
                "end_date": today,
                "branch_id": None
            }
        )
        assert gen_response.status_code == 200, f"Export generation failed: {gen_response.status_code}"
        
        # Now check history
        hist_response = requests.get(
            f"{BASE_URL}/api/export-center/history",
            headers=auth_headers
        )
        assert hist_response.status_code == 200
        history = hist_response.json()
        
        # Should have at least one entry
        assert len(history) >= 1, "History should have at least one entry after export"
        
        # Most recent entry should be sales report
        recent = history[0]
        assert "report_type" in recent, "History entry should have report_type"
        assert "format" in recent, "History entry should have format"
        assert "created_at" in recent, "History entry should have created_at"


class TestExportCenterAuthentication:
    """Test that export center requires authentication"""

    def test_report_types_requires_auth(self):
        """Test that report types endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export-center/report-types")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422 without auth, got {response.status_code}"

    def test_history_requires_auth(self):
        """Test that history endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export-center/history")
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422 without auth, got {response.status_code}"

    def test_generate_requires_auth(self):
        """Test that generate endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/export-center/generate",
            json={"report_type": "sales", "format": "excel"}
        )
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422 without auth, got {response.status_code}"
