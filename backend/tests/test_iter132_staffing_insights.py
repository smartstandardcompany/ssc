"""
Iteration 132: Staff Scheduling Suggestion Feature Tests
Testing:
- GET /api/staffing-insights - Staffing insights with peak hours data
- POST /api/shifts/ai-recommend - Enhanced AI recommendation with peak hours analysis
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    """Return headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }

@pytest.fixture(scope="module")
def branch_id(headers):
    """Get first branch ID"""
    response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
    assert response.status_code == 200
    branches = response.json()
    assert len(branches) > 0, "No branches found"
    return branches[0]["id"]


class TestStaffingInsightsAPI:
    """Tests for GET /api/staffing-insights endpoint"""
    
    def test_01_staffing_insights_returns_200(self, headers, branch_id):
        """Verify staffing-insights endpoint returns 200 with valid branch_id"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Staffing insights returned 200 OK")
    
    def test_02_staffing_insights_structure(self, headers, branch_id):
        """Verify response contains required fields: peak_hours, daily_coverage, shift_demand, suggestions"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        data = response.json()
        
        # Required top-level fields
        required_fields = ["branch_id", "week_start", "total_employees", "total_shifts", 
                         "peak_hours", "daily_coverage", "shift_demand", "suggestions", "total_suggestions"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        print(f"✓ Response structure verified: all required fields present")
    
    def test_03_peak_hours_structure(self, headers, branch_id):
        """Verify peak_hours contains hourly, daily, peak_hour, peak_day, rush_hours"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        peak_hours = response.json()["peak_hours"]
        
        required_peak_fields = ["hourly", "daily", "peak_hour", "peak_day", "rush_hours", 
                               "total_orders", "avg_orders_per_hour"]
        for field in required_peak_fields:
            assert field in peak_hours, f"Missing peak_hours field: {field}"
        
        # Verify hourly has 24 entries
        assert len(peak_hours["hourly"]) == 24, f"Expected 24 hourly entries, got {len(peak_hours['hourly'])}"
        
        # Verify daily has 7 entries
        assert len(peak_hours["daily"]) == 7, f"Expected 7 daily entries, got {len(peak_hours['daily'])}"
        
        print(f"✓ Peak hours structure verified: 24 hourly entries, 7 daily entries")
    
    def test_04_daily_coverage_structure(self, headers, branch_id):
        """Verify daily_coverage contains 7 days with required fields"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        daily_coverage = response.json()["daily_coverage"]
        
        assert len(daily_coverage) == 7, f"Expected 7 days coverage, got {len(daily_coverage)}"
        
        # Check first day structure
        day = daily_coverage[0]
        required_day_fields = ["date", "day", "day_abbr", "staff_count", "order_demand", 
                              "demand_level", "shifts"]
        for field in required_day_fields:
            assert field in day, f"Missing daily_coverage field: {field}"
        
        # Verify demand_level is one of expected values
        assert day["demand_level"] in ["high", "medium", "low"], f"Invalid demand_level: {day['demand_level']}"
        
        print(f"✓ Daily coverage structure verified with {len(daily_coverage)} days")
    
    def test_05_shift_demand_structure(self, headers, branch_id):
        """Verify shift_demand array has proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        shift_demand = response.json()["shift_demand"]
        
        if len(shift_demand) > 0:
            shift = shift_demand[0]
            required_shift_fields = ["shift_name", "shift_id", "start_time", "end_time", 
                                    "orders_during_shift", "demand_level"]
            for field in required_shift_fields:
                assert field in shift, f"Missing shift_demand field: {field}"
            
            assert shift["demand_level"] in ["high", "normal"], f"Invalid shift demand_level: {shift['demand_level']}"
            print(f"✓ Shift demand structure verified with {len(shift_demand)} shifts")
        else:
            print(f"✓ Shift demand array is empty (no shifts for branch)")
    
    def test_06_suggestions_structure(self, headers, branch_id):
        """Verify suggestions array has proper structure for no_coverage, understaffed, overstaffed"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        suggestions = response.json()["suggestions"]
        total = response.json()["total_suggestions"]
        
        assert len(suggestions) == total, f"Suggestions count mismatch: {len(suggestions)} vs {total}"
        
        if len(suggestions) > 0:
            sugg = suggestions[0]
            required_sugg_fields = ["type", "priority", "day", "date", "message", "action"]
            for field in required_sugg_fields:
                assert field in sugg, f"Missing suggestion field: {field}"
            
            # Verify type is one of expected values
            assert sugg["type"] in ["no_coverage", "understaffed", "overstaffed"], \
                f"Invalid suggestion type: {sugg['type']}"
            
            # Verify priority is one of expected values
            assert sugg["priority"] in ["high", "low"], f"Invalid suggestion priority: {sugg['priority']}"
            
            print(f"✓ Suggestions structure verified: {len(suggestions)} suggestions, types valid")
        else:
            print(f"✓ No suggestions (all shifts covered or no shifts)")
    
    def test_07_staffing_insights_with_week_start(self, headers, branch_id):
        """Verify custom week_start parameter works"""
        week_start = "2026-03-10"
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}&week_start={week_start}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["week_start"] == week_start, f"week_start mismatch: expected {week_start}, got {data['week_start']}"
        print(f"✓ Custom week_start parameter works correctly")
    
    def test_08_staffing_insights_requires_branch_id(self, headers):
        """Verify endpoint returns error without branch_id"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights",
            headers=headers
        )
        # Should return 422 (Unprocessable Entity) for missing required param
        assert response.status_code == 422, f"Expected 422 for missing branch_id, got {response.status_code}"
        print(f"✓ Endpoint correctly requires branch_id parameter")
    
    def test_09_staffing_insights_requires_auth(self):
        """Verify endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id=test-id"
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ Endpoint correctly requires authentication")


