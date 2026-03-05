"""
Test Iteration 98: Data Management and Scheduled PDF Reports
- Data Management endpoints: GET /api/data-management/stats, POST /api/data-management/archive,
  GET /api/data-management/export/{collection}
- Scheduled Reports endpoints: GET /api/pdf-exports/scheduled-reports, POST /api/pdf-exports/scheduled-reports,
  POST /api/pdf-exports/scheduled-reports/{id}/send-now
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="session")
def admin_token():
    """Get authentication token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token") or data.get("token")
    pytest.skip("Admin authentication failed - skipping tests")


@pytest.fixture
def auth_headers(admin_token):
    """Headers with authorization"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestDataManagement:
    """Test Data Management endpoints"""
    
    def test_get_data_stats(self, auth_headers):
        """Test GET /api/data-management/stats returns collection statistics"""
        response = requests.get(
            f"{BASE_URL}/api/data-management/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "stats" in data, "Response should contain 'stats' field"
        assert isinstance(data["stats"], list), "Stats should be a list"
        
        # Should have stats for 7 collections
        expected_collections = ["sales", "expenses", "supplier_payments", "invoices", 
                               "activity_logs", "scheduler_logs", "notifications"]
        collection_names = [s["collection"] for s in data["stats"]]
        
        for coll in expected_collections:
            assert coll in collection_names, f"Missing stats for collection: {coll}"
        
        # Verify stat structure
        if data["stats"]:
            stat = data["stats"][0]
            assert "collection" in stat, "Stat should have 'collection'"
            assert "label" in stat, "Stat should have 'label'"
            assert "total" in stat, "Stat should have 'total'"
            assert isinstance(stat["total"], int), "total should be integer"
            assert "older_than_3_months" in stat
            assert "older_than_6_months" in stat
            assert "older_than_12_months" in stat
        
        print(f"SUCCESS: Got stats for {len(data['stats'])} collections")
        for stat in data["stats"]:
            print(f"  - {stat['label']}: {stat['total']} records")
    
    def test_get_data_stats_archives_history(self, auth_headers):
        """Test that stats endpoint returns archive history"""
        response = requests.get(
            f"{BASE_URL}/api/data-management/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "archives" in data, "Response should contain 'archives' field"
        assert isinstance(data["archives"], list), "Archives should be a list"
        print(f"SUCCESS: Archive history has {len(data['archives'])} entries")
    
    def test_export_collection_sales(self, auth_headers):
        """Test GET /api/data-management/export/sales exports data as JSON"""
        response = requests.get(
            f"{BASE_URL}/api/data-management/export/sales",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "collection" in data, "Export should have 'collection'"
        assert data["collection"] == "sales", "Collection should be 'sales'"
        assert "count" in data, "Export should have 'count'"
        assert "exported_at" in data, "Export should have 'exported_at'"
        assert "data" in data, "Export should have 'data'"
        assert isinstance(data["data"], list), "Data should be a list"
        
        print(f"SUCCESS: Exported {data['count']} sales records")
    
    def test_export_collection_expenses(self, auth_headers):
        """Test GET /api/data-management/export/expenses"""
        response = requests.get(
            f"{BASE_URL}/api/data-management/export/expenses",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["collection"] == "expenses"
        assert "count" in data
        print(f"SUCCESS: Exported {data['count']} expense records")
    
    def test_export_collection_invoices(self, auth_headers):
        """Test GET /api/data-management/export/invoices"""
        response = requests.get(
            f"{BASE_URL}/api/data-management/export/invoices",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["collection"] == "invoices"
        print(f"SUCCESS: Exported {data['count']} invoice records")
    
    def test_export_invalid_collection(self, auth_headers):
        """Test export with invalid collection name returns 400"""
        response = requests.get(
            f"{BASE_URL}/api/data-management/export/invalid_collection",
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400 for invalid collection, got {response.status_code}"
        print("SUCCESS: Invalid collection returns 400 as expected")
    
    def test_archive_endpoint_exists(self, auth_headers):
        """Test POST /api/data-management/archive endpoint exists (without archiving)"""
        # We'll test with 0 months to avoid actually archiving data
        # Actually let's just verify the endpoint responds correctly
        response = requests.post(
            f"{BASE_URL}/api/data-management/archive",
            headers=auth_headers,
            json={"collection": "invalid_collection", "months": 12}
        )
        # Should return 400 for invalid collection
        assert response.status_code == 400, f"Expected 400 for invalid collection, got {response.status_code}"
        print("SUCCESS: Archive endpoint exists and validates input")
    
    def test_archive_with_valid_collection(self, auth_headers):
        """Test POST /api/data-management/archive with activity_logs (safest to test)"""
        # Test archiving scheduler_logs older than 12 months - likely won't archive anything
        # but verifies endpoint works
        response = requests.post(
            f"{BASE_URL}/api/data-management/archive",
            headers=auth_headers,
            json={"collection": "scheduler_logs", "months": 24}  # 24 months - very old
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "archived_count" in data
        print(f"SUCCESS: Archive returned: {data['message']}")


class TestScheduledReports:
    """Test Scheduled PDF Reports endpoints"""
    
    def test_get_scheduled_reports(self, auth_headers):
        """Test GET /api/pdf-exports/scheduled-reports"""
        response = requests.get(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of scheduled reports"
        print(f"SUCCESS: Found {len(data)} scheduled reports")
        
        for report in data:
            print(f"  - {report.get('report_type', 'unknown')} ({report.get('frequency', 'unknown')})")
    
    def test_create_scheduled_report(self, auth_headers):
        """Test POST /api/pdf-exports/scheduled-reports creates new schedule"""
        payload = {
            "report_type": "sales",
            "frequency": "daily",
            "email_recipients": ["test@example.com"],
            "enabled": True,
            "time_of_day": "08:00"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports",
            headers=auth_headers,
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Created report should have 'id'"
        assert data["report_type"] == "sales"
        assert data["frequency"] == "daily"
        assert "test@example.com" in data["email_recipients"]
        
        print(f"SUCCESS: Created scheduled report with ID: {data['id']}")
        return data["id"]
    
    def test_send_now_scheduled_report(self, auth_headers):
        """Test POST /api/pdf-exports/scheduled-reports/{id}/send-now"""
        # First create a report
        create_payload = {
            "report_type": "expenses",
            "frequency": "weekly",
            "email_recipients": ["test@example.com"],
            "enabled": True,
            "time_of_day": "09:00",
            "day_of_week": 1
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports",
            headers=auth_headers,
            json=create_payload
        )
        assert create_response.status_code == 200
        report_id = create_response.json()["id"]
        
        # Now try to send it now
        send_response = requests.post(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports/{report_id}/send-now",
            headers=auth_headers
        )
        assert send_response.status_code == 200, f"Expected 200, got {send_response.status_code}: {send_response.text}"
        
        data = send_response.json()
        assert "message" in data
        assert "status" in data
        # Email might fail due to SMTP block, but endpoint should work
        print(f"SUCCESS: Send now returned: {data['message']} (status: {data['status']})")
    
    def test_delete_scheduled_report(self, auth_headers):
        """Test DELETE /api/pdf-exports/scheduled-reports/{id}"""
        # First create a report
        create_payload = {
            "report_type": "pnl",
            "frequency": "monthly",
            "email_recipients": ["delete-test@example.com"],
            "enabled": True,
            "time_of_day": "10:00",
            "day_of_month": 1
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports",
            headers=auth_headers,
            json=create_payload
        )
        assert create_response.status_code == 200
        report_id = create_response.json()["id"]
        
        # Delete the report
        delete_response = requests.delete(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports/{report_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        print(f"SUCCESS: Deleted scheduled report {report_id}")
    
    def test_get_branding_config(self, auth_headers):
        """Test GET /api/pdf-exports/branding"""
        response = requests.get(
            f"{BASE_URL}/api/pdf-exports/branding",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "company_name" in data
        print(f"SUCCESS: Got branding config - company: {data.get('company_name', 'N/A')}")


class TestSchedulerIntegration:
    """Test scheduler config for PDF reports"""
    
    def test_scheduler_config(self, auth_headers):
        """Test GET /api/scheduler/config"""
        response = requests.get(
            f"{BASE_URL}/api/scheduler/config",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Should return list of scheduler configs"
        print(f"SUCCESS: Found {len(data)} scheduler configurations")
    
    def test_scheduler_logs(self, auth_headers):
        """Test GET /api/scheduler/logs"""
        response = requests.get(
            f"{BASE_URL}/api/scheduler/logs",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Should return list of logs"
        print(f"SUCCESS: Found {len(data)} scheduler logs")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
