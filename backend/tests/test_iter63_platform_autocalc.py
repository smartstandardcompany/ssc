"""
Tests for Platform Auto-Calculation and Branch Distribution Features
Iteration 63: Auto-commission calculation and branch breakdown for platform payments
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPlatformAutoCalculation:
    """Tests for /api/platform-payments/calculate endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        
        # Get test IDs
        platforms = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers).json()
        self.platform_id = platforms[0]["id"] if platforms else None
        self.platform_commission = platforms[0].get("commission_rate", 0) if platforms else 0
        
        branches = requests.get(f"{BASE_URL}/api/branches", headers=self.headers).json()
        self.branch_id = branches[0]["id"] if branches else None
    
    def test_calculate_endpoint_exists(self):
        """Test that /api/platform-payments/calculate endpoint exists"""
        if not self.platform_id:
            pytest.skip("No platforms available")
        
        resp = requests.get(
            f"{BASE_URL}/api/platform-payments/calculate",
            params={
                "platform_id": self.platform_id,
                "period_start": "2026-02-01",
                "period_end": "2026-02-28"
            },
            headers=self.headers
        )
        
        assert resp.status_code == 200, f"Calculate endpoint failed: {resp.text}"
        data = resp.json()
        
        # Verify response structure
        assert "platform_id" in data
        assert "platform_name" in data
        assert "commission_rate" in data
        assert "total_sales" in data
        assert "calculated_commission" in data
        assert "expected_amount" in data
        assert "sales_count" in data
        assert "branch_breakdown" in data
    
    def test_calculate_returns_correct_commission(self):
        """Test that commission calculation is correct based on platform rate"""
        if not self.platform_id:
            pytest.skip("No platforms available")
        
        resp = requests.get(
            f"{BASE_URL}/api/platform-payments/calculate",
            params={
                "platform_id": self.platform_id,
                "period_start": "2026-02-01",
                "period_end": "2026-02-28"
            },
            headers=self.headers
        )
        
        assert resp.status_code == 200
        data = resp.json()
        
        # Commission should be total_sales * (commission_rate / 100)
        if data["total_sales"] > 0:
            expected_commission = data["total_sales"] * (data["commission_rate"] / 100)
            assert abs(data["calculated_commission"] - expected_commission) < 0.01, \
                f"Commission mismatch: got {data['calculated_commission']}, expected {expected_commission}"
            
            # Expected amount = total_sales - commission
            expected_amount = data["total_sales"] - data["calculated_commission"]
            assert abs(data["expected_amount"] - expected_amount) < 0.01
    
    def test_calculate_branch_breakdown_sums_correctly(self):
        """Test that branch breakdown amounts sum to total"""
        if not self.platform_id:
            pytest.skip("No platforms available")
        
        resp = requests.get(
            f"{BASE_URL}/api/platform-payments/calculate",
            params={
                "platform_id": self.platform_id,
                "period_start": "2026-02-01",
                "period_end": "2026-02-28"
            },
            headers=self.headers
        )
        
        assert resp.status_code == 200
        data = resp.json()
        
        if data["branch_breakdown"]:
            # Sum of branch sales should equal total sales
            branch_sales_sum = sum(b["sales_amount"] for b in data["branch_breakdown"])
            assert abs(branch_sales_sum - data["total_sales"]) < 0.01, \
                f"Branch sales sum {branch_sales_sum} != total {data['total_sales']}"
            
            # Shares should sum to ~100%
            share_sum = sum(b["share_percent"] for b in data["branch_breakdown"])
            if data["total_sales"] > 0:
                assert 99.9 <= share_sum <= 100.1, f"Share sum {share_sum} not 100%"
    
    def test_calculate_requires_platform_id(self):
        """Test that platform_id is required"""
        resp = requests.get(
            f"{BASE_URL}/api/platform-payments/calculate",
            params={
                "period_start": "2026-02-01",
                "period_end": "2026-02-28"
            },
            headers=self.headers
        )
        
        # Should fail without platform_id
        assert resp.status_code in [400, 404, 422]
    
    def test_calculate_with_invalid_platform(self):
        """Test calculation with non-existent platform"""
        resp = requests.get(
            f"{BASE_URL}/api/platform-payments/calculate",
            params={
                "platform_id": "non-existent-id",
                "period_start": "2026-02-01",
                "period_end": "2026-02-28"
            },
            headers=self.headers
        )
        
        assert resp.status_code == 404


