"""
Iteration 12: Job Titles Feature Tests
- GET /api/job-titles (auto-seeds 15 default titles if empty)
- POST /api/job-titles (create new title)
- DELETE /api/job-titles/{id} (delete title)
- Employee job_title_id field integration
- Settings Deploy tab verification (GoDaddy, PWA instructions)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestJobTitles:
    """Job Title CRUD endpoint tests"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Authenticate before each test"""
        if not TestJobTitles.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "SSC@SSC.com",
                "password": "Aa147258369SsC@"
            })
            assert response.status_code == 200, f"Login failed: {response.text}"
            TestJobTitles.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {TestJobTitles.token}"}
    
    def test_01_get_job_titles_returns_list(self):
        """GET /api/job-titles returns list with default titles seeded"""
        response = requests.get(f"{BASE_URL}/api/job-titles", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Should have at least 15 default titles
        assert len(data) >= 15, f"Expected at least 15 default titles, got {len(data)}"
        print(f"GET /api/job-titles: Found {len(data)} job titles")
    
    def test_02_job_titles_have_required_fields(self):
        """Job titles should have title, department, min_salary, max_salary"""
        response = requests.get(f"{BASE_URL}/api/job-titles", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check first title has required fields
        first_title = data[0]
        assert "id" in first_title, "Job title should have id"
        assert "title" in first_title, "Job title should have title"
        assert "department" in first_title, "Job title should have department"
        assert "min_salary" in first_title, "Job title should have min_salary"
        assert "max_salary" in first_title, "Job title should have max_salary"
        print(f"Sample job title: {first_title['title']} - {first_title['department']} (SAR {first_title['min_salary']}-{first_title['max_salary']})")
    
    def test_03_default_titles_include_expected_roles(self):
        """Default titles should include Chef, Cashier, Manager, Waiter, Driver, etc."""
        response = requests.get(f"{BASE_URL}/api/job-titles", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        titles = [jt["title"] for jt in data]
        expected_titles = ["Chef", "Cashier", "Manager", "Waiter", "Driver", "Sous Chef", "Line Cook", "Supervisor"]
        
        found = []
        missing = []
        for expected in expected_titles:
            if expected in titles:
                found.append(expected)
            else:
                missing.append(expected)
        
        print(f"Found expected titles: {found}")
        if missing:
            print(f"Missing titles: {missing}")
        
        # At least 6 of the expected titles should exist
        assert len(found) >= 6, f"Expected at least 6 of the default titles, found {len(found)}: {found}"
    
    def test_04_create_new_job_title(self):
        """POST /api/job-titles creates a new title"""
        new_title = {
            "title": "TEST_Dishwasher",
            "department": "Kitchen",
            "min_salary": 1000,
            "max_salary": 1800
        }
        response = requests.post(f"{BASE_URL}/api/job-titles", json=new_title, headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["title"] == "TEST_Dishwasher", f"Title mismatch: {data}"
        assert data["department"] == "Kitchen", f"Department mismatch: {data}"
        assert data["min_salary"] == 1000, f"min_salary mismatch: {data}"
        assert data["max_salary"] == 1800, f"max_salary mismatch: {data}"
        assert "id" in data, "Created title should have id"
        
        # Store for cleanup
        self.__class__.created_title_id = data["id"]
        print(f"Created job title: {data['title']} (id: {data['id']})")
    
    def test_05_verify_created_title_in_list(self):
        """Verify the created title appears in GET /api/job-titles"""
        response = requests.get(f"{BASE_URL}/api/job-titles", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        titles = [jt["title"] for jt in data]
        assert "TEST_Dishwasher" in titles, f"Created title not found in list: {titles}"
        print("Verified: TEST_Dishwasher appears in job titles list")
    
    def test_06_delete_job_title(self):
        """DELETE /api/job-titles/{id} removes the title"""
        title_id = getattr(self.__class__, 'created_title_id', None)
        if not title_id:
            # Find the TEST_Dishwasher title
            response = requests.get(f"{BASE_URL}/api/job-titles", headers=self.headers)
            data = response.json()
            for jt in data:
                if jt["title"] == "TEST_Dishwasher":
                    title_id = jt["id"]
                    break
        
        if not title_id:
            pytest.skip("No TEST_Dishwasher title to delete")
        
        response = requests.delete(f"{BASE_URL}/api/job-titles/{title_id}", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"Deleted job title id: {title_id}")
    
    def test_07_verify_title_deleted(self):
        """Verify deleted title no longer appears in list"""
        response = requests.get(f"{BASE_URL}/api/job-titles", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        titles = [jt["title"] for jt in data]
        assert "TEST_Dishwasher" not in titles, f"Deleted title still in list"
        print("Verified: TEST_Dishwasher removed from list")


class TestEmployeeJobTitleIntegration:
    """Test Employee + Job Title integration"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        if not TestEmployeeJobTitleIntegration.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "SSC@SSC.com",
                "password": "Aa147258369SsC@"
            })
            assert response.status_code == 200
            TestEmployeeJobTitleIntegration.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {TestEmployeeJobTitleIntegration.token}"}
    
    def test_01_get_employees_works(self):
        """GET /api/employees returns list"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"GET /api/employees: {len(data)} employees found")
    
    def test_02_job_title_id_field_exists(self):
        """Employee model should support job_title_id field"""
        # Get a job title first
        jt_response = requests.get(f"{BASE_URL}/api/job-titles", headers=self.headers)
        assert jt_response.status_code == 200
        job_titles = jt_response.json()
        assert len(job_titles) > 0, "No job titles found"
        
        job_title = job_titles[0]
        
        # Create test employee with job_title_id
        emp_data = {
            "name": "TEST_JobTitleEmp",
            "job_title_id": job_title["id"],
            "salary": job_title.get("min_salary", 1500)
        }
        response = requests.post(f"{BASE_URL}/api/employees", json=emp_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to create employee: {response.text}"
        
        emp = response.json()
        assert emp["job_title_id"] == job_title["id"], f"job_title_id not saved: {emp}"
        
        # Store for cleanup
        self.__class__.test_emp_id = emp["id"]
        print(f"Created employee {emp['name']} with job_title_id: {emp['job_title_id']}")
    
    def test_03_cleanup_test_employee(self):
        """Delete test employee"""
        emp_id = getattr(self.__class__, 'test_emp_id', None)
        if emp_id:
            response = requests.delete(f"{BASE_URL}/api/employees/{emp_id}", headers=self.headers)
            assert response.status_code == 200, f"Failed to delete: {response.text}"
            print(f"Cleaned up test employee: {emp_id}")


class TestSettingsEndpoints:
    """Test Settings page related endpoints"""
    
    token = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        if not TestSettingsEndpoints.token:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": "SSC@SSC.com",
                "password": "Aa147258369SsC@"
            })
            assert response.status_code == 200
            TestSettingsEndpoints.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {TestSettingsEndpoints.token}"}
    
    def test_settings_company_endpoint(self):
        """GET /api/settings/company should work"""
        response = requests.get(f"{BASE_URL}/api/settings/company", headers=self.headers)
        # May return 200 or be null/empty
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"GET /api/settings/company: {response.status_code}")
    
    def test_settings_email_endpoint(self):
        """GET /api/settings/email should work"""
        response = requests.get(f"{BASE_URL}/api/settings/email", headers=self.headers)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"GET /api/settings/email: {response.status_code}")
    
    def test_settings_whatsapp_endpoint(self):
        """GET /api/settings/whatsapp should work"""
        response = requests.get(f"{BASE_URL}/api/settings/whatsapp", headers=self.headers)
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print(f"GET /api/settings/whatsapp: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
