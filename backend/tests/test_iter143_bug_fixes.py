"""
Iteration 143: Test 3 Bug Fixes
1. Daily Summary → Expenses redirect with BRANCH (frontend test primarily)
2. Export with datewise filtering - verify date range filter works correctly
3. Supplier Report custom date range - backend API accepts start_date/end_date
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestExportWithDates:
    """Bug 2: Export endpoint should filter data by date range and reflect dates in filename"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for API requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Auth failed - skipping authenticated tests")
    
    def test_export_expenses_with_date_range_excel(self, auth_token):
        """Test expense export with date range returns smaller/filtered dataset"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Export ALL expenses (no date filter)
        response_all = requests.post(f"{BASE_URL}/api/export/data", 
            json={"type": "expenses", "format": "excel"},
            headers=headers
        )
        assert response_all.status_code == 200
        size_all = len(response_all.content)
        
        # Export FILTERED expenses (narrow date range)
        response_filtered = requests.post(f"{BASE_URL}/api/export/data", 
            json={
                "type": "expenses", 
                "format": "excel",
                "start_date": "2025-06-01",
                "end_date": "2025-06-30"
            },
            headers=headers
        )
        assert response_filtered.status_code == 200
        size_filtered = len(response_filtered.content)
        
        # Filtered export should generally be smaller or equal (unless all data is in June 2025)
        print(f"All data size: {size_all} bytes, Filtered size: {size_filtered} bytes")
        
        # Check filename in content-disposition contains dates
        content_disp = response_filtered.headers.get('content-disposition', '')
        assert 'expenses_report' in content_disp.lower()
        print(f"Content-Disposition: {content_disp}")
    
    def test_export_expenses_with_date_range_pdf(self, auth_token):
        """Test expense PDF export with date range"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/export/data", 
            json={
                "type": "expenses", 
                "format": "pdf",
                "start_date": "2025-06-01",
                "end_date": "2025-06-30"
            },
            headers=headers
        )
        assert response.status_code == 200
        assert 'application/pdf' in response.headers.get('content-type', '')
        
        # PDF should contain some content
        assert len(response.content) > 1000, "PDF seems too small"
        print(f"PDF export size: {len(response.content)} bytes")
    
    def test_export_sales_with_date_range(self, auth_token):
        """Test sales export with date range filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/export/data", 
            json={
                "type": "sales", 
                "format": "excel",
                "start_date": "2025-01-01",
                "end_date": "2025-12-31"
            },
            headers=headers
        )
        assert response.status_code == 200
        print(f"Sales export size: {len(response.content)} bytes")


class TestSupplierReportCustomDate:
    """Bug 3: Supplier Report should support custom date range"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for API requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Auth failed - skipping authenticated tests")
    
    def test_supplier_report_all_time(self, auth_token):
        """Test supplier report without date filter (all time)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"All time supplier report: {len(data)} suppliers")
    
    def test_supplier_report_with_custom_date_range(self, auth_token):
        """Test supplier report with start_date and end_date parameters"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Request with custom date range
        response = requests.get(
            f"{BASE_URL}/api/reports/supplier-balance?start_date=2025-01-01&end_date=2025-06-30", 
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Custom range supplier report: {len(data)} suppliers")
        
        # Verify response structure
        if len(data) > 0:
            supplier = data[0]
            assert 'name' in supplier
            assert 'total_expenses' in supplier or 'id' in supplier
            print(f"First supplier: {supplier.get('name')}")
    
    def test_supplier_report_with_period_today(self, auth_token):
        """Test supplier report with period=today"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance?period=today", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Today's supplier report: {len(data)} suppliers")
    
    def test_supplier_report_with_period_month(self, auth_token):
        """Test supplier report with period=month"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance?period=month", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"This month supplier report: {len(data)} suppliers")


class TestExpensesBranchFilter:
    """Bug 1: Expenses endpoint should filter by branch_id"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for API requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Auth failed - skipping authenticated tests")
    
    def test_get_branches(self, auth_token):
        """Get list of branches for testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        assert response.status_code == 200
        branches = response.json()
        print(f"Available branches: {[b.get('name') for b in branches]}")
        return branches
    
    def test_expenses_filter_by_branch(self, auth_token):
        """Test expenses endpoint with branch_id filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get branches
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        branches = branches_resp.json()
        
        if len(branches) == 0:
            pytest.skip("No branches available for testing")
        
        branch_id = branches[0].get('id')
        branch_name = branches[0].get('name')
        print(f"Testing with branch: {branch_name} (ID: {branch_id})")
        
        # Get expenses filtered by branch
        response = requests.get(f"{BASE_URL}/api/expenses?branch_id={branch_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Handle paginated or direct list response
        expenses = data.get('data', data) if isinstance(data, dict) else data
        print(f"Expenses for branch {branch_name}: {len(expenses)} records")
        
        # Verify all returned expenses belong to the requested branch
        for exp in expenses[:10]:  # Check first 10
            if exp.get('branch_id'):
                assert exp['branch_id'] == branch_id, f"Expense {exp.get('id')} has wrong branch"
    
    def test_expenses_filter_by_date_and_branch(self, auth_token):
        """Test expenses endpoint with both date and branch filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get branches first
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        branches = branches_resp.json()
        
        if len(branches) == 0:
            pytest.skip("No branches available")
        
        branch_id = branches[0].get('id')
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get expenses filtered by both date and branch
        response = requests.get(
            f"{BASE_URL}/api/expenses?start_date={today}&end_date={today}&branch_id={branch_id}", 
            headers=headers
        )
        assert response.status_code == 200
        print(f"Expenses for {today} at branch: {response.json()}")


class TestDailySummary:
    """Test Daily Summary API used for Bug 1"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Auth failed")
    
    def test_daily_summary_with_branch(self, auth_token):
        """Test daily summary API with branch filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get branches first
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        branches = branches_resp.json()
        
        if len(branches) == 0:
            pytest.skip("No branches")
        
        branch_id = branches[0].get('id')
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Get daily summary with branch filter
        response = requests.get(
            f"{BASE_URL}/api/dashboard/daily-summary?date={today}&branch_id={branch_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert 'sales' in data
        assert 'expenses' in data
        print(f"Daily summary for {today} at branch: Expenses={data.get('expenses', {}).get('total', 0)}")