class TestBranchPlatformSummary:
    """Tests for /api/platforms/branch-summary endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_branch_summary_endpoint_exists(self):
        """Test that /api/platforms/branch-summary endpoint exists"""
        resp = requests.get(f"{BASE_URL}/api/platforms/branch-summary", headers=self.headers)
        
        assert resp.status_code == 200, f"Branch summary failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, list)
    
    def test_branch_summary_structure(self):
        """Test branch summary response structure"""
        resp = requests.get(f"{BASE_URL}/api/platforms/branch-summary", headers=self.headers)
        
        assert resp.status_code == 200
        data = resp.json()
        
        if data:
            branch_data = data[0]
            assert "branch_id" in branch_data
            assert "branch_name" in branch_data
            assert "platforms" in branch_data
            assert "totals" in branch_data
            
            # Check totals structure
            totals = branch_data["totals"]
            assert "total_sales" in totals
            assert "total_received" in totals
            assert "total_commission" in totals
            assert "total_pending" in totals
            
            # Check platforms structure if present
            if branch_data["platforms"]:
                platform = branch_data["platforms"][0]
                assert "platform_id" in platform
                assert "platform_name" in platform
                assert "sales" in platform
                assert "pending" in platform
    
    def test_branch_summary_with_filter(self):
        """Test branch summary with branch_id filter"""
        # First get a branch ID
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=self.headers)
        branches = branches_resp.json()
        
        if branches:
            branch_id = branches[0]["id"]
            resp = requests.get(
                f"{BASE_URL}/api/platforms/branch-summary",
                params={"branch_id": branch_id},
                headers=self.headers
            )
            
            assert resp.status_code == 200
            data = resp.json()
            
            # Should only contain the requested branch
            if data:
                assert all(b["branch_id"] == branch_id for b in data)


class TestRecordPaymentWithBranchBreakdown:
    """Tests for recording payments with branch distribution"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
        
        platforms = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers).json()
        self.platform_id = platforms[0]["id"] if platforms else None
    
    def test_record_payment_with_period_dates(self):
        """Test recording a payment with period dates calculates branch breakdown"""
        if not self.platform_id:
            pytest.skip("No platforms available")
        
        payment_data = {
            "platform_id": self.platform_id,
            "payment_date": "2026-02-28",
            "period_start": "2026-02-01",
            "period_end": "2026-02-28",
            "total_sales": 1000,
            "commission_paid": 200,
            "amount_received": 800,
            "payment_method": "bank_transfer",
            "reference_number": "TEST-REF-001"
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/platform-payments",
            json=payment_data,
            headers=self.headers
        )
        
        assert resp.status_code == 200, f"Record payment failed: {resp.text}"
        data = resp.json()
        
        # Verify payment was recorded
        assert "id" in data
        
        # Verify branch_breakdown is included in response
        payment = data.get("payment", {})
        assert "branch_breakdown" in payment
    
    def test_record_payment_auto_calculates_commission(self):
        """Test that commission is auto-calculated from platform rate if not provided"""
        if not self.platform_id:
            pytest.skip("No platforms available")
        
        payment_data = {
            "platform_id": self.platform_id,
            "payment_date": "2026-02-28",
            "period_start": "2026-02-01",
            "period_end": "2026-02-28",
            "total_sales": 1000,
            # commission_paid not provided - should be auto-calculated
            "amount_received": 800,
            "payment_method": "bank_transfer"
        }
        
        resp = requests.post(
            f"{BASE_URL}/api/platform-payments",
            json=payment_data,
            headers=self.headers
        )
        
        assert resp.status_code == 200
        data = resp.json()
        payment = data.get("payment", {})
        
        # Commission should be auto-calculated
        assert "commission_paid" in payment


class TestPlatformsEndpoints:
    """Test basic platforms endpoints still work"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_platforms(self):
        """Test GET /api/platforms"""
        resp = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        
        if data:
            platform = data[0]
            assert "id" in platform
            assert "name" in platform
            assert "commission_rate" in platform
    
    def test_get_platform_payments(self):
        """Test GET /api/platform-payments"""
        resp = requests.get(f"{BASE_URL}/api/platform-payments", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
    
    def test_get_platforms_summary(self):
        """Test GET /api/platforms/summary"""
        resp = requests.get(f"{BASE_URL}/api/platforms/summary", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        assert "platforms" in data
        assert "totals" in data
