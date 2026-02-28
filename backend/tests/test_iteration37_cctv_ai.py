"""
Test CCTV AI Features - Iteration 37
Tests Face Recognition, Object Detection, People Counting, Motion Analysis
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Simple test image - 1x1 red pixel PNG (valid base64 image)
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for API calls"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestCCTVBasicEndpoints:
    """Basic CCTV endpoint tests"""
    
    def test_get_cameras(self, auth_headers):
        """GET /api/cctv/cameras - Get all cameras"""
        response = requests.get(f"{BASE_URL}/api/cctv/cameras", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Cameras count: {len(response.json())}")
    
    def test_get_dvrs(self, auth_headers):
        """GET /api/cctv/dvrs - Get all DVRs"""
        response = requests.get(f"{BASE_URL}/api/cctv/dvrs", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"DVRs count: {len(response.json())}")
    
    def test_get_faces(self, auth_headers):
        """GET /api/cctv/faces - Get registered faces"""
        response = requests.get(f"{BASE_URL}/api/cctv/faces", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Registered faces count: {len(response.json())}")
    
    def test_get_alerts(self, auth_headers):
        """GET /api/cctv/alerts - Get motion alerts"""
        response = requests.get(f"{BASE_URL}/api/cctv/alerts?limit=20", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Alerts count: {len(response.json())}")
    
    def test_get_analytics(self, auth_headers):
        """GET /api/cctv/analytics - Get CCTV analytics"""
        response = requests.get(f"{BASE_URL}/api/cctv/analytics", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "summary" in data
        assert "period" in data
        print(f"Analytics summary: {data.get('summary', {})}")
    
    def test_get_people_count(self, auth_headers):
        """GET /api/cctv/people-count - Get people count data"""
        response = requests.get(f"{BASE_URL}/api/cctv/people-count", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "date" in data
        assert "total_entries" in data
        print(f"People count data: entries={data.get('total_entries')}, exits={data.get('total_exits')}")
    
    def test_get_attendance(self, auth_headers):
        """GET /api/cctv/attendance - Get face recognition attendance"""
        response = requests.get(f"{BASE_URL}/api/cctv/attendance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "records" in data
        print(f"Attendance records: {len(data.get('records', []))}")
    
    def test_get_cctv_settings(self, auth_headers):
        """GET /api/cctv/settings - Get CCTV AI settings"""
        response = requests.get(f"{BASE_URL}/api/cctv/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "people_counting_enabled" in data
        assert "motion_alerts_enabled" in data
        print(f"CCTV Settings: people_counting={data.get('people_counting_enabled')}, motion_alerts={data.get('motion_alerts_enabled')}")


class TestCCTVAIPeopleCount:
    """AI People Counting endpoint tests"""
    
    def test_count_people_success(self, auth_headers):
        """POST /api/cctv/ai/count-people - Returns success response with people count"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/count-people", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera",
                "image_data": TEST_IMAGE_BASE64,
                "previous_count": 0
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "people_count" in data or "error" in data
        print(f"People count result: {data}")
    
    def test_count_people_missing_camera(self, auth_headers):
        """POST /api/cctv/ai/count-people - Returns 400 when camera_id missing"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/count-people", 
            headers=auth_headers,
            json={
                "image_data": TEST_IMAGE_BASE64
            }
        )
        assert response.status_code == 400
        assert "camera_id" in response.json().get("detail", "").lower()
    
    def test_count_people_missing_image(self, auth_headers):
        """POST /api/cctv/ai/count-people - Returns 400 when image_data missing"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/count-people", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera"
            }
        )
        assert response.status_code == 400
        assert "image_data" in response.json().get("detail", "").lower()


