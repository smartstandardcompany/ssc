"""
Test Iteration 85: End-of-Service Benefits, SMTP Email Integration, Zustand Migration

Features tested:
1. GET /api/employees/{emp_id}/settlement - End of Service Benefits calculation (Saudi labor law)
2. POST /api/pdf-exports/scheduled-reports/{id}/send-now - PDF generation + email attempt
3. GET /api/pdf-exports/scheduled-reports - List scheduled reports
4. GET /api/dashboard/stats - Regression test for dashboard totals
5. GET /api/branches - Used by Zustand branchStore
"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://ssc-track.preview.emergentagent.com"


class TestAuth:
    """Authentication for test suite"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestEndOfServiceBenefits(TestAuth):
    """Test End-of-Service benefits calculation (Saudi labor law)"""
    
    def test_get_employees_list(self, auth_headers):
        """GET /api/employees - Should return employee list"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        assert len(employees) > 0, "Need at least one employee for testing"
        print(f"✓ Found {len(employees)} employees")
        return employees
    
    def test_settlement_endpoint_structure(self, auth_headers):
        """GET /api/employees/{emp_id}/settlement - Should return EOS calculation"""
        # First get an employee
        employees = self.test_get_employees_list(auth_headers)
        emp = employees[0]
        emp_id = emp["id"]
        
        response = requests.get(f"{BASE_URL}/api/employees/{emp_id}/settlement", headers=auth_headers)
        assert response.status_code == 200, f"Settlement endpoint failed: {response.text}"
        
        settlement = response.json()
        print(f"✓ Settlement for {settlement.get('employee_name')}")
        
        # Verify required fields
        required_fields = [
            "employee_id", "employee_name", "status", "monthly_salary",
            "join_date", "end_date", "service_years", "service_months",
            "service_days", "end_of_service_benefit", "eos_calculation_type",
            "pending_salary", "leave_balance_days", "leave_encashment",
            "loan_balance", "total_settlement", "breakdown"
        ]
        
        for field in required_fields:
            assert field in settlement, f"Missing field: {field}"
        
        # Verify breakdown structure
        breakdown = settlement["breakdown"]
        assert "pending_salary" in breakdown
        assert "leave_encashment" in breakdown
        assert "end_of_service" in breakdown
        assert "loan_deduction" in breakdown
        assert "total" in breakdown
        
        # Verify eos_calculation_type is valid
        assert settlement["eos_calculation_type"] in ["resignation", "termination"], \
            f"Invalid eos_calculation_type: {settlement['eos_calculation_type']}"
        
        print(f"  Service years: {settlement['service_years']}")
        print(f"  EOS type: {settlement['eos_calculation_type']}")
        print(f"  EOS benefit: SAR {settlement['end_of_service_benefit']}")
        print(f"  Total settlement: SAR {settlement['total_settlement']}")
        
        return settlement
    
    def test_settlement_calculation_logic(self, auth_headers):
        """Verify EOS calculation follows Saudi labor law"""
        employees = self.test_get_employees_list(auth_headers)
        emp = employees[0]
        
        response = requests.get(f"{BASE_URL}/api/employees/{emp['id']}/settlement", headers=auth_headers)
        assert response.status_code == 200
        
        settlement = response.json()
        service_years = settlement["service_years"]
        monthly_salary = settlement["monthly_salary"]
        eos_type = settlement["eos_calculation_type"]
        eos_amount = settlement["end_of_service_benefit"]
        
        # Validate the EOS amount is non-negative
        assert eos_amount >= 0, "EOS benefit should not be negative"
        
        # For resignation with < 2 years service, EOS should be 0
        if eos_type == "resignation" and service_years < 2:
            assert eos_amount == 0, f"EOS should be 0 for resignation < 2 years, got {eos_amount}"
            print("✓ EOS correctly 0 for short service resignation")
        
        # Verify total settlement calculation
        breakdown = settlement["breakdown"]
        expected_total = (
            breakdown["pending_salary"] +
            breakdown["leave_encashment"] +
            breakdown["end_of_service"] +
            breakdown["loan_deduction"]  # This is negative
        )
        
        # Allow small floating point difference
        assert abs(breakdown["total"] - expected_total) < 0.01, \
            f"Total mismatch: {breakdown['total']} vs {expected_total}"
        
        print(f"✓ Settlement calculation verified")


class TestScheduledReportsAndEmail(TestAuth):
    """Test PDF export scheduled reports and email sending"""
    
    def test_list_scheduled_reports(self, auth_headers):
        """GET /api/pdf-exports/scheduled-reports - Should list reports"""
        response = requests.get(f"{BASE_URL}/api/pdf-exports/scheduled-reports", headers=auth_headers)
        assert response.status_code == 200
        reports = response.json()
        assert isinstance(reports, list)
        print(f"✓ Found {len(reports)} scheduled reports")
        return reports
    
    def test_create_and_send_scheduled_report(self, auth_headers):
        """POST /api/pdf-exports/scheduled-reports and send-now"""
        # Create a test scheduled report
        test_report = {
            "report_type": "sales",
            "frequency": "daily",
            "email_recipients": ["test@example.com"],
            "enabled": True,
            "time_of_day": "09:00"
        }
        
        # Create the report
        create_response = requests.post(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports",
            headers=auth_headers,
            json=test_report
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        
        created = create_response.json()
        report_id = created.get("id")
        assert report_id, "No ID returned for created report"
        print(f"✓ Created scheduled report: {report_id}")
        
        # Test send-now (PDF generation should work, email may fail due to M365 auth)
        send_response = requests.post(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports/{report_id}/send-now",
            headers=auth_headers
        )
        assert send_response.status_code == 200, f"Send-now failed: {send_response.text}"
        
        send_result = send_response.json()
        print(f"✓ Send-now result: {send_result}")
        
        # The status should indicate PDF was generated (email delivery may fail)
        assert "message" in send_result
        assert "status" in send_result
        # Possible statuses: "sent", "email_failed", "error"
        assert send_result["status"] in ["sent", "email_failed"], \
            f"Unexpected status: {send_result['status']}"
        
        if send_result["status"] == "email_failed":
            print("  Note: Email delivery failed (expected - M365 auth needs SMTP AUTH enabled)")
        else:
            print("  Email sent successfully!")
        
        # Cleanup - delete the test report
        delete_response = requests.delete(
            f"{BASE_URL}/api/pdf-exports/scheduled-reports/{report_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200
        print(f"✓ Cleaned up test report")
        
        return send_result


class TestDashboardRegression(TestAuth):
    """Regression test for dashboard stats"""
    
    def test_dashboard_stats(self, auth_headers):
        """GET /api/dashboard/stats - Should return correct totals"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        
        stats = response.json()
        print(f"✓ Dashboard stats loaded")
        
        # Verify required fields
        assert "total_sales" in stats
        assert "total_expenses" in stats
        assert "net_profit" in stats
        
        print(f"  Total sales: SAR {stats.get('total_sales', 0)}")
        print(f"  Total expenses: SAR {stats.get('total_expenses', 0)}")
        print(f"  Net profit: SAR {stats.get('net_profit', 0)}")
        
        return stats


