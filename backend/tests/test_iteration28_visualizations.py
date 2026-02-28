"""
Iteration 28: Advanced Data Visualization Options Tests
Tests for 8 new visualization endpoints:
1. Heatmap Calendar - /api/reports/heatmap-data
2. Sales Funnel - /api/reports/sales-funnel
3. Expense Treemap - /api/reports/expense-treemap
4. KPI Gauges - /api/reports/kpi-gauges
5. Branch Radar - /api/reports/branch-radar
6. Cash Flow Waterfall - /api/reports/cashflow-waterfall
7. Money Flow - /api/reports/money-flow
8. Time Series Compare - /api/reports/time-series-compare
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://ssc-track-erp-1.preview.emergentagent.com"

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


@pytest.fixture(scope="module")
def auth_token():
    """Authenticate and get token for API calls"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        token = response.json().get("access_token") or response.json().get("token")
        return token
    pytest.skip(f"Authentication failed: {response.status_code}")


@pytest.fixture
def headers(auth_token):
    """Headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


class TestHeatmapData:
    """Test /api/reports/heatmap-data endpoint"""

    def test_heatmap_returns_200(self, headers):
        """Heatmap endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/reports/heatmap-data", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_heatmap_returns_array(self, headers):
        """Heatmap returns array of daily data"""
        response = requests.get(f"{BASE_URL}/api/reports/heatmap-data", headers=headers)
        data = response.json()
        assert isinstance(data, list), "Heatmap should return an array"

    def test_heatmap_data_structure(self, headers):
        """Heatmap data has correct structure (date, sales, expenses, profit, count)"""
        response = requests.get(f"{BASE_URL}/api/reports/heatmap-data", headers=headers)
        data = response.json()
        if len(data) > 0:
            item = data[0]
            assert "date" in item, "Heatmap item should have 'date' field"
            assert "sales" in item, "Heatmap item should have 'sales' field"
            assert "expenses" in item, "Heatmap item should have 'expenses' field"
            assert "profit" in item, "Heatmap item should have 'profit' field"


class TestSalesFunnel:
    """Test /api/reports/sales-funnel endpoint"""

    def test_funnel_returns_200(self, headers):
        """Sales funnel endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/reports/sales-funnel", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_funnel_has_funnel_array(self, headers):
        """Funnel response has 'funnel' array with stages"""
        response = requests.get(f"{BASE_URL}/api/reports/sales-funnel", headers=headers)
        data = response.json()
        assert "funnel" in data, "Response should have 'funnel' key"
        assert isinstance(data["funnel"], list), "Funnel should be an array"

    def test_funnel_has_5_stages(self, headers):
        """Funnel has 5 pipeline stages"""
        response = requests.get(f"{BASE_URL}/api/reports/sales-funnel", headers=headers)
        data = response.json()
        assert len(data["funnel"]) == 5, f"Expected 5 stages, got {len(data['funnel'])}"
        stages = [s["stage"] for s in data["funnel"]]
        expected_stages = ["Total Customers", "Customers with Sales", "Total Transactions", "Fully Paid Sales", "Credit Collected"]
        assert stages == expected_stages, f"Stages mismatch: {stages}"

    def test_funnel_has_summary(self, headers):
        """Funnel has summary with conversion_rate and collection_rate"""
        response = requests.get(f"{BASE_URL}/api/reports/sales-funnel", headers=headers)
        data = response.json()
        assert "summary" in data, "Response should have 'summary' key"
        summary = data["summary"]
        assert "total_customers" in summary, "Summary should have 'total_customers'"
        assert "active_customers" in summary, "Summary should have 'active_customers'"
        assert "conversion_rate" in summary, "Summary should have 'conversion_rate'"
        assert "collection_rate" in summary, "Summary should have 'collection_rate'"


class TestExpenseTreemap:
    """Test /api/reports/expense-treemap endpoint"""

    def test_treemap_returns_200(self, headers):
        """Expense treemap endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/reports/expense-treemap", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_treemap_has_tree_array(self, headers):
        """Treemap response has 'tree' array"""
        response = requests.get(f"{BASE_URL}/api/reports/expense-treemap", headers=headers)
        data = response.json()
        assert "tree" in data, "Response should have 'tree' key"
        assert isinstance(data["tree"], list), "Tree should be an array"

    def test_treemap_has_total_and_period(self, headers):
        """Treemap has total and period_months"""
        response = requests.get(f"{BASE_URL}/api/reports/expense-treemap", headers=headers)
        data = response.json()
        assert "total" in data, "Response should have 'total'"
        assert "period_months" in data, "Response should have 'period_months'"

    def test_treemap_months_filter(self, headers):
        """Treemap months parameter works"""
        for months in ["1", "3", "6", "12"]:
            response = requests.get(f"{BASE_URL}/api/reports/expense-treemap?months={months}", headers=headers)
            assert response.status_code == 200, f"Failed for months={months}"
            data = response.json()
            assert data["period_months"] == int(months), f"period_months mismatch for months={months}"


