"""
Test Suite for Iteration 47 - New Feature Sets:
1. Enhanced Predictive Analytics (inventory-demand, customer-clv, peak-hours, profit-decomposition)
2. Report Customization (report-views CRUD + data endpoint)
3. Push Notification Preferences (vapid-key, subscribe, unsubscribe, preferences, status)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "ss@ssc.com"
TEST_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test session"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    # Use access_token field
    return data.get("access_token")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestPredictionEndpoints:
    """Test new prediction API endpoints in predictions.py"""
    
    def test_inventory_demand_endpoint(self, api_client):
        """Test GET /api/predictions/inventory-demand"""
        response = api_client.get(f"{BASE_URL}/api/predictions/inventory-demand")
        assert response.status_code == 200, f"Inventory demand failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "items" in data, "Missing 'items' field"
        assert "total_items_tracked" in data, "Missing 'total_items_tracked' field"
        assert "items_at_risk" in data, "Missing 'items_at_risk' field"
        assert "forecast_period" in data, "Missing 'forecast_period' field"
        assert isinstance(data["items"], list), "'items' should be a list"
        print(f"PASS: inventory-demand returned {data['total_items_tracked']} items tracked")
    
    def test_inventory_demand_with_days_param(self, api_client):
        """Test inventory-demand with custom days parameter"""
        response = api_client.get(f"{BASE_URL}/api/predictions/inventory-demand?days=7")
        assert response.status_code == 200, f"Inventory demand with days=7 failed: {response.text}"
        data = response.json()
        assert data["forecast_period"] == "Next 7 days", f"Unexpected forecast_period: {data['forecast_period']}"
        print("PASS: inventory-demand accepts days parameter")
    
    def test_customer_clv_endpoint(self, api_client):
        """Test GET /api/predictions/customer-clv"""
        response = api_client.get(f"{BASE_URL}/api/predictions/customer-clv")
        assert response.status_code == 200, f"Customer CLV failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "customers" in data, "Missing 'customers' field"
        assert "total_customers" in data, "Missing 'total_customers' field"
        assert "total_projected_revenue" in data, "Missing 'total_projected_revenue' field"
        assert "segments" in data, "Missing 'segments' field"
        assert "avg_clv" in data, "Missing 'avg_clv' field"
        
        # Validate segments structure
        segments = data["segments"]
        assert "Platinum" in segments, "Missing 'Platinum' segment"
        assert "Gold" in segments, "Missing 'Gold' segment"
        assert "Silver" in segments, "Missing 'Silver' segment"
        assert "Bronze" in segments, "Missing 'Bronze' segment"
        print(f"PASS: customer-clv returned {data['total_customers']} customers")
    
    def test_peak_hours_endpoint(self, api_client):
        """Test GET /api/predictions/peak-hours"""
        response = api_client.get(f"{BASE_URL}/api/predictions/peak-hours")
        assert response.status_code == 200, f"Peak hours failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "hourly_analysis" in data, "Missing 'hourly_analysis' field"
        assert "peak_hours" in data, "Missing 'peak_hours' field"
        assert "slow_hours" in data, "Missing 'slow_hours' field"
        assert "heatmap" in data, "Missing 'heatmap' field"
        assert "total_transactions_analyzed" in data, "Missing 'total_transactions_analyzed'"
        assert "recommendations" in data, "Missing 'recommendations' field"
        
        # Validate hourly_analysis has 24 hours
        assert len(data["hourly_analysis"]) == 24, f"Expected 24 hours, got {len(data['hourly_analysis'])}"
        print(f"PASS: peak-hours analyzed {data['total_transactions_analyzed']} transactions")
    
    def test_profit_decomposition_endpoint(self, api_client):
        """Test GET /api/predictions/profit-decomposition"""
        response = api_client.get(f"{BASE_URL}/api/predictions/profit-decomposition")
        assert response.status_code == 200, f"Profit decomposition failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "daily" in data, "Missing 'daily' field"
        assert "monthly" in data, "Missing 'monthly' field"
        assert "seasonality" in data, "Missing 'seasonality' field"
        assert "anomalies" in data, "Missing 'anomalies' field"
        assert "summary" in data, "Missing 'summary' field"
        
        # Validate summary structure
        summary = data["summary"]
        assert "avg_daily_profit" in summary, "Missing 'avg_daily_profit' in summary"
        assert "profit_trend" in summary, "Missing 'profit_trend' in summary"
        assert "best_day" in summary, "Missing 'best_day' in summary"
        assert "worst_day" in summary, "Missing 'worst_day' in summary"
        print(f"PASS: profit-decomposition returned {len(data['daily'])} daily records")


class TestReportViewsEndpoints:
    """Test report views CRUD endpoints in report_views.py"""
    
    def test_list_report_views_empty(self, api_client):
        """Test GET /api/report-views returns list"""
        response = api_client.get(f"{BASE_URL}/api/report-views")
        assert response.status_code == 200, f"List report views failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: list report-views returned {len(data)} views")
    
    def test_create_report_view(self, api_client):
        """Test POST /api/report-views - create a new view"""
        view_name = f"TEST_View_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": view_name,
            "report_type": "sales",
            "filters": {"start_date": "2024-01-01", "end_date": "2024-12-31"},
            "columns": ["date", "amount", "final_amount", "payment_mode"],
            "sort_by": "date",
            "sort_order": "desc"
        }
        response = api_client.post(f"{BASE_URL}/api/report-views", json=payload)
        assert response.status_code == 200, f"Create report view failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data, "Missing 'id' in created view"
        assert data["name"] == view_name, f"Name mismatch: expected {view_name}"
        assert data["report_type"] == "sales", "Report type mismatch"
        assert data["columns"] == payload["columns"], "Columns mismatch"
        
        print(f"PASS: Created report view with id={data['id']}")
        return data["id"]
    
    def test_list_report_views_with_type_filter(self, api_client):
        """Test GET /api/report-views?report_type=sales"""
        response = api_client.get(f"{BASE_URL}/api/report-views?report_type=sales")
        assert response.status_code == 200, f"List views with filter failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # All returned views should be of type 'sales'
        for view in data:
            assert view.get("report_type") == "sales", f"Unexpected report type: {view.get('report_type')}"
        print(f"PASS: Filtered list returned {len(data)} sales views")
    
    def test_delete_report_view(self, api_client):
        """Test DELETE /api/report-views/{id}"""
        # First create a view to delete
        view_name = f"TEST_DeleteView_{uuid.uuid4().hex[:6]}"
        create_res = api_client.post(f"{BASE_URL}/api/report-views", json={
            "name": view_name,
            "report_type": "expenses",
            "filters": {},
            "columns": ["date", "amount", "category"]
        })
        assert create_res.status_code == 200, f"Create for delete test failed: {create_res.text}"
        view_id = create_res.json()["id"]
        
        # Delete the view
        delete_res = api_client.delete(f"{BASE_URL}/api/report-views/{view_id}")
        assert delete_res.status_code == 200, f"Delete failed: {delete_res.text}"
        
        # Verify deletion - trying to delete again should 404
        delete_again_res = api_client.delete(f"{BASE_URL}/api/report-views/{view_id}")
        assert delete_again_res.status_code == 404, f"Expected 404 for deleted view, got {delete_again_res.status_code}"
        print(f"PASS: Delete report view works correctly")
    
    def test_get_report_data_sales(self, api_client):
        """Test GET /api/report-views/data/sales"""
        response = api_client.get(f"{BASE_URL}/api/report-views/data/sales")
        assert response.status_code == 200, f"Get sales report data failed: {response.text}"
        data = response.json()
        
        assert "data" in data, "Missing 'data' field"
        assert "summary" in data, "Missing 'summary' field"
        assert "filters_applied" in data, "Missing 'filters_applied' field"
        assert "total_records" in data["summary"], "Missing 'total_records' in summary"
        print(f"PASS: report-views/data/sales returned {data['summary']['total_records']} records")
    
    def test_get_report_data_with_filters(self, api_client):
        """Test GET /api/report-views/data/expenses with date filters"""
        response = api_client.get(f"{BASE_URL}/api/report-views/data/expenses?start_date=2024-01-01&end_date=2024-12-31")
        assert response.status_code == 200, f"Get expenses data with filters failed: {response.text}"
        data = response.json()
        
        assert data["filters_applied"]["start_date"] == "2024-01-01"
        assert data["filters_applied"]["end_date"] == "2024-12-31"
        print(f"PASS: report-views/data/expenses with filters returned {data['summary']['total_records']} records")
    
    def test_get_report_data_invalid_type(self, api_client):
        """Test GET /api/report-views/data/invalid returns 400"""
        response = api_client.get(f"{BASE_URL}/api/report-views/data/invalid_type")
        assert response.status_code == 400, f"Expected 400 for invalid type, got {response.status_code}"
        print("PASS: invalid report type returns 400")


class TestPushNotificationEndpoints:
    """Test push notification endpoints in push_notifications.py"""
    
    def test_get_vapid_key(self, api_client):
        """Test GET /api/push/vapid-key"""
        response = api_client.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200, f"Get VAPID key failed: {response.text}"
        data = response.json()
        
        assert "publicKey" in data, "Missing 'publicKey' field"
        # VAPID key should be a string (can be empty if not configured)
        assert isinstance(data["publicKey"], str), "'publicKey' should be string"
        print(f"PASS: vapid-key returned publicKey (length={len(data['publicKey'])})")
    
    def test_get_push_preferences(self, api_client):
        """Test GET /api/push/preferences"""
        response = api_client.get(f"{BASE_URL}/api/push/preferences")
        assert response.status_code == 200, f"Get push preferences failed: {response.text}"
        data = response.json()
        
        # Validate all preference fields exist
        expected_fields = [
            "low_stock_alerts", "leave_requests", "order_updates",
            "loan_installments", "expense_anomalies", "document_expiry", "daily_summary"
        ]
        for field in expected_fields:
            assert field in data, f"Missing '{field}' in preferences"
            assert isinstance(data[field], bool), f"'{field}' should be boolean"
        print("PASS: push/preferences returns all expected fields")
    
    def test_update_push_preferences(self, api_client):
        """Test PUT /api/push/preferences"""
        payload = {
            "low_stock_alerts": True,
            "leave_requests": False,
            "order_updates": True,
            "loan_installments": True,
            "expense_anomalies": False,
            "document_expiry": True,
            "daily_summary": True
        }
        response = api_client.put(f"{BASE_URL}/api/push/preferences", json=payload)
        assert response.status_code == 200, f"Update push preferences failed: {response.text}"
        
        # Verify by fetching preferences again
        get_res = api_client.get(f"{BASE_URL}/api/push/preferences")
        assert get_res.status_code == 200
        data = get_res.json()
        
        # Validate updated values
        assert data["leave_requests"] == False, "leave_requests should be False"
        assert data["expense_anomalies"] == False, "expense_anomalies should be False"
        assert data["daily_summary"] == True, "daily_summary should be True"
        print("PASS: push/preferences update works correctly")
    
    def test_get_push_status(self, api_client):
        """Test GET /api/push/status"""
        response = api_client.get(f"{BASE_URL}/api/push/status")
        assert response.status_code == 200, f"Get push status failed: {response.text}"
        data = response.json()
        
        assert "subscribed" in data, "Missing 'subscribed' field"
        assert "subscription_count" in data, "Missing 'subscription_count' field"
        assert isinstance(data["subscribed"], bool), "'subscribed' should be boolean"
        assert isinstance(data["subscription_count"], int), "'subscription_count' should be int"
        print(f"PASS: push/status returns subscribed={data['subscribed']}, count={data['subscription_count']}")
    
    def test_subscribe_push(self, api_client):
        """Test POST /api/push/subscribe"""
        payload = {
            "endpoint": f"https://fcm.googleapis.com/fcm/send/{uuid.uuid4().hex}",
            "keys": {
                "p256dh": "test_p256dh_key_for_testing",
                "auth": "test_auth_key"
            }
        }
        response = api_client.post(f"{BASE_URL}/api/push/subscribe", json=payload)
        assert response.status_code == 200, f"Subscribe push failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "Missing 'message' in response"
        assert "Subscribed" in data["message"], f"Unexpected message: {data['message']}"
        print("PASS: push/subscribe creates subscription")
    
    def test_unsubscribe_push(self, api_client):
        """Test DELETE /api/push/unsubscribe"""
        response = api_client.delete(f"{BASE_URL}/api/push/unsubscribe")
        assert response.status_code == 200, f"Unsubscribe push failed: {response.text}"
        data = response.json()
        
        assert "message" in data, "Missing 'message' in response"
        assert "Unsubscribed" in data["message"], f"Unexpected message: {data['message']}"
        
        # Verify status after unsubscribe
        status_res = api_client.get(f"{BASE_URL}/api/push/status")
        status_data = status_res.json()
        assert status_data["subscribed"] == False, "Should be unsubscribed"
        print("PASS: push/unsubscribe removes subscriptions")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_views(self, api_client):
        """Delete all TEST_ prefixed report views"""
        response = api_client.get(f"{BASE_URL}/api/report-views")
        if response.status_code == 200:
            views = response.json()
            deleted = 0
            for view in views:
                if view.get("name", "").startswith("TEST_"):
                    del_res = api_client.delete(f"{BASE_URL}/api/report-views/{view['id']}")
                    if del_res.status_code == 200:
                        deleted += 1
            print(f"CLEANUP: Deleted {deleted} TEST_ prefixed views")
        assert True  # Always pass cleanup


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
