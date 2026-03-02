"""
Test file for Assets & Liabilities module - Iteration 64
Tests asset CRUD operations, depreciation tracking, and liabilities summary
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Auth token fixture
@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    if response.status_code == 200:
        return response.json().get("access_token")  # Fixed: was "token", now "access_token"
    pytest.skip("Authentication failed - skipping tests")

@pytest.fixture
def headers(auth_token):
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestAssetTypes:
    """Test asset types endpoint"""
    
    def test_get_asset_types(self, headers):
        """Test GET /api/assets/types returns predefined asset types"""
        response = requests.get(f"{BASE_URL}/api/assets/types", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of asset types"
        assert len(data) > 0, "Expected at least one asset type"
        
        # Verify structure
        first_type = data[0]
        assert "id" in first_type
        assert "name" in first_type
        print(f"Asset types returned: {[t['id'] for t in data]}")


class TestAssetCRUD:
    """Test Asset CRUD operations"""
    
    def test_create_asset(self, headers):
        """Test POST /api/assets creates new asset"""
        test_asset = {
            "name": f"TEST_Asset_{uuid.uuid4().hex[:8]}",
            "asset_type": "vehicle",
            "description": "Test vehicle for automated testing",
            "purchase_date": "2024-01-15",
            "purchase_price": 50000,
            "current_value": 45000,
            "depreciation_rate": 15,
            "serial_number": f"SN-{uuid.uuid4().hex[:8]}",
            "location": "Main Branch",
            "status": "active",
            "warranty_expiry": "2026-01-15"
        }
        
        response = requests.post(f"{BASE_URL}/api/assets", json=test_asset, headers=headers)
        assert response.status_code == 200 or response.status_code == 201, f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain id"
        assert data["name"] == test_asset["name"], f"Name mismatch: {data.get('name')}"
        assert data["asset_type"] == "vehicle", "Asset type should be vehicle"
        assert data["purchase_price"] == 50000, "Purchase price mismatch"
        print(f"Created asset: {data['id']}")
        
        # Store for cleanup
        return data["id"]
    
    def test_get_assets_list(self, headers):
        """Test GET /api/assets returns list of assets"""
        response = requests.get(f"{BASE_URL}/api/assets", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list of assets"
        print(f"Total assets: {len(data)}")
    
    def test_get_assets_with_filter(self, headers):
        """Test GET /api/assets with type filter"""
        response = requests.get(f"{BASE_URL}/api/assets?asset_type=vehicle", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        for asset in data:
            assert asset.get("asset_type") == "vehicle", f"Expected vehicle type, got {asset.get('asset_type')}"
        print(f"Filtered assets (vehicle): {len(data)}")
    
    def test_get_assets_with_status_filter(self, headers):
        """Test GET /api/assets with status filter"""
        response = requests.get(f"{BASE_URL}/api/assets?status=active", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        for asset in data:
            assert asset.get("status") == "active", f"Expected active status, got {asset.get('status')}"
        print(f"Active assets: {len(data)}")


class TestAssetStats:
    """Test asset statistics endpoint"""
    
    def test_get_asset_stats(self, headers):
        """Test GET /api/assets/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/assets/stats", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify structure
        assert "total_assets" in data, "Missing total_assets"
        assert "total_purchase_value" in data, "Missing total_purchase_value"
        assert "total_current_value" in data, "Missing total_current_value"
        assert "total_depreciation" in data, "Missing total_depreciation"
        assert "by_type" in data, "Missing by_type"
        assert "by_status" in data, "Missing by_status"
        
        # Verify numeric values
        assert isinstance(data["total_assets"], int), "total_assets should be int"
        assert isinstance(data["total_purchase_value"], (int, float)), "total_purchase_value should be numeric"
        
        print(f"Stats: {data['total_assets']} assets, SAR {data['total_current_value']} current value")


