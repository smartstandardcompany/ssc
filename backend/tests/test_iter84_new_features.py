"""
Test file for iteration 84 - New features:
1. Supplier Returns (cash_refund, credit_return, full_invoice_return)
2. Expense Refunds
3. Employee Status Filter (Active/Left/All)
4. Scheduled PDF Reports
5. Bill Image Upload for Supplier Payments
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"
TEST_SUPPLIER_ID = "4c5f2407-9755-485f-9dee-ba110a1a2f47"


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


# =====================================================
# SUPPLIER RETURNS TESTS
# =====================================================
class TestSupplierReturns:
    """Test supplier returns API endpoints"""

    def test_get_supplier_returns(self, auth_headers):
        """GET /api/supplier-returns - should return list of supplier returns"""
        response = requests.get(f"{BASE_URL}/api/supplier-returns", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET supplier-returns: Found {len(data)} returns")

    def test_create_supplier_return_credit(self, auth_headers):
        """POST /api/supplier-returns - create credit_return type"""
        payload = {
            "supplier_id": TEST_SUPPLIER_ID,
            "return_type": "credit_return",
            "amount": 50.00,
            "reason": "TEST_Damaged goods",
            "invoice_ref": "TEST_INV001",
            "date": "2026-01-15T10:00:00Z"
        }
        response = requests.post(f"{BASE_URL}/api/supplier-returns", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create return failed: {response.text}"
        data = response.json()
        assert data.get("return_type") == "credit_return"
        assert data.get("amount") == 50.00
        assert "id" in data
        print(f"✓ POST supplier-returns (credit_return): Created return {data['id'][:8]}")
        return data

    def test_create_supplier_return_cash_refund(self, auth_headers):
        """POST /api/supplier-returns - create cash_refund type"""
        payload = {
            "supplier_id": TEST_SUPPLIER_ID,
            "return_type": "cash_refund",
            "amount": 25.00,
            "reason": "TEST_Quality issue",
            "date": "2026-01-15T10:00:00Z"
        }
        response = requests.post(f"{BASE_URL}/api/supplier-returns", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create return failed: {response.text}"
        data = response.json()
        assert data.get("return_type") == "cash_refund"
        print(f"✓ POST supplier-returns (cash_refund): Created return {data['id'][:8]}")
        return data

    def test_create_supplier_return_full_invoice(self, auth_headers):
        """POST /api/supplier-returns - create full_invoice_return type"""
        payload = {
            "supplier_id": TEST_SUPPLIER_ID,
            "return_type": "full_invoice_return",
            "amount": 100.00,
            "reason": "TEST_Incorrect order",
            "invoice_ref": "TEST_INV999",
            "date": "2026-01-15T10:00:00Z"
        }
        response = requests.post(f"{BASE_URL}/api/supplier-returns", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create return failed: {response.text}"
        data = response.json()
        assert data.get("return_type") == "full_invoice_return"
        print(f"✓ POST supplier-returns (full_invoice_return): Created return {data['id'][:8]}")
        return data

    def test_delete_supplier_return(self, auth_headers):
        """DELETE /api/supplier-returns/{id} - delete and reverse balance"""
        # First create a return to delete
        payload = {
            "supplier_id": TEST_SUPPLIER_ID,
            "return_type": "credit_return",
            "amount": 10.00,
            "reason": "TEST_To delete",
            "date": "2026-01-15T10:00:00Z"
        }
        create_resp = requests.post(f"{BASE_URL}/api/supplier-returns", headers=auth_headers, json=payload)
        assert create_resp.status_code == 200
        return_id = create_resp.json()["id"]

        # Now delete it
        response = requests.delete(f"{BASE_URL}/api/supplier-returns/{return_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "deleted" in data.get("message", "").lower() or "reversed" in data.get("message", "").lower()
        print(f"✓ DELETE supplier-returns/{return_id[:8]}: Balance reversed")

    def test_supplier_returns_invalid_supplier(self, auth_headers):
        """POST /api/supplier-returns - should fail with invalid supplier"""
        payload = {
            "supplier_id": "invalid-uuid-that-does-not-exist",
            "return_type": "credit_return",
            "amount": 50.00,
            "reason": "TEST_Invalid",
            "date": "2026-01-15T10:00:00Z"
        }
        response = requests.post(f"{BASE_URL}/api/supplier-returns", headers=auth_headers, json=payload)
        assert response.status_code == 404
        print("✓ POST supplier-returns: Correctly rejected invalid supplier")


# =====================================================
# BILL IMAGE UPLOAD TESTS
# =====================================================
class TestBillImageUpload:
    """Test bill image upload for supplier payments"""

    def test_upload_bill_image(self, auth_headers):
        """POST /api/supplier-payments/upload-bill - upload bill image"""
        # Create a simple test image (1x1 PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_bill.png', io.BytesIO(png_data), 'image/png')}
        headers = {"Authorization": auth_headers["Authorization"]}  # Don't set Content-Type for multipart
        
        response = requests.post(f"{BASE_URL}/api/supplier-payments/upload-bill", headers=headers, files=files)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "bill_url" in data
        assert data["bill_url"].startswith("/uploads/bills/")
        print(f"✓ POST upload-bill: Uploaded to {data['bill_url']}")
        return data["bill_url"]


# =====================================================
# EXPENSE REFUNDS TESTS
# =====================================================
class TestExpenseRefunds:
    """Test expense refund API endpoints"""

    def test_create_expense_refund(self, auth_headers):
        """POST /api/expense-refunds - create refund with negative expense entry"""
        payload = {
            "amount": 30.00,
            "reason": "TEST_Returned item",
            "refund_mode": "cash",
            "category": "Refund",
            "date": "2026-01-15T10:00:00Z"
        }
        response = requests.post(f"{BASE_URL}/api/expense-refunds", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create refund failed: {response.text}"
        data = response.json()
        assert data.get("amount") == 30.00
        assert data.get("refund_mode") == "cash"
        assert "id" in data
        print(f"✓ POST expense-refunds: Created refund {data['id'][:8]}")
        return data

    def test_get_expense_refunds(self, auth_headers):
        """GET /api/expense-refunds - list all expense refunds"""
        response = requests.get(f"{BASE_URL}/api/expense-refunds", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET expense-refunds: Found {len(data)} refunds")


# =====================================================
# SCHEDULED PDF REPORTS TESTS
# =====================================================
class TestScheduledReports:
    """Test scheduled PDF reports CRUD"""

    def test_get_scheduled_reports(self, auth_headers):
        """GET /api/pdf-exports/scheduled-reports - list all scheduled reports"""
        response = requests.get(f"{BASE_URL}/api/pdf-exports/scheduled-reports", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET scheduled-reports: Found {len(data)} schedules")

    def test_create_scheduled_report(self, auth_headers):
        """POST /api/pdf-exports/scheduled-reports - create new schedule"""
        payload = {
            "report_type": "sales",
            "frequency": "daily",
            "email_recipients": ["test@example.com"],
            "enabled": True,
            "time_of_day": "09:00"
        }
        response = requests.post(f"{BASE_URL}/api/pdf-exports/scheduled-reports", headers=auth_headers, json=payload)
        assert response.status_code == 200, f"Create schedule failed: {response.text}"
        data = response.json()
        assert data.get("report_type") == "sales"
        assert data.get("frequency") == "daily"
        assert "id" in data
        print(f"✓ POST scheduled-reports: Created schedule {data['id'][:8]}")
        return data["id"]

    def test_update_scheduled_report(self, auth_headers):
        """PUT /api/pdf-exports/scheduled-reports/{id} - toggle enable/disable"""
        # First create a report to update
        payload = {
            "report_type": "expenses",
            "frequency": "weekly",
            "email_recipients": ["test2@example.com"],
            "enabled": True,
            "day_of_week": 1,
            "time_of_day": "10:00"
        }
        create_resp = requests.post(f"{BASE_URL}/api/pdf-exports/scheduled-reports", headers=auth_headers, json=payload)
        assert create_resp.status_code == 200
        report_id = create_resp.json()["id"]

        # Update to disable
        update_payload = {
            "report_type": "expenses",
            "frequency": "weekly",
            "email_recipients": ["test2@example.com"],
            "enabled": False,
            "day_of_week": 1,
            "time_of_day": "10:00"
        }
        response = requests.put(f"{BASE_URL}/api/pdf-exports/scheduled-reports/{report_id}", headers=auth_headers, json=update_payload)
        assert response.status_code == 200
        print(f"✓ PUT scheduled-reports/{report_id[:8]}: Toggled to disabled")
        return report_id

    def test_send_now_scheduled_report(self, auth_headers):
        """POST /api/pdf-exports/scheduled-reports/{id}/send-now - manual trigger"""
        # First create a report
        payload = {
            "report_type": "pnl",
            "frequency": "monthly",
            "email_recipients": ["test3@example.com"],
            "enabled": True,
            "day_of_month": 1,
            "time_of_day": "08:00"
        }
        create_resp = requests.post(f"{BASE_URL}/api/pdf-exports/scheduled-reports", headers=auth_headers, json=payload)
        assert create_resp.status_code == 200
        report_id = create_resp.json()["id"]

        # Send now (MOCKED - doesn't actually send email)
        response = requests.post(f"{BASE_URL}/api/pdf-exports/scheduled-reports/{report_id}/send-now", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "sent" in data.get("message", "").lower()
        print(f"✓ POST scheduled-reports/{report_id[:8]}/send-now: Triggered (MOCKED)")
        return report_id

    def test_delete_scheduled_report(self, auth_headers):
        """DELETE /api/pdf-exports/scheduled-reports/{id} - delete schedule"""
        # First create a report to delete
        payload = {
            "report_type": "sales",
            "frequency": "daily",
            "email_recipients": ["delete@example.com"],
            "enabled": True,
            "time_of_day": "07:00"
        }
        create_resp = requests.post(f"{BASE_URL}/api/pdf-exports/scheduled-reports", headers=auth_headers, json=payload)
        assert create_resp.status_code == 200
        report_id = create_resp.json()["id"]

        # Delete it
        response = requests.delete(f"{BASE_URL}/api/pdf-exports/scheduled-reports/{report_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ DELETE scheduled-reports/{report_id[:8]}: Deleted")


# =====================================================
# EMPLOYEE STATUS FILTER TESTS
# =====================================================
class TestEmployeeStatusFilter:
    """Test employee status filtering (Active/Left/All)"""

    def test_get_employees(self, auth_headers):
        """GET /api/employees - should return all employees with status field"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Count by status
        active_count = len([e for e in data if not e.get('status') or e.get('status') == 'active'])
        left_count = len([e for e in data if e.get('status') in ['left', 'terminated', 'resigned', 'on_notice']])
        
        print(f"✓ GET employees: Total={len(data)}, Active={active_count}, Left={left_count}")
        return data

    def test_employee_has_status_field(self, auth_headers):
        """Verify employees have status field for filtering"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            # Check that employees can have a status field
            emp = data[0]
            # Status may be null/undefined for active employees
            status = emp.get('status')
            valid_statuses = [None, '', 'active', 'left', 'terminated', 'resigned', 'on_notice']
            assert status in valid_statuses or status is None, f"Invalid status: {status}"
            print(f"✓ Employee status field verified: {status or 'active (default)'}")


# =====================================================
# CLEANUP TEST DATA
# =====================================================
class TestCleanup:
    """Clean up test data created during tests"""

    def test_cleanup_test_returns(self, auth_headers):
        """Clean up TEST_ prefixed supplier returns"""
        response = requests.get(f"{BASE_URL}/api/supplier-returns", headers=auth_headers)
        if response.status_code == 200:
            returns = response.json()
            deleted = 0
            for ret in returns:
                if "TEST_" in (ret.get("reason") or "") or "TEST_" in (ret.get("invoice_ref") or ""):
                    requests.delete(f"{BASE_URL}/api/supplier-returns/{ret['id']}", headers=auth_headers)
                    deleted += 1
            print(f"✓ Cleanup: Deleted {deleted} test supplier returns")

    def test_cleanup_test_scheduled_reports(self, auth_headers):
        """Clean up test scheduled reports"""
        response = requests.get(f"{BASE_URL}/api/pdf-exports/scheduled-reports", headers=auth_headers)
        if response.status_code == 200:
            reports = response.json()
            deleted = 0
            for report in reports:
                recipients = report.get("email_recipients", [])
                if any("test" in (r or "").lower() or "delete" in (r or "").lower() for r in recipients):
                    requests.delete(f"{BASE_URL}/api/pdf-exports/scheduled-reports/{report['id']}", headers=auth_headers)
                    deleted += 1
            print(f"✓ Cleanup: Deleted {deleted} test scheduled reports")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
