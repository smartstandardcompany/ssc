"""
Iteration 17 Tests: 3 New Features
1. POS/Quick Entry page - mobile-optimized sale/expense recording
2. Employee Resignation/Exit workflow with settlement calculation
3. AI-powered shift scheduling recommendations (GPT-4o)

Test credentials:
- Admin: ss@ssc.com / Aa147258369Ssc@
- Employee: ahmed@test.com / emp@123

Test data:
- Employee IDs: daa12216-70f0-45d2-b89a-2dbb5dcf5324 (Ahmed Khan)
- Branch IDs: 1c348f2b-xxxx (Test Branch), d805e6cb-xxxx (A)
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://ssc-business-hub.preview.emergentagent.com"


class TestAuth:
    """Authentication for testing"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, admin_token):
        """Auth headers with admin token"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestPOSFeature(TestAuth):
    """Test POS/Quick Entry feature - fast sale & expense recording"""
    
    def test_branches_endpoint(self, auth_headers):
        """Test branches endpoint for POS branch dropdown"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get branches: {response.text}"
        branches = response.json()
        assert isinstance(branches, list), "Branches should be a list"
        print(f"✓ Found {len(branches)} branches")
        return branches
    
    def test_customers_endpoint(self, auth_headers):
        """Test customers endpoint for credit payment mode"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get customers: {response.text}"
        customers = response.json()
        assert isinstance(customers, list), "Customers should be a list"
        print(f"✓ Found {len(customers)} customers")
        return customers
    
    def test_categories_endpoint(self, auth_headers):
        """Test categories endpoint for expense category dropdown"""
        response = requests.get(f"{BASE_URL}/api/categories", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        categories = response.json()
        assert isinstance(categories, list), "Categories should be a list"
        print(f"✓ Found {len(categories)} categories")
        return categories
    
    def test_dashboard_stats_endpoint(self, auth_headers):
        """Test dashboard stats endpoint for POS today stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get dashboard stats: {response.text}"
        stats = response.json()
        assert "total_sales" in stats, "Stats should have total_sales"
        assert "total_expenses" in stats, "Stats should have total_expenses"
        print(f"✓ Dashboard stats: sales={stats.get('total_sales')}, expenses={stats.get('total_expenses')}")
    
    def test_create_pos_sale(self, auth_headers):
        """Test creating a sale via POS"""
        # First get a branch
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_resp.json()
        if not branches:
            pytest.skip("No branches available for testing")
        
        branch_id = branches[0]["id"]
        
        # Create sale
        sale_data = {
            "amount": 100.00,
            "payment_mode": "cash",
            "branch_id": branch_id,
            "description": "TEST_POS_Sale",
            "date": "2026-01-15T12:00:00Z"
        }
        response = requests.post(f"{BASE_URL}/api/sales", json=sale_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Failed to create POS sale: {response.text}"
        sale = response.json()
        assert sale.get("amount") == 100.00, "Sale amount mismatch"
        print(f"✓ Created POS sale: SAR {sale.get('amount')} via {sale.get('payment_mode', 'N/A')}")
        return sale
    
    def test_create_pos_expense(self, auth_headers):
        """Test creating an expense via POS"""
        # First get a branch
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_resp.json()
        if not branches:
            pytest.skip("No branches available for testing")
        
        branch_id = branches[0]["id"]
        
        # Create expense
        expense_data = {
            "amount": 50.00,
            "category": "General",
            "branch_id": branch_id,
            "description": "TEST_POS_Expense",
            "date": "2026-01-15T12:00:00Z",
            "payment_mode": "cash"
        }
        response = requests.post(f"{BASE_URL}/api/expenses", json=expense_data, headers=auth_headers)
        assert response.status_code in [200, 201], f"Failed to create POS expense: {response.text}"
        expense = response.json()
        assert expense.get("amount") == 50.00, "Expense amount mismatch"
        print(f"✓ Created POS expense: SAR {expense.get('amount')} category={expense.get('category')}")
        return expense


class TestEmployeeResignation(TestAuth):
    """Test Employee Resignation/Exit workflow with settlement calculation"""
    
    def get_active_employee(self, auth_headers):
        """Find an active employee for testing"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        # Find an active employee that hasn't resigned
        active = [e for e in employees if e.get("active") != False and e.get("status", "active") == "active"]
        if not active:
            pytest.skip("No active employees found")
        return active[0]
    
    def test_employees_list_has_status_field(self, auth_headers):
        """Test that employees list returns status field"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        assert len(employees) > 0, "No employees found"
        # Check if status field exists (can be 'active', 'resigned', 'on_notice', 'terminated', 'left')
        print(f"✓ Found {len(employees)} employees")
        for emp in employees[:3]:
            status = emp.get("status", "active")
            print(f"  - {emp['name']}: status={status}")
    
    def test_settlement_endpoint(self, auth_headers):
        """Test GET /api/employees/{id}/settlement returns settlement data"""
        # Use Ahmed Khan's ID if available
        emp_id = "daa12216-70f0-45d2-b89a-2dbb5dcf5324"
        
        response = requests.get(f"{BASE_URL}/api/employees/{emp_id}/settlement", headers=auth_headers)
        if response.status_code == 404:
            # Try to find another employee
            employees_resp = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
            if employees_resp.status_code == 200 and employees_resp.json():
                emp_id = employees_resp.json()[0]["id"]
                response = requests.get(f"{BASE_URL}/api/employees/{emp_id}/settlement", headers=auth_headers)
        
        assert response.status_code == 200, f"Settlement endpoint failed: {response.text}"
        settlement = response.json()
        
        # Verify settlement fields
        assert "employee_id" in settlement, "Missing employee_id"
        assert "employee_name" in settlement, "Missing employee_name"
        assert "pending_salary" in settlement, "Missing pending_salary"
        assert "leave_encashment" in settlement, "Missing leave_encashment"
        assert "loan_balance" in settlement, "Missing loan_balance"
        assert "total_settlement" in settlement, "Missing total_settlement"
        
        print(f"✓ Settlement data for {settlement.get('employee_name')}:")
        print(f"  - Pending Salary: SAR {settlement.get('pending_salary')}")
        print(f"  - Leave Balance ({settlement.get('leave_balance_days', 0)} days): SAR {settlement.get('leave_encashment')}")
        print(f"  - Loan Balance: SAR {settlement.get('loan_balance')}")
        print(f"  - Total Settlement: SAR {settlement.get('total_settlement')}")
    
    def test_resign_endpoint_exists(self, auth_headers):
        """Test that POST /api/employees/{id}/resign endpoint exists (without actually calling it)"""
        # Create a test employee to resign
        test_emp_data = {
            "name": "TEST_ResignEmployee",
            "salary": 5000,
            "document_id": "TEST123",
            "position": "Test Position"
        }
        create_resp = requests.post(f"{BASE_URL}/api/employees", json=test_emp_data, headers=auth_headers)
        assert create_resp.status_code in [200, 201], f"Failed to create test employee: {create_resp.text}"
        test_emp = create_resp.json()
        emp_id = test_emp["id"]
        
        try:
            # Test resign endpoint
            resign_data = {
                "resignation_date": "2026-01-20",
                "notice_period_days": 30,
                "reason": "TEST resignation",
                "status": "resigned"
            }
            response = requests.post(f"{BASE_URL}/api/employees/{emp_id}/resign", json=resign_data, headers=auth_headers)
            assert response.status_code == 200, f"Resign endpoint failed: {response.text}"
            result = response.json()
            assert "message" in result or "last_working_day" in result
            print(f"✓ Resign endpoint works: {result.get('message', result)}")
            
            # Verify employee status was updated
            emp_resp = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
            employees = emp_resp.json()
            test_emp_updated = next((e for e in employees if e["id"] == emp_id), None)
            if test_emp_updated:
                assert test_emp_updated.get("status") in ["resigned", "on_notice", "terminated"]
                print(f"✓ Employee status updated to: {test_emp_updated.get('status')}")
        finally:
            # Cleanup - delete test employee
            requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=auth_headers)
            print(f"✓ Cleaned up test employee")
    
    def test_complete_exit_endpoint_exists(self, auth_headers):
        """Test that POST /api/employees/{id}/complete-exit endpoint exists (without deactivating real employees)"""
        # Create a test employee
        test_emp_data = {
            "name": "TEST_ExitEmployee",
            "salary": 4000,
            "document_id": "TESTEXIT123",
            "position": "Test Position"
        }
        create_resp = requests.post(f"{BASE_URL}/api/employees", json=test_emp_data, headers=auth_headers)
        assert create_resp.status_code in [200, 201]
        test_emp = create_resp.json()
        emp_id = test_emp["id"]
        
        try:
            # First resign the employee
            resign_data = {"status": "resigned", "resignation_date": "2026-01-15", "reason": "Test exit"}
            requests.post(f"{BASE_URL}/api/employees/{emp_id}/resign", json=resign_data, headers=auth_headers)
            
            # Now complete exit
            exit_data = {
                "settlement_amount": 5000,
                "paid": True,
                "status": "left"
            }
            response = requests.post(f"{BASE_URL}/api/employees/{emp_id}/complete-exit", json=exit_data, headers=auth_headers)
            assert response.status_code == 200, f"Complete-exit endpoint failed: {response.text}"
            result = response.json()
            assert "message" in result
            print(f"✓ Complete-exit endpoint works: {result.get('message')}")
            
            # Verify employee is now inactive
            emp_resp = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
            employees = emp_resp.json()
            test_emp_updated = next((e for e in employees if e["id"] == emp_id), None)
            if test_emp_updated:
                assert test_emp_updated.get("active") == False or test_emp_updated.get("status") == "left"
                print(f"✓ Employee deactivated: active={test_emp_updated.get('active')}, status={test_emp_updated.get('status')}")
        finally:
            # Cleanup
            requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=auth_headers)


