"""
Iteration 90 - Platform Sales Bug Fix Tests
Tests the fix for: 'Online Platforms should read the sale from online sale we added some sale but the Online Platforms not shows anything'

Bug Root Cause: Platform sales queries were filtering by 'payment_mode: online_platform' at document level,
but newer POS entries only set this inside the payment_details array, not at the top level.

Fix Applied:
1) Removed all 'payment_mode: online_platform' filters from 7 queries in platforms.py - now filtering only by platform_id
2) Added platform_status to SaleCreate model so pending status is properly saved
3) Fixed POS frontend to set payment_mode at top level for new online sales
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestPlatformSalesFix:
    """Tests for the platform sales bug fix - verifying sales with platform_id are correctly retrieved"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    # === GET /api/platforms - List platforms with sales totals ===
    def test_platforms_list_returns_sales_totals(self):
        """Test that GET /api/platforms returns platforms with total_sales and pending_amount"""
        response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        assert response.status_code == 200
        
        platforms = response.json()
        assert isinstance(platforms, list)
        assert len(platforms) > 0, "Should have at least one platform"
        
        # Check structure
        platform = platforms[0]
        assert "id" in platform
        assert "name" in platform
        assert "total_sales" in platform, "Platform should have total_sales field"
        assert "pending_amount" in platform, "Platform should have pending_amount field"
        
        # Verify HungerStation has expected sales
        hungerstation = next((p for p in platforms if p["name"] == "HungerStation"), None)
        if hungerstation:
            assert hungerstation["total_sales"] >= 3000, f"HungerStation should have at least SAR 3000 in sales, got {hungerstation['total_sales']}"
            print(f"HungerStation: total_sales={hungerstation['total_sales']}, pending={hungerstation['pending_amount']}")
        
        # Verify Keta has expected sales  
        keta = next((p for p in platforms if p["name"] == "Keta"), None)
        if keta:
            assert keta["total_sales"] >= 150, f"Keta should have at least SAR 150 in sales, got {keta['total_sales']}"
            print(f"Keta: total_sales={keta['total_sales']}, pending={keta['pending_amount']}")
    
    # === GET /api/platforms/summary - Platform sales summary ===
    def test_platforms_summary_returns_correct_totals(self):
        """Test that GET /api/platforms/summary returns correct totals for each platform"""
        response = requests.get(f"{BASE_URL}/api/platforms/summary", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "platforms" in data
        assert "totals" in data
        
        # Check totals structure
        totals = data["totals"]
        assert "total_sales" in totals
        assert "total_received" in totals
        assert "total_commission" in totals
        assert "total_pending" in totals
        
        # Verify total sales > 0 (bug fix verification)
        assert totals["total_sales"] >= 3150, f"Total sales should be at least SAR 3150, got {totals['total_sales']}"
        print(f"Summary totals: {totals}")
        
        # Check individual platforms
        platforms = data["platforms"]
        hungerstation = next((p for p in platforms if p["platform_name"] == "HungerStation"), None)
        if hungerstation:
            assert hungerstation["total_sales"] >= 3000, f"HungerStation summary should show sales >= 3000"
            assert hungerstation["sales_count"] >= 6, f"HungerStation should have at least 6 sales, got {hungerstation['sales_count']}"
            print(f"HungerStation summary: sales={hungerstation['total_sales']}, count={hungerstation['sales_count']}")
    
    # === GET /api/platforms/branch-summary - Branch-level platform data ===
    def test_platforms_branch_summary(self):
        """Test that GET /api/platforms/branch-summary returns branch-level platform data"""
        response = requests.get(f"{BASE_URL}/api/platforms/branch-summary", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Branch summary should be a list"
        
        # Should have at least one branch with platform sales
        assert len(data) > 0, "Should have at least one branch with platform sales"
        
        # Check structure
        branch = data[0]
        assert "branch_id" in branch
        assert "branch_name" in branch
        assert "platforms" in branch
        assert "totals" in branch
        
        # Verify totals structure
        assert "total_sales" in branch["totals"]
        assert "total_pending" in branch["totals"]
        
        print(f"Branch summaries: {len(data)} branches with platform sales")
        for b in data:
            print(f"  {b['branch_name']}: sales={b['totals']['total_sales']}, pending={b['totals']['total_pending']}")
    
    # === GET /api/platforms/{platform_id}/sales - Platform-specific sales ===
    def test_platform_specific_sales(self):
        """Test that GET /api/platforms/{platform_id}/sales returns sales for a specific platform"""
        # First get platforms to find HungerStation ID
        platforms_response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        assert platforms_response.status_code == 200
        
        platforms = platforms_response.json()
        hungerstation = next((p for p in platforms if p["name"] == "HungerStation"), None)
        
        if not hungerstation:
            pytest.skip("HungerStation platform not found")
        
        platform_id = hungerstation["id"]
        
        # Get sales for this platform
        response = requests.get(f"{BASE_URL}/api/platforms/{platform_id}/sales", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "sales" in data
        assert "total_amount" in data
        assert "total_count" in data
        
        # Verify sales exist (bug fix verification)
        assert data["total_count"] >= 6, f"HungerStation should have at least 6 sales, got {data['total_count']}"
        assert data["total_amount"] >= 3000, f"HungerStation should have at least SAR 3000 in sales, got {data['total_amount']}"
        
        print(f"HungerStation sales: count={data['total_count']}, amount={data['total_amount']}")
    
    # === GET /api/platforms/{platform_id}/reconciliation - Platform reconciliation ===
    def test_platform_reconciliation(self):
        """Test that GET /api/platforms/{platform_id}/reconciliation returns correct data"""
        # First get platforms to find one with sales
        platforms_response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        platforms = platforms_response.json()
        
        # Find platform with sales
        platform_with_sales = next((p for p in platforms if p.get("total_sales", 0) > 0), None)
        if not platform_with_sales:
            pytest.skip("No platform with sales found")
        
        platform_id = platform_with_sales["id"]
        
        response = requests.get(f"{BASE_URL}/api/platforms/{platform_id}/reconciliation", headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "platform" in data
        assert "summary" in data
        
        # Check summary structure
        summary = data["summary"]
        assert "total_sales" in summary
        assert "pending_sales_amount" in summary
        assert "settled_sales_amount" in summary
        
        print(f"Reconciliation for {platform_with_sales['name']}: total={summary['total_sales']}, pending={summary['pending_sales_amount']}")


class TestPOSOnlineSaleCreation:
    """Tests for creating online sales via POS with correct platform_id and payment_mode"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and platform/branch data"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get platforms
        platforms_resp = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        self.platforms = platforms_resp.json() if platforms_resp.status_code == 200 else []
        
        # Get branches
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        self.branches = branches_resp.json() if branches_resp.status_code == 200 else []
    
    def test_create_online_sale_with_platform_id_and_payment_mode(self):
        """Test that creating an online sale correctly saves platform_id, payment_mode, and platform_status"""
        if not self.platforms:
            pytest.skip("No platforms available")
        if not self.branches:
            pytest.skip("No branches available")
        
        # Use first platform and branch
        platform = self.platforms[0]
        branch = self.branches[0]
        
        # Create online sale with all required fields
        sale_data = {
            "sale_type": "online",
            "amount": 100.0,
            "branch_id": branch["id"],
            "notes": "TEST_Iter90_Online_Sale",
            "date": "2026-03-05T12:00:00.000Z",
            "payment_mode": "online_platform",  # This should be at top level
            "payment_details": [{"mode": "online_platform", "amount": 100.0, "discount": 0}],
            "platform_id": platform["id"],
            "platform_status": "pending"  # New field added in fix
        }
        
        response = requests.post(f"{BASE_URL}/api/sales", json=sale_data, headers=self.headers)
        assert response.status_code in [200, 201], f"Failed to create sale: {response.text}"
        
        sale = response.json()
        sale_id = sale.get("id")
        
        # Verify the sale was created with correct fields
        assert sale.get("platform_id") == platform["id"], "platform_id should be saved"
        assert sale.get("payment_mode") == "online_platform", "payment_mode should be at top level"
        assert sale.get("platform_status") == "pending", "platform_status should be saved"
        
        print(f"Created online sale: id={sale_id}, platform={platform['name']}, amount=100")
        
        # Cleanup - delete the test sale
        if sale_id:
            delete_resp = requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=self.headers)
            print(f"Cleanup: deleted test sale, status={delete_resp.status_code}")
    
    def test_created_online_sale_appears_in_platform_summary(self):
        """Test that a newly created online sale appears in platform summary"""
        if not self.platforms:
            pytest.skip("No platforms available")
        if not self.branches:
            pytest.skip("No branches available")
        
        platform = self.platforms[0]
        branch = self.branches[0]
        
        # Get initial platform summary
        initial_resp = requests.get(f"{BASE_URL}/api/platforms/summary", headers=self.headers)
        initial_data = initial_resp.json()
        initial_platform = next((p for p in initial_data["platforms"] if p["platform_id"] == platform["id"]), None)
        initial_sales = initial_platform["total_sales"] if initial_platform else 0
        
        # Create online sale
        sale_data = {
            "sale_type": "online",
            "amount": 250.0,
            "branch_id": branch["id"],
            "notes": "TEST_Iter90_Summary_Test",
            "date": "2026-03-05T12:00:00.000Z",
            "payment_mode": "online_platform",
            "payment_details": [{"mode": "online_platform", "amount": 250.0, "discount": 0}],
            "platform_id": platform["id"],
            "platform_status": "pending"
        }
        
        create_resp = requests.post(f"{BASE_URL}/api/sales", json=sale_data, headers=self.headers)
        assert create_resp.status_code in [200, 201], f"Failed to create sale: {create_resp.text}"
        sale = create_resp.json()
        sale_id = sale.get("id")
        
        try:
            # Get updated platform summary
            updated_resp = requests.get(f"{BASE_URL}/api/platforms/summary", headers=self.headers)
            updated_data = updated_resp.json()
            updated_platform = next((p for p in updated_data["platforms"] if p["platform_id"] == platform["id"]), None)
            
            assert updated_platform is not None, "Platform should appear in summary"
            
            # The sale should now appear (bug fix verification)
            expected_sales = initial_sales + 250.0
            actual_sales = updated_platform["total_sales"]
            assert actual_sales >= expected_sales, f"Platform sales should increase by 250. Expected >= {expected_sales}, got {actual_sales}"
            
            print(f"SUCCESS: Sale appeared in summary. Initial: {initial_sales}, After: {actual_sales}")
            
        finally:
            # Cleanup
            if sale_id:
                requests.delete(f"{BASE_URL}/api/sales/{sale_id}", headers=self.headers)


class TestPlatformPaymentsCalculation:
    """Tests for platform payment calculation endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        if not BASE_URL:
            pytest.skip("REACT_APP_BACKEND_URL not set")
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_calculate_platform_payment(self):
        """Test GET /api/platform-payments/calculate returns correct calculations"""
        # Get platforms to find one with sales
        platforms_resp = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        platforms = platforms_resp.json()
        
        platform_with_sales = next((p for p in platforms if p.get("total_sales", 0) > 0), None)
        if not platform_with_sales:
            pytest.skip("No platform with sales found")
        
        platform_id = platform_with_sales["id"]
        
        # Calculate payment for a wide date range
        response = requests.get(
            f"{BASE_URL}/api/platform-payments/calculate",
            params={
                "platform_id": platform_id,
                "period_start": "2024-01-01",
                "period_end": "2027-12-31"
            },
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "platform_id" in data
        assert "total_sales" in data
        assert "calculated_commission" in data
        assert "expected_amount" in data
        
        print(f"Payment calculation for {platform_with_sales['name']}:")
        print(f"  Total sales: {data['total_sales']}")
        print(f"  Commission: {data['calculated_commission']}")
        print(f"  Expected: {data['expected_amount']}")
    
    def test_platform_payments_list(self):
        """Test GET /api/platform-payments returns payment records"""
        response = requests.get(f"{BASE_URL}/api/platform-payments", headers=self.headers)
        assert response.status_code == 200
        
        payments = response.json()
        assert isinstance(payments, list)
        
        if len(payments) > 0:
            payment = payments[0]
            assert "id" in payment
            assert "platform_id" in payment
            assert "amount_received" in payment
            print(f"Found {len(payments)} payment records")
