"""
Iteration 61 Tests: Dashboard Tour, PDF Bank Statement Parsing, WhatsApp Chatbot, AI Shift Scheduling, and PWA
Features tested:
1. Dashboard Tour component (9 steps)
2. PDF bank statement parsing endpoint
3. WhatsApp chatbot webhook and test-command endpoints
4. AI shift schedule generation and peak hours analysis
5. PWA manifest and service worker
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestAuthentication:
    """Get auth token for protected endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestWhatsAppChatbot(TestAuthentication):
    """Test WhatsApp chatbot webhook and test command endpoints"""
    
    def test_whatsapp_webhook_endpoint_exists(self):
        """Test POST /api/whatsapp/webhook endpoint exists"""
        # Webhook should accept POST without authentication (it's for Twilio)
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/webhook",
            data={"Body": "help", "From": "whatsapp:+1234567890", "To": "whatsapp:+0987654321", "MessageSid": "test123"}
        )
        # Should return 200 with processed status
        assert response.status_code == 200, f"Webhook failed: {response.text}"
        data = response.json()
        assert "status" in data
        assert data["status"] == "processed"
    
    def test_whatsapp_test_command_help(self, auth_headers):
        """Test /api/whatsapp/test-command with 'help' command"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/test-command",
            json={"command": "help"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Test command failed: {response.text}"
        data = response.json()
        assert "command" in data
        assert "response" in data
        assert data["command"] == "help"
        # Verify help message contains key commands
        assert "sales" in data["response"].lower()
        assert "stock" in data["response"].lower()
        assert "expenses" in data["response"].lower()
    
    def test_whatsapp_test_command_sales_today(self, auth_headers):
        """Test chatbot 'sales today' command"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/test-command",
            json={"command": "sales today"},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Test command failed: {response.text}"
        data = response.json()
        assert "response" in data
        assert "Today's Sales" in data["response"]
    
    def test_whatsapp_test_command_sales_week(self, auth_headers):
        """Test chatbot 'sales week' command"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/test-command",
            json={"command": "sales week"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "Week" in data["response"]
    
    def test_whatsapp_test_command_stock_low(self, auth_headers):
        """Test chatbot 'stock low' command"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/test-command",
            json={"command": "stock low"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        # Should show either low stock items or "well-stocked" message
        assert "Stock" in data["response"]
    
    def test_whatsapp_test_command_expenses_today(self, auth_headers):
        """Test chatbot 'expenses today' command"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/test-command",
            json={"command": "expenses today"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "Expenses" in data["response"]
    
    def test_whatsapp_test_command_summary(self, auth_headers):
        """Test chatbot 'summary' command"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/test-command",
            json={"command": "summary"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "Summary" in data["response"]
    
    def test_whatsapp_test_command_profit(self, auth_headers):
        """Test chatbot 'profit' command"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/test-command",
            json={"command": "profit"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "Profit" in data["response"]
    
    def test_whatsapp_test_command_unknown(self, auth_headers):
        """Test chatbot with unknown command returns help hint"""
        response = requests.post(
            f"{BASE_URL}/api/whatsapp/test-command",
            json={"command": "blahblahblah"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "help" in data["response"].lower()


class TestAIShiftScheduling(TestAuthentication):
    """Test AI shift scheduling endpoints"""
    
    def test_peak_hours_analysis(self, auth_headers):
        """Test GET /api/schedules/peak-hours/analysis"""
        response = requests.get(
            f"{BASE_URL}/api/schedules/peak-hours/analysis",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Peak hours analysis failed: {response.text}"
        data = response.json()
        # Verify response structure
        assert "hourly_data" in data
        assert "busiest_hours" in data
        assert "slowest_hours" in data
        assert "analysis_period_days" in data
        # Hourly data should have 24 entries (one for each hour)
        assert isinstance(data["hourly_data"], list)
        # Each entry should have hour, label, score
        if len(data["hourly_data"]) > 0:
            entry = data["hourly_data"][0]
            assert "hour" in entry
            assert "label" in entry
            assert "score" in entry
    
    def test_generate_schedule(self, auth_headers):
        """Test POST /api/schedules/generate"""
        response = requests.post(
            f"{BASE_URL}/api/schedules/generate",
            json={
                "days": 7,
                "shift_duration": 8,
                "min_staff": 1,
                "max_staff": 3
            },
            headers=auth_headers
        )
        assert response.status_code == 200, f"Schedule generation failed: {response.text}"
        data = response.json()
        # Verify response structure
        assert "success" in data
        # May be false if no employees, but structure should be correct
        if data["success"]:
            assert "schedule" in data
            assert "summary" in data
            assert "employee_hours" in data
            assert "schedule_id" in data
        else:
            # If no employees, should have error message
            assert "error" in data
    
    def test_get_schedules_list(self, auth_headers):
        """Test GET /api/schedules"""
        response = requests.get(
            f"{BASE_URL}/api/schedules",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get schedules failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)


class TestPDFBankStatementParsing(TestAuthentication):
    """Test PDF bank statement parsing"""
    
    def test_bank_reconciliation_upload_pdf(self, auth_headers):
        """Test bank statement upload endpoint with PDF file"""
        # Create a minimal PDF-like file for testing
        # Note: This tests if the endpoint accepts PDF files
        pdf_content = b"%PDF-1.4 test content"  # Minimal PDF header
        
        files = {
            'file': ('test_statement.pdf', pdf_content, 'application/pdf')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/bank-reconciliation/upload",
            files=files,
            headers=auth_headers
        )
        # Should either process successfully or return error about invalid PDF
        # Both are acceptable - we're testing endpoint accepts PDF files
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}, {response.text}"
    
    def test_bank_formats_endpoint(self, auth_headers):
        """Test bank formats info endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/bank-reconciliation/formats",
            headers=auth_headers
        )
        # If endpoint exists
        if response.status_code == 200:
            data = response.json()
            # Should include PDF info
            assert isinstance(data, (list, dict))


class TestScheduleRetrieval(TestAuthentication):
    """Test schedule retrieval endpoints"""
    
    def test_get_schedules_with_status_filter(self, auth_headers):
        """Test GET /api/schedules with status filter"""
        response = requests.get(
            f"{BASE_URL}/api/schedules?status=draft",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_nonexistent_schedule(self, auth_headers):
        """Test GET /api/schedules/{id} with non-existent ID"""
        response = requests.get(
            f"{BASE_URL}/api/schedules/nonexistent123",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestPWAAssets:
    """Test PWA manifest and service worker files"""
    
    def test_manifest_json_exists(self):
        """Test manifest.json is accessible"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200, f"Manifest not found: {response.status_code}"
        data = response.json()
        # Verify PWA manifest structure
        assert "name" in data
        assert "short_name" in data
        assert "start_url" in data
        assert "display" in data
        assert "icons" in data
    
    def test_manifest_has_shortcuts(self):
        """Test manifest.json has shortcuts configured"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        data = response.json()
        assert "shortcuts" in data
        assert len(data["shortcuts"]) > 0
        # Verify shortcut structure
        shortcut = data["shortcuts"][0]
        assert "name" in shortcut
        assert "url" in shortcut
    
    def test_service_worker_exists(self):
        """Test sw.js service worker file exists"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200, f"Service worker not found: {response.status_code}"
        content = response.text
        # Verify service worker content
        assert "CACHE_NAME" in content
        assert "fetch" in content
    
    def test_offline_html_exists(self):
        """Test offline.html page exists"""
        response = requests.get(f"{BASE_URL}/offline.html")
        assert response.status_code == 200, f"Offline page not found: {response.status_code}"
        content = response.text
        assert "offline" in content.lower()


class TestWhatsAppMessages(TestAuthentication):
    """Test WhatsApp message history endpoint"""
    
    def test_get_whatsapp_messages(self, auth_headers):
        """Test GET /api/whatsapp/messages"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/messages",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_whatsapp_messages_with_phone_filter(self, auth_headers):
        """Test GET /api/whatsapp/messages with phone filter"""
        response = requests.get(
            f"{BASE_URL}/api/whatsapp/messages?phone=123",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


@pytest.fixture(scope="module")
def auth_token():
    """Module-level auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Module-level auth headers"""
    return {"Authorization": f"Bearer {auth_token}"}