class TestKPIGauges:
    """Test /api/reports/kpi-gauges endpoint"""

    def test_gauges_returns_200(self, headers):
        """KPI gauges endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/reports/kpi-gauges", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_gauges_has_4_indicators(self, headers):
        """Gauges returns 4 KPI indicators"""
        response = requests.get(f"{BASE_URL}/api/reports/kpi-gauges", headers=headers)
        data = response.json()
        assert "gauges" in data, "Response should have 'gauges' key"
        assert len(data["gauges"]) == 4, f"Expected 4 gauges, got {len(data['gauges'])}"

    def test_gauges_names(self, headers):
        """Gauges have correct names: Sales Target, Profit Margin, Collection Rate, Customer Retention"""
        response = requests.get(f"{BASE_URL}/api/reports/kpi-gauges", headers=headers)
        data = response.json()
        gauge_names = [g["name"] for g in data["gauges"]]
        expected = ["Sales Target", "Profit Margin", "Collection Rate", "Customer Retention"]
        assert gauge_names == expected, f"Gauge names mismatch: {gauge_names}"

    def test_gauge_structure(self, headers):
        """Each gauge has name, value, max, current, target, unit, color"""
        response = requests.get(f"{BASE_URL}/api/reports/kpi-gauges", headers=headers)
        data = response.json()
        for gauge in data["gauges"]:
            assert "name" in gauge, "Gauge should have 'name'"
            assert "value" in gauge, "Gauge should have 'value'"
            assert "max" in gauge, "Gauge should have 'max'"
            assert "current" in gauge, "Gauge should have 'current'"
            assert "target" in gauge, "Gauge should have 'target'"
            assert "unit" in gauge, "Gauge should have 'unit'"
            assert "color" in gauge, "Gauge should have 'color'"

    def test_gauges_has_month(self, headers):
        """Gauges response has 'month' field"""
        response = requests.get(f"{BASE_URL}/api/reports/kpi-gauges", headers=headers)
        data = response.json()
        assert "month" in data, "Response should have 'month'"


class TestBranchRadar:
    """Test /api/reports/branch-radar endpoint"""

    def test_radar_returns_200(self, headers):
        """Branch radar endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-radar", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_radar_has_branches(self, headers):
        """Radar response has 'branches' array"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-radar", headers=headers)
        data = response.json()
        assert "branches" in data, "Response should have 'branches' key"
        assert isinstance(data["branches"], list), "Branches should be an array"

    def test_radar_has_radar_data(self, headers):
        """Radar response has 'radar' data for chart"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-radar", headers=headers)
        data = response.json()
        assert "radar" in data, "Response should have 'radar' key"
        assert "metrics" in data, "Response should have 'metrics' key"

    def test_radar_metrics(self, headers):
        """Radar has 5 metrics: Sales, Transactions, Customers, Margin, Efficiency"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-radar", headers=headers)
        data = response.json()
        expected = ["Sales", "Transactions", "Customers", "Margin", "Efficiency"]
        assert data["metrics"] == expected, f"Metrics mismatch: {data['metrics']}"

    def test_radar_branch_structure(self, headers):
        """Branch data has correct structure"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-radar", headers=headers)
        data = response.json()
        if len(data["branches"]) > 0:
            branch = data["branches"][0]
            assert "branch_id" in branch, "Branch should have 'branch_id'"
            assert "name" in branch, "Branch should have 'name'"
            assert "sales" in branch, "Branch should have 'sales'"
            assert "expenses" in branch, "Branch should have 'expenses'"
            assert "transactions" in branch, "Branch should have 'transactions'"
            assert "customers" in branch, "Branch should have 'customers'"
            assert "margin" in branch, "Branch should have 'margin'"


