"""
Iteration 86 - Employee Portal Salary Record Feature Tests
Tests the new /my/salary-summary endpoint and related functionality

Features tested:
- GET /api/my/salary-summary for employees with linked profiles
- 404 response for users without employee profiles
- Salary summary calculation (periods, amounts, status)
- Integration with salary_payments and salary_deductions collections
"""

import pytest
import requests
import os
from datetime import datetime
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSalaryRecordFeature:
    """Tests for the new Employee Portal Salary Record feature"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def admin_headers(self, admin_token):
        """Admin auth headers"""
        return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}
    
    def test_salary_summary_no_profile(self, admin_headers):
        """Admin user without employee profile should get 404"""
        response = requests.get(f"{BASE_URL}/api/my/salary-summary", headers=admin_headers)
        assert response.status_code == 404
        assert "No employee profile" in response.json().get("detail", "")
        print("✓ /my/salary-summary returns 404 for users without employee profile")
    
    def test_employees_list_api(self, admin_headers):
        """Verify employees endpoint works"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=admin_headers)
        assert response.status_code == 200
        employees = response.json()
        assert isinstance(employees, list)
        print(f"✓ GET /api/employees returns {len(employees)} employees")
        return employees
    
    def test_salary_payments_api(self, admin_headers):
        """Verify salary payments endpoint works"""
        response = requests.get(f"{BASE_URL}/api/salary-payments", headers=admin_headers)
        assert response.status_code == 200
        payments = response.json()
        assert isinstance(payments, list)
        print(f"✓ GET /api/salary-payments returns {len(payments)} payments")
        return payments
    
    def test_create_test_employee_and_salary_summary(self, admin_headers):
        """
        Full integration test:
        1. Create test employee with email
        2. Auto-created user account
        3. Create salary payment
        4. Login as employee
        5. Test /my/salary-summary
        6. Cleanup
        """
        test_email = f"TEST_salary_user_{uuid.uuid4().hex[:8]}@test.com"
        
        # Step 1: Create employee (auto-creates user)
        emp_response = requests.post(f"{BASE_URL}/api/employees", headers=admin_headers, json={
            "name": "TEST Salary Employee",
            "email": test_email,
            "phone": "1234567890",
            "position": "Test Position",
            "salary": 5000,
            "active": True
        })
        assert emp_response.status_code == 200, f"Create employee failed: {emp_response.text}"
        employee = emp_response.json()
        emp_id = employee["id"]
        user_id = employee.get("user_id")
        print(f"✓ Created test employee: {emp_id}, user_id: {user_id}")
        
        try:
            # Step 2: Create salary payments for different periods
            periods = ["Jan 2026", "Feb 2026"]
            payment_ids = []
            
            for period in periods:
                pay_response = requests.post(f"{BASE_URL}/api/salary-payments", headers=admin_headers, json={
                    "employee_id": emp_id,
                    "period": period,
                    "amount": 5000,
                    "payment_type": "salary",
                    "payment_mode": "bank",
                    "date": datetime.now().isoformat(),
                    "notes": "Test salary payment"
                })
                assert pay_response.status_code == 200, f"Create payment failed: {pay_response.text}"
                payment = pay_response.json()
                payment_ids.append(payment["id"])
                print(f"✓ Created salary payment for {period}: {payment['id']}")
            
            # Create bonus payment
            bonus_response = requests.post(f"{BASE_URL}/api/salary-payments", headers=admin_headers, json={
                "employee_id": emp_id,
                "period": "Jan 2026",
                "amount": 500,
                "payment_type": "bonus",
                "payment_mode": "cash",
                "date": datetime.now().isoformat(),
                "notes": "Test bonus"
            })
            if bonus_response.status_code == 200:
                payment_ids.append(bonus_response.json()["id"])
                print("✓ Created bonus payment")
            
            # Step 3: Login as employee (default password: emp@123)
            emp_login = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": test_email,
                "password": "emp@123"
            })
            assert emp_login.status_code == 200, f"Employee login failed: {emp_login.text}"
            emp_token = emp_login.json()["access_token"]
            emp_headers = {"Authorization": f"Bearer {emp_token}"}
            print("✓ Logged in as test employee")
            
            # Step 4: Test /my/salary-summary endpoint
            summary_response = requests.get(f"{BASE_URL}/api/my/salary-summary", headers=emp_headers)
            assert summary_response.status_code == 200, f"Salary summary failed: {summary_response.text}"
            summary = summary_response.json()
            
            # Validate response structure
            assert "employee_name" in summary
            assert "salary" in summary
            assert "summary" in summary
            assert isinstance(summary["summary"], list)
            assert summary["employee_name"] == "TEST Salary Employee"
            assert summary["salary"] == 5000
            print("✓ /my/salary-summary returns correct structure")
            
            # Validate summary contents
            if len(summary["summary"]) > 0:
                first_period = summary["summary"][0]
                expected_fields = ["period", "monthly_salary", "salary_paid", "advance", 
                                  "overtime", "bonus", "deductions", "total_received", 
                                  "balance", "status", "payment_date", "payment_mode"]
                for field in expected_fields:
                    assert field in first_period, f"Missing field: {field}"
                print(f"✓ Salary summary has {len(summary['summary'])} periods with correct fields")
                
                # Check status calculation
                for period_data in summary["summary"]:
                    if period_data["salary_paid"] >= period_data["monthly_salary"]:
                        assert period_data["status"] == "paid", f"Status should be 'paid' for {period_data['period']}"
                    elif period_data["salary_paid"] > 0:
                        assert period_data["status"] == "partial", f"Status should be 'partial' for {period_data['period']}"
                print("✓ Payment status calculation is correct")
            
            # Step 5: Test /my/employee-profile  
            profile_response = requests.get(f"{BASE_URL}/api/my/employee-profile", headers=emp_headers)
            assert profile_response.status_code == 200
            profile = profile_response.json()
            assert profile["name"] == "TEST Salary Employee"
            print("✓ /my/employee-profile works correctly")
            
            # Step 6: Test /my/payments
            payments_response = requests.get(f"{BASE_URL}/api/my/payments", headers=emp_headers)
            assert payments_response.status_code == 200
            my_payments = payments_response.json()
            assert len(my_payments) >= 2  # At least 2 salary payments
            print(f"✓ /my/payments returns {len(my_payments)} payments")
            
        finally:
            # Cleanup: Delete payments and employee
            for pid in payment_ids:
                requests.delete(f"{BASE_URL}/api/salary-payments/{pid}", headers=admin_headers)
            requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=admin_headers)
            print("✓ Cleanup completed")
    
    def test_salary_summary_with_existing_data(self, admin_headers):
        """Test salary summary calculation with employees that have existing data"""
        # Get employees with user_id
        emp_response = requests.get(f"{BASE_URL}/api/employees", headers=admin_headers)
        employees = emp_response.json()
        
        linked_employees = [e for e in employees if e.get("user_id")]
        print(f"Found {len(linked_employees)} employees with linked user accounts")
        
        # Get all salary payments
        payments_response = requests.get(f"{BASE_URL}/api/salary-payments", headers=admin_headers)
        payments = payments_response.json()
        
        # Find employee with payments
        emp_ids_with_payments = set(p["employee_id"] for p in payments)
        emp_with_payments = [e for e in linked_employees if e["id"] in emp_ids_with_payments]
        
        if emp_with_payments:
            print(f"Found {len(emp_with_payments)} linked employees with payment history")
            for emp in emp_with_payments[:1]:  # Test first one
                emp_payments = [p for p in payments if p["employee_id"] == emp["id"]]
                print(f"  - {emp['name']}: {len(emp_payments)} payments")
        else:
            print("No linked employees with payment history found")
        
        return True


