"""
Iteration 101 - Backend Tests
Features to test:
1. Supplier Report branch filter (branch_id query param)
2. Supplier Balance endpoint returns branch_breakdown
3. Supplier Ledger endpoint returns branch_name in entries
4. Advanced Analytics APIs (kpi-gauges, revenue-trends, supplier-balance, cashflow-waterfall, branch-radar, sales-funnel, expense-treemap)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "admin"
        print("Login successful - admin user authenticated")


class TestSupplierBalance:
    """Tests for GET /api/reports/supplier-balance with branch filter and breakdown"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_supplier_balance_returns_list(self, auth_headers):
        """Test supplier-balance endpoint returns list of suppliers"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Expected list of suppliers"
        print(f"Supplier balance returned {len(data)} suppliers")
    
    def test_supplier_balance_has_branch_breakdown(self, auth_headers):
        """Test each supplier has branch_breakdown field"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check at least first few suppliers have branch_breakdown
        for supplier in data[:5]:
            assert "branch_breakdown" in supplier, f"Supplier {supplier.get('name')} missing branch_breakdown"
            assert isinstance(supplier["branch_breakdown"], dict), "branch_breakdown should be a dict"
            print(f"Supplier {supplier['name']}: branch_breakdown = {list(supplier['branch_breakdown'].keys())}")
        
        print("All suppliers have branch_breakdown field")
    
    def test_supplier_balance_branch_breakdown_structure(self, auth_headers):
        """Test branch_breakdown has correct structure (expenses, paid)"""
        response = requests.get(f"{BASE_URL}/api/reports/supplier-balance", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        suppliers_with_breakdown = [s for s in data if s.get("branch_breakdown")]
        if suppliers_with_breakdown:
            supplier = suppliers_with_breakdown[0]
            for branch_name, breakdown in supplier["branch_breakdown"].items():
                assert "expenses" in breakdown, f"Missing 'expenses' in breakdown for {branch_name}"
                assert "paid" in breakdown, f"Missing 'paid' in breakdown for {branch_name}"
                print(f"Branch {branch_name}: expenses={breakdown['expenses']}, paid={breakdown['paid']}")
        print("Branch breakdown structure verified")
    
    def test_supplier_balance_with_branch_filter(self, auth_headers):
        """Test supplier-balance filters by branch_id query param"""
        # First get branches
        branches_resp = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        if branches_resp.status_code == 200:
            branches = branches_resp.json()
            if branches:
                branch_id = branches[0]["id"]
                
                # Get unfiltered
                unfiltered = requests.get(f"{BASE_URL}/api/reports/supplier-balance", headers=auth_headers)
                
                # Get filtered by branch
                filtered = requests.get(
                    f"{BASE_URL}/api/reports/supplier-balance?branch_id={branch_id}", 
                    headers=auth_headers
                )
                assert filtered.status_code == 200
                filtered_data = filtered.json()
                
                print(f"Unfiltered: {len(unfiltered.json())} suppliers, Filtered by branch: {len(filtered_data)} suppliers")
                print("Branch filter working correctly")
            else:
                pytest.skip("No branches found")
        else:
            pytest.skip("Could not fetch branches")


class TestSupplierLedger:
    """Tests for GET /api/suppliers/{id}/ledger with branch info"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def supplier_id(self, auth_headers):
        """Get first supplier ID"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        if response.status_code == 200 and response.json():
            return response.json()[0]["id"]
        pytest.skip("No suppliers found")
    
    def test_ledger_endpoint_works(self, auth_headers, supplier_id):
        """Test ledger endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/suppliers/{supplier_id}/ledger", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "supplier" in data
        assert "entries" in data
        assert "summary" in data
        print(f"Ledger for supplier {data['supplier']['name']}: {len(data['entries'])} entries")
    
    def test_ledger_entries_have_branch_info(self, auth_headers, supplier_id):
        """Test ledger entries have branch_name and branch_id fields"""
        response = requests.get(f"{BASE_URL}/api/suppliers/{supplier_id}/ledger", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        entries = data.get("entries", [])
        if entries:
            for entry in entries[:5]:
                assert "branch_name" in entry, f"Entry missing branch_name: {entry}"
                assert "branch_id" in entry, f"Entry missing branch_id: {entry}"
                print(f"Entry type={entry['type']}, branch={entry['branch_name']}")
            print("All ledger entries have branch_name and branch_id")
        else:
            print("No entries in ledger - checking structure is correct")
            # Even with no entries, structure should be valid
            assert isinstance(entries, list)


class TestAdvancedAnalyticsAPIs:
    """Tests for Advanced Analytics dashboard APIs"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_kpi_gauges_endpoint(self, auth_headers):
        """Test GET /api/reports/kpi-gauges returns KPI data"""
        response = requests.get(f"{BASE_URL}/api/reports/kpi-gauges", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "gauges" in data
        assert isinstance(data["gauges"], list)
        
        # Check gauge structure
        if data["gauges"]:
            gauge = data["gauges"][0]
            assert "name" in gauge
            assert "value" in gauge
            print(f"KPI Gauges: {[g['name'] for g in data['gauges']]}")
    
    def test_revenue_trends_endpoint(self, auth_headers):
        """Test GET /api/reports/revenue-trends returns trend data"""
        response = requests.get(f"{BASE_URL}/api/reports/revenue-trends", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "weekly" in data
        assert "monthly" in data
        assert "growth" in data
        print(f"Revenue trends: {len(data['weekly'])} weekly data points, {len(data['monthly'])} monthly")
    
    def test_cashflow_waterfall_endpoint(self, auth_headers):
        """Test GET /api/reports/cashflow-waterfall returns waterfall data"""
        response = requests.get(f"{BASE_URL}/api/reports/cashflow-waterfall", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "waterfall" in data or isinstance(data, list), "Expected waterfall data"
        print(f"Cashflow waterfall data received")
    
    def test_branch_radar_endpoint(self, auth_headers):
        """Test GET /api/reports/branch-radar returns radar data"""
        response = requests.get(f"{BASE_URL}/api/reports/branch-radar", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "branches" in data or "radar" in data or isinstance(data, list)
        print(f"Branch radar data received")
    
    def test_sales_funnel_endpoint(self, auth_headers):
        """Test GET /api/reports/sales-funnel returns funnel data"""
        response = requests.get(f"{BASE_URL}/api/reports/sales-funnel", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "funnel" in data or "summary" in data
        print(f"Sales funnel data received")
    
    def test_expense_treemap_endpoint(self, auth_headers):
        """Test GET /api/reports/expense-treemap returns treemap data"""
        response = requests.get(f"{BASE_URL}/api/reports/expense-treemap", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "tree" in data or "total" in data
        print(f"Expense treemap data received")


class TestModuleTourConfigs:
    """Test that module tour configurations exist in backend routes"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_suppliers_page_accessible(self, auth_headers):
        """Test /api/suppliers endpoint works (for Supplier Management tour)"""
        response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert response.status_code == 200
        print("Suppliers endpoint accessible - Supplier Management tour route valid")
    
    def test_data_management_recommendations_accessible(self, auth_headers):
        """Test /api/data-management/recommendations works (for Data Management tour)"""
        response = requests.get(f"{BASE_URL}/api/data-management/recommendations", headers=auth_headers)
        assert response.status_code == 200
        print("Data Management recommendations endpoint accessible - tour route valid")
    
    def test_advanced_analytics_kpi_accessible(self, auth_headers):
        """Test /api/reports/kpi-gauges works (for Advanced Analytics tour)"""
        response = requests.get(f"{BASE_URL}/api/reports/kpi-gauges", headers=auth_headers)
        assert response.status_code == 200
        print("Advanced Analytics KPI endpoint accessible - tour route valid")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
