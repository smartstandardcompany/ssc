"""
CCTV Module Backend Tests - Iteration 88
Tests for: Remote DVR support with port forwarding
New features tested:
1. DVR connection_type field ('remote', 'local', 'cloud')
2. Snapshot endpoint no longer blocks cloud DVRs
3. Proper error messages for cloud DVRs without IP
4. Stream-info endpoint returns type based on connection_type
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def get_auth_headers():
    """Get authentication headers"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


def get_test_branch_id(auth_headers):
    """Get a branch ID for testing"""
    response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
    if response.status_code == 200 and len(response.json()) > 0:
        return response.json()[0]["id"]
    return None


# =====================================================
# AUTHENTICATION TEST
# =====================================================

class TestAuth:
    """Test authentication works"""
    
    def test_login_success(self):
        """POST /api/auth/login - verify admin credentials work"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data


# =====================================================
# ALL-IN-ONE CCTV TESTS  
# =====================================================

class TestCCTVRemoteDVRFeatures:
    """Test all CCTV remote DVR features in one class to control execution order"""
    
    @pytest.fixture(scope="class")
    def setup_data(self):
        """Create test DVRs and return their data"""
        auth_headers = get_auth_headers()
        branch_id = get_test_branch_id(auth_headers)
        
        if not branch_id:
            pytest.skip("No branch available for testing")
        
        dvr_ids = []
        camera_ids = {}
        
        # Create remote DVR
        dvr_data = {
            "branch_id": branch_id,
            "branch_name": "Test Branch",
            "name": "TEST Remote DVR iter88",
            "ip_address": "203.0.113.50",
            "port": 8080,
            "http_port": 8080,
            "rtsp_port": 554,
            "username": "admin",
            "password": "test123",
            "is_cloud": False,
            "connection_type": "remote",
            "channels": 4
        }
        response = requests.post(f"{BASE_URL}/api/cctv/dvrs", json=dvr_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create remote DVR: {response.text}"
        remote_dvr_id = response.json()["id"]
        dvr_ids.append(remote_dvr_id)
        
        # Create local DVR
        dvr_data = {
            "branch_id": branch_id,
            "branch_name": "Test Branch",
            "name": "TEST Local DVR iter88",
            "ip_address": "192.168.1.100",
            "port": 80,
            "http_port": 80,
            "rtsp_port": 554,
            "username": "admin",
            "password": "test123",
            "is_cloud": False,
            "connection_type": "local",
            "channels": 4
        }
        response = requests.post(f"{BASE_URL}/api/cctv/dvrs", json=dvr_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create local DVR: {response.text}"
        local_dvr_id = response.json()["id"]
        dvr_ids.append(local_dvr_id)
        
        # Create cloud DVR with IP
        dvr_data = {
            "branch_id": branch_id,
            "branch_name": "Test Branch",
            "name": "TEST Cloud DVR with IP iter88",
            "device_serial": "DS-7208HQHI-K1-TEST88",
            "ip_address": "103.0.113.100",
            "http_port": 80,
            "rtsp_port": 554,
            "username": "admin",
            "password": "test123",
            "is_cloud": True,
            "connection_type": "cloud",
            "channels": 8
        }
        response = requests.post(f"{BASE_URL}/api/cctv/dvrs", json=dvr_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create cloud DVR with IP: {response.text}"
        cloud_with_ip_dvr_id = response.json()["id"]
        dvr_ids.append(cloud_with_ip_dvr_id)
        
        # Create cloud DVR without IP
        dvr_data = {
            "branch_id": branch_id,
            "branch_name": "Test Branch",
            "name": "TEST Cloud DVR no IP iter88",
            "device_serial": "DS-7216HQHI-K2-TEST88",
            "is_cloud": True,
            "connection_type": "cloud",
            "channels": 16
        }
        response = requests.post(f"{BASE_URL}/api/cctv/dvrs", json=dvr_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create cloud DVR without IP: {response.text}"
        cloud_no_ip_dvr_id = response.json()["id"]
        dvr_ids.append(cloud_no_ip_dvr_id)
        
        # Small delay to ensure cameras are created
        import time
        time.sleep(0.5)
        
        # Get camera IDs
        cams_resp = requests.get(f"{BASE_URL}/api/cctv/cameras", headers=auth_headers)
        cams = cams_resp.json() if cams_resp.status_code == 200 else []
        
        for cam in cams:
            dvr_id = cam.get("dvr_id")
            if dvr_id == remote_dvr_id and "remote" not in camera_ids:
                camera_ids["remote"] = cam["id"]
            elif dvr_id == local_dvr_id and "local" not in camera_ids:
                camera_ids["local"] = cam["id"]
            elif dvr_id == cloud_with_ip_dvr_id and "cloud_with_ip" not in camera_ids:
                camera_ids["cloud_with_ip"] = cam["id"]
            elif dvr_id == cloud_no_ip_dvr_id and "cloud_no_ip" not in camera_ids:
                camera_ids["cloud_no_ip"] = cam["id"]
        
        print(f"Created DVRs: {dvr_ids}")
        print(f"Camera IDs: {camera_ids}")
        
        yield {
            "auth_headers": auth_headers,
            "dvr_ids": dvr_ids,
            "camera_ids": camera_ids
        }
        
        # Cleanup after all tests
        print("Cleaning up test DVRs...")
        for dvr_id in dvr_ids:
            requests.delete(f"{BASE_URL}/api/cctv/dvrs/{dvr_id}", headers=auth_headers)
        print("Cleanup complete")

    # === DVR Connection Type Tests ===
    
    def test_dvrs_created_with_connection_type(self, setup_data):
        """Verify DVRs are created with correct connection_type field"""
        auth_headers = setup_data["auth_headers"]
        
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs", headers=auth_headers)
        assert response.status_code == 200
        dvrs = response.json()
        
        test_dvrs = [d for d in dvrs if "iter88" in d.get("name", "")]
        assert len(test_dvrs) == 4, f"Should have 4 test DVRs, found {len(test_dvrs)}"
        
        # Verify connection types
        types_found = {}
        for dvr in test_dvrs:
            conn_type = dvr.get("connection_type", "unknown")
            types_found[dvr["name"]] = conn_type
            print(f"DVR: {dvr['name']}, connection_type: {conn_type}")
        
        assert any("remote" in t for t in types_found.values()), "Should have remote DVR"
        assert any("local" in t for t in types_found.values()), "Should have local DVR"
        assert any("cloud" in t for t in types_found.values()), "Should have cloud DVR"

    # === Snapshot Endpoint Tests ===
    
    def test_snapshot_remote_dvr_returns_connection_error(self, setup_data):
        """GET /api/cctv/snapshot - remote DVR returns connection error (DVR not reachable)"""
        auth_headers = setup_data["auth_headers"]
        cam_id = setup_data["camera_ids"].get("remote")
        if not cam_id:
            pytest.skip("No remote DVR camera")
        
        response = requests.get(f"{BASE_URL}/api/cctv/snapshot/{cam_id}", headers=auth_headers)
        # Should return 502/504 (connection error), not 400 (blocked)
        assert response.status_code in [502, 504], f"Expected connection error, got {response.status_code}"
        data = response.json()
        detail = data.get("detail", "").lower()
        assert "cannot connect" in detail or "timed out" in detail or "port" in detail
        print(f"Remote DVR snapshot: {response.status_code}")

    def test_snapshot_local_dvr_returns_connection_error(self, setup_data):
        """GET /api/cctv/snapshot - local DVR returns connection error (DVR not reachable)"""
        auth_headers = setup_data["auth_headers"]
        cam_id = setup_data["camera_ids"].get("local")
        if not cam_id:
            pytest.skip("No local DVR camera")
        
        response = requests.get(f"{BASE_URL}/api/cctv/snapshot/{cam_id}", headers=auth_headers)
        assert response.status_code in [502, 504], f"Expected connection error, got {response.status_code}"
        print(f"Local DVR snapshot: {response.status_code}")

    def test_snapshot_cloud_dvr_with_ip_attempts_connection(self, setup_data):
        """GET /api/cctv/snapshot - cloud DVR WITH IP should attempt connection (not blocked)"""
        auth_headers = setup_data["auth_headers"]
        cam_id = setup_data["camera_ids"].get("cloud_with_ip")
        if not cam_id:
            pytest.skip("No cloud DVR with IP camera")
        
        response = requests.get(f"{BASE_URL}/api/cctv/snapshot/{cam_id}", headers=auth_headers)
        # Should return 502/504 (connection error), not 400 (blocked)
        # This proves snapshot endpoint no longer blocks cloud DVRs
        assert response.status_code in [502, 504], f"Expected connection error for cloud DVR with IP, got {response.status_code}"
        print(f"Cloud DVR with IP snapshot: {response.status_code}")

    def test_snapshot_cloud_dvr_without_ip_returns_helpful_message(self, setup_data):
        """GET /api/cctv/snapshot - cloud DVR WITHOUT IP returns helpful error message"""
        auth_headers = setup_data["auth_headers"]
        cam_id = setup_data["camera_ids"].get("cloud_no_ip")
        if not cam_id:
            pytest.skip("No cloud DVR without IP camera")
        
        response = requests.get(f"{BASE_URL}/api/cctv/snapshot/{cam_id}", headers=auth_headers)
        # Should return 400 with helpful message about adding public IP
        assert response.status_code == 400, f"Expected 400 for cloud DVR without IP, got {response.status_code}: {response.text}"
        data = response.json()
        detail_lower = data.get("detail", "").lower()
        assert "public ip" in detail_lower or "ip address" in detail_lower or "ddns" in detail_lower or "domain" in detail_lower
        print(f"Cloud DVR without IP message: {data.get('detail')}")

    # === Stream-Info Endpoint Tests ===
    
    def test_stream_info_remote_dvr_returns_type_remote(self, setup_data):
        """GET /api/cctv/stream-info - remote DVR returns type='remote'"""
        auth_headers = setup_data["auth_headers"]
        cam_id = setup_data["camera_ids"].get("remote")
        if not cam_id:
            pytest.skip("No remote DVR camera")
        
        response = requests.get(f"{BASE_URL}/api/cctv/stream-info/{cam_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("type") == "remote", f"Expected type='remote', got '{data.get('type')}'"
        assert "channel" in data
        print(f"Remote DVR stream-info: type={data['type']}")

    def test_stream_info_local_dvr_returns_type_local(self, setup_data):
        """GET /api/cctv/stream-info - local DVR returns type='local'"""
        auth_headers = setup_data["auth_headers"]
        cam_id = setup_data["camera_ids"].get("local")
        if not cam_id:
            pytest.skip("No local DVR camera")
        
        response = requests.get(f"{BASE_URL}/api/cctv/stream-info/{cam_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("type") == "local", f"Expected type='local', got '{data.get('type')}'"
        print(f"Local DVR stream-info: type={data['type']}")

    def test_stream_info_cloud_dvr_returns_type_cloud(self, setup_data):
        """GET /api/cctv/stream-info - cloud DVR returns type='cloud'"""
        auth_headers = setup_data["auth_headers"]
        cam_id = setup_data["camera_ids"].get("cloud_with_ip") or setup_data["camera_ids"].get("cloud_no_ip")
        if not cam_id:
            pytest.skip("No cloud DVR camera")
        
        response = requests.get(f"{BASE_URL}/api/cctv/stream-info/{cam_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data.get("type") == "cloud", f"Expected type='cloud', got '{data.get('type')}'"
        print(f"Cloud DVR stream-info: type={data['type']}")

    def test_stream_info_has_rtsp_urls_for_dvr_with_ip(self, setup_data):
        """GET /api/cctv/stream-info - DVR with IP should have RTSP URLs"""
        auth_headers = setup_data["auth_headers"]
        cam_id = setup_data["camera_ids"].get("remote")
        if not cam_id:
            pytest.skip("No DVR with IP camera")
        
        response = requests.get(f"{BASE_URL}/api/cctv/stream-info/{cam_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "rtsp_main" in data or "rtsp_available" in data
        if data.get("rtsp_main"):
            assert "rtsp://" in data["rtsp_main"]
        print(f"RTSP URL present: {data.get('rtsp_main', 'N/A')[:50]}...")
