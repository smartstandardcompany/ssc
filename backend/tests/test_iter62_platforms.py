"""
Test module for Online Delivery Platforms feature (Iteration 62)
Tests the following:
- Platforms CRUD API
- Platform payments API  
- Platform summary API
- Seed defaults functionality
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPlatformsAPI:
    """Tests for Online Delivery Platforms API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Auth failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_platforms(self):
        """Test GET /api/platforms - should return list of platforms"""
        response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Should have 10 default platforms seeded
        assert len(data) >= 10, f"Expected at least 10 platforms, got {len(data)}"
        # Check platform structure
        platform = data[0]
        assert "id" in platform
        assert "name" in platform
        assert "commission_rate" in platform
        assert "total_sales" in platform
        assert "pending_amount" in platform
        print(f"PASS: GET /api/platforms returned {len(data)} platforms")
    
    def test_get_platforms_summary(self):
        """Test GET /api/platforms/summary - should return summary with totals"""
        response = requests.get(f"{BASE_URL}/api/platforms/summary", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "platforms" in data, "Response should have platforms key"
        assert "totals" in data, "Response should have totals key"
        # Check totals structure
        totals = data["totals"]
        assert "total_sales" in totals
        assert "total_received" in totals
        assert "total_commission" in totals
        assert "total_pending" in totals
        # Check platform summary structure
        if len(data["platforms"]) > 0:
            p = data["platforms"][0]
            assert "platform_name" in p
            assert "commission_rate" in p
            assert "sales_count" in p
            assert "payments_count" in p
        print(f"PASS: GET /api/platforms/summary returned {len(data['platforms'])} platform summaries")
    
    def test_get_platform_payments_empty(self):
        """Test GET /api/platform-payments - should return empty list or payments"""
        response = requests.get(f"{BASE_URL}/api/platform-payments", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: GET /api/platform-payments returned {len(data)} payments")
    
    def test_create_platform(self):
        """Test POST /api/platforms - should create a new platform"""
        unique_name = f"TEST_Platform_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "name_ar": "منصة اختبار",
            "commission_rate": 15,
            "payment_terms": "weekly",
            "notes": "Test platform"
        }
        response = requests.post(f"{BASE_URL}/api/platforms", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["message"] == "Platform created"
        assert "id" in data
        assert "platform" in data
        platform = data["platform"]
        assert platform["name"] == unique_name
        assert platform["commission_rate"] == 15
        # Clean up
        platform_id = data["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/platforms/{platform_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print(f"PASS: POST /api/platforms created platform {unique_name}")
    
    def test_update_platform(self):
        """Test PUT /api/platforms/{id} - should update platform"""
        # Create first
        unique_name = f"TEST_Platform_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/platforms", headers=self.headers, json={
            "name": unique_name,
            "commission_rate": 10
        })
        assert create_response.status_code == 200
        platform_id = create_response.json()["id"]
        
        # Update
        update_payload = {
            "name": f"{unique_name}_Updated",
            "commission_rate": 20,
            "payment_terms": "monthly"
        }
        update_response = requests.put(f"{BASE_URL}/api/platforms/{platform_id}", headers=self.headers, json=update_payload)
        assert update_response.status_code == 200, f"Failed: {update_response.text}"
        assert update_response.json()["message"] == "Platform updated"
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        platforms = get_response.json()
        updated = next((p for p in platforms if p["id"] == platform_id), None)
        assert updated is not None
        assert updated["commission_rate"] == 20
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/platforms/{platform_id}", headers=self.headers)
        print(f"PASS: PUT /api/platforms/{platform_id} updated successfully")
    
    def test_delete_platform(self):
        """Test DELETE /api/platforms/{id} - should delete platform"""
        # Create first
        unique_name = f"TEST_Platform_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(f"{BASE_URL}/api/platforms", headers=self.headers, json={
            "name": unique_name,
            "commission_rate": 5
        })
        assert create_response.status_code == 200
        platform_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/platforms/{platform_id}", headers=self.headers)
        assert delete_response.status_code == 200, f"Failed: {delete_response.text}"
        assert delete_response.json()["message"] == "Platform deleted"
        
        # Verify deleted
        get_response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        platforms = get_response.json()
        deleted = next((p for p in platforms if p["id"] == platform_id), None)
        assert deleted is None, "Platform should be deleted"
        print(f"PASS: DELETE /api/platforms/{platform_id} deleted successfully")
    
    def test_create_platform_payment(self):
        """Test POST /api/platform-payments - should record payment"""
        # Get first platform
        platforms_response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        platforms = platforms_response.json()
        assert len(platforms) > 0, "Need at least one platform"
        platform_id = platforms[0]["id"]
        
        # Create payment
        payload = {
            "platform_id": platform_id,
            "payment_date": "2026-01-07",
            "period_start": "2026-01-01",
            "period_end": "2026-01-07",
            "total_sales": 5000,
            "commission_paid": 1000,
            "amount_received": 4000,
            "payment_method": "bank_transfer",
            "reference_number": f"TEST_{uuid.uuid4().hex[:8]}"
        }
        response = requests.post(f"{BASE_URL}/api/platform-payments", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["message"] == "Payment recorded"
        assert "id" in data
        assert "payment" in data
        payment = data["payment"]
        assert payment["amount_received"] == 4000
        assert payment["commission_paid"] == 1000
        
        # Clean up
        payment_id = data["id"]
        delete_response = requests.delete(f"{BASE_URL}/api/platform-payments/{payment_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print(f"PASS: POST /api/platform-payments recorded payment")
    
    def test_create_platform_payment_invalid_platform(self):
        """Test POST /api/platform-payments with invalid platform - should fail"""
        payload = {
            "platform_id": "invalid-platform-id",
            "amount_received": 1000
        }
        response = requests.post(f"{BASE_URL}/api/platform-payments", headers=self.headers, json=payload)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: POST /api/platform-payments with invalid platform returns 404")
    
    def test_create_platform_payment_missing_platform_id(self):
        """Test POST /api/platform-payments without platform_id - should fail"""
        payload = {
            "amount_received": 1000
        }
        response = requests.post(f"{BASE_URL}/api/platform-payments", headers=self.headers, json=payload)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: POST /api/platform-payments without platform_id returns 400")
    
    def test_seed_defaults_idempotent(self):
        """Test POST /api/platforms/seed-defaults - should be idempotent"""
        response = requests.post(f"{BASE_URL}/api/platforms/seed-defaults", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message" in data
        # Should not create duplicates
        platforms_response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        platforms = platforms_response.json()
        platform_names = [p["name"] for p in platforms]
        # Check no duplicate default platforms
        default_names = ["HungerStation", "Jahez", "ToYou", "Keta", "Ninja"]
        for name in default_names:
            count = platform_names.count(name)
            assert count <= 1, f"Platform {name} appears {count} times (should be unique)"
        print("PASS: POST /api/platforms/seed-defaults is idempotent")
    
    def test_platform_reconciliation(self):
        """Test GET /api/platforms/{id}/reconciliation - should return reconciliation data"""
        # Get first platform
        platforms_response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        platforms = platforms_response.json()
        assert len(platforms) > 0
        platform_id = platforms[0]["id"]
        
        response = requests.get(f"{BASE_URL}/api/platforms/{platform_id}/reconciliation", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "platform" in data
        assert "summary" in data
        assert "recent_sales" in data
        assert "recent_payments" in data
        # Check summary structure
        summary = data["summary"]
        assert "total_sales" in summary
        assert "pending_sales_amount" in summary
        assert "settled_sales_amount" in summary
        print(f"PASS: GET /api/platforms/{platform_id}/reconciliation returned data")
    
    def test_verify_default_platforms(self):
        """Verify all 10 default platforms are present"""
        response = requests.get(f"{BASE_URL}/api/platforms", headers=self.headers)
        assert response.status_code == 200
        platforms = response.json()
        
        expected_platforms = [
            ("HungerStation", 20),
            ("Hunger", 18),
            ("Jahez", 20),
            ("ToYou", 18),
            ("Keta", 15),
            ("Ninja", 15),
            ("Careem Food", 22),
            ("Talabat", 20),
            ("Marsool", 15),
            ("Other", 0)
        ]
        
        platform_dict = {p["name"]: p for p in platforms}
        
        for name, expected_commission in expected_platforms:
            assert name in platform_dict, f"Missing platform: {name}"
            assert platform_dict[name]["commission_rate"] == expected_commission, \
                f"Platform {name} has wrong commission rate"
        
        print("PASS: All 10 default platforms verified with correct commission rates")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