class TestDepreciationReport:
    """Test depreciation report endpoint"""
    
    def test_get_depreciation_report(self, headers):
        """Test GET /api/assets/depreciation-report"""
        response = requests.get(f"{BASE_URL}/api/assets/depreciation-report", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify structure
        assert "assets" in data, "Missing assets array"
        assert "summary" in data, "Missing summary"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_assets" in summary
        assert "total_purchase_value" in summary
        assert "total_depreciation" in summary
        assert "total_book_value" in summary
        
        print(f"Depreciation report: {summary['total_assets']} assets, SAR {summary['total_depreciation']} total depreciation")


class TestLiabilitiesSummary:
    """Test liabilities summary endpoint"""
    
    def test_get_liabilities_summary(self, headers):
        """Test GET /api/liabilities/summary returns unified liability view"""
        response = requests.get(f"{BASE_URL}/api/liabilities/summary", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify structure
        assert "total_liabilities" in data, "Missing total_liabilities"
        assert "loans" in data, "Missing loans section"
        assert "fines" in data, "Missing fines section"
        assert "suppliers" in data, "Missing suppliers section"
        assert "documents" in data, "Missing documents section"
        
        # Verify loans structure
        loans = data["loans"]
        assert "active_count" in loans
        assert "remaining" in loans
        
        # Verify fines structure
        fines = data["fines"]
        assert "unpaid_count" in fines
        assert "remaining" in fines
        
        # Verify suppliers structure
        suppliers = data["suppliers"]
        assert "with_dues" in suppliers
        assert "total_dues" in suppliers
        
        # Verify documents structure
        documents = data["documents"]
        assert "expired" in documents
        assert "expiring_soon" in documents
        
        print(f"Liabilities: SAR {data['total_liabilities']} total")
        print(f"  - Loans: {loans['active_count']} active, SAR {loans['remaining']} remaining")
        print(f"  - Fines: {fines['unpaid_count']} unpaid, SAR {fines['remaining']} remaining")
        print(f"  - Suppliers: {suppliers['with_dues']} with dues, SAR {suppliers['total_dues']}")
        print(f"  - Documents: {documents['expired']} expired, {documents['expiring_soon']} expiring")


class TestAssetMaintenance:
    """Test asset maintenance logging"""
    
    def test_create_and_log_maintenance(self, headers):
        """Test creating asset and logging maintenance"""
        # First create an asset
        test_asset = {
            "name": f"TEST_Maint_Asset_{uuid.uuid4().hex[:8]}",
            "asset_type": "equipment",
            "purchase_price": 10000,
            "status": "active"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assets", json=test_asset, headers=headers)
        assert create_response.status_code in [200, 201], f"Failed to create asset: {create_response.text}"
        
        asset_id = create_response.json()["id"]
        
        # Log maintenance
        maintenance_data = {
            "type": "maintenance",
            "description": "Routine maintenance test",
            "cost": 500,
            "performed_by": "Test Technician"
        }
        
        maint_response = requests.post(f"{BASE_URL}/api/assets/{asset_id}/maintenance", json=maintenance_data, headers=headers)
        assert maint_response.status_code in [200, 201], f"Failed to log maintenance: {maint_response.text}"
        
        maint_data = maint_response.json()
        assert "id" in maint_data
        assert maint_data["description"] == "Routine maintenance test"
        assert maint_data["cost"] == 500
        print(f"Maintenance logged for asset {asset_id}")
        
        # Get maintenance logs
        logs_response = requests.get(f"{BASE_URL}/api/assets/{asset_id}/maintenance", headers=headers)
        assert logs_response.status_code == 200
        
        logs = logs_response.json()
        assert len(logs) > 0, "Expected at least one maintenance log"
        print(f"Maintenance logs: {len(logs)}")
        
        # Cleanup - delete asset
        requests.delete(f"{BASE_URL}/api/assets/{asset_id}", headers=headers)


class TestAssetUpdateDelete:
    """Test asset update and delete operations"""
    
    def test_update_asset(self, headers):
        """Test PUT /api/assets/{id} updates asset"""
        # Create asset first
        test_asset = {
            "name": f"TEST_Update_Asset_{uuid.uuid4().hex[:8]}",
            "asset_type": "electronics",
            "purchase_price": 5000,
            "status": "active"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assets", json=test_asset, headers=headers)
        assert create_response.status_code in [200, 201]
        asset_id = create_response.json()["id"]
        
        # Update asset
        update_data = {
            "name": "Updated Asset Name",
            "status": "maintenance",
            "current_value": 4500
        }
        
        update_response = requests.put(f"{BASE_URL}/api/assets/{asset_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200, f"Failed to update: {update_response.text}"
        
        updated = update_response.json()
        assert updated["name"] == "Updated Asset Name"
        assert updated["status"] == "maintenance"
        print(f"Updated asset {asset_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/assets/{asset_id}", headers=headers)
    
    def test_delete_asset(self, headers):
        """Test DELETE /api/assets/{id} removes asset"""
        # Create asset first
        test_asset = {
            "name": f"TEST_Delete_Asset_{uuid.uuid4().hex[:8]}",
            "asset_type": "furniture",
            "purchase_price": 2000,
            "status": "active"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/assets", json=test_asset, headers=headers)
        assert create_response.status_code in [200, 201]
        asset_id = create_response.json()["id"]
        
        # Delete asset
        delete_response = requests.delete(f"{BASE_URL}/api/assets/{asset_id}", headers=headers)
        assert delete_response.status_code in [200, 204], f"Failed to delete: {delete_response.text}"
        print(f"Deleted asset {asset_id}")
        
        # Verify deletion - asset should not exist
        get_response = requests.get(f"{BASE_URL}/api/assets", headers=headers)
        assets = get_response.json()
        deleted_ids = [a["id"] for a in assets if a["id"] == asset_id]
        assert len(deleted_ids) == 0, "Asset should be deleted"
    
    def test_delete_nonexistent_asset(self, headers):
        """Test DELETE /api/assets/{id} with invalid id returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/assets/{fake_id}", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestPartnerPLReport:
    """Test Partner P&L Report endpoint"""
    
    def test_get_partner_pl_report(self, headers):
        """Test GET /api/partner-pl-report"""
        from datetime import datetime, timedelta
        
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/partner-pl-report?start_date={start_date}&end_date={end_date}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify basic structure
        assert "company_summary" in data or "partners" in data, "Expected company_summary or partners in response"
        print(f"Partner P&L report retrieved successfully")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_assets(self, headers):
        """Remove all TEST_ prefixed assets"""
        response = requests.get(f"{BASE_URL}/api/assets", headers=headers)
        if response.status_code == 200:
            assets = response.json()
            test_assets = [a for a in assets if a.get("name", "").startswith("TEST_")]
            
            for asset in test_assets:
                requests.delete(f"{BASE_URL}/api/assets/{asset['id']}", headers=headers)
            
            print(f"Cleaned up {len(test_assets)} test assets")
