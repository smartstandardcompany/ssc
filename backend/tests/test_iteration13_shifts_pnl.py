"""
Iteration 13 Tests: Staff Schedule/Shifts and Item P&L Report
Tests:
1. Shifts CRUD endpoints (GET, POST, PUT, DELETE)
2. Shift Assignments (create, bulk create, update with time tracking)
3. Attendance Summary endpoint
4. Item P&L Report endpoint
5. Backend refactoring verification (existing APIs still work)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Login and get auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "SSC@SSC.com",
        "password": "Aa147258369SsC@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data
    return data["access_token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Auth headers for requests"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }

@pytest.fixture(scope="module")
def branch_with_employees(auth_headers):
    """Get or create a branch with employees (use 'A' branch)"""
    # Get branches
    resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
    assert resp.status_code == 200
    branches = resp.json()
    
    # Find 'A' branch or first branch
    branch_a = next((b for b in branches if b['name'] == 'A'), branches[0] if branches else None)
    
    if not branch_a:
        # Create a branch
        resp = requests.post(f"{BASE_URL}/api/branches", headers=auth_headers, json={"name": "Test Branch A", "location": "Test Location"})
        assert resp.status_code == 200
        branch_a = resp.json()
    
    # Check for employees in this branch
    resp = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
    assert resp.status_code == 200
    employees = resp.json()
    branch_employees = [e for e in employees if e.get('branch_id') == branch_a['id'] and e.get('active', True)]
    
    return {"branch": branch_a, "employees": branch_employees}


# ============== Backend Refactoring Verification ==============
class TestBackendRefactoring:
    """Verify existing APIs still work after refactoring"""
    
    def test_login_endpoint(self, auth_headers):
        """Auth login should work"""
        # Already tested via fixture, just verify token works
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        user = resp.json()
        assert "email" in user
        assert "role" in user
    
    def test_branches_endpoint(self, auth_headers):
        """Branches CRUD should work"""
        resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        assert resp.status_code == 200
        branches = resp.json()
        assert isinstance(branches, list)
    
    def test_employees_endpoint(self, auth_headers):
        """Employees endpoint should work"""
        resp = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert resp.status_code == 200
        employees = resp.json()
        assert isinstance(employees, list)
    
    def test_stock_endpoints(self, auth_headers):
        """Stock endpoints should work"""
        resp = requests.get(f"{BASE_URL}/api/stock", headers=auth_headers)
        assert resp.status_code == 200


# ============== Shifts CRUD Tests ==============
class TestShiftsCRUD:
    """Test Shift CRUD endpoints"""
    
    created_shift_id = None
    
    def test_get_shifts_empty_or_list(self, auth_headers):
        """GET /shifts should return list"""
        resp = requests.get(f"{BASE_URL}/api/shifts", headers=auth_headers)
        assert resp.status_code == 200
        shifts = resp.json()
        assert isinstance(shifts, list)
    
    def test_create_shift_morning(self, auth_headers, branch_with_employees):
        """POST /shifts - create Morning shift"""
        branch = branch_with_employees["branch"]
        resp = requests.post(f"{BASE_URL}/api/shifts", headers=auth_headers, json={
            "name": "TEST_Morning",
            "branch_id": branch["id"],
            "start_time": "08:00",
            "end_time": "16:00",
            "break_minutes": 60,
            "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            "color": "#F5841F"
        })
        assert resp.status_code == 200, f"Create shift failed: {resp.text}"
        shift = resp.json()
        assert shift["name"] == "TEST_Morning"
        assert shift["start_time"] == "08:00"
        assert shift["end_time"] == "16:00"
        assert "id" in shift
        TestShiftsCRUD.created_shift_id = shift["id"]
    
    def test_create_shift_evening(self, auth_headers, branch_with_employees):
        """POST /shifts - create Evening shift"""
        branch = branch_with_employees["branch"]
        resp = requests.post(f"{BASE_URL}/api/shifts", headers=auth_headers, json={
            "name": "TEST_Evening",
            "branch_id": branch["id"],
            "start_time": "16:00",
            "end_time": "00:00",
            "break_minutes": 30,
            "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "color": "#3B82F6"
        })
        assert resp.status_code == 200, f"Create shift failed: {resp.text}"
        shift = resp.json()
        assert shift["name"] == "TEST_Evening"
        assert shift["start_time"] == "16:00"
    
    def test_get_shifts_by_branch(self, auth_headers, branch_with_employees):
        """GET /shifts?branch_id=X - filter by branch"""
        branch = branch_with_employees["branch"]
        resp = requests.get(f"{BASE_URL}/api/shifts?branch_id={branch['id']}", headers=auth_headers)
        assert resp.status_code == 200
        shifts = resp.json()
        assert isinstance(shifts, list)
        # Should have our created shifts
        test_shifts = [s for s in shifts if s["name"].startswith("TEST_")]
        assert len(test_shifts) >= 2
    
    def test_update_shift(self, auth_headers):
        """PUT /shifts/{id} - update shift"""
        if not TestShiftsCRUD.created_shift_id:
            pytest.skip("No shift created to update")
        
        resp = requests.put(f"{BASE_URL}/api/shifts/{TestShiftsCRUD.created_shift_id}", headers=auth_headers, json={
            "name": "TEST_Morning_Updated",
            "break_minutes": 45
        })
        assert resp.status_code == 200
        shift = resp.json()
        assert shift["name"] == "TEST_Morning_Updated"
        assert shift["break_minutes"] == 45


# ============== Shift Assignments Tests ==============
class TestShiftAssignments:
    """Test Shift Assignment endpoints"""
    
    assignment_id = None
    
    def test_get_assignments_empty(self, auth_headers, branch_with_employees):
        """GET /shift-assignments should return list"""
        branch = branch_with_employees["branch"]
        # Get current week start (Monday)
        today = datetime.now()
        days_since_monday = today.weekday()
        monday = today - timedelta(days=days_since_monday)
        week_start = monday.strftime("%Y-%m-%d")
        
        resp = requests.get(f"{BASE_URL}/api/shift-assignments?branch_id={branch['id']}&week_start={week_start}", headers=auth_headers)
        assert resp.status_code == 200
        assignments = resp.json()
        assert isinstance(assignments, list)
    
    def test_create_assignment(self, auth_headers, branch_with_employees):
        """POST /shift-assignments - assign employee to shift"""
        branch = branch_with_employees["branch"]
        employees = branch_with_employees["employees"]
        
        if not employees:
            pytest.skip("No employees in branch to assign")
        
        # Get shifts for this branch
        resp = requests.get(f"{BASE_URL}/api/shifts?branch_id={branch['id']}", headers=auth_headers)
        shifts = resp.json()
        test_shifts = [s for s in shifts if s["name"].startswith("TEST_")]
        
        if not test_shifts:
            pytest.skip("No test shifts created")
        
        employee = employees[0]
        shift = test_shifts[0]
        today = datetime.now()
        days_since_monday = today.weekday()
        monday = today - timedelta(days=days_since_monday)
        week_start = monday.strftime("%Y-%m-%d")
        assign_date = (monday + timedelta(days=1)).strftime("%Y-%m-%d")  # Tuesday
        
        resp = requests.post(f"{BASE_URL}/api/shift-assignments", headers=auth_headers, json={
            "employee_id": employee["id"],
            "shift_id": shift["id"],
            "branch_id": branch["id"],
            "week_start": week_start,
            "date": assign_date
        })
        assert resp.status_code == 200, f"Create assignment failed: {resp.text}"
        assignment = resp.json()
        assert assignment["employee_id"] == employee["id"]
        assert assignment["shift_id"] == shift["id"]
        assert "id" in assignment
        TestShiftAssignments.assignment_id = assignment["id"]
    
    def test_bulk_assignments(self, auth_headers, branch_with_employees):
        """POST /shift-assignments/bulk - create multiple assignments"""
        branch = branch_with_employees["branch"]
        employees = branch_with_employees["employees"]
        
        if not employees:
            pytest.skip("No employees in branch")
        
        resp = requests.get(f"{BASE_URL}/api/shifts?branch_id={branch['id']}", headers=auth_headers)
        shifts = resp.json()
        test_shifts = [s for s in shifts if s["name"].startswith("TEST_")]
        
        if not test_shifts:
            pytest.skip("No test shifts")
        
        employee = employees[0]
        shift = test_shifts[0]
        today = datetime.now()
        days_since_monday = today.weekday()
        monday = today - timedelta(days=days_since_monday)
        week_start = monday.strftime("%Y-%m-%d")
        
        assignments = []
        for i in range(3, 6):  # Wed, Thu, Fri
            date = (monday + timedelta(days=i)).strftime("%Y-%m-%d")
            assignments.append({
                "employee_id": employee["id"],
                "shift_id": shift["id"],
                "branch_id": branch["id"],
                "week_start": week_start,
                "date": date
            })
        
        resp = requests.post(f"{BASE_URL}/api/shift-assignments/bulk", headers=auth_headers, json={
            "assignments": assignments
        })
        assert resp.status_code == 200
        result = resp.json()
        assert "created" in result
    
    def test_update_assignment_time_in_out(self, auth_headers):
        """PUT /shift-assignments/{id} - record actual time in/out"""
        if not TestShiftAssignments.assignment_id:
            pytest.skip("No assignment to update")
        
        resp = requests.put(f"{BASE_URL}/api/shift-assignments/{TestShiftAssignments.assignment_id}", headers=auth_headers, json={
            "actual_in": "08:05",
            "actual_out": "16:10"
        })
        assert resp.status_code == 200
        assignment = resp.json()
        assert assignment["actual_in"] == "08:05"
        assert assignment["actual_out"] == "16:10"
        # Should have auto-calculated status
        assert assignment["status"] in ["present", "late"]
    
    def test_update_assignment_late(self, auth_headers, branch_with_employees):
        """PUT /shift-assignments/{id} - late status when >15 min after shift start"""
        branch = branch_with_employees["branch"]
        employees = branch_with_employees["employees"]
        
        if not employees:
            pytest.skip("No employees")
        
        resp = requests.get(f"{BASE_URL}/api/shifts?branch_id={branch['id']}", headers=auth_headers)
        shifts = resp.json()
        test_shifts = [s for s in shifts if s["name"].startswith("TEST_")]
        
        if not test_shifts:
            pytest.skip("No test shifts")
        
        employee = employees[0]
        shift = test_shifts[0]
        today = datetime.now()
        days_since_monday = today.weekday()
        monday = today - timedelta(days=days_since_monday)
        week_start = monday.strftime("%Y-%m-%d")
        assign_date = monday.strftime("%Y-%m-%d")  # Monday
        
        # Create a new assignment
        resp = requests.post(f"{BASE_URL}/api/shift-assignments", headers=auth_headers, json={
            "employee_id": employee["id"],
            "shift_id": shift["id"],
            "branch_id": branch["id"],
            "week_start": week_start,
            "date": assign_date
        })
        assert resp.status_code == 200
        assignment = resp.json()
        
        # Update with late time (assuming shift starts at 08:00, arrive at 08:30)
        resp = requests.put(f"{BASE_URL}/api/shift-assignments/{assignment['id']}", headers=auth_headers, json={
            "actual_in": "08:30",
            "actual_out": "16:00"
        })
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["status"] == "late"
    
    def test_attendance_summary(self, auth_headers, branch_with_employees):
        """GET /shift-assignments/attendance-summary"""
        branch = branch_with_employees["branch"]
        month = datetime.now().strftime("%Y-%m")
        
        resp = requests.get(f"{BASE_URL}/api/shift-assignments/attendance-summary?branch_id={branch['id']}&month={month}", headers=auth_headers)
        assert resp.status_code == 200
        summary = resp.json()
        assert isinstance(summary, list)
        # Each entry should have expected fields
        if summary:
            entry = summary[0]
            assert "employee_id" in entry
            assert "employee_name" in entry
            assert "scheduled" in entry
            assert "present" in entry
            assert "late" in entry
            assert "overtime_hours" in entry


# ============== Item P&L Report Tests ==============
class TestItemPnLReport:
    """Test Item P&L Report endpoint"""
    
    def test_get_item_pnl_report(self, auth_headers):
        """GET /reports/item-pnl - returns P&L data"""
        resp = requests.get(f"{BASE_URL}/api/reports/item-pnl", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify structure
        assert "rows" in data
        assert "summary" in data
        assert isinstance(data["rows"], list)
        
        summary = data["summary"]
        assert "total_items" in summary
        assert "total_cost" in summary
        assert "total_revenue" in summary
        assert "total_profit" in summary
        assert "overall_margin" in summary
    
    def test_item_pnl_row_structure(self, auth_headers):
        """Verify P&L row has correct columns"""
        resp = requests.get(f"{BASE_URL}/api/reports/item-pnl", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        
        if data["rows"]:
            row = data["rows"][0]
            expected_fields = ["item_id", "item_name", "category", "unit", "purchased_qty", 
                            "purchased_cost", "avg_cost", "used_qty", "sold_qty", 
                            "sold_revenue", "cost_of_sold", "profit", "margin", "current_stock"]
            for field in expected_fields:
                assert field in row, f"Missing field: {field}"
    
    def test_item_pnl_with_branch_filter(self, auth_headers, branch_with_employees):
        """GET /reports/item-pnl?branch_id=X - filter by branch"""
        branch = branch_with_employees["branch"]
        resp = requests.get(f"{BASE_URL}/api/reports/item-pnl?branch_id={branch['id']}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "rows" in data
        assert "summary" in data


# ============== Cleanup ==============
class TestCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_shifts(self, auth_headers, branch_with_employees):
        """Delete TEST_ prefixed shifts"""
        branch = branch_with_employees["branch"]
        resp = requests.get(f"{BASE_URL}/api/shifts?branch_id={branch['id']}", headers=auth_headers)
        shifts = resp.json()
        
        for shift in shifts:
            if shift["name"].startswith("TEST_"):
                resp = requests.delete(f"{BASE_URL}/api/shifts/{shift['id']}", headers=auth_headers)
                assert resp.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