class TestCashflowWaterfall:
    """Test /api/reports/cashflow-waterfall endpoint"""

    def test_waterfall_returns_200(self, headers):
        """Cash flow waterfall endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/reports/cashflow-waterfall", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_waterfall_has_waterfall_array(self, headers):
        """Waterfall response has 'waterfall' array"""
        response = requests.get(f"{BASE_URL}/api/reports/cashflow-waterfall", headers=headers)
        data = response.json()
        assert "waterfall" in data, "Response should have 'waterfall' key"
        assert isinstance(data["waterfall"], list), "Waterfall should be an array"

    def test_waterfall_has_net(self, headers):
        """Waterfall has 'net' balance and 'month'"""
        response = requests.get(f"{BASE_URL}/api/reports/cashflow-waterfall", headers=headers)
        data = response.json()
        assert "net" in data, "Response should have 'net'"
        assert "month" in data, "Response should have 'month'"

    def test_waterfall_step_structure(self, headers):
        """Waterfall steps have name, value, type, start, end"""
        response = requests.get(f"{BASE_URL}/api/reports/cashflow-waterfall", headers=headers)
        data = response.json()
        if len(data["waterfall"]) > 0:
            step = data["waterfall"][0]
            assert "name" in step, "Step should have 'name'"
            assert "value" in step, "Step should have 'value'"
            assert "type" in step, "Step should have 'type'"
            assert "start" in step, "Step should have 'start'"
            assert "end" in step, "Step should have 'end'"

    def test_waterfall_has_income_expense_total(self, headers):
        """Waterfall has income, expense, and total type steps"""
        response = requests.get(f"{BASE_URL}/api/reports/cashflow-waterfall", headers=headers)
        data = response.json()
        types = set(s["type"] for s in data["waterfall"])
        assert "income" in types, "Should have income type steps"
        assert "expense" in types, "Should have expense type steps"
        assert "total" in types, "Should have total type step"


class TestMoneyFlow:
    """Test /api/reports/money-flow endpoint"""

    def test_money_flow_returns_200(self, headers):
        """Money flow endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/reports/money-flow", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_money_flow_has_links(self, headers):
        """Money flow response has 'links' array"""
        response = requests.get(f"{BASE_URL}/api/reports/money-flow", headers=headers)
        data = response.json()
        assert "links" in data, "Response should have 'links' key"
        assert isinstance(data["links"], list), "Links should be an array"

    def test_money_flow_has_totals(self, headers):
        """Money flow has total_revenue, total_expenses, total_supplier, profit"""
        response = requests.get(f"{BASE_URL}/api/reports/money-flow", headers=headers)
        data = response.json()
        assert "total_revenue" in data, "Response should have 'total_revenue'"
        assert "total_expenses" in data, "Response should have 'total_expenses'"
        assert "total_supplier" in data, "Response should have 'total_supplier'"
        assert "profit" in data, "Response should have 'profit'"
        assert "month" in data, "Response should have 'month'"

    def test_money_flow_link_structure(self, headers):
        """Money flow links have source, target, value"""
        response = requests.get(f"{BASE_URL}/api/reports/money-flow", headers=headers)
        data = response.json()
        if len(data["links"]) > 0:
            link = data["links"][0]
            assert "source" in link, "Link should have 'source'"
            assert "target" in link, "Link should have 'target'"
            assert "value" in link, "Link should have 'value'"


class TestTimeSeriesCompare:
    """Test /api/reports/time-series-compare endpoint"""

    def test_timeseries_returns_200(self, headers):
        """Time series compare endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/reports/time-series-compare", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_timeseries_has_periods(self, headers):
        """Time series response has 'periods' array"""
        response = requests.get(f"{BASE_URL}/api/reports/time-series-compare", headers=headers)
        data = response.json()
        assert "periods" in data, "Response should have 'periods' key"
        assert isinstance(data["periods"], list), "Periods should be an array"

    def test_timeseries_default_3_periods(self, headers):
        """Default returns 3 periods"""
        response = requests.get(f"{BASE_URL}/api/reports/time-series-compare", headers=headers)
        data = response.json()
        assert len(data["periods"]) == 3, f"Expected 3 periods, got {len(data['periods'])}"

    def test_timeseries_periods_param(self, headers):
        """Periods parameter changes number of periods returned"""
        for periods in ["2", "4", "6"]:
            response = requests.get(f"{BASE_URL}/api/reports/time-series-compare?periods={periods}", headers=headers)
            assert response.status_code == 200, f"Failed for periods={periods}"
            data = response.json()
            assert len(data["periods"]) == int(periods), f"Expected {periods} periods"

    def test_timeseries_period_structure(self, headers):
        """Each period has month, total, daily array"""
        response = requests.get(f"{BASE_URL}/api/reports/time-series-compare", headers=headers)
        data = response.json()
        if len(data["periods"]) > 0:
            period = data["periods"][0]
            assert "month" in period, "Period should have 'month'"
            assert "total" in period, "Period should have 'total'"
            assert "daily" in period, "Period should have 'daily'"
            assert isinstance(period["daily"], list), "Daily should be an array"

    def test_timeseries_daily_structure(self, headers):
        """Daily data has day and sales fields"""
        response = requests.get(f"{BASE_URL}/api/reports/time-series-compare", headers=headers)
        data = response.json()
        if len(data["periods"]) > 0 and len(data["periods"][0]["daily"]) > 0:
            day_data = data["periods"][0]["daily"][0]
            assert "day" in day_data, "Daily item should have 'day'"
            assert "sales" in day_data, "Daily item should have 'sales'"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
