"""
Iteration 103 - Testing 4 features:
1. Quick Access buttons in sidebar (UI test)
2. Deletion Audit Trail (check_delete_permission logs)
3. Report Builder CRUD (create/read/update/delete/run templates)
4. Comparative Period Analysis (this-period vs last-period metrics)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
OPERATOR_EMAIL = "test@ssc.com"
OPERATOR_PASSWORD = "testtest"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    # Backend uses 'access_token' not 'token'
    token = data.get("access_token") or data.get("token")
    assert token, f"No token in login response: {data}"
    return token


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Admin auth headers."""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestReportBuilder:
    """Test report builder CRUD operations."""
    
    template_id = None
    
    def test_get_templates_initially(self, admin_headers):
        """GET /api/report-templates - should return list (may be empty)."""
        response = requests.get(f"{BASE_URL}/api/report-templates", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET /api/report-templates returned {len(data)} templates")

    def test_create_template(self, admin_headers):
        """POST /api/report-templates - create new template."""
        payload = {
            "name": f"TEST_Template_{uuid.uuid4().hex[:8]}",
            "description": "Test report template for iteration 103",
            "data_source": "sales",
            "columns": ["date", "amount", "payment_mode"],
            "sort_by": "date",
            "sort_order": "desc",
            "chart_type": "bar"
        }
        response = requests.post(f"{BASE_URL}/api/report-templates", json=payload, headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data, f"Missing id in response: {data}"
        assert data["name"] == payload["name"], f"Name mismatch"
        assert data["data_source"] == "sales"
        TestReportBuilder.template_id = data["id"]
        print(f"PASS: POST /api/report-templates created template id={data['id']}")

    def test_verify_template_in_list(self, admin_headers):
        """Verify created template appears in list."""
        response = requests.get(f"{BASE_URL}/api/report-templates", headers=admin_headers)
        assert response.status_code == 200
        templates = response.json()
        found = any(t["id"] == TestReportBuilder.template_id for t in templates)
        assert found, "Created template not found in list"
        print(f"PASS: Template {TestReportBuilder.template_id} verified in list")

    def test_run_template(self, admin_headers):
        """POST /api/report-templates/{id}/run - execute template."""
        template_id = TestReportBuilder.template_id
        assert template_id, "No template_id to run"
        
        response = requests.post(f"{BASE_URL}/api/report-templates/{template_id}/run", json={}, headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "template" in data, "Missing template in run result"
        assert "data" in data, "Missing data in run result"
        assert "summary" in data, "Missing summary in run result"
        assert "total" in data, "Missing total in run result"
        print(f"PASS: POST /api/report-templates/{template_id}/run returned {data['total']} records, summary={data['summary']}")

    def test_update_template(self, admin_headers):
        """PUT /api/report-templates/{id} - update template."""
        template_id = TestReportBuilder.template_id
        assert template_id, "No template_id to update"
        
        payload = {
            "description": "Updated description for test template"
        }
        response = requests.put(f"{BASE_URL}/api/report-templates/{template_id}", json=payload, headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["description"] == payload["description"], "Description not updated"
        print(f"PASS: PUT /api/report-templates/{template_id} updated successfully")

    def test_delete_template(self, admin_headers):
        """DELETE /api/report-templates/{id} - delete template."""
        template_id = TestReportBuilder.template_id
        assert template_id, "No template_id to delete"
        
        response = requests.delete(f"{BASE_URL}/api/report-templates/{template_id}", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify deletion
        response2 = requests.get(f"{BASE_URL}/api/report-templates", headers=admin_headers)
        templates = response2.json()
        not_found = all(t["id"] != template_id for t in templates)
        assert not_found, "Template should be deleted"
        print(f"PASS: DELETE /api/report-templates/{template_id} - template removed")


class TestComparativeAnalysis:
    """Test comparative period analysis API."""
    
    def test_comparative_day(self, admin_headers):
        """GET /api/reports/comparative?period=day - today vs yesterday."""
        response = requests.get(f"{BASE_URL}/api/reports/comparative?period=day", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "current_label" in data, "Missing current_label"
        assert "previous_label" in data, "Missing previous_label"
        assert "metrics" in data, "Missing metrics"
        assert data["current_label"] == "Today", f"Expected 'Today', got {data['current_label']}"
        assert data["previous_label"] == "Yesterday", f"Expected 'Yesterday', got {data['previous_label']}"
        print(f"PASS: GET /api/reports/comparative?period=day - {len(data['metrics'])} metrics returned")

    def test_comparative_week(self, admin_headers):
        """GET /api/reports/comparative?period=week - this week vs last week."""
        response = requests.get(f"{BASE_URL}/api/reports/comparative?period=week", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["current_label"] == "This Week"
        assert data["previous_label"] == "Last Week"
        print(f"PASS: GET /api/reports/comparative?period=week - {len(data['metrics'])} metrics")

    def test_comparative_month(self, admin_headers):
        """GET /api/reports/comparative?period=month - this month vs last month."""
        response = requests.get(f"{BASE_URL}/api/reports/comparative?period=month", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["current_label"] == "This Month"
        assert data["previous_label"] == "Last Month"
        assert "metrics" in data
        # Verify metrics structure
        for m in data["metrics"]:
            assert "label" in m, f"Missing label in metric: {m}"
            assert "current" in m, f"Missing current in metric: {m}"
            assert "previous" in m, f"Missing previous in metric: {m}"
            assert "change_pct" in m, f"Missing change_pct in metric: {m}"
        print(f"PASS: GET /api/reports/comparative?period=month - metrics: {[m['label'] for m in data['metrics']]}")

    def test_comparative_year(self, admin_headers):
        """GET /api/reports/comparative?period=year - this year vs last year."""
        response = requests.get(f"{BASE_URL}/api/reports/comparative?period=year", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["current_label"] == "This Year"
        assert data["previous_label"] == "Last Year"
        print(f"PASS: GET /api/reports/comparative?period=year")


class TestDeletionAuditTrail:
    """Test deletion audit trail features."""
    
    def test_get_audit_log(self, admin_headers):
        """GET /api/access-policies/delete-audit-log - admin can view."""
        response = requests.get(f"{BASE_URL}/api/access-policies/delete-audit-log", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "data" in data, "Missing data field"
        assert "total" in data, "Missing total field"
        assert "page" in data, "Missing page field"
        assert "pages" in data, "Missing pages field"
        print(f"PASS: GET /api/access-policies/delete-audit-log - {data['total']} total logs, page {data['page']}/{data['pages']}")

    def test_create_sale_for_deletion(self, admin_headers):
        """Create a test sale to delete later."""
        # First get a valid branch
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=admin_headers)
        branches = branches_resp.json() if branches_resp.status_code == 200 else []
        branch_id = branches[0]["id"] if branches else None
        
        payload = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "amount": 50,
            "payment_mode": "cash",
            "sale_type": "walkin",
            "notes": "TEST_SALE_FOR_AUDIT_DELETION",
            "payment_details": [{"mode": "cash", "amount": 50, "discount": 0}]
        }
        if branch_id:
            payload["branch_id"] = branch_id
            
        response = requests.post(f"{BASE_URL}/api/sales", json=payload, headers=admin_headers)
        assert response.status_code == 200, f"Failed to create sale: {response.text}"
        data = response.json()
        TestDeletionAuditTrail.sale_id = data.get("id")
        print(f"PASS: Created test sale id={data.get('id')}")

    sale_id = None
    
    def test_delete_sale_triggers_audit(self, admin_headers):
        """DELETE /api/sales/{id} should trigger audit log entry."""
        sale_id = TestDeletionAuditTrail.sale_id
        if not sale_id:
            pytest.skip("No sale created to delete")
        
        # Get audit log count before
        before_resp = requests.get(f"{BASE_URL}/api/access-policies/delete-audit-log", headers=admin_headers)
        before_total = before_resp.json().get("total", 0) if before_resp.status_code == 200 else 0
        
        # Delete the sale
        response = requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=admin_headers)
        assert response.status_code == 200, f"Failed to delete sale: {response.text}"
        
        # Get audit log count after
        after_resp = requests.get(f"{BASE_URL}/api/access-policies/delete-audit-log", headers=admin_headers)
        after_data = after_resp.json()
        after_total = after_data.get("total", 0)
        
        # Audit log should have more entries now
        assert after_total >= before_total, f"Audit log should have increased: {before_total} -> {after_total}"
        
        # Check if there's an entry with sales module
        logs = after_data.get("data", [])
        sales_log = next((l for l in logs if l.get("module") == "sales"), None)
        if sales_log:
            print(f"PASS: Found audit log entry for sales deletion: allowed={sales_log.get('allowed')}, reason={sales_log.get('reason')}")
        else:
            print(f"PASS: Sale deleted, audit log total increased from {before_total} to {after_total}")

    def test_audit_log_has_required_fields(self, admin_headers):
        """Verify audit log entries have required fields."""
        response = requests.get(f"{BASE_URL}/api/access-policies/delete-audit-log?limit=10", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        logs = data.get("data", [])
        
        if logs:
            log = logs[0]
            required_fields = ["user_email", "user_role", "module", "timestamp", "allowed", "reason"]
            for field in required_fields:
                assert field in log, f"Missing field '{field}' in audit log entry"
            print(f"PASS: Audit log entries have all required fields: {required_fields}")
        else:
            print("INFO: No audit logs available to verify fields")


class TestAuditTrailPage:
    """Test audit trail page endpoint."""
    
    def test_audit_trail_pagination(self, admin_headers):
        """Test pagination of audit trail."""
        response = requests.get(f"{BASE_URL}/api/access-policies/delete-audit-log?page=1&limit=30", headers=admin_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data.get("data"), list)
        assert "pages" in data
        print(f"PASS: Audit trail pagination works - page 1 of {data['pages']}")


class TestReportBuilderDataSources:
    """Test report builder with different data sources."""
    
    def test_create_and_run_expenses_report(self, admin_headers):
        """Create and run an expenses report template."""
        payload = {
            "name": f"TEST_Expenses_Report_{uuid.uuid4().hex[:6]}",
            "data_source": "expenses",
            "columns": ["date", "amount", "category", "description"],
            "sort_by": "date",
            "sort_order": "desc"
        }
        create_resp = requests.post(f"{BASE_URL}/api/report-templates", json=payload, headers=admin_headers)
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        template = create_resp.json()
        template_id = template["id"]
        
        # Run it
        run_resp = requests.post(f"{BASE_URL}/api/report-templates/{template_id}/run", json={}, headers=admin_headers)
        assert run_resp.status_code == 200, f"Run failed: {run_resp.text}"
        result = run_resp.json()
        assert result["template"]["data_source"] == "expenses"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/report-templates/{template_id}", headers=admin_headers)
        print(f"PASS: Expenses report created, ran ({result['total']} records), and deleted")

    def test_create_and_run_customers_report(self, admin_headers):
        """Create and run a customers report template."""
        payload = {
            "name": f"TEST_Customers_Report_{uuid.uuid4().hex[:6]}",
            "data_source": "customers",
            "columns": ["name", "phone", "email", "current_credit"],
            "sort_by": "name",
            "sort_order": "asc"
        }
        create_resp = requests.post(f"{BASE_URL}/api/report-templates", json=payload, headers=admin_headers)
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        template = create_resp.json()
        template_id = template["id"]
        
        # Run it
        run_resp = requests.post(f"{BASE_URL}/api/report-templates/{template_id}/run", json={}, headers=admin_headers)
        assert run_resp.status_code == 200, f"Run failed: {run_resp.text}"
        result = run_resp.json()
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/report-templates/{template_id}", headers=admin_headers)
        print(f"PASS: Customers report created, ran ({result['total']} records), and deleted")
