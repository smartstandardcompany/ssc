"""
ZATCA Phase 2 E-Invoicing Service
Implements XML invoice generation, digital signatures, and API submission structure
"""

import base64
import hashlib
import struct
import uuid as uuid_lib
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any
from xml.etree import ElementTree as ET
from xml.dom import minidom


class ZATCAPhase2Service:
    """Service for generating ZATCA Phase 2 compliant e-invoices"""
    
    # XML Namespaces
    NAMESPACES = {
        'cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
        'sig': 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2',
        'sac': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2',
        'sbc': 'urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2'
    }
    
    # Invoice Type Codes
    INVOICE_TYPE_TAX = "388"  # Standard Tax Invoice
    INVOICE_TYPE_SIMPLIFIED = "381"  # Simplified Tax Invoice (B2C)
    INVOICE_TYPE_DEBIT = "383"  # Debit Note
    INVOICE_TYPE_CREDIT = "384"  # Credit Note
    
    def __init__(self, company_settings: Dict[str, Any]):
        """Initialize with company settings"""
        self.company_name = company_settings.get("company_name", "")
        self.company_name_ar = company_settings.get("company_name_ar", self.company_name)
        self.vat_number = company_settings.get("vat_number", "")
        self.cr_number = company_settings.get("cr_number", "")  # Commercial Registration
        self.address = {
            "street": company_settings.get("address_street", ""),
            "building": company_settings.get("address_building", ""),
            "city": company_settings.get("city", ""),
            "district": company_settings.get("district", ""),
            "postal_code": company_settings.get("postal_code", ""),
            "country": "SA"
        }
    
    def generate_uuid(self) -> str:
        """Generate a UUID for the invoice"""
        return str(uuid_lib.uuid4())
    
    def generate_invoice_hash(self, xml_content: str) -> str:
        """Generate SHA-256 hash of invoice XML (for signing)"""
        # Remove whitespace and normalize
        normalized = ''.join(xml_content.split())
        hash_bytes = hashlib.sha256(normalized.encode('utf-8')).digest()
        return base64.b64encode(hash_bytes).decode('ascii')
    
    def tlv_encode(self, tag: int, value: str) -> bytes:
        """Encode a TLV (Tag-Length-Value) field"""
        value_bytes = value.encode('utf-8')
        return struct.pack(f'BB{len(value_bytes)}s', tag, len(value_bytes), value_bytes)
    
    def generate_qr_code_phase2(self, invoice_data: Dict[str, Any], xml_hash: str, signature: str = "") -> str:
        """
        Generate ZATCA Phase 2 QR code with 9 tags in TLV format
        Tags:
        1: Seller Name
        2: VAT Registration Number
        3: Invoice Timestamp (ISO 8601)
        4: Invoice Total (with VAT)
        5: VAT Amount
        6: Hash of XML Invoice
        7: ECDSA Signature
        8: Public Key
        9: Certificate Signature (CSID stamp)
        """
        tlv_data = b''
        
        # Tag 1: Seller Name
        tlv_data += self.tlv_encode(1, self.company_name)
        
        # Tag 2: VAT Number
        tlv_data += self.tlv_encode(2, self.vat_number)
        
        # Tag 3: Timestamp
        timestamp = invoice_data.get("timestamp", datetime.now(timezone.utc).isoformat())
        tlv_data += self.tlv_encode(3, timestamp)
        
        # Tag 4: Total with VAT
        total = str(round(invoice_data.get("total_with_vat", 0), 2))
        tlv_data += self.tlv_encode(4, total)
        
        # Tag 5: VAT Amount
        vat = str(round(invoice_data.get("vat_amount", 0), 2))
        tlv_data += self.tlv_encode(5, vat)
        
        # Tag 6: Invoice Hash (SHA-256 of XML)
        tlv_data += self.tlv_encode(6, xml_hash)
        
        # Tag 7: ECDSA Signature (placeholder - requires actual signing certificate)
        sig = signature if signature else "PLACEHOLDER_SIGNATURE"
        tlv_data += self.tlv_encode(7, sig)
        
        # Tag 8: Public Key (placeholder - requires CSID from ZATCA)
        tlv_data += self.tlv_encode(8, "PLACEHOLDER_PUBLIC_KEY")
        
        # Tag 9: Certificate Signature / CSID Stamp (placeholder)
        tlv_data += self.tlv_encode(9, "PLACEHOLDER_CSID")
        
        return base64.b64encode(tlv_data).decode('ascii')
    
    def generate_xml_invoice(self, invoice_data: Dict[str, Any], customer_data: Optional[Dict] = None) -> str:
        """Generate ZATCA Phase 2 compliant XML invoice"""
        
        # Determine invoice type
        is_b2c = not customer_data or not customer_data.get("vat_number")
        invoice_type_code = self.INVOICE_TYPE_SIMPLIFIED if is_b2c else self.INVOICE_TYPE_TAX
        
        # Root element
        root = ET.Element('Invoice', {
            'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
            'xmlns:cac': self.NAMESPACES['cac'],
            'xmlns:cbc': self.NAMESPACES['cbc'],
            'xmlns:ext': self.NAMESPACES['ext']
        })
        
        # UBL Extensions (for signature)
        ext_container = ET.SubElement(root, 'ext:UBLExtensions')
        ext = ET.SubElement(ext_container, 'ext:UBLExtension')
        ext_content = ET.SubElement(ext, 'ext:ExtensionContent')
        # Signature placeholder
        sig_placeholder = ET.SubElement(ext_content, 'sig:UBLDocumentSignatures', {
            'xmlns:sig': self.NAMESPACES['sig'],
            'xmlns:sac': self.NAMESPACES['sac'],
            'xmlns:sbc': self.NAMESPACES['sbc']
        })
        
        # Profile ID
        profile_id = ET.SubElement(root, 'cbc:ProfileID')
        profile_id.text = 'reporting:1.0'
        
        # Invoice UUID (mandatory for Phase 2)
        inv_uuid = ET.SubElement(root, 'cbc:UUID')
        inv_uuid.text = invoice_data.get("uuid", self.generate_uuid())
        
        # Invoice Number
        inv_id = ET.SubElement(root, 'cbc:ID')
        inv_id.text = invoice_data.get("invoice_number", "")
        
        # Issue Date
        issue_date = ET.SubElement(root, 'cbc:IssueDate')
        issue_date.text = invoice_data.get("date", datetime.now().strftime("%Y-%m-%d"))
        
        # Issue Time
        issue_time = ET.SubElement(root, 'cbc:IssueTime')
        issue_time.text = invoice_data.get("time", datetime.now().strftime("%H:%M:%S"))
        
        # Invoice Type Code
        type_code = ET.SubElement(root, 'cbc:InvoiceTypeCode', {'name': '0100000' if is_b2c else '0200000'})
        type_code.text = invoice_type_code
        
        # Document Currency
        currency = ET.SubElement(root, 'cbc:DocumentCurrencyCode')
        currency.text = 'SAR'
        
        # Tax Currency
        tax_currency = ET.SubElement(root, 'cbc:TaxCurrencyCode')
        tax_currency.text = 'SAR'
        
        # Invoice Counter (Previous Invoice Hash for chain)
        if invoice_data.get("previous_invoice_hash"):
            additional_ref = ET.SubElement(root, 'cac:AdditionalDocumentReference')
            ref_id = ET.SubElement(additional_ref, 'cbc:ID')
            ref_id.text = 'PIH'
            attachment = ET.SubElement(additional_ref, 'cac:Attachment')
            embed = ET.SubElement(attachment, 'cbc:EmbeddedDocumentBinaryObject', {'mimeCode': 'text/plain'})
            embed.text = invoice_data.get("previous_invoice_hash", "")
        
        # Signature reference
        sig_ref = ET.SubElement(root, 'cac:Signature')
        sig_id = ET.SubElement(sig_ref, 'cbc:ID')
        sig_id.text = 'urn:oasis:names:specification:ubl:signature:Invoice'
        sig_method = ET.SubElement(sig_ref, 'cbc:SignatureMethod')
        sig_method.text = 'urn:oasis:names:specification:ubl:dsig:enveloped:xades'
        
        # Supplier (Seller) Party
        supplier = ET.SubElement(root, 'cac:AccountingSupplierParty')
        supplier_party = ET.SubElement(supplier, 'cac:Party')
        
        # Supplier Identification
        party_id = ET.SubElement(supplier_party, 'cac:PartyIdentification')
        id_elem = ET.SubElement(party_id, 'cbc:ID', {'schemeID': 'CRN'})
        id_elem.text = self.cr_number
        
        # Supplier Address
        postal_addr = ET.SubElement(supplier_party, 'cac:PostalAddress')
        street = ET.SubElement(postal_addr, 'cbc:StreetName')
        street.text = self.address["street"]
        building = ET.SubElement(postal_addr, 'cbc:BuildingNumber')
        building.text = self.address["building"]
        city = ET.SubElement(postal_addr, 'cbc:CityName')
        city.text = self.address["city"]
        postal_code = ET.SubElement(postal_addr, 'cbc:PostalZone')
        postal_code.text = self.address["postal_code"]
        district = ET.SubElement(postal_addr, 'cbc:CitySubdivisionName')
        district.text = self.address["district"]
        country = ET.SubElement(postal_addr, 'cac:Country')
        country_code = ET.SubElement(country, 'cbc:IdentificationCode')
        country_code.text = 'SA'
        
        # Supplier Tax Scheme
        party_tax = ET.SubElement(supplier_party, 'cac:PartyTaxScheme')
        tax_id = ET.SubElement(party_tax, 'cbc:CompanyID')
        tax_id.text = self.vat_number
        tax_scheme = ET.SubElement(party_tax, 'cac:TaxScheme')
        tax_scheme_id = ET.SubElement(tax_scheme, 'cbc:ID')
        tax_scheme_id.text = 'VAT'
        
        # Supplier Legal Entity
        legal = ET.SubElement(supplier_party, 'cac:PartyLegalEntity')
        legal_name = ET.SubElement(legal, 'cbc:RegistrationName')
        legal_name.text = self.company_name
        
        # Customer (Buyer) Party
        customer = ET.SubElement(root, 'cac:AccountingCustomerParty')
        customer_party = ET.SubElement(customer, 'cac:Party')
        
        if customer_data:
            # Customer Identification
            cust_party_id = ET.SubElement(customer_party, 'cac:PartyIdentification')
            cust_id = ET.SubElement(cust_party_id, 'cbc:ID', {'schemeID': 'NAT'})
            cust_id.text = customer_data.get("id_number", "")
            
            # Customer Tax (if B2B)
            if customer_data.get("vat_number"):
                cust_tax = ET.SubElement(customer_party, 'cac:PartyTaxScheme')
                cust_tax_id = ET.SubElement(cust_tax, 'cbc:CompanyID')
                cust_tax_id.text = customer_data.get("vat_number", "")
                cust_tax_scheme = ET.SubElement(cust_tax, 'cac:TaxScheme')
                cust_tax_scheme_id = ET.SubElement(cust_tax_scheme, 'cbc:ID')
                cust_tax_scheme_id.text = 'VAT'
            
            # Customer Legal Entity
            cust_legal = ET.SubElement(customer_party, 'cac:PartyLegalEntity')
            cust_name = ET.SubElement(cust_legal, 'cbc:RegistrationName')
            cust_name.text = customer_data.get("name", "")
        
        # Payment Means
        payment = ET.SubElement(root, 'cac:PaymentMeans')
        payment_code = ET.SubElement(payment, 'cbc:PaymentMeansCode')
        payment_code.text = self._get_payment_code(invoice_data.get("payment_mode", "cash"))
        
        # Tax Total
        tax_total = ET.SubElement(root, 'cac:TaxTotal')
        tax_amount = ET.SubElement(tax_total, 'cbc:TaxAmount', {'currencyID': 'SAR'})
        tax_amount.text = str(round(invoice_data.get("vat_amount", 0), 2))
        
        # Tax Subtotal
        tax_subtotal = ET.SubElement(tax_total, 'cac:TaxSubtotal')
        taxable = ET.SubElement(tax_subtotal, 'cbc:TaxableAmount', {'currencyID': 'SAR'})
        taxable.text = str(round(invoice_data.get("subtotal", 0) - invoice_data.get("discount", 0), 2))
        tax_sub_amt = ET.SubElement(tax_subtotal, 'cbc:TaxAmount', {'currencyID': 'SAR'})
        tax_sub_amt.text = str(round(invoice_data.get("vat_amount", 0), 2))
        tax_cat = ET.SubElement(tax_subtotal, 'cac:TaxCategory')
        tax_cat_id = ET.SubElement(tax_cat, 'cbc:ID')
        tax_cat_id.text = 'S'  # Standard rate
        tax_percent = ET.SubElement(tax_cat, 'cbc:Percent')
        tax_percent.text = str(invoice_data.get("vat_rate", 15))
        tax_cat_scheme = ET.SubElement(tax_cat, 'cac:TaxScheme')
        tax_cat_scheme_id = ET.SubElement(tax_cat_scheme, 'cbc:ID')
        tax_cat_scheme_id.text = 'VAT'
        
        # Legal Monetary Total
        legal_total = ET.SubElement(root, 'cac:LegalMonetaryTotal')
        line_ext = ET.SubElement(legal_total, 'cbc:LineExtensionAmount', {'currencyID': 'SAR'})
        line_ext.text = str(round(invoice_data.get("subtotal", 0), 2))
        tax_excl = ET.SubElement(legal_total, 'cbc:TaxExclusiveAmount', {'currencyID': 'SAR'})
        tax_excl.text = str(round(invoice_data.get("total", 0), 2))
        tax_incl = ET.SubElement(legal_total, 'cbc:TaxInclusiveAmount', {'currencyID': 'SAR'})
        tax_incl.text = str(round(invoice_data.get("total_with_vat", 0), 2))
        allowance = ET.SubElement(legal_total, 'cbc:AllowanceTotalAmount', {'currencyID': 'SAR'})
        allowance.text = str(round(invoice_data.get("discount", 0), 2))
        payable = ET.SubElement(legal_total, 'cbc:PayableAmount', {'currencyID': 'SAR'})
        payable.text = str(round(invoice_data.get("total_with_vat", 0), 2))
        
        # Invoice Lines (Items)
        for idx, item in enumerate(invoice_data.get("items", []), start=1):
            inv_line = ET.SubElement(root, 'cac:InvoiceLine')
            line_id = ET.SubElement(inv_line, 'cbc:ID')
            line_id.text = str(idx)
            quantity = ET.SubElement(inv_line, 'cbc:InvoicedQuantity', {'unitCode': 'PCE'})
            quantity.text = str(item.get("quantity", 1))
            line_amt = ET.SubElement(inv_line, 'cbc:LineExtensionAmount', {'currencyID': 'SAR'})
            line_amt.text = str(round(item.get("total", 0), 2))
            
            # Item Tax
            item_tax = ET.SubElement(inv_line, 'cac:TaxTotal')
            item_tax_amt = ET.SubElement(item_tax, 'cbc:TaxAmount', {'currencyID': 'SAR'})
            item_vat = round(item.get("total", 0) * invoice_data.get("vat_rate", 15) / 100, 2)
            item_tax_amt.text = str(item_vat)
            item_tax_percent = ET.SubElement(item_tax, 'cbc:RoundingAmount', {'currencyID': 'SAR'})
            item_tax_percent.text = str(round(item.get("total", 0) + item_vat, 2))
            
            # Item details
            item_elem = ET.SubElement(inv_line, 'cac:Item')
            item_name = ET.SubElement(item_elem, 'cbc:Name')
            item_name.text = item.get("description", "")
            
            # Item Tax Category
            item_tax_cat = ET.SubElement(item_elem, 'cac:ClassifiedTaxCategory')
            item_tax_cat_id = ET.SubElement(item_tax_cat, 'cbc:ID')
            item_tax_cat_id.text = 'S'
            item_tax_cat_pct = ET.SubElement(item_tax_cat, 'cbc:Percent')
            item_tax_cat_pct.text = str(invoice_data.get("vat_rate", 15))
            item_tax_scheme2 = ET.SubElement(item_tax_cat, 'cac:TaxScheme')
            item_tax_scheme_id2 = ET.SubElement(item_tax_scheme2, 'cbc:ID')
            item_tax_scheme_id2.text = 'VAT'
            
            # Item Price
            price_elem = ET.SubElement(inv_line, 'cac:Price')
            price_amt = ET.SubElement(price_elem, 'cbc:PriceAmount', {'currencyID': 'SAR'})
            price_amt.text = str(round(item.get("unit_price", 0), 2))
        
        # Convert to string with pretty printing
        xml_str = ET.tostring(root, encoding='unicode')
        dom = minidom.parseString(xml_str)
        return dom.toprettyxml(indent="  ", encoding=None)
    
    def _get_payment_code(self, payment_mode: str) -> str:
        """Convert payment mode to ZATCA payment means code"""
        codes = {
            "cash": "10",      # Cash
            "bank": "42",      # Bank transfer
            "online": "48",    # Bank card (online)
            "credit": "30",    # Credit
        }
        return codes.get(payment_mode.lower(), "10")
    
    def prepare_for_submission(self, invoice_data: Dict[str, Any], customer_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Prepare invoice data for ZATCA API submission (Fatoora Portal)"""
        
        # Generate UUID if not present
        if not invoice_data.get("uuid"):
            invoice_data["uuid"] = self.generate_uuid()
        
        # Generate XML
        xml_content = self.generate_xml_invoice(invoice_data, customer_data)
        
        # Generate hash
        xml_hash = self.generate_invoice_hash(xml_content)
        
        # Generate QR code
        qr_code = self.generate_qr_code_phase2(invoice_data, xml_hash)
        
        return {
            "uuid": invoice_data["uuid"],
            "invoice_number": invoice_data.get("invoice_number"),
            "xml_content": xml_content,
            "xml_base64": base64.b64encode(xml_content.encode('utf-8')).decode('ascii'),
            "xml_hash": xml_hash,
            "qr_code_base64": qr_code,
            "is_b2c": not customer_data or not customer_data.get("vat_number"),
            "status": "ready_for_submission",
            "submission_url": "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
            "note": "Phase 2 requires CSID from ZATCA for actual submission. Current implementation generates compliant XML and QR."
        }


# Singleton instance
_zatca_service = None


def get_zatca_service(company_settings: Dict[str, Any]) -> ZATCAPhase2Service:
    """Get ZATCA service instance"""
    global _zatca_service
    if _zatca_service is None or company_settings:
        _zatca_service = ZATCAPhase2Service(company_settings)
    return _zatca_service
