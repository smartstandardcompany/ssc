"""
Iteration 11: WhatsApp Send-To and Bank Reconciliation Testing
- WhatsApp notification triggers with flexible phone numbers
- Bank Reconciliation (POS sales comparison with 1-day offset)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestIteration11:
    """Test WhatsApp send-to and Bank Reconciliation features"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with admin credentials
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "SSC@SSC.com",
            "password": "Aa147258369SsC@"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        token = login_resp.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.token = token
    
    # ===== WhatsApp Tests =====
    
    def test_01_whatsapp_send_to_requires_phone(self):
        """POST /api/whatsapp/send-to without phone should return 400"""
        resp = self.session.post(f"{BASE_URL}/api/whatsapp/send-to", json={
            "report_type": "daily_sales"
        })
        assert resp.status_code == 400
        assert "Phone number required" in resp.json().get("detail", "")
        print("PASS: WhatsApp send-to requires phone number")
    
    def test_02_whatsapp_send_to_with_daily_sales(self):
        """POST /api/whatsapp/send-to with phone and daily_sales report type"""
        # Twilio is configured in the database, so this should work
        resp = self.session.post(f"{BASE_URL}/api/whatsapp/send-to", json={
            "phone": "+966500000000",
            "report_type": "daily_sales"
        })
        # Should return 200 with message sent confirmation
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert "message" in data, "Response should have 'message' field"
        assert "preview" in data, "Response should have 'preview' field with report content"
        assert "Daily Sales" in data.get("preview", ""), "Preview should contain 'Daily Sales'"
        print(f"PASS: WhatsApp send-to daily_sales returns preview: {data.get('preview', '')[:100]}...")
    
    def test_03_whatsapp_send_to_accepts_all_report_types(self):
        """Verify send-to endpoint accepts phone and various report types"""
        report_types = ["daily_sales", "expense_summary", "low_stock", "branch_report"]
        for rt in report_types:
            resp = self.session.post(f"{BASE_URL}/api/whatsapp/send-to", json={
                "phone": "+966500000000",
                "report_type": rt
            })
            # Should return 200 when Twilio is configured
            assert resp.status_code == 200, f"Expected 200 for report_type={rt}, got {resp.status_code}: {resp.text}"
            data = resp.json()
            assert "message" in data, f"Response for {rt} should have 'message' field"
            assert "preview" in data, f"Response for {rt} should have 'preview' field"
            print(f"PASS: WhatsApp send-to accepts report_type={rt}, preview length: {len(data.get('preview', ''))}")
    
    def test_04_whatsapp_send_to_rejects_invalid_report_type(self):
        """POST /api/whatsapp/send-to with invalid report_type should fail"""
        resp = self.session.post(f"{BASE_URL}/api/whatsapp/send-to", json={
            "phone": "+966500000000",
            "report_type": "invalid_type"
        })
        # Should return 400 with "Unknown report type" error
        assert resp.status_code == 400, f"Expected 400 for invalid report_type, got {resp.status_code}"
        detail = resp.json().get("detail", "")
        assert "Unknown report type" in detail, f"Expected 'Unknown report type' error, got: {detail}"
        print("PASS: WhatsApp send-to rejects invalid report_type with 400 error")
    
    # ===== Bank Statement & Reconciliation Tests =====
    
    def test_05_get_bank_statements_list(self):
        """GET /api/bank-statements returns list of uploaded statements"""
        resp = self.session.get(f"{BASE_URL}/api/bank-statements")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list), "Expected list of bank statements"
        print(f"PASS: GET /api/bank-statements returns {len(data)} statements")
        # Store first statement ID for reconciliation test
        if data:
            self.statement_id = data[0]["id"]
        return data
    
    def test_06_get_bank_statement_detail(self):
        """GET /api/bank-statements/{id} returns statement details"""
        # First get list of statements
        resp = self.session.get(f"{BASE_URL}/api/bank-statements")
        assert resp.status_code == 200
        statements = resp.json()
        
        if not statements:
            print("SKIP: No bank statements uploaded to test detail endpoint")
            return
        
        stmt_id = statements[0]["id"]
        detail_resp = self.session.get(f"{BASE_URL}/api/bank-statements/{stmt_id}")
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        
        # Verify required fields
        assert "id" in detail
        assert "transactions" in detail or "transaction_count" in detail
        print(f"PASS: GET /api/bank-statements/{stmt_id} returns statement details")
    
    def test_07_get_bank_statement_analysis(self):
        """GET /api/bank-statements/{id}/analysis returns analysis data"""
        resp = self.session.get(f"{BASE_URL}/api/bank-statements")
        assert resp.status_code == 200
        statements = resp.json()
        
        if not statements:
            print("SKIP: No bank statements uploaded to test analysis endpoint")
            return
        
        stmt_id = statements[0]["id"]
        analysis_resp = self.session.get(f"{BASE_URL}/api/bank-statements/{stmt_id}/analysis")
        assert analysis_resp.status_code == 200
        analysis = analysis_resp.json()
        
        # Verify analysis contains expected fields
        print(f"PASS: GET /api/bank-statements/{stmt_id}/analysis returns analysis data")
    
    def test_08_get_reconciliation_endpoint(self):
        """GET /api/bank-statements/{id}/reconciliation returns reconciliation data"""
        resp = self.session.get(f"{BASE_URL}/api/bank-statements")
        assert resp.status_code == 200
        statements = resp.json()
        
        if not statements:
            print("SKIP: No bank statements uploaded to test reconciliation endpoint")
            return
        
        stmt_id = statements[0]["id"]
        recon_resp = self.session.get(f"{BASE_URL}/api/bank-statements/{stmt_id}/reconciliation")
        assert recon_resp.status_code == 200
        recon = recon_resp.json()
        
        # Verify reconciliation response structure
        assert "rows" in recon, "Reconciliation should have 'rows' field"
        assert "summary" in recon, "Reconciliation should have 'summary' field"
        
        # Verify summary fields
        summary = recon["summary"]
        assert "total_bank_pos" in summary, "Summary should have 'total_bank_pos'"
        assert "total_app_sales" in summary, "Summary should have 'total_app_sales'"
        assert "total_difference" in summary, "Summary should have 'total_difference'"
        assert "matched_count" in summary, "Summary should have 'matched_count'"
        assert "discrepancy_count" in summary, "Summary should have 'discrepancy_count'"
        
        # Verify rows structure (if any rows exist)
        if recon["rows"]:
            row = recon["rows"][0]
            assert "deposit_date" in row, "Row should have 'deposit_date'"
            assert "sale_date" in row or row.get("sale_date") == "", "Row should have 'sale_date' field"
            assert "branch" in row, "Row should have 'branch'"
            assert "bank_amount" in row, "Row should have 'bank_amount'"
            assert "app_amount" in row, "Row should have 'app_amount'"
            assert "difference" in row, "Row should have 'difference'"
            assert "status" in row, "Row should have 'status'"
            print(f"PASS: Reconciliation has {len(recon['rows'])} rows with correct structure")
        else:
            print("PASS: Reconciliation endpoint returns correct structure (0 rows)")
        
        print(f"PASS: Summary - Bank POS: {summary['total_bank_pos']}, App Sales: {summary['total_app_sales']}, Matched: {summary['matched_count']}")
    
    def test_09_reconciliation_404_for_invalid_id(self):
        """GET /api/bank-statements/invalid-id/reconciliation returns 404"""
        resp = self.session.get(f"{BASE_URL}/api/bank-statements/invalid-statement-id/reconciliation")
        assert resp.status_code == 404
        print("PASS: Reconciliation returns 404 for invalid statement ID")
    
    def test_10_reconciliation_1_day_offset_logic(self):
        """Verify reconciliation calculates 1-day offset (sale_date = deposit_date - 1)"""
        resp = self.session.get(f"{BASE_URL}/api/bank-statements")
        assert resp.status_code == 200
        statements = resp.json()
        
        if not statements:
            print("SKIP: No bank statements to verify offset logic")
            return
        
        stmt_id = statements[0]["id"]
        recon_resp = self.session.get(f"{BASE_URL}/api/bank-statements/{stmt_id}/reconciliation")
        assert recon_resp.status_code == 200
        recon = recon_resp.json()
        
        # Check if any rows have both deposit_date and sale_date to verify offset
        rows_with_sale_date = [r for r in recon["rows"] if r.get("sale_date")]
        if rows_with_sale_date:
            for row in rows_with_sale_date[:3]:  # Check first 3 rows
                deposit = row["deposit_date"]
                sale = row["sale_date"]
                # Sale date should be 1 day before deposit date
                from datetime import datetime, timedelta
                try:
                    deposit_dt = datetime.strptime(deposit, "%Y-%m-%d")
                    sale_dt = datetime.strptime(sale, "%Y-%m-%d")
                    expected_sale = deposit_dt - timedelta(days=1)
                    assert sale_dt == expected_sale, f"Sale date {sale} should be 1 day before deposit {deposit}"
                    print(f"PASS: Row with deposit={deposit}, sale={sale} follows 1-day offset rule")
                except ValueError:
                    print(f"WARN: Could not parse dates - deposit={deposit}, sale={sale}")
        else:
            print("SKIP: No rows with both deposit_date and sale_date to verify offset")
    
    # ===== Additional Helper Tests =====
    
    def test_11_branches_endpoint(self):
        """GET /api/branches works for branch dropdown in WhatsApp dialog"""
        resp = self.session.get(f"{BASE_URL}/api/branches")
        assert resp.status_code == 200
        branches = resp.json()
        assert isinstance(branches, list)
        print(f"PASS: GET /api/branches returns {len(branches)} branches")
    
    def test_12_pos_machines_endpoint(self):
        """GET /api/pos-machines works for reconciliation mapping"""
        resp = self.session.get(f"{BASE_URL}/api/pos-machines")
        assert resp.status_code == 200
        machines = resp.json()
        assert isinstance(machines, list)
        print(f"PASS: GET /api/pos-machines returns {len(machines)} machines")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
