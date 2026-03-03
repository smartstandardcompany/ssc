"""
Test Sales Alerts System and AdvancedSearch on Customers/Suppliers
Iteration 73 - P3 Features Testing
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSalesAlertsAPI:
    """Test Sales Alerts endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_sales_alerts_config(self):
        """Test GET /api/sales-alerts/config - Returns alert configuration"""
        response = requests.get(f"{BASE_URL}/api/sales-alerts/config", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check expected fields
        assert 'enabled' in data
        assert 'threshold_percentage' in data
        assert 'alert_time' in data
        assert 'email_enabled' in data
        assert 'whatsapp_enabled' in data
        assert 'recipients' in data
        
        # Validate types
        assert isinstance(data['enabled'], bool)
        assert isinstance(data['threshold_percentage'], int)
        assert isinstance(data['alert_time'], str)
        assert isinstance(data['email_enabled'], bool)
        assert isinstance(data['whatsapp_enabled'], bool)
        assert isinstance(data['recipients'], list)
        
        print(f"Config: enabled={data['enabled']}, threshold={data['threshold_percentage']}%, time={data['alert_time']}")
    
    def test_save_sales_alerts_config(self):
        """Test POST /api/sales-alerts/config - Saves alert configuration"""
        config_data = {
            "enabled": True,
            "threshold_percentage": 25,
            "alert_time": "09:00",
            "email_enabled": True,
            "whatsapp_enabled": False,
            "recipients": ["test@example.com"]
        }
        
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json=config_data, headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        
        assert 'message' in data
        assert data['message'] == 'Alert configuration saved'
        assert 'config' in data
        
        # Verify the saved config
        saved_config = data['config']
        assert saved_config['threshold_percentage'] == 25
        assert saved_config['alert_time'] == '09:00'
        
        print(f"Saved config: threshold={saved_config['threshold_percentage']}%, time={saved_config['alert_time']}")
    
    def test_get_sales_alerts_preview(self):
        """Test GET /api/sales-alerts/preview - Returns prediction preview"""
        response = requests.get(f"{BASE_URL}/api/sales-alerts/preview", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check expected fields
        assert 'alert_needed' in data
        assert 'threshold' in data
        assert 'message' in data
        
        # Check optional prediction fields
        if data.get('predicted_sales'):
            assert 'predicted_sales' in data
            assert 'historical_avg' in data
            assert 'difference_percentage' in data
            assert 'prediction_date' in data
            assert 'prediction_day' in data
        
        print(f"Preview: alert_needed={data['alert_needed']}, threshold={data['threshold']}%")
        print(f"Message: {data['message']}")
    
    def test_get_sales_alerts_history(self):
        """Test GET /api/sales-alerts/history - Returns alert history"""
        response = requests.get(f"{BASE_URL}/api/sales-alerts/history?limit=10", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        
        # If history exists, check structure
        if len(data) > 0:
            alert = data[0]
            assert 'sent_at' in alert
            assert 'prediction_date' in alert
            assert 'predicted_sales' in alert
            assert 'historical_avg' in alert
            assert 'difference_pct' in alert
            assert 'threshold' in alert
            assert 'results' in alert
        
        print(f"Alert history: {len(data)} entries")
    
    def test_threshold_slider_range(self):
        """Test threshold values are accepted in the 5-50% range"""
        # Test minimum threshold (5%)
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json={"threshold_percentage": 5}, headers=self.headers)
        assert response.status_code == 200
        
        # Test maximum threshold (50%)
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json={"threshold_percentage": 50}, headers=self.headers)
        assert response.status_code == 200
        
        # Test middle value (20%)
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json={"threshold_percentage": 20}, headers=self.headers)
        assert response.status_code == 200
        
        print("Threshold range (5-50%) validation passed")
    
    def test_alert_time_format(self):
        """Test alert time accepts HH:MM format"""
        # Test various valid times
        valid_times = ["08:00", "09:30", "12:00", "18:45", "23:59", "00:00"]
        
        for time_val in valid_times:
            response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                     json={"alert_time": time_val}, headers=self.headers)
            assert response.status_code == 200, f"Failed for time {time_val}: {response.text}"
        
        print(f"Alert time format validation passed for {len(valid_times)} time values")
    
    def test_recipients_list_operations(self):
        """Test adding and removing recipients"""
        # Add email recipients
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json={"recipients": ["admin@example.com", "manager@example.com"]}, 
                                 headers=self.headers)
        assert response.status_code == 200
        
        # Verify recipients saved
        get_response = requests.get(f"{BASE_URL}/api/sales-alerts/config", headers=self.headers)
        assert get_response.status_code == 200
        saved_recipients = get_response.json().get('recipients', [])
        assert "admin@example.com" in saved_recipients
        assert "manager@example.com" in saved_recipients
        
        # Clear recipients
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json={"recipients": []}, headers=self.headers)
        assert response.status_code == 200
        
        print("Recipients list operations passed")
    
    def test_email_whatsapp_toggles(self):
        """Test email and WhatsApp enable/disable"""
        # Enable both
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json={"email_enabled": True, "whatsapp_enabled": True}, 
                                 headers=self.headers)
        assert response.status_code == 200
        
        # Disable both
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json={"email_enabled": False, "whatsapp_enabled": False}, 
                                 headers=self.headers)
        assert response.status_code == 200
        
        # Enable email only
        response = requests.post(f"{BASE_URL}/api/sales-alerts/config", 
                                 json={"email_enabled": True, "whatsapp_enabled": False}, 
                                 headers=self.headers)
        assert response.status_code == 200
        
        # Verify
        get_response = requests.get(f"{BASE_URL}/api/sales-alerts/config", headers=self.headers)
        data = get_response.json()
        assert data['email_enabled'] == True
        assert data['whatsapp_enabled'] == False
        
        print("Email/WhatsApp toggle tests passed")
    
    def test_sales_alerts_requires_auth(self):
        """Test that endpoints require authentication"""
        # Config endpoint without auth - returns 401 or 403
        response = requests.get(f"{BASE_URL}/api/sales-alerts/config")
        assert response.status_code in [401, 403]
        
        # Preview endpoint without auth
        response = requests.get(f"{BASE_URL}/api/sales-alerts/preview")
        assert response.status_code in [401, 403]
        
        # History endpoint without auth
        response = requests.get(f"{BASE_URL}/api/sales-alerts/history")
        assert response.status_code in [401, 403]
        
        print("Authentication requirement validation passed")


