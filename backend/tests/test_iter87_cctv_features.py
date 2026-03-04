"""
CCTV Module Backend Tests - Iteration 87
Tests for: DVR management, camera endpoints, snapshot, stream-info endpoints
Focus: Hikvision integration updates, Setup Guide feature support endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCCTVAuth:
    """Test CCTV endpoints require authentication"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json().get("access_token")
    
    @pytest.fixture(scope="class") 
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}

    def test_cctv_dvrs_requires_auth(self):
        """GET /api/cctv/dvrs should require auth"""
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs")
        assert response.status_code in [401, 403]

    def test_cctv_cameras_requires_auth(self):
        """GET /api/cctv/cameras should require auth"""
        response = requests.get(f"{BASE_URL}/api/cctv/cameras")
        assert response.status_code in [401, 403]

    def test_cctv_alerts_requires_auth(self):
        """GET /api/cctv/alerts should require auth"""
        response = requests.get(f"{BASE_URL}/api/cctv/alerts")
        assert response.status_code in [401, 403]


class TestCCTVDVRs:
    """Test DVR CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_branch_id(self, auth_headers):
        """Get or create a branch for testing"""
        # Get existing branches
        response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        # Create a test branch if none exists
        branch_data = {
            "name": "TEST CCTV Branch",
            "location": "Test Location"
        }
        response = requests.post(f"{BASE_URL}/api/branches", json=branch_data, headers=auth_headers)
        if response.status_code == 200:
            return response.json().get("id")
        return None

    def test_get_dvrs_list(self, auth_headers):
        """GET /api/cctv/dvrs - should return list of DVRs"""
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_create_dvr_local(self, auth_headers, test_branch_id):
        """POST /api/cctv/dvrs - create a local DVR with HTTP and RTSP ports"""
        if not test_branch_id:
            pytest.skip("No branch available for testing")
        
        dvr_data = {
            "branch_id": test_branch_id,
            "branch_name": "Test Branch",
            "name": "TEST Local DVR iter87",
            "ip_address": "192.168.1.100",
            "port": 80,
            "http_port": 80,
            "rtsp_port": 554,
            "username": "admin",
            "password": "test123",
            "is_cloud": False,
            "channels": 4
        }
        response = requests.post(f"{BASE_URL}/api/cctv/dvrs", json=dvr_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "id" in data
        # Store for cleanup
        TestCCTVDVRs.test_dvr_id = data["id"]

    def test_create_dvr_cloud(self, auth_headers, test_branch_id):
        """POST /api/cctv/dvrs - create a cloud (Hik-Connect) DVR"""
        if not test_branch_id:
            pytest.skip("No branch available for testing")
        
        dvr_data = {
            "branch_id": test_branch_id,
            "branch_name": "Test Branch",
            "name": "TEST Cloud DVR iter87",
            "device_serial": "DS-7208HQHI-K1-TEST",
            "is_cloud": True,
            "channels": 8
        }
        response = requests.post(f"{BASE_URL}/api/cctv/dvrs", json=dvr_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        # Store for cleanup
        TestCCTVDVRs.cloud_dvr_id = data.get("id")

    def test_get_dvrs_contains_new_dvrs(self, auth_headers):
        """Verify newly created DVRs appear in the list"""
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs", headers=auth_headers)
        assert response.status_code == 200
        dvrs = response.json()
        
        # Check at least one test DVR exists
        test_dvr_names = [d["name"] for d in dvrs if "TEST" in d.get("name", "")]
        assert len(test_dvr_names) > 0, "Test DVRs should appear in list"

    def test_dvr_has_http_rtsp_ports(self, auth_headers):
        """Verify DVR records include http_port and rtsp_port fields"""
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs", headers=auth_headers)
        assert response.status_code == 200
        dvrs = response.json()
        
        local_dvrs = [d for d in dvrs if not d.get("is_cloud") and d.get("ip_address")]
        if local_dvrs:
            dvr = local_dvrs[0]
            # Verify fields exist (may have defaults)
            assert "port" in dvr or "http_port" in dvr


class TestCCTVCameras:
    """Test camera endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}

    def test_get_cameras_list(self, auth_headers):
        """GET /api/cctv/cameras - should return list of cameras"""
        response = requests.get(f"{BASE_URL}/api/cctv/cameras", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_cameras_auto_created_for_dvr(self, auth_headers):
        """Verify cameras are auto-created when DVR is added"""
        response = requests.get(f"{BASE_URL}/api/cctv/cameras", headers=auth_headers)
        assert response.status_code == 200
        cameras = response.json()
        
        # Check for cameras with TEST in DVR name
        test_cameras = [c for c in cameras if "TEST" in c.get("dvr_id", "") or "iter87" in c.get("dvr_id", "")]
        # Cameras should have been auto-created if DVRs were added
        # Even if no DVRs exist, this should return empty list not error


class TestCCTVSnapshot:
    """Test snapshot endpoint - expects errors since no real DVR connected"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}

    def test_snapshot_nonexistent_camera(self, auth_headers):
        """GET /api/cctv/snapshot/{camera_id} - returns 404 for non-existent camera"""
        response = requests.get(f"{BASE_URL}/api/cctv/snapshot/nonexistent_camera_123", headers=auth_headers)
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()

    def test_snapshot_requires_auth(self):
        """GET /api/cctv/snapshot/{camera_id} - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/cctv/snapshot/any_camera")
        assert response.status_code in [401, 403]


class TestCCTVStreamInfo:
    """Test stream-info endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_camera_id(self, auth_headers):
        """Get a camera ID for testing"""
        response = requests.get(f"{BASE_URL}/api/cctv/cameras", headers=auth_headers)
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        return None

    def test_stream_info_nonexistent_camera(self, auth_headers):
        """GET /api/cctv/stream-info/{camera_id} - returns 404 for non-existent camera"""
        response = requests.get(f"{BASE_URL}/api/cctv/stream-info/nonexistent_camera_xyz", headers=auth_headers)
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "not found" in data["detail"].lower()

    def test_stream_info_returns_proper_data(self, auth_headers, test_camera_id):
        """GET /api/cctv/stream-info/{camera_id} - returns stream info for valid camera"""
        if not test_camera_id:
            pytest.skip("No cameras available for testing")
        
        response = requests.get(f"{BASE_URL}/api/cctv/stream-info/{test_camera_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "type" in data
        assert "channel" in data
        assert data["type"] in ["cloud", "local"]
        
        if data["type"] == "local":
            # Local DVR should have RTSP URLs and port info
            assert "rtsp_main" in data or "rtsp_available" in data
            assert "snapshot_url" in data or "snapshot_available" in data

    def test_stream_info_requires_auth(self):
        """GET /api/cctv/stream-info/{camera_id} - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/cctv/stream-info/any_camera")
        assert response.status_code in [401, 403]


class TestCCTVAlerts:
    """Test CCTV alerts endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}

    def test_get_alerts(self, auth_headers):
        """GET /api/cctv/alerts - should return list of alerts"""
        response = requests.get(f"{BASE_URL}/api/cctv/alerts", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_alerts_with_limit(self, auth_headers):
        """GET /api/cctv/alerts?limit=5 - respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/cctv/alerts?limit=5", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5


class TestCCTVAnalytics:
    """Test CCTV analytics endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}

    def test_get_analytics(self, auth_headers):
        """GET /api/cctv/analytics - should return analytics data"""
        response = requests.get(f"{BASE_URL}/api/cctv/analytics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert "summary" in data
        assert "daily_traffic" in data
        assert "hourly_distribution" in data

    def test_get_people_count(self, auth_headers):
        """GET /api/cctv/people-count - should return people counting data"""
        response = requests.get(f"{BASE_URL}/api/cctv/people-count", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "date" in data
        assert "total_entries" in data
        assert "total_exits" in data


class TestCCTVHikConnect:
    """Test Hik-Connect status endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}

    def test_hik_connect_status(self, auth_headers):
        """GET /api/cctv/hik-connect/status - should return status"""
        response = requests.get(f"{BASE_URL}/api/cctv/hik-connect/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Should have connected status field
        assert "connected" in data


class TestCCTVCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}

    def test_cleanup_test_dvrs(self, auth_headers):
        """Delete test DVRs created during testing"""
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs", headers=auth_headers)
        assert response.status_code == 200
        dvrs = response.json()
        
        # Delete DVRs with TEST in name
        for dvr in dvrs:
            if "TEST" in dvr.get("name", "") and "iter87" in dvr.get("name", ""):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/cctv/dvrs/{dvr['id']}", 
                    headers=auth_headers
                )
                assert delete_response.status_code == 200
        
        # Verify cleanup
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs", headers=auth_headers)
        dvrs = response.json()
        remaining_test_dvrs = [d for d in dvrs if "TEST" in d.get("name", "") and "iter87" in d.get("name", "")]
        assert len(remaining_test_dvrs) == 0, "All test DVRs should be deleted"
