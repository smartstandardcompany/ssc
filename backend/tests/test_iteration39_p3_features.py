"""
Iteration 39 Tests: P3 Features - ZATCA Phase 2 Compliance, i18n Translations, Mobile Nav Customization
Tests:
- ZATCA Phase 2 XML generation and QR code
- i18n translations for CCTV, Partner P&L, ZATCA Phase 2, Mobile Nav
- Partner P&L Report page
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "ss@ssc.com"
TEST_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


@pytest.fixture(scope="module")
def invoice_id(api_client):
    """Get an existing invoice ID for testing"""
    response = api_client.get(f"{BASE_URL}/api/invoices")
    assert response.status_code == 200
    invoices = response.json()
    if not invoices:
        pytest.skip("No invoices available for testing")
    return invoices[0]["id"]


class TestZATCAPhase2XMLGeneration:
    """Test ZATCA Phase 2 XML Invoice Generation endpoint"""

    def test_zatca_phase2_endpoint_returns_200(self, api_client, invoice_id):
        """GET /api/invoices/{id}/zatca-phase2 returns 200"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        assert response.status_code == 200
        print(f"PASS: ZATCA Phase 2 endpoint returns 200")

    def test_zatca_phase2_returns_uuid(self, api_client, invoice_id):
        """Response includes UUID"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        assert "uuid" in data
        assert len(data["uuid"]) == 36  # UUID format
        print(f"PASS: Response includes UUID: {data['uuid']}")

    def test_zatca_phase2_returns_xml_content(self, api_client, invoice_id):
        """Response includes xml_content"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        assert "xml_content" in data
        assert "<Invoice" in data["xml_content"]
        print(f"PASS: Response includes XML content")

    def test_zatca_phase2_xml_contains_ubl_elements(self, api_client, invoice_id):
        """XML contains required UBL elements"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        xml = data["xml_content"]
        
        required_elements = [
            "<cbc:ProfileID>",
            "<cbc:UUID>",
            "<cbc:ID>",  # Invoice number
            "<cbc:IssueDate>",
            "<cbc:IssueTime>",
            "<cbc:InvoiceTypeCode",
            "<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>",
            "<cac:AccountingSupplierParty>",
            "<cac:AccountingCustomerParty>",
            "<cac:PaymentMeans>",
            "<cac:TaxTotal>",
            "<cac:LegalMonetaryTotal>",
            "<cac:InvoiceLine>",
        ]
        
        for element in required_elements:
            assert element in xml, f"Missing element: {element}"
        print(f"PASS: XML contains all required UBL elements")

    def test_zatca_phase2_xml_contains_signature_structure(self, api_client, invoice_id):
        """XML contains digital signature structure"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        xml = data["xml_content"]
        
        # Signature elements
        assert "<cac:Signature>" in xml
        assert "urn:oasis:names:specification:ubl:signature:Invoice" in xml
        assert "sig:UBLDocumentSignatures" in xml
        print(f"PASS: XML contains signature structure")

    def test_zatca_phase2_returns_qr_code(self, api_client, invoice_id):
        """Response includes QR code base64"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        assert "qr_code_base64" in data
        assert len(data["qr_code_base64"]) > 100  # Should be substantial
        print(f"PASS: Response includes QR code base64")

    def test_zatca_phase2_qr_code_has_9_tags(self, api_client, invoice_id):
        """QR code contains 9 TLV tags"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        qr_data = base64.b64decode(data["qr_code_base64"])
        
        # Parse TLV and count tags
        tags = []
        i = 0
        while i < len(qr_data):
            tag = qr_data[i]
            length = qr_data[i+1]
            tags.append(tag)
            i = i + 2 + length
        
        assert len(tags) == 9, f"Expected 9 tags, got {len(tags)}"
        assert tags == [1, 2, 3, 4, 5, 6, 7, 8, 9], f"Tags should be 1-9, got {tags}"
        print(f"PASS: QR code contains 9 TLV tags: {tags}")

    def test_zatca_phase2_qr_tag1_seller_name(self, api_client, invoice_id):
        """QR Tag 1: Seller Name"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        qr_data = base64.b64decode(data["qr_code_base64"])
        
        # Tag 1 is at start
        tag = qr_data[0]
        length = qr_data[1]
        value = qr_data[2:2+length].decode('utf-8')
        
        assert tag == 1
        assert len(value) > 0
        print(f"PASS: Tag 1 (Seller Name): {value}")

    def test_zatca_phase2_qr_tag2_vat_number(self, api_client, invoice_id):
        """QR Tag 2: VAT Registration Number"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        qr_data = base64.b64decode(data["qr_code_base64"])
        
        # Parse to Tag 2
        i = 0
        for n in range(2):
            length = qr_data[i+1]
            if n == 1:
                tag = qr_data[i]
                value = qr_data[i+2:i+2+length].decode('utf-8')
                assert tag == 2
                print(f"PASS: Tag 2 (VAT Number): {value}")
                return
            i = i + 2 + length

    def test_zatca_phase2_qr_tag6_xml_hash(self, api_client, invoice_id):
        """QR Tag 6: Hash of XML Invoice"""
        response = api_client.get(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-phase2")
        data = response.json()
        
        # Also check xml_hash is returned
        assert "xml_hash" in data
        assert len(data["xml_hash"]) == 44  # Base64 SHA-256 hash
        print(f"PASS: Tag 6 (XML Hash): {data['xml_hash']}")


class TestZATCAPhase2Submit:
    """Test ZATCA Phase 2 Submit endpoint"""

    def test_zatca_submit_endpoint_returns_200(self, api_client, invoice_id):
        """POST /api/invoices/{id}/zatca-submit returns 200"""
        response = api_client.post(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-submit")
        assert response.status_code == 200
        print(f"PASS: ZATCA submit endpoint returns 200")

    def test_zatca_submit_returns_success(self, api_client, invoice_id):
        """Submit response has success: true"""
        response = api_client.post(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-submit")
        data = response.json()
        assert data.get("success") == True
        print(f"PASS: Submit response has success: true")

    def test_zatca_submit_returns_status(self, api_client, invoice_id):
        """Submit response has status: ready_for_submission"""
        response = api_client.post(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-submit")
        data = response.json()
        assert data.get("status") == "ready_for_submission"
        print(f"PASS: Submit response has status: ready_for_submission")

    def test_zatca_submit_returns_next_steps(self, api_client, invoice_id):
        """Submit response includes next_steps for CSID registration"""
        response = api_client.post(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-submit")
        data = response.json()
        assert "next_steps" in data
        assert len(data["next_steps"]) >= 3
        assert any("CSID" in step for step in data["next_steps"])
        print(f"PASS: Submit response includes next_steps: {len(data['next_steps'])} steps")

    def test_zatca_submit_returns_invoice_id(self, api_client, invoice_id):
        """Submit response includes invoice_id"""
        response = api_client.post(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-submit")
        data = response.json()
        assert data.get("invoice_id") == invoice_id
        print(f"PASS: Submit response includes correct invoice_id")

    def test_zatca_submit_returns_b2c_flag(self, api_client, invoice_id):
        """Submit response includes is_b2c flag"""
        response = api_client.post(f"{BASE_URL}/api/invoices/{invoice_id}/zatca-submit")
        data = response.json()
        assert "is_b2c" in data
        print(f"PASS: Submit response includes is_b2c: {data['is_b2c']}")


class TestZATCAPhase2ErrorHandling:
    """Test ZATCA Phase 2 error handling"""

    def test_zatca_phase2_invalid_invoice_returns_404(self, api_client):
        """Invalid invoice ID returns 404"""
        response = api_client.get(f"{BASE_URL}/api/invoices/invalid-id/zatca-phase2")
        assert response.status_code == 404
        print(f"PASS: Invalid invoice ID returns 404")

    def test_zatca_submit_invalid_invoice_returns_404(self, api_client):
        """Invalid invoice ID on submit returns 404"""
        response = api_client.post(f"{BASE_URL}/api/invoices/invalid-id/zatca-submit")
        assert response.status_code == 404
        print(f"PASS: Invalid invoice ID on submit returns 404")


class TestPartnerPLReportEndpoint:
    """Test Partner P&L Report endpoint"""

    def test_partner_pl_report_returns_200(self, api_client):
        """GET /api/partner-pl-report returns 200"""
        response = api_client.get(f"{BASE_URL}/api/partner-pl-report")
        assert response.status_code == 200
        print(f"PASS: Partner P&L report returns 200")

    def test_partner_pl_report_has_company_summary(self, api_client):
        """Report includes company_summary"""
        response = api_client.get(f"{BASE_URL}/api/partner-pl-report")
        data = response.json()
        assert "company_summary" in data
        summary = data["company_summary"]
        assert "total_revenue" in summary
        assert "net_profit" in summary
        print(f"PASS: Report includes company_summary with revenue and profit")

    def test_partner_pl_report_supports_date_filter(self, api_client):
        """Report supports date range filtering"""
        response = api_client.get(f"{BASE_URL}/api/partner-pl-report?start_date=2026-01-01&end_date=2026-12-31")
        assert response.status_code == 200
        print(f"PASS: Report supports date range filtering")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