class TestCustomersAdvancedSearch:
    """Test AdvancedSearch on Customers page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_customers_endpoint(self):
        """Test GET /api/customers - Returns customers list"""
        response = requests.get(f"{BASE_URL}/api/customers", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Customers: {len(data)} total")
    
    def test_customers_balance_endpoint(self):
        """Test GET /api/customers-balance - Returns customer balances"""
        response = requests.get(f"{BASE_URL}/api/customers-balance", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            balance = data[0]
            assert 'id' in balance
            # Check balance fields that may exist
            print(f"Customer balances: {len(data)} entries")
    
    def test_branches_endpoint_for_filters(self):
        """Test GET /api/branches - Used for branch filter dropdown"""
        response = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        if len(data) > 0:
            branch = data[0]
            assert 'id' in branch
            assert 'name' in branch
        
        print(f"Branches: {len(data)} total")


class TestSuppliersAdvancedSearch:
    """Test AdvancedSearch on Suppliers page"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_suppliers_endpoint(self):
        """Test GET /api/suppliers - Returns suppliers list"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Suppliers: {len(data)} total")
    
    def test_supplier_categories_endpoint(self):
        """Test GET /api/categories?category_type=supplier - Used for category filter"""
        response = requests.get(f"{BASE_URL}/api/categories?category_type=supplier", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list)
        print(f"Supplier categories: {len(data)} total")
    
    def test_supplier_payment_summaries(self):
        """Test GET /api/suppliers/payment-summaries - Returns payment data for cards"""
        response = requests.get(f"{BASE_URL}/api/suppliers/payment-summaries", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, dict)
        print(f"Supplier payment summaries retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
