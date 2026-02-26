import requests
import sys
from datetime import datetime
import json

class DataEntryAPITester:
    def __init__(self, base_url="https://track-finances-ops.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {
            'branch_id': None,
            'customer_id': None,
            'sale_id': None,
            'expense_id': None,
            'payment_id': None
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, auth_required=True):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.content:
                    try:
                        error_data = response.json()
                        print(f"   Error: {error_data}")
                    except:
                        print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health check"""
        return self.run_test("Health Check", "GET", "", 200, auth_required=False)

    def test_register(self):
        """Test user registration"""
        test_user_data = {
            "name": f"Test User {datetime.now().strftime('%H%M%S')}",
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data,
            auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        return False

    def test_login(self):
        """Test user login with existing credentials"""
        login_data = {
            "email": f"test_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data,
            auth_required=False
        )
        return success

    def test_get_me(self):
        """Test get current user"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_branch_crud(self):
        """Test branch CRUD operations"""
        # Create branch
        branch_data = {
            "name": f"Test Branch {datetime.now().strftime('%H%M%S')}",
            "location": "Test Location"
        }
        
        success, response = self.run_test(
            "Create Branch",
            "POST",
            "branches",
            200,
            data=branch_data
        )
        
        if success and 'id' in response:
            self.test_data['branch_id'] = response['id']
            
            # Get branches
            self.run_test("Get Branches", "GET", "branches", 200)
            
            # Update branch
            update_data = {"name": "Updated Branch", "location": "Updated Location"}
            self.run_test(
                "Update Branch",
                "PUT",
                f"branches/{self.test_data['branch_id']}",
                200,
                data=update_data
            )
            
            return True
        return False

    def test_customer_crud(self):
        """Test customer CRUD operations"""
        # Create customer
        customer_data = {
            "name": f"Test Customer {datetime.now().strftime('%H%M%S')}",
            "phone": "+1234567890",
            "email": f"customer_{datetime.now().strftime('%H%M%S')}@example.com"
        }
        
        success, response = self.run_test(
            "Create Customer",
            "POST",
            "customers",
            200,
            data=customer_data
        )
        
        if success and 'id' in response:
            self.test_data['customer_id'] = response['id']
            
            # Get customers
            self.run_test("Get Customers", "GET", "customers", 200)
            
            # Update customer
            update_data = {"name": "Updated Customer", "phone": "+0987654321"}
            self.run_test(
                "Update Customer",
                "PUT",
                f"customers/{self.test_data['customer_id']}",
                200,
                data=update_data
            )
            
            return True
        return False

    def test_sales_crud(self):
        """Test sales CRUD operations"""
        if not self.test_data['branch_id'] or not self.test_data['customer_id']:
            print("❌ Cannot test sales - missing branch or customer")
            return False
            
        # Test branch sale
        branch_sale_data = {
            "sale_type": "branch",
            "branch_id": self.test_data['branch_id'],
            "amount": 100.50,
            "payment_mode": "cash",
            "date": datetime.now().isoformat(),
            "notes": "Test branch sale"
        }
        
        success, response = self.run_test(
            "Create Branch Sale",
            "POST",
            "sales",
            200,
            data=branch_sale_data
        )
        
        if success and 'id' in response:
            self.test_data['sale_id'] = response['id']
            
            # Test online sale
            online_sale_data = {
                "sale_type": "online",
                "customer_id": self.test_data['customer_id'],
                "amount": 75.25,
                "payment_mode": "credit",
                "date": datetime.now().isoformat(),
                "notes": "Test online sale"
            }
            
            self.run_test(
                "Create Online Sale",
                "POST",
                "sales",
                200,
                data=online_sale_data
            )
            
            # Get sales
            self.run_test("Get Sales", "GET", "sales", 200)
            
            # Update sale (mark credit as received)
            update_data = {
                "payment_status": "received",
                "received_mode": "bank"
            }
            self.run_test(
                "Update Sale Status",
                "PUT",
                f"sales/{self.test_data['sale_id']}",
                200,
                data=update_data
            )
            
            return True
        return False

    def test_supplier_payments(self):
        """Test supplier payment operations"""
        payment_data = {
            "supplier_name": f"Test Supplier {datetime.now().strftime('%H%M%S')}",
            "amount": 200.00,
            "payment_mode": "bank",
            "date": datetime.now().isoformat(),
            "notes": "Test supplier payment"
        }
        
        success, response = self.run_test(
            "Create Supplier Payment",
            "POST",
            "supplier-payments",
            200,
            data=payment_data
        )
        
        if success and 'id' in response:
            self.test_data['payment_id'] = response['id']
            
            # Get supplier payments
            self.run_test("Get Supplier Payments", "GET", "supplier-payments", 200)
            
            return True
        return False

    def test_expenses(self):
        """Test expense operations"""
        expense_data = {
            "category": "salary",
            "description": "Test salary expense",
            "amount": 1500.00,
            "payment_mode": "bank",
            "date": datetime.now().isoformat(),
            "notes": "Test expense"
        }
        
        success, response = self.run_test(
            "Create Expense",
            "POST",
            "expenses",
            200,
            data=expense_data
        )
        
        if success and 'id' in response:
            self.test_data['expense_id'] = response['id']
            
            # Get expenses
            self.run_test("Get Expenses", "GET", "expenses", 200)
            
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        return self.run_test("Get Dashboard Stats", "GET", "dashboard/stats", 200)

    def cleanup_test_data(self):
        """Clean up created test data"""
        print("\n🧹 Cleaning up test data...")
        
        if self.test_data['sale_id']:
            self.run_test("Delete Sale", "DELETE", f"sales/{self.test_data['sale_id']}", 200)
            
        if self.test_data['expense_id']:
            self.run_test("Delete Expense", "DELETE", f"expenses/{self.test_data['expense_id']}", 200)
            
        if self.test_data['payment_id']:
            self.run_test("Delete Supplier Payment", "DELETE", f"supplier-payments/{self.test_data['payment_id']}", 200)
            
        if self.test_data['customer_id']:
            self.run_test("Delete Customer", "DELETE", f"customers/{self.test_data['customer_id']}", 200)
            
        if self.test_data['branch_id']:
            self.run_test("Delete Branch", "DELETE", f"branches/{self.test_data['branch_id']}", 200)

def main():
    print("🚀 Starting DataEntry Hub API Tests")
    print("=" * 50)
    
    tester = DataEntryAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("User Registration", tester.test_register),
        ("Get Current User", tester.test_get_me),
        ("Branch CRUD", tester.test_branch_crud),
        ("Customer CRUD", tester.test_customer_crud),
        ("Sales CRUD", tester.test_sales_crud),
        ("Supplier Payments", tester.test_supplier_payments),
        ("Expenses", tester.test_expenses),
        ("Dashboard Stats", tester.test_dashboard_stats),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        print(f"\n📋 Running {test_name} tests...")
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Cleanup
    tester.cleanup_test_data()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed test categories: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All test categories passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())