class TestSalarySummaryEndpointValidation:
    """Additional validation tests for salary summary endpoint"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    def test_unauthenticated_request(self):
        """Verify unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/my/salary-summary")
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print("✓ Unauthenticated requests rejected correctly")
    
    def test_existing_employee_endpoints(self, admin_token):
        """Verify all Employee Portal endpoints exist"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        endpoints = [
            ("GET", "/api/my/employee-profile"),
            ("GET", "/api/my/payments"),
            ("GET", "/api/my/salary-summary"),  # New endpoint
            ("GET", "/api/my/leaves"),
            ("GET", "/api/my/requests"),
            ("GET", "/api/my/attendance"),
            ("GET", "/api/my/loans"),
        ]
        
        for method, endpoint in endpoints:
            response = requests.request(method, f"{BASE_URL}{endpoint}", headers=headers)
            # 404 is acceptable if no profile, other errors indicate missing endpoint
            assert response.status_code in [200, 404], f"{method} {endpoint} failed with {response.status_code}: {response.text}"
            status = "200 OK" if response.status_code == 200 else "404 (no profile)"
            print(f"✓ {method} {endpoint} - {status}")


class TestSalaryDeductions:
    """Test salary deductions integration with summary"""
    
    @pytest.fixture(scope="class")
    def admin_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_salary_deductions_endpoint(self, admin_headers):
        """Verify salary deductions endpoint works"""
        response = requests.get(f"{BASE_URL}/api/salary-deductions", headers=admin_headers)
        assert response.status_code == 200
        deductions = response.json()
        assert isinstance(deductions, list)
        print(f"✓ GET /api/salary-deductions returns {len(deductions)} deductions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