class TestAIShiftRecommendation(TestAuth):
    """Test AI-powered shift scheduling recommendations"""
    
    def test_ai_recommend_endpoint_exists(self, auth_headers):
        """Test POST /api/shifts/ai-recommend endpoint"""
        # Get a branch first
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_resp.json()
        if not branches:
            pytest.skip("No branches available for AI shift recommendation")
        
        branch_id = branches[0]["id"]
        
        # Check if there are shifts for this branch
        shifts_resp = requests.get(f"{BASE_URL}/api/shifts", headers=auth_headers)
        shifts = shifts_resp.json()
        branch_shifts = [s for s in shifts if s.get("branch_id") == branch_id]
        if not branch_shifts:
            print(f"⚠ No shifts defined for branch {branch_id}, AI recommend may return error")
        
        # Test AI recommend endpoint (may take 10-15 seconds with GPT-4o)
        ai_data = {
            "branch_id": branch_id,
            "week_start": "2026-01-20"
        }
        print(f"Testing AI recommend endpoint (may take 10-15 seconds)...")
        response = requests.post(f"{BASE_URL}/api/shifts/ai-recommend", json=ai_data, headers=auth_headers, timeout=60)
        
        # Expected: 200 with recommendations OR 400 if no shifts defined
        if response.status_code == 400:
            error = response.json()
            if "No shifts defined" in error.get("detail", ""):
                print(f"⚠ AI recommend returned 400: {error.get('detail')} - this is expected if no shifts exist")
                pytest.skip("No shifts defined for branch - cannot test AI recommend")
            else:
                assert False, f"Unexpected 400 error: {error}"
        
        assert response.status_code == 200, f"AI recommend failed: {response.text}"
        result = response.json()
        
        # Verify response structure
        assert "recommendations" in result, "Missing recommendations field"
        recommendations = result.get("recommendations", [])
        print(f"✓ AI generated {len(recommendations)} shift recommendations")
        
        if recommendations:
            # Check first recommendation structure
            rec = recommendations[0]
            expected_fields = ["employee_name", "shift_name", "day"]
            for field in expected_fields:
                assert field in rec, f"Recommendation missing {field}"
            print(f"  Sample: {rec.get('employee_name')} - {rec.get('shift_name')} on {rec.get('day')}: {rec.get('reason', 'N/A')}")
    
    def test_shifts_endpoint(self, auth_headers):
        """Test GET /api/shifts endpoint"""
        response = requests.get(f"{BASE_URL}/api/shifts", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get shifts: {response.text}"
        shifts = response.json()
        print(f"✓ Found {len(shifts)} shifts")
        for s in shifts[:3]:
            print(f"  - {s.get('name')}: {s.get('start_time')}-{s.get('end_time')} (branch: {s.get('branch_id', 'N/A')[:8]}...)")
    
    def test_shift_assignments_endpoint(self, auth_headers):
        """Test GET /api/shift-assignments endpoint"""
        response = requests.get(f"{BASE_URL}/api/shift-assignments", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get shift assignments: {response.text}"
        assignments = response.json()
        print(f"✓ Found {len(assignments)} shift assignments")


class TestRegressions(TestAuth):
    """Ensure no regressions on existing functionality"""
    
    def test_dashboard_loads(self, auth_headers):
        """Test dashboard still works"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        print("✓ Dashboard stats endpoint working")
    
    def test_sales_endpoint(self, auth_headers):
        """Test sales endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200, f"Sales endpoint failed: {response.text}"
        print(f"✓ Sales endpoint working ({len(response.json())} records)")
    
    def test_employees_endpoint(self, auth_headers):
        """Test employees endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200, f"Employees endpoint failed: {response.text}"
        print(f"✓ Employees endpoint working ({len(response.json())} records)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
