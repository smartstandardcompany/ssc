"""
Iteration 122: Test Quick Entry Date Handling & Menu Categories Management
- Tests: Quick Entry date preservation (timezone-safe)
- Tests: Dynamic category management (add/delete custom categories)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get access token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "Missing access_token in response"
        return data["access_token"]
    
    def test_login_success(self, auth_token):
        """Verify login returns valid token"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"Login successful, token length: {len(auth_token)}")


class TestQuickEntryDateHandling:
    """Test Quick Entry (/pos) date handling - dates should not shift due to timezone conversion"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def branch_id(self, auth_token):
        """Get a valid branch_id for testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        assert response.status_code == 200
        branches = response.json()
        assert len(branches) > 0, "No branches found"
        return branches[0]["id"]
    
    def test_sale_with_late_night_datetime_preserves_date(self, auth_token, branch_id):
        """
        Critical bug test: When user submits sale at 2026-03-09T23:45:00,
        it should be saved as 2026-03-09, NOT shift to 2026-03-08 (UTC conversion issue)
        """
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Simulate a late night sale (23:45) - this was previously causing date shifts to UTC
        test_date = "2026-03-09T23:45:00"
        unique_note = f"TEST_DATEFIX_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "sale_type": "pos",
            "amount": 100.0,
            "branch_id": branch_id,
            "notes": unique_note,
            "date": test_date,
            "payment_details": [{"mode": "cash", "amount": 100.0, "discount": 0}]
        }
        
        response = requests.post(f"{BASE_URL}/api/sales", json=payload, headers=headers)
        assert response.status_code in [200, 201], f"Sale creation failed: {response.text}"
        
        created_sale = response.json()
        sale_id = created_sale.get("id")
        assert sale_id is not None
        
        # Verify the date by querying sales list with the unique note
        # The sale should appear on 2026-03-09, not 2026-03-08
        get_response = requests.get(
            f"{BASE_URL}/api/sales?start_date=2026-03-09&end_date=2026-03-09", 
            headers=headers
        )
        assert get_response.status_code == 200
        response_data = get_response.json()
        
        # Handle response structure: {"data": [...]} or direct list
        if isinstance(response_data, dict) and "data" in response_data:
            sales = response_data["data"]
        else:
            sales = response_data
        
        # Find our test sale by its unique note
        found_sale = None
        for sale in sales:
            if isinstance(sale, dict) and sale.get("notes") == unique_note:
                found_sale = sale
                break
        
        assert found_sale is not None, f"Sale not found on 2026-03-09 - date may have shifted to different day!"
        saved_date = found_sale.get("date", "")
        assert "2026-03-09" in saved_date, f"Date shifted! Expected 2026-03-09, got {saved_date}"
        print(f"PASS: Sale date preserved correctly as {saved_date}")
        
        # Cleanup - delete test sale
        delete_response = requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=headers)
        assert delete_response.status_code in [200, 204]
        print(f"Cleaned up test sale {sale_id}")
    
    def test_regular_sale_submission(self, auth_token, branch_id):
        """Test regular sale with cash amount is saved correctly"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        test_date = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        unique_note = f"TEST_REGULAR_SALE_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "sale_type": "pos",
            "amount": 250.0,
            "branch_id": branch_id,
            "notes": unique_note,
            "date": test_date,
            "payment_details": [
                {"mode": "cash", "amount": 150.0, "discount": 0},
                {"mode": "bank", "amount": 100.0, "discount": 0}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/sales", json=payload, headers=headers)
        assert response.status_code in [200, 201], f"Sale creation failed: {response.text}"
        
        sale = response.json()
        assert sale.get("amount") == 250.0
        assert sale.get("branch_id") == branch_id
        print(f"PASS: Regular sale created with amount 250.0")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/sales/{sale['id']}", headers=headers)


class TestMenuCategories:
    """Test dynamic menu category management"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_menu_categories(self, auth_token):
        """Test fetching menu categories with type=menu filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/categories?category_type=menu", headers=headers)
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list)
        print(f"PASS: Retrieved {len(categories)} menu categories")
        return categories
    
    def test_create_custom_category(self, auth_token):
        """Test adding a custom menu category (e.g., 'Grills')"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        test_category_name = f"TEST_Grills_{uuid.uuid4().hex[:6]}"
        
        payload = {
            "name": test_category_name,
            "type": "menu"
        }
        
        response = requests.post(f"{BASE_URL}/api/categories", json=payload, headers=headers)
        assert response.status_code in [200, 201], f"Failed to create category: {response.text}"
        
        created = response.json()
        assert created.get("name") == test_category_name
        assert created.get("type") == "menu"
        category_id = created.get("id")
        assert category_id is not None
        print(f"PASS: Created custom category '{test_category_name}' with id {category_id}")
        
        # Verify it appears in category list
        get_response = requests.get(f"{BASE_URL}/api/categories?category_type=menu", headers=headers)
        categories = get_response.json()
        found = any(c.get("name") == test_category_name for c in categories)
        assert found, f"Created category not found in list"
        print(f"PASS: Custom category appears in category list")
        
        return category_id, test_category_name
    
    def test_delete_custom_category(self, auth_token):
        """Test deleting a custom category"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First create a category to delete
        test_name = f"TEST_ToDelete_{uuid.uuid4().hex[:6]}"
        create_response = requests.post(f"{BASE_URL}/api/categories", json={
            "name": test_name,
            "type": "menu"
        }, headers=headers)
        assert create_response.status_code in [200, 201]
        category_id = create_response.json().get("id")
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/categories/{category_id}", headers=headers)
        assert delete_response.status_code in [200, 204], f"Delete failed: {delete_response.text}"
        print(f"PASS: Deleted category {category_id}")
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/categories?category_type=menu", headers=headers)
        categories = get_response.json()
        found = any(c.get("id") == category_id for c in categories)
        assert not found, "Deleted category still exists!"
        print(f"PASS: Category no longer in list after deletion")
    
    def test_category_appears_in_filter_dropdown(self, auth_token):
        """Verify categories endpoint returns data that can be used in filter dropdowns"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(f"{BASE_URL}/api/categories?category_type=menu", headers=headers)
        assert response.status_code == 200
        
        categories = response.json()
        # Each category should have id and name for dropdown usage
        for cat in categories:
            assert "id" in cat, "Category missing id field"
            assert "name" in cat, "Category missing name field"
        
        print(f"PASS: All {len(categories)} categories have id and name for dropdown usage")