class TestZustandBranchStore(TestAuth):
    """Test branch API used by Zustand store"""
    
    def test_branches_endpoint(self, auth_headers):
        """GET /api/branches - Central data for Zustand branchStore"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200
        
        branches = response.json()
        assert isinstance(branches, list)
        print(f"✓ Found {len(branches)} branches for Zustand store")
        
        if branches:
            # Verify branch structure
            branch = branches[0]
            assert "id" in branch
            assert "name" in branch
            print(f"  Branch: {branch['name']} (id: {branch['id']})")
        
        return branches


class TestZustandMigratedPages(TestAuth):
    """Test pages that were migrated to use Zustand branchStore"""
    
    def test_sales_endpoint(self, auth_headers):
        """GET /api/sales - Used by SalesPage (paginated response)"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200
        result = response.json()
        # Sales returns paginated response with 'data' field
        if isinstance(result, dict) and "data" in result:
            sales = result["data"]
            total = result.get("total", len(sales))
        else:
            sales = result
            total = len(sales)
        assert isinstance(sales, list)
        print(f"✓ Sales page data: {total} records")
    
    def test_expenses_endpoint(self, auth_headers):
        """GET /api/expenses - Used by ExpensesPage (paginated response)"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=auth_headers)
        assert response.status_code == 200
        result = response.json()
        # Expenses returns paginated response with 'data' field
        if isinstance(result, dict) and "data" in result:
            expenses = result["data"]
            total = result.get("total", len(expenses))
        else:
            expenses = result
            total = len(expenses)
        assert isinstance(expenses, list)
        print(f"✓ Expenses page data: {total} records")
    
    def test_supplier_payments_endpoint(self, auth_headers):
        """GET /api/supplier-payments - Used by SupplierPaymentsPage"""
        response = requests.get(f"{BASE_URL}/api/supplier-payments", headers=auth_headers)
        assert response.status_code == 200
        payments = response.json()
        assert isinstance(payments, list)
        print(f"✓ Supplier payments page data: {len(payments)} records")
    
    def test_invoices_endpoint(self, auth_headers):
        """GET /api/invoices - Used by InvoicesPage"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        assert response.status_code == 200
        invoices = response.json()
        assert isinstance(invoices, list)
        print(f"✓ Invoices page data: {len(invoices)} records")
    
    def test_stock_endpoint(self, auth_headers):
        """GET /api/items - Used by StockPage for items data"""
        response = requests.get(f"{BASE_URL}/api/items", headers=auth_headers)
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        print(f"✓ Stock page (items) data: {len(items)} records")
    
    def test_stock_balance_endpoint(self, auth_headers):
        """GET /api/stock/balance - Used by StockPage for balance"""
        response = requests.get(f"{BASE_URL}/api/stock/balance", headers=auth_headers)
        assert response.status_code == 200
        balance = response.json()
        assert isinstance(balance, list)
        print(f"✓ Stock balance data: {len(balance)} records")
    
    def test_cash_transfers_endpoint(self, auth_headers):
        """GET /api/cash-transfers - Used by TransfersPage"""
        response = requests.get(f"{BASE_URL}/api/cash-transfers", headers=auth_headers)
        assert response.status_code == 200
        transfers = response.json()
        assert isinstance(transfers, list)
        print(f"✓ Cash transfers page data: {len(transfers)} records")
    
    def test_fines_endpoint(self, auth_headers):
        """GET /api/fines - Used by FinesPage"""
        response = requests.get(f"{BASE_URL}/api/fines", headers=auth_headers)
        assert response.status_code == 200
        fines = response.json()
        assert isinstance(fines, list)
        print(f"✓ Fines page data: {len(fines)} records")


class TestEmployeeStatusFilter(TestAuth):
    """Test employee status filtering"""
    
    def test_employees_have_status_field(self, auth_headers):
        """Verify employees have status field for filtering"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Check that status field exists (can be null for active)
        for emp in employees:
            # status is optional - active employees may not have it
            status = emp.get("status", "active")
            assert status in ["active", "resigned", "terminated", "left", "on_notice", None]
        
        # Count by status
        active = sum(1 for e in employees if not e.get("status") or e.get("status") == "active")
        left = sum(1 for e in employees if e.get("status") in ["left", "terminated", "resigned", "on_notice"])
        
        print(f"✓ Employee status filter: {active} active, {left} left/terminated")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
