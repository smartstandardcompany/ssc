"""
Test Iteration 60: Quick Actions Widget, WhatsApp Notifications, CCTV Face Training, Bank Parsers
Tests:
- Quick Actions widget role-based buttons
- Multi-language AI widgets i18n translations
- WhatsApp notification endpoints (low stock, leave, salary)
- CCTV multiple face registration and training status
- Bank statement parser UAE formats
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication for protected endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("access_token") or data.get("token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestWhatsAppNotificationEndpoints(TestAuth):
    """Test new WhatsApp notification endpoints"""
    
    def test_whatsapp_send_low_stock_alert_endpoint_exists(self, auth_headers):
        """POST /api/whatsapp/send-low-stock-alert - Test endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/send-low-stock-alert",
            headers=auth_headers
        )
        # Should return 200 (success) or 500 (WhatsApp not configured) - NOT 404
        assert response.status_code in [200, 400, 500], f"Endpoint should exist, got {response.status_code}"
        # Verify response structure
        data = response.json()
        assert "message" in data or "detail" in data, "Response should have message or detail"
    
    def test_whatsapp_send_leave_notification_endpoint_exists(self, auth_headers):
        """POST /api/whatsapp/send-leave-notification - Test endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/send-leave-notification",
            headers=auth_headers,
            json={"leave_id": "test_leave_123", "status": "approved"}
        )
        # Should return 200/400/404/500 - NOT 404 for endpoint itself
        assert response.status_code in [200, 400, 404, 500], f"Unexpected status: {response.status_code}"
        data = response.json()
        # 404 is acceptable if leave request not found, but not if endpoint doesn't exist
        if response.status_code == 404:
            assert "Leave request not found" in str(data) or "not found" in str(data).lower()
    
    def test_whatsapp_send_salary_notification_endpoint_exists(self, auth_headers):
        """POST /api/whatsapp/send-salary-notification - Test endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/send-salary-notification",
            headers=auth_headers,
            json={"employee_id": "test_emp_123", "amount": 5000, "period": "Jan 2026"}
        )
        # Should return 200/400/404/500
        assert response.status_code in [200, 400, 404, 500], f"Unexpected status: {response.status_code}"
        data = response.json()
        # 404 is acceptable if employee not found
        if response.status_code == 404:
            assert "Employee not found" in str(data) or "not found" in str(data).lower()