class TestExpenses:
    """Test expense submission with date handling"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def branch_id(self, auth_token):
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
        assert response.status_code == 200
        branches = response.json()
        return branches[0]["id"]
    
    def test_expense_with_correct_date(self, auth_token, branch_id):
        """Test expense is saved with correct date (no timezone shift)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        test_date = "2026-03-09T22:30:00"
        unique_desc = f"TEST_EXPENSE_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "amount": 50.0,
            "category": "General",
            "branch_id": branch_id,
            "description": unique_desc,
            "date": test_date,
            "payment_mode": "cash"
        }
        
        response = requests.post(f"{BASE_URL}/api/expenses", json=payload, headers=headers)
        assert response.status_code in [200, 201], f"Expense creation failed: {response.text}"
        
        expense = response.json()
        expense_id = expense.get("id")
        
        # Verify date by querying expenses list
        get_response = requests.get(
            f"{BASE_URL}/api/expenses?start_date=2026-03-09&end_date=2026-03-09", 
            headers=headers
        )
        assert get_response.status_code == 200
        response_data = get_response.json()
        
        # Handle response structure: {"data": [...]} or direct list
        if isinstance(response_data, dict) and "data" in response_data:
            expenses = response_data["data"]
        else:
            expenses = response_data if isinstance(response_data, list) else []
        
        # Find our test expense by unique description
        found_expense = None
        for exp in expenses:
            if isinstance(exp, dict) and exp.get("description") == unique_desc:
                found_expense = exp
                break
        
        assert found_expense is not None, f"Expense not found on 2026-03-09 - date may have shifted!"
        saved_date = found_expense.get("date", "")
        assert "2026-03-09" in saved_date, f"Date shifted! Expected 2026-03-09, got {saved_date}"
        print(f"PASS: Expense date preserved correctly as {saved_date}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/expenses/{expense_id}", headers=headers)


class TestCategoryDuplicatePrevention:
    """Test that duplicate categories are prevented"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        return response.json()["access_token"]
    
    def test_duplicate_category_prevention(self, auth_token):
        """Creating duplicate category should fail"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        unique_name = f"TEST_DUP_{uuid.uuid4().hex[:6]}"
        
        # Create first
        response1 = requests.post(f"{BASE_URL}/api/categories", json={
            "name": unique_name,
            "type": "menu"
        }, headers=headers)
        assert response1.status_code in [200, 201]
        cat_id = response1.json().get("id")
        
        # Try creating duplicate
        response2 = requests.post(f"{BASE_URL}/api/categories", json={
            "name": unique_name,
            "type": "menu"
        }, headers=headers)
        assert response2.status_code == 400, "Duplicate should be rejected"
        print(f"PASS: Duplicate category correctly rejected")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/categories/{cat_id}", headers=headers)


# Cleanup test categories
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_categories():
    """Clean up test categories after all tests"""
    yield
    # Post-test cleanup
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        if response.status_code == 200:
            token = response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Get all categories and delete TEST_ prefixed ones
            cat_response = requests.get(f"{BASE_URL}/api/categories?category_type=menu", headers=headers)
            if cat_response.status_code == 200:
                for cat in cat_response.json():
                    if cat.get("name", "").startswith("TEST_"):
                        requests.delete(f"{BASE_URL}/api/categories/{cat['id']}", headers=headers)
                        print(f"Cleaned up test category: {cat['name']}")
    except Exception as e:
        print(f"Cleanup warning: {e}")
