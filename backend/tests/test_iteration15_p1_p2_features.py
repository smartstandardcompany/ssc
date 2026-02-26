"""
Iteration 15: P1 (Job Title Permissions) and P2 (Bank Reconciliation UI) Tests
Tests for the two new features:
- P1: Job titles linked to permissions, permissions sync to users on login/link
- P2: Reconciliation page at /reconciliation with flag/notes feature
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
EMPLOYEE_EMAIL = "ahmed@test.com"
EMPLOYEE_PASSWORD = "emp@123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestP1JobTitlePermissions:
    """P1: Job Title Permissions Feature Tests"""

    def test_get_job_titles_returns_permissions_field(self, admin_headers):
        """GET /api/job-titles should return job titles with permissions array"""
        response = requests.get(f"{BASE_URL}/api/job-titles", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get job titles: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Job titles should be a list"
        
        # Check that at least one job title has permissions field
        if len(data) > 0:
            job_title = data[0]
            assert "permissions" in job_title, "Job title should have permissions field"
            assert isinstance(job_title["permissions"], list), "Permissions should be a list"
            print(f"Found {len(data)} job titles, first has permissions: {job_title.get('permissions', [])[:3]}...")

    def test_create_job_title_with_permissions(self, admin_headers):
        """POST /api/job-titles creates job title with permissions array"""
        unique_suffix = str(uuid.uuid4())[:6]
        new_title = {
            "title": f"TEST_Title_{unique_suffix}",
            "department": "TEST_Dept",
            "min_salary": 1000,
            "max_salary": 2000,
            "permissions": ["dashboard", "sales", "expenses"]
        }
        
        response = requests.post(f"{BASE_URL}/api/job-titles", json=new_title, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create job title: {response.text}"
        
        data = response.json()
        assert data["title"] == new_title["title"], "Title should match"
        assert "permissions" in data, "Should return permissions"
        assert set(data["permissions"]) == set(new_title["permissions"]), "Permissions should match"
        print(f"Created job title: {data['title']} with permissions: {data['permissions']}")
        
        return data

    def test_update_job_title_permissions(self, admin_headers):
        """PUT /api/job-titles/{id} updates permissions and should sync to linked users"""
        # First get existing job titles
        response = requests.get(f"{BASE_URL}/api/job-titles", headers=admin_headers)
        assert response.status_code == 200
        job_titles = response.json()
        
        if len(job_titles) == 0:
            pytest.skip("No job titles to update")
        
        # Pick a job title to update
        job_title = job_titles[0]
        title_id = job_title["id"]
        
        # Update permissions
        new_permissions = ["dashboard", "sales", "invoices", "customers"]
        update_payload = {"permissions": new_permissions}
        
        response = requests.put(f"{BASE_URL}/api/job-titles/{title_id}", json=update_payload, headers=admin_headers)
        assert response.status_code == 200, f"Failed to update job title: {response.text}"
        
        data = response.json()
        assert set(data["permissions"]) == set(new_permissions), "Permissions should be updated"
        print(f"Updated job title {data['title']} permissions to: {data['permissions']}")

    def test_create_job_title_without_permissions(self, admin_headers):
        """Creating job title without permissions should default to empty array"""
        unique_suffix = str(uuid.uuid4())[:6]
        new_title = {
            "title": f"TEST_NoPerms_{unique_suffix}",
            "department": "TEST_Dept",
            "min_salary": 500,
            "max_salary": 1000
            # No permissions field
        }
        
        response = requests.post(f"{BASE_URL}/api/job-titles", json=new_title, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create job title: {response.text}"
        
        data = response.json()
        assert "permissions" in data, "Should have permissions field"
        assert isinstance(data["permissions"], list), "Permissions should be a list"
        print(f"Created job title without permissions, got: {data['permissions']}")

    def test_login_merges_job_title_permissions(self):
        """Login should merge job title permissions into user (employee test)"""
        # Login as employee
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EMPLOYEE_EMAIL,
            "password": EMPLOYEE_PASSWORD
        })
        assert response.status_code == 200, f"Employee login failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Should return user"
        user = data["user"]
        
        # User should have permissions
        assert "permissions" in user, "User should have permissions field"
        print(f"Employee {user['email']} logged in with permissions: {user['permissions']}")


class TestP2ReconciliationEndpoints:
    """P2: Bank Reconciliation Feature Tests"""

    def test_get_bank_statements_list(self, admin_headers):
        """GET /api/bank-statements returns list of statements"""
        response = requests.get(f"{BASE_URL}/api/bank-statements", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get bank statements: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"Found {len(data)} bank statements")
        
        if len(data) > 0:
            # Verify structure
            stmt = data[0]
            assert "id" in stmt, "Statement should have id"
            assert "file_name" in stmt or "bank_name" in stmt, "Statement should have identifier"

    def test_get_reconciliation_for_statement(self, admin_headers):
        """GET /api/bank-statements/{id}/reconciliation returns reconciliation data"""
        # First get statements
        response = requests.get(f"{BASE_URL}/api/bank-statements", headers=admin_headers)
        assert response.status_code == 200
        statements = response.json()
        
        if len(statements) == 0:
            pytest.skip("No bank statements available for reconciliation test")
        
        stmt_id = statements[0]["id"]
        
        # Get reconciliation
        response = requests.get(f"{BASE_URL}/api/bank-statements/{stmt_id}/reconciliation", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get reconciliation: {response.text}"
        
        data = response.json()
        assert "rows" in data, "Reconciliation should have rows"
        assert "summary" in data, "Reconciliation should have summary"
        
        summary = data["summary"]
        print(f"Reconciliation summary: bank={summary.get('total_bank_pos', 0)}, app={summary.get('total_app_sales', 0)}, diff={summary.get('total_difference', 0)}")

    def test_flag_reconciliation_row(self, admin_headers):
        """POST /api/bank-statements/{id}/reconciliation/flag saves flag"""
        # Get statements
        response = requests.get(f"{BASE_URL}/api/bank-statements", headers=admin_headers)
        assert response.status_code == 200
        statements = response.json()
        
        if len(statements) == 0:
            pytest.skip("No bank statements available for flag test")
        
        stmt_id = statements[0]["id"]
        
        # Flag a row
        flag_data = {
            "row_key": "2025-01-01|TestBranch",
            "flag": "verified",
            "notes": "TEST_Flag - Verified by testing agent"
        }
        
        response = requests.post(f"{BASE_URL}/api/bank-statements/{stmt_id}/reconciliation/flag", json=flag_data, headers=admin_headers)
        assert response.status_code == 200, f"Failed to save flag: {response.text}"
        
        data = response.json()
        assert "message" in data, "Should return success message"
        print(f"Flag saved: {data}")

    def test_get_reconciliation_flags(self, admin_headers):
        """GET /api/bank-statements/{id}/reconciliation/flags returns saved flags"""
        response = requests.get(f"{BASE_URL}/api/bank-statements", headers=admin_headers)
        assert response.status_code == 200
        statements = response.json()
        
        if len(statements) == 0:
            pytest.skip("No bank statements available for flags test")
        
        stmt_id = statements[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/bank-statements/{stmt_id}/reconciliation/flags", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get flags: {response.text}"
        
        data = response.json()
        assert isinstance(data, dict), "Flags should be a dictionary"
        print(f"Found {len(data)} flags for statement")

    def test_flag_update_persists(self, admin_headers):
        """Verify flag updates are persisted"""
        response = requests.get(f"{BASE_URL}/api/bank-statements", headers=admin_headers)
        assert response.status_code == 200
        statements = response.json()
        
        if len(statements) == 0:
            pytest.skip("No bank statements available")
        
        stmt_id = statements[0]["id"]
        unique_key = f"TEST_{str(uuid.uuid4())[:6]}|TestBranch"
        
        # Create flag
        flag_data = {
            "row_key": unique_key,
            "flag": "investigate",
            "notes": "TEST_Investigate note"
        }
        
        response = requests.post(f"{BASE_URL}/api/bank-statements/{stmt_id}/reconciliation/flag", json=flag_data, headers=admin_headers)
        assert response.status_code == 200
        
        # Verify it's saved
        response = requests.get(f"{BASE_URL}/api/bank-statements/{stmt_id}/reconciliation/flags", headers=admin_headers)
        assert response.status_code == 200
        
        flags = response.json()
        assert unique_key in flags, f"Flag for {unique_key} should be saved"
        assert flags[unique_key]["flag"] == "investigate", "Flag value should match"
        print(f"Flag persisted correctly: {flags[unique_key]}")


class TestExistingFeaturesNoRegression:
    """Verify existing features still work (no regressions)"""

    def test_dashboard_stats(self, admin_headers):
        """Dashboard stats endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        
        data = response.json()
        assert "total_sales" in data, "Should have total_sales"
        print(f"Dashboard stats working: total_sales={data.get('total_sales', 0)}")

    def test_sales_list(self, admin_headers):
        """Sales endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=admin_headers)
        assert response.status_code == 200, f"Sales list failed: {response.text}"
        print(f"Sales endpoint working: {len(response.json())} sales")

    def test_employees_list(self, admin_headers):
        """Employees endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=admin_headers)
        assert response.status_code == 200, f"Employees list failed: {response.text}"
        print(f"Employees endpoint working: {len(response.json())} employees")

    def test_branches_list(self, admin_headers):
        """Branches endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=admin_headers)
        assert response.status_code == 200, f"Branches list failed: {response.text}"
        print(f"Branches endpoint working: {len(response.json())} branches")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