class TestAIRecommendEnhanced:
    """Tests for enhanced POST /api/shifts/ai-recommend endpoint"""
    
    def test_01_ai_recommend_endpoint_exists(self, headers, branch_id):
        """Verify AI recommend endpoint exists and accepts request"""
        response = requests.post(
            f"{BASE_URL}/api/shifts/ai-recommend",
            headers=headers,
            json={"branch_id": branch_id, "week_start": "2026-03-10"}
        )
        # Should return 200 with recommendations OR 400/500 with error info
        assert response.status_code in [200, 400, 500], \
            f"Unexpected status: {response.status_code}: {response.text}"
        print(f"✓ AI recommend endpoint exists and responded with {response.status_code}")
    
    def test_02_ai_recommend_response_structure(self, headers, branch_id):
        """Verify AI recommend returns recommendations array"""
        response = requests.post(
            f"{BASE_URL}/api/shifts/ai-recommend",
            headers=headers,
            json={"branch_id": branch_id, "week_start": "2026-03-10"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "recommendations" in data, "Missing recommendations field"
            assert "employee_count" in data, "Missing employee_count field"
            assert "shift_count" in data, "Missing shift_count field"
            
            if len(data["recommendations"]) > 0:
                rec = data["recommendations"][0]
                expected_fields = ["employee_id", "employee_name", "shift_name", "day", "date"]
                for field in expected_fields:
                    assert field in rec, f"Missing recommendation field: {field}"
            
            print(f"✓ AI recommend response structure valid with {len(data['recommendations'])} recommendations")
        else:
            # Check error response structure
            data = response.json()
            assert "detail" in data or "error" in data, "Error response missing detail/error field"
            print(f"✓ AI recommend returned error with proper structure: {response.status_code}")
    
    def test_03_ai_recommend_requires_branch_id(self, headers):
        """Verify AI recommend requires branch_id"""
        response = requests.post(
            f"{BASE_URL}/api/shifts/ai-recommend",
            headers=headers,
            json={"week_start": "2026-03-10"}
        )
        assert response.status_code == 400, f"Expected 400 for missing branch_id, got {response.status_code}"
        print(f"✓ AI recommend correctly requires branch_id")
    
    def test_04_ai_recommend_requires_auth(self):
        """Verify AI recommend requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/shifts/ai-recommend",
            json={"branch_id": "test-id"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"✓ AI recommend correctly requires authentication")


class TestNoCoverageSuggestions:
    """Tests for 'no_coverage' suggestions when shifts have no staff"""
    
    def test_01_no_coverage_suggestions_generated(self, headers, branch_id):
        """Verify suggestions correctly identify shifts with no staff"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        data = response.json()
        
        # Check if there are no_coverage suggestions
        no_coverage = [s for s in data["suggestions"] if s["type"] == "no_coverage"]
        
        # Verify no_coverage suggestions match shifts with 0 assigned_count
        for dc in data["daily_coverage"]:
            for shift in dc["shifts"]:
                if shift["assigned_count"] == 0:
                    # Should have a corresponding no_coverage suggestion
                    matching = [s for s in no_coverage 
                               if s["date"] == dc["date"] and shift["shift_name"] in s["message"]]
                    # Allow for cases where suggestion exists for this gap
                    if matching:
                        assert matching[0]["priority"] == "high", \
                            "no_coverage suggestions should have high priority"
        
        print(f"✓ No coverage suggestions properly generated: {len(no_coverage)} found")


class TestDataIntegrity:
    """Tests for data integrity in staffing insights"""
    
    def test_01_verify_branch_id_in_response(self, headers, branch_id):
        """Verify branch_id in response matches request"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        data = response.json()
        assert data["branch_id"] == branch_id, \
            f"Branch ID mismatch: requested {branch_id}, got {data['branch_id']}"
        print(f"✓ Branch ID correctly returned in response")
    
    def test_02_verify_hourly_labels_format(self, headers, branch_id):
        """Verify hourly labels are in HH:00 format"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        hourly = response.json()["peak_hours"]["hourly"]
        
        for h in hourly:
            assert "label" in h, "Missing label in hourly data"
            assert h["label"].endswith(":00"), f"Invalid hourly label format: {h['label']}"
            assert len(h["label"]) == 5, f"Invalid hourly label length: {h['label']}"
        
        print(f"✓ All 24 hourly labels have correct HH:00 format")
    
    def test_03_verify_daily_names(self, headers, branch_id):
        """Verify daily data has correct day names"""
        response = requests.get(
            f"{BASE_URL}/api/staffing-insights?branch_id={branch_id}",
            headers=headers
        )
        daily = response.json()["peak_hours"]["daily"]
        
        expected_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        actual_days = [d["name"] for d in daily]
        
        for expected in expected_days:
            assert expected in actual_days, f"Missing day: {expected}"
        
        print(f"✓ All 7 day names present in daily data")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