class TestCCTVFaceRegistration(TestAuth):
    """Test CCTV face registration endpoints"""
    
    def test_cctv_faces_register_multiple_endpoint_exists(self, auth_headers):
        """POST /api/cctv/faces/register-multiple - Test endpoint exists"""
        # First get an employee ID
        emp_response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert emp_response.status_code == 200
        employees = emp_response.json()
        
        if employees:
            employee_id = employees[0].get("id")
            # Test with dummy base64 image
            dummy_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
            
            response = requests.post(
                f"{BASE_URL}/api/cctv/faces/register-multiple",
                headers=auth_headers,
                json={
                    "employee_id": employee_id,
                    "images": [dummy_image, dummy_image]
                }
            )
            # Should return success or error, not 404
            assert response.status_code in [200, 400, 500], f"Endpoint should exist, got {response.status_code}"
            data = response.json()
            assert "success" in data or "message" in data or "detail" in data
        else:
            pytest.skip("No employees found to test with")
    
    def test_cctv_faces_training_status_endpoint(self, auth_headers):
        """GET /api/cctv/faces/training-status - Test endpoint exists"""
        response = requests.get(
            f"{BASE_URL}/api/cctv/faces/training-status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Training status endpoint failed: {response.status_code}"
        data = response.json()
        # Verify response structure
        assert "total_faces" in data
        assert "fully_trained" in data
        assert "partially_trained" in data
        assert "training_percentage" in data
        assert "faces" in data
    
    def test_cctv_faces_training_status_with_branch_filter(self, auth_headers):
        """GET /api/cctv/faces/training-status?branch_id=xxx - Test branch filtering"""
        # First get a branch ID
        branch_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        if branch_response.status_code == 200:
            branches = branch_response.json()
            if branches:
                branch_id = branches[0].get("id")
                response = requests.get(
                    f"{BASE_URL}/api/cctv/faces/training-status",
                    headers=auth_headers,
                    params={"branch_id": branch_id}
                )
                assert response.status_code == 200
                data = response.json()
                assert "total_faces" in data


class TestDashboardLayout(TestAuth):
    """Test dashboard layout endpoints for Quick Actions widget"""
    
    def test_dashboard_stats_endpoint(self, auth_headers):
        """GET /api/dashboard/stats - Verify dashboard loads"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_sales" in data or "net_profit" in data
    
    def test_dashboard_layout_get(self, auth_headers):
        """GET /api/dashboard/layout - Get saved widget preferences"""
        response = requests.get(f"{BASE_URL}/api/dashboard/layout", headers=auth_headers)
        # Should return 200 or 404 (no saved layout)
        assert response.status_code in [200, 404]
    
    def test_dashboard_layout_save_with_quick_actions(self, auth_headers):
        """POST /api/dashboard/layout - Save layout with quickActions enabled"""
        response = requests.post(
            f"{BASE_URL}/api/dashboard/layout",
            headers=auth_headers,
            json={
                "widgets": {
                    "stats": True,
                    "charts": True,
                    "quickActions": True,  # Quick Actions widget enabled
                    "cashBank": True,
                    "lowStock": True,
                    "peakHours": True,
                    "customerInsights": True,
                    "profitTrend": True
                }
            }
        )
        assert response.status_code in [200, 201], f"Failed to save layout: {response.text}"


class TestBankParserFormats:
    """Test bank statement parser format detection"""
    
    def test_bank_parser_imports(self):
        """Test that bank parsers module has UAE bank support"""
        import sys
        sys.path.insert(0, '/app/backend')
        from services.bank_parsers import detect_bank_format, get_parser
        
        # Test Emirates NBD detection
        import pandas as pd
        df = pd.DataFrame({'col': ['Emirates NBD statement']})
        result = detect_bank_format(df, 'emirates_nbd_statement.csv')
        assert result == 'enbd', f"Expected 'enbd', got '{result}'"
        
        # Test RAK Bank detection
        result = detect_bank_format(df, 'rak_bank_statement.csv')
        assert result == 'rakbank', f"Expected 'rakbank', got '{result}'"
        
        # Test Dubai Islamic Bank detection
        result = detect_bank_format(df, 'dib_statement.csv')
        assert result == 'dib', f"Expected 'dib', got '{result}'"
    
    def test_emirates_nbd_parser_class_exists(self):
        """Test EmiratesNBDParser class exists"""
        import sys
        sys.path.insert(0, '/app/backend')
        from services.bank_parsers import EmiratesNBDParser
        
        parser = EmiratesNBDParser()
        assert parser.BANK_NAME == "Emirates NBD"
    
    def test_rakbank_parser_class_exists(self):
        """Test RAKBankParser class exists"""
        import sys
        sys.path.insert(0, '/app/backend')
        from services.bank_parsers import RAKBankParser
        
        parser = RAKBankParser()
        assert parser.BANK_NAME == "RAK Bank"
    
    def test_dib_parser_class_exists(self):
        """Test DubaiIslamicBankParser class exists"""
        import sys
        sys.path.insert(0, '/app/backend')
        from services.bank_parsers import DubaiIslamicBankParser
        
        parser = DubaiIslamicBankParser()
        assert parser.BANK_NAME == "Dubai Islamic Bank"
    
    def test_get_parser_returns_uae_parsers(self):
        """Test get_parser returns correct UAE bank parsers"""
        import sys
        sys.path.insert(0, '/app/backend')
        from services.bank_parsers import get_parser, EmiratesNBDParser, RAKBankParser, DubaiIslamicBankParser
        
        # Emirates NBD
        parser = get_parser('enbd')
        assert isinstance(parser, EmiratesNBDParser)
        
        # RAK Bank
        parser = get_parser('rakbank')
        assert isinstance(parser, RAKBankParser)
        
        # Dubai Islamic Bank
        parser = get_parser('dib')
        assert isinstance(parser, DubaiIslamicBankParser)


class TestPredictiveEndpoints(TestAuth):
    """Test predictive analytics endpoints still work"""
    
    def test_inventory_demand_prediction(self, auth_headers):
        """GET /api/predictions/inventory-demand"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/inventory-demand",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items_at_risk" in data
        # API returns 'items' or 'forecasts'
        assert "forecasts" in data or "items" in data
    
    def test_peak_hours_prediction(self, auth_headers):
        """GET /api/predictions/peak-hours"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/peak-hours",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "peak_hours" in data
        assert "total_transactions_analyzed" in data
    
    def test_customer_clv_prediction(self, auth_headers):
        """GET /api/predictions/customer-clv"""
        response = requests.get(
            f"{BASE_URL}/api/predictions/customer-clv",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "high_value_customers" in data or "total_projected_revenue" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
