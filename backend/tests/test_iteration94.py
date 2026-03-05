"""
Iteration 94 Backend Tests
- Customer CLV prediction endpoint (was returning 500)
- Pagination for cash-transfers, invoices, and fines endpoints
- Employee offboarding buttons already verified in iteration 93
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication for testing"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}


class TestCustomerCLVPrediction(TestAuth):
    """Test Customer CLV prediction endpoint - was returning 500 before fix"""
    
    def test_customer_clv_returns_200(self, auth_headers):
        """Bug fix verification: /api/predictions/customer-clv should return 200"""
        response = requests.get(f"{BASE_URL}/api/predictions/customer-clv", headers=auth_headers)
        print(f"Customer CLV response status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "customers" in data, "Missing 'customers' field in response"
        assert "total_customers" in data, "Missing 'total_customers' field"
        assert "total_projected_revenue" in data, "Missing 'total_projected_revenue' field"
        assert "segments" in data, "Missing 'segments' field"
        print(f"Customer CLV: {data['total_customers']} customers, projected revenue: {data['total_projected_revenue']}")
        print("SUCCESS: Customer CLV endpoint returns 200 (bug fixed)")


class TestCashTransfersPagination(TestAuth):
    """Test cash-transfers pagination format"""
    
    def test_cash_transfers_returns_paginated(self, auth_headers):
        """Verify /api/cash-transfers returns paginated format {data, total, page, limit, pages}"""
        response = requests.get(f"{BASE_URL}/api/cash-transfers", headers=auth_headers)
        print(f"Cash Transfers response status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify paginated structure
        assert "data" in data, "Missing 'data' field - should return paginated format"
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        assert "limit" in data, "Missing 'limit' field"
        assert "pages" in data, "Missing 'pages' field"
        
        # Verify data is a list
        assert isinstance(data["data"], list), "'data' should be a list"
        print(f"Cash Transfers: {data['total']} total, page {data['page']}/{data['pages']}, {len(data['data'])} items returned")
        print("SUCCESS: Cash Transfers returns paginated format")
    
    def test_cash_transfers_page_param(self, auth_headers):
        """Verify pagination params work"""
        response = requests.get(f"{BASE_URL}/api/cash-transfers?page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10
        print("SUCCESS: Cash Transfers pagination params work")


class TestInvoicesPagination(TestAuth):
    """Test invoices pagination format"""
    
    def test_invoices_returns_paginated(self, auth_headers):
        """Verify /api/invoices returns paginated format {data, total, page, limit, pages}"""
        response = requests.get(f"{BASE_URL}/api/invoices", headers=auth_headers)
        print(f"Invoices response status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify paginated structure
        assert "data" in data, "Missing 'data' field - should return paginated format"
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        assert "limit" in data, "Missing 'limit' field"
        assert "pages" in data, "Missing 'pages' field"
        
        # Verify data is a list
        assert isinstance(data["data"], list), "'data' should be a list"
        print(f"Invoices: {data['total']} total, page {data['page']}/{data['pages']}, {len(data['data'])} items returned")
        print("SUCCESS: Invoices returns paginated format")
    
    def test_invoices_page_param(self, auth_headers):
        """Verify pagination params work"""
        response = requests.get(f"{BASE_URL}/api/invoices?page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10
        print("SUCCESS: Invoices pagination params work")


class TestFinesPagination(TestAuth):
    """Test fines pagination format"""
    
    def test_fines_returns_paginated(self, auth_headers):
        """Verify /api/fines returns paginated format {data, total, page, limit, pages}"""
        response = requests.get(f"{BASE_URL}/api/fines", headers=auth_headers)
        print(f"Fines response status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify paginated structure
        assert "data" in data, "Missing 'data' field - should return paginated format"
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        assert "limit" in data, "Missing 'limit' field"
        assert "pages" in data, "Missing 'pages' field"
        
        # Verify data is a list
        assert isinstance(data["data"], list), "'data' should be a list"
        print(f"Fines: {data['total']} total, page {data['page']}/{data['pages']}, {len(data['data'])} items returned")
        print("SUCCESS: Fines returns paginated format")
    
    def test_fines_page_param(self, auth_headers):
        """Verify pagination params work"""
        response = requests.get(f"{BASE_URL}/api/fines?page=1&limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 10
        print("SUCCESS: Fines pagination params work")


class TestEmployeeOffboardingButtons(TestAuth):
    """Verify employee offboarding features - buttons should be visible"""
    
    def test_get_employees(self, auth_headers):
        """Get employees list to verify data is available"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        print(f"Found {len(employees)} employees")
        
        # Check for active/left employees
        active = [e for e in employees if not e.get("status") or e.get("status") == "active"]
        left = [e for e in employees if e.get("status") in ["left", "terminated", "resigned", "end_of_contract"]]
        on_notice = [e for e in employees if e.get("status") in ["resigned", "on_notice", "terminated", "end_of_contract"]]
        
        print(f"Active employees (should show Exit button): {len(active)}")
        print(f"Left employees (should show Review button): {len(left)}")
        print(f"On notice/terminated (should show Settlement button): {len(on_notice)}")
        
        return employees
    
    def test_settlement_endpoint_exists(self, auth_headers):
        """Verify settlement endpoint works for testing"""
        # Get an employee with status that would show settlement
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        employees = response.json()
        
        # Find any employee to test settlement endpoint
        test_emp = None
        for emp in employees:
            if emp.get("status") in ["resigned", "terminated", "end_of_contract", "left"]:
                test_emp = emp
                break
        
        if test_emp:
            settlement_response = requests.get(f"{BASE_URL}/api/employees/{test_emp['id']}/settlement", headers=auth_headers)
            assert settlement_response.status_code == 200, f"Settlement endpoint failed: {settlement_response.text}"
            settlement = settlement_response.json()
            print(f"Settlement for {test_emp['name']}: {settlement.get('total_settlement', 'N/A')}")
        else:
            print("No employees with settlement status found - skipping settlement endpoint test")
            pytest.skip("No employees with settlement status")