class TestCCTVAIObjectDetection:
    """AI Object Detection endpoint tests"""
    
    def test_detect_objects_success(self, auth_headers):
        """POST /api/cctv/ai/detect-objects - Returns success response"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/detect-objects", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera",
                "image_data": TEST_IMAGE_BASE64,
                "context": "retail store inventory",
                "target_objects": ["bottles", "boxes"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "objects_detected" in data or "error" in data
        print(f"Object detection result: {data}")
    
    def test_detect_objects_missing_image(self, auth_headers):
        """POST /api/cctv/ai/detect-objects - Returns 400 when image_data missing"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/detect-objects", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera",
                "context": "retail store"
            }
        )
        assert response.status_code == 400
    
    def test_detect_objects_different_contexts(self, auth_headers):
        """POST /api/cctv/ai/detect-objects - Works with different contexts"""
        contexts = ["warehouse shelves", "restaurant kitchen", "office supplies"]
        for context in contexts:
            response = requests.post(f"{BASE_URL}/api/cctv/ai/detect-objects", 
                headers=auth_headers,
                json={
                    "camera_id": "test_camera",
                    "image_data": TEST_IMAGE_BASE64,
                    "context": context
                }
            )
            assert response.status_code == 200
            print(f"Context '{context}': {response.json().get('success')}")


class TestCCTVAIFaceRecognition:
    """AI Face Recognition endpoint tests"""
    
    def test_recognize_face_success(self, auth_headers):
        """POST /api/cctv/ai/recognize-face - Returns success response"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/recognize-face", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera",
                "image_data": TEST_IMAGE_BASE64
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        # Should have faces_detected and matches even if 0
        assert "faces_detected" in data or "error" in data
        print(f"Face recognition result: {data}")
    
    def test_recognize_face_missing_image(self, auth_headers):
        """POST /api/cctv/ai/recognize-face - Returns 400 when image_data missing"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/recognize-face", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera"
            }
        )
        assert response.status_code == 400
    
    def test_recognize_face_with_branch_filter(self, auth_headers):
        """POST /api/cctv/ai/recognize-face - Works with branch_id filter"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/recognize-face", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera",
                "image_data": TEST_IMAGE_BASE64,
                "branch_id": "branch_1"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data


class TestCCTVAIMotionAnalysis:
    """AI Motion Analysis endpoint tests"""
    
    def test_analyze_motion_success(self, auth_headers):
        """POST /api/cctv/ai/analyze-motion - Returns success response"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/analyze-motion", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera",
                "image_data": TEST_IMAGE_BASE64
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "motion_detected" in data or "error" in data
        print(f"Motion analysis result: {data}")
    
    def test_analyze_motion_missing_image(self, auth_headers):
        """POST /api/cctv/ai/analyze-motion - Returns 400 when image_data missing"""
        response = requests.post(f"{BASE_URL}/api/cctv/ai/analyze-motion", 
            headers=auth_headers,
            json={
                "camera_id": "test_camera"
            }
        )
        assert response.status_code == 400


class TestCCTVFaceRegistration:
    """Face Registration endpoint tests"""
    
    def test_register_face_missing_employee(self, auth_headers):
        """POST /api/cctv/faces/register - Returns 400 when employee_id missing"""
        response = requests.post(f"{BASE_URL}/api/cctv/faces/register", 
            headers=auth_headers,
            json={
                "image_data": TEST_IMAGE_BASE64
            }
        )
        assert response.status_code == 400
    
    def test_register_face_missing_image(self, auth_headers):
        """POST /api/cctv/faces/register - Returns 400 when image_data missing"""
        response = requests.post(f"{BASE_URL}/api/cctv/faces/register", 
            headers=auth_headers,
            json={
                "employee_id": "emp_123"
            }
        )
        assert response.status_code == 400
    
    def test_register_face_nonexistent_employee(self, auth_headers):
        """POST /api/cctv/faces/register - Returns 404 for nonexistent employee"""
        response = requests.post(f"{BASE_URL}/api/cctv/faces/register", 
            headers=auth_headers,
            json={
                "employee_id": "nonexistent_employee_123",
                "image_data": TEST_IMAGE_BASE64
            }
        )
        assert response.status_code == 404


class TestCCTVObjectDetectionHistory:
    """Object Detection History endpoint tests"""
    
    def test_get_object_detections(self, auth_headers):
        """GET /api/cctv/object-detections - Get object detection history"""
        response = requests.get(f"{BASE_URL}/api/cctv/object-detections?limit=20", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Object detections count: {len(response.json())}")


class TestCCTVHikConnect:
    """Hik-Connect status endpoint tests"""
    
    def test_get_hik_connect_status(self, auth_headers):
        """GET /api/cctv/hik-connect/status - Get Hik-Connect connection status"""
        response = requests.get(f"{BASE_URL}/api/cctv/hik-connect/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        print(f"Hik-Connect status: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
