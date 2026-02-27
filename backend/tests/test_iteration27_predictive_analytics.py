"""
Iteration 27 Tests - Predictive Analytics & UX Enhancements
Tests: 
  - P1: Predictive Analytics APIs (expense-forecast, stock-reorder, revenue-trends, customer-churn, margin-optimizer)
  - P0: Scheduler EOD Auto-Send config
  - Data validation for all API responses
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def get_auth_token():
    """Login as admin and get auth token."""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


# Get token once at module level
TOKEN = get_auth_token()


@pytest.fixture
def api_client():
    """Session with auth header."""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}"
    })
    return session


class TestExpenseForecast:
    """Test GET /api/reports/expense-forecast - Predict next month expenses by category."""
    
    def test_expense_forecast_returns_200(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/expense-forecast")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Expense forecast returns 200")
    
    def test_expense_forecast_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/expense-forecast")
        data = response.json()
        # Must have required fields
        assert "next_month" in data, "Missing next_month field"
        assert "total_predicted" in data, "Missing total_predicted field"
        assert "categories" in data, "Missing categories field"
        assert "history" in data, "Missing history field"
        print(f"✓ Expense forecast has required fields: next_month={data['next_month']}, total_predicted={data['total_predicted']}")
    
    def test_expense_forecast_categories_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/expense-forecast")
        data = response.json()
        categories = data.get("categories", [])
        if len(categories) > 0:
            cat = categories[0]
            assert "category" in cat, "Category missing 'category' field"
            assert "predicted" in cat, "Category missing 'predicted' field"
            assert "avg_3m" in cat, "Category missing 'avg_3m' field"
            assert "trend" in cat, "Category missing 'trend' field"
            assert cat["trend"] in ["up", "down", "stable"], f"Invalid trend: {cat['trend']}"
            print(f"✓ Categories structure valid: {len(categories)} categories, first={cat['category']}")
        else:
            print("✓ Categories list is empty (no expense data)")


class TestStockReorder:
    """Test GET /api/reports/stock-reorder - Predict reorder dates/quantities."""
    
    def test_stock_reorder_returns_200(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/stock-reorder")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Stock reorder returns 200")
    
    def test_stock_reorder_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/stock-reorder")
        data = response.json()
        assert "predictions" in data, "Missing predictions field"
        assert "total_items" in data, "Missing total_items field"
        assert "items_needing_reorder" in data, "Missing items_needing_reorder field"
        print(f"✓ Stock reorder structure valid: total_items={data['total_items']}, needing_reorder={data['items_needing_reorder']}")
    
    def test_stock_reorder_predictions_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/stock-reorder")
        data = response.json()
        predictions = data.get("predictions", [])
        if len(predictions) > 0:
            pred = predictions[0]
            required_fields = ["item_id", "item_name", "unit", "current_balance", "daily_usage", "days_left", "reorder_date", "suggested_reorder_qty", "urgency"]
            for field in required_fields:
                assert field in pred, f"Prediction missing '{field}' field"
            assert pred["urgency"] in ["critical", "soon", "normal", "safe"], f"Invalid urgency: {pred['urgency']}"
            print(f"✓ Predictions structure valid: first item={pred['item_name']}, days_left={pred['days_left']}, urgency={pred['urgency']}")
        else:
            print("✓ Predictions list is empty (no usage data)")


class TestRevenueTrends:
    """Test GET /api/reports/revenue-trends - Weekly/monthly trends with growth rates."""
    
    def test_revenue_trends_returns_200(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/revenue-trends")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Revenue trends returns 200")
    
    def test_revenue_trends_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/revenue-trends")
        data = response.json()
        assert "weekly" in data, "Missing weekly field"
        assert "monthly" in data, "Missing monthly field"
        assert "growth" in data, "Missing growth field"
        print(f"✓ Revenue trends has required fields: weekly={len(data['weekly'])} items, monthly={len(data['monthly'])} items")
    
    def test_revenue_trends_growth_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/revenue-trends")
        data = response.json()
        growth = data.get("growth", {})
        assert "weekly_rates" in growth, "Growth missing weekly_rates"
        assert "monthly_rates" in growth, "Growth missing monthly_rates"
        assert "avg_weekly" in growth, "Growth missing avg_weekly"
        assert "avg_monthly" in growth, "Growth missing avg_monthly"
        assert "predicted_next_week" in growth, "Growth missing predicted_next_week"
        print(f"✓ Growth structure valid: avg_weekly={growth['avg_weekly']}%, avg_monthly={growth['avg_monthly']}%, predicted_next_week={growth['predicted_next_week']}")


class TestCustomerChurn:
    """Test GET /api/reports/customer-churn - Customer churn risk analysis."""
    
    def test_customer_churn_returns_200(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/customer-churn")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Customer churn returns 200")
    
    def test_customer_churn_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/customer-churn")
        data = response.json()
        assert "customers" in data, "Missing customers field"
        assert "summary" in data, "Missing summary field"
        print(f"✓ Customer churn has required fields: {len(data['customers'])} customers")
    
    def test_customer_churn_summary_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/customer-churn")
        data = response.json()
        summary = data.get("summary", {})
        assert "total" in summary, "Summary missing total"
        assert "lost" in summary, "Summary missing lost"
        assert "high_risk" in summary, "Summary missing high_risk"
        assert "medium_risk" in summary, "Summary missing medium_risk"
        assert "active" in summary, "Summary missing active"
        print(f"✓ Churn summary: total={summary['total']}, lost={summary['lost']}, high_risk={summary['high_risk']}, active={summary['active']}")
    
    def test_customer_churn_customer_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/customer-churn")
        data = response.json()
        customers = data.get("customers", [])
        if len(customers) > 0:
            cust = customers[0]
            required_fields = ["customer_id", "name", "last_purchase_date", "days_inactive", "purchase_count", "total_spent", "risk_level"]
            for field in required_fields:
                assert field in cust, f"Customer missing '{field}' field"
            assert cust["risk_level"] in ["lost", "high", "medium", "low"], f"Invalid risk_level: {cust['risk_level']}"
            print(f"✓ Customer structure valid: first={cust['name']}, days_inactive={cust['days_inactive']}, risk={cust['risk_level']}")
        else:
            print("✓ Customers list is empty (no customer data)")


class TestMarginOptimizer:
    """Test GET /api/reports/margin-optimizer - Item margin analysis and recommendations."""
    
    def test_margin_optimizer_returns_200(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/margin-optimizer")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Margin optimizer returns 200")
    
    def test_margin_optimizer_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/margin-optimizer")
        data = response.json()
        assert "items" in data, "Missing items field"
        assert "total_analyzed" in data, "Missing total_analyzed field"
        assert "stars" in data, "Missing stars field"
        assert "to_promote" in data, "Missing to_promote field"
        assert "to_review" in data, "Missing to_review field"
        print(f"✓ Margin optimizer structure: analyzed={data['total_analyzed']}, stars={data['stars']}, to_promote={data['to_promote']}, to_review={data['to_review']}")
    
    def test_margin_optimizer_items_structure(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/reports/margin-optimizer")
        data = response.json()
        items = data.get("items", [])
        if len(items) > 0:
            item = items[0]
            required_fields = ["item_id", "item_name", "unit_price", "cost_price", "margin_pct", "total_qty_sold", "total_revenue", "total_profit", "recommendation"]
            for field in required_fields:
                assert field in item, f"Item missing '{field}' field"
            assert item["recommendation"] in ["star", "promote", "review", "maintain"], f"Invalid recommendation: {item['recommendation']}"
            print(f"✓ Item structure valid: first={item['item_name']}, margin={item['margin_pct']}%, recommendation={item['recommendation']}")
        else:
            print("✓ Items list is empty (no sales data)")


class TestSchedulerEodSummary:
    """Test scheduler config for EOD Summary job type."""
    
    def test_scheduler_config_returns_200(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/scheduler/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ Scheduler config returns 200")
    
    def test_scheduler_has_eod_summary_job(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/scheduler/config")
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        job_types = [cfg["job_type"] for cfg in data]
        assert "eod_summary" in job_types, "Missing eod_summary job type in scheduler config"
        eod_job = next((cfg for cfg in data if cfg["job_type"] == "eod_summary"), None)
        assert eod_job is not None, "eod_summary job not found"
        assert "label" in eod_job, "eod_summary missing label"
        assert "enabled" in eod_job, "eod_summary missing enabled"
        assert "hour" in eod_job, "eod_summary missing hour"
        assert "channels" in eod_job, "eod_summary missing channels"
        print(f"✓ EOD Summary job found: label={eod_job['label']}, enabled={eod_job['enabled']}, hour={eod_job['hour']}, channels={eod_job['channels']}")
    
    def test_scheduler_eod_can_be_enabled(self, api_client):
        # Enable eod_summary
        response = api_client.put(f"{BASE_URL}/api/scheduler/config/eod_summary", json={"enabled": True})
        assert response.status_code == 200, f"Failed to enable eod_summary: {response.text}"
        data = response.json()
        assert data.get("enabled") == True, "eod_summary not enabled after PUT"
        print("✓ EOD Summary job can be enabled")
        
        # Disable it back
        response = api_client.put(f"{BASE_URL}/api/scheduler/config/eod_summary", json={"enabled": False})
        assert response.status_code == 200, f"Failed to disable eod_summary: {response.text}"
        print("✓ EOD Summary job can be disabled")
    
    def test_scheduler_eod_can_update_time(self, api_client):
        # Update time to 20:30
        response = api_client.put(f"{BASE_URL}/api/scheduler/config/eod_summary", json={"hour": 20, "minute": 30})
        assert response.status_code == 200, f"Failed to update eod_summary time: {response.text}"
        data = response.json()
        assert data.get("hour") == 20, f"hour not updated: {data.get('hour')}"
        assert data.get("minute") == 30, f"minute not updated: {data.get('minute')}"
        print("✓ EOD Summary time can be updated to 20:30")
        
        # Reset to default
        api_client.put(f"{BASE_URL}/api/scheduler/config/eod_summary", json={"hour": 22, "minute": 0})


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
