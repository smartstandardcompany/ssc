"""
Iteration 100 Tests - SSC Track ERP System
Tests for: POS/Kitchen/Customer Portal tours, Smart Archive Recommendations, Auto-Archive Settings

Features being tested:
1. Smart Archive Recommendations API (GET /api/data-management/recommendations)
2. Auto-Archive Settings API (GET/PUT /api/data-management/auto-archive-settings)
3. Data Management Stats API (GET /api/data-management/stats)
4. Dashboard/Auth endpoints
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')

class TestHealthAndAuth:
    """Health check and authentication tests"""
    
    def test_api_root_endpoint(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"API root endpoint working: {data['message']}")
    
    def test_admin_login(self):
        """Test admin login via /api/auth/login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print(f"Admin login successful, email: {data['user']['email']}")
        return data["access_token"]


class TestSmartArchiveRecommendations:
    """Tests for Smart Archive Recommendations API"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_recommendations_endpoint_returns_health_score(self, auth_headers):
        """Test GET /data-management/recommendations returns health_score field"""
        response = requests.get(f"{BASE_URL}/api/data-management/recommendations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify health_score is present (0-100)
        assert "health_score" in data
        assert isinstance(data["health_score"], (int, float))
        assert 0 <= data["health_score"] <= 100
        print(f"Health score: {data['health_score']}/100")
    
    def test_recommendations_endpoint_returns_recommendations_array(self, auth_headers):
        """Test GET /data-management/recommendations returns recommendations array"""
        response = requests.get(f"{BASE_URL}/api/data-management/recommendations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify recommendations array structure
        assert "recommendations" in data
        assert isinstance(data["recommendations"], list)
        print(f"Recommendations count: {len(data['recommendations'])}")
        
        # If there are recommendations, verify structure
        if data["recommendations"]:
            rec = data["recommendations"][0]
            assert "collection" in rec
            assert "label" in rec
            assert "total_records" in rec
            assert "priority" in rec
            assert rec["priority"] in ["critical", "high", "medium", "low"]
            print(f"First recommendation: {rec['label']} - priority: {rec['priority']}")
    
    def test_recommendations_endpoint_returns_analyzed_metadata(self, auth_headers):
        """Test GET /data-management/recommendations returns analysis metadata"""
        response = requests.get(f"{BASE_URL}/api/data-management/recommendations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify metadata fields
        assert "total_collections_analyzed" in data
        assert "collections_needing_attention" in data
        assert "analyzed_at" in data
        print(f"Collections analyzed: {data['total_collections_analyzed']}, needing attention: {data['collections_needing_attention']}")


class TestAutoArchiveSettings:
    """Tests for Auto-Archive Settings API"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_auto_archive_settings(self, auth_headers):
        """Test GET /data-management/auto-archive-settings returns settings"""
        response = requests.get(f"{BASE_URL}/api/data-management/auto-archive-settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "enabled" in data
        assert "frequency" in data
        assert "collections" in data
        print(f"Auto-archive enabled: {data['enabled']}, frequency: {data['frequency']}")
    
    def test_toggle_auto_archive_settings(self, auth_headers):
        """Test PUT /data-management/auto-archive-settings can toggle enabled"""
        # First get current settings
        get_response = requests.get(f"{BASE_URL}/api/data-management/auto-archive-settings", headers=auth_headers)
        current_settings = get_response.json()
        
        # Toggle enabled state
        new_enabled = not current_settings.get("enabled", False)
        update_payload = {
            **current_settings,
            "enabled": new_enabled
        }
        
        put_response = requests.put(
            f"{BASE_URL}/api/data-management/auto-archive-settings",
            headers=auth_headers,
            json=update_payload
        )
        assert put_response.status_code == 200
        updated = put_response.json()
        assert updated["enabled"] == new_enabled
        print(f"Auto-archive toggled to: {new_enabled}")
        
        # Reset to original state
        reset_payload = {
            **current_settings,
            "enabled": current_settings.get("enabled", False)
        }
        requests.put(f"{BASE_URL}/api/data-management/auto-archive-settings", headers=auth_headers, json=reset_payload)
        print("Settings reset to original state")


class TestDataManagementStats:
    """Tests for Data Management Stats API"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_data_management_stats_returns_7_collections(self, auth_headers):
        """Test GET /data-management/stats returns all 7 archivable collections"""
        response = requests.get(f"{BASE_URL}/api/data-management/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "stats" in data
        collections = [s["collection"] for s in data["stats"]]
        
        expected_collections = [
            "sales", "expenses", "supplier_payments", "invoices", 
            "activity_logs", "scheduler_logs", "notifications"
        ]
        
        for expected in expected_collections:
            assert expected in collections, f"Missing collection: {expected}"
        
        print(f"All {len(expected_collections)} collections found in stats")
    
    def test_data_management_stats_structure(self, auth_headers):
        """Test GET /data-management/stats returns proper structure per collection"""
        response = requests.get(f"{BASE_URL}/api/data-management/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check first stat entry structure
        stat = data["stats"][0]
        required_fields = ["collection", "label", "total", "older_than_3_months", "older_than_6_months", "older_than_12_months"]
        
        for field in required_fields:
            assert field in stat, f"Missing field: {field}"
        
        print(f"Stats structure verified: {stat['label']} has {stat['total']} total records")


class TestExistingModuleTours:
    """Tests to verify existing module tours APIs still work (Sales, Stock, Employees, Analytics, Settings)"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_sales_api_accessible(self, auth_headers):
        """Test /api/sales endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/sales", headers=auth_headers)
        assert response.status_code == 200
        print("Sales endpoint accessible")
    
    def test_stock_balance_api_accessible(self, auth_headers):
        """Test /api/stock/balance endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/stock/balance", headers=auth_headers)
        assert response.status_code == 200
        print("Stock balance endpoint accessible")
    
    def test_employees_api_accessible(self, auth_headers):
        """Test /api/employees endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        print("Employees endpoint accessible")
    
    def test_dashboard_stats_accessible(self, auth_headers):
        """Test /api/dashboard/stats endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        print("Dashboard stats endpoint accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
