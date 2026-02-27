"""
Iteration 31: Test 5 New AI Predictive Analytics Endpoints

1. Cash Flow Prediction - /api/reports/cashflow-prediction
2. Seasonal Sales Forecasting - /api/reports/seasonal-forecast
3. Employee Performance Scoring - /api/reports/employee-performance
4. Smart Expense Alerts - /api/reports/expense-anomalies
5. Supplier Payment Optimization - /api/reports/supplier-optimization
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "ss@ssc.com"
ADMIN_PASSWORD = "Aa147258369Ssc@"


class TestAIPredictiveAnalytics:
    """Test suite for 5 new AI Predictive Analytics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("access_token") or data.get("token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    # ==========================================
    # 1. Cash Flow Prediction Tests
    # ==========================================
    
    def test_cashflow_prediction_endpoint_returns_200(self):
        """Test that cashflow-prediction endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/reports/cashflow-prediction")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Cashflow prediction endpoint returns 200")
    
    def test_cashflow_prediction_has_required_fields(self):
        """Test cashflow prediction response structure"""
        response = self.session.get(f"{BASE_URL}/api/reports/cashflow-prediction")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "current_cash_balance" in data, "Missing current_cash_balance"
        assert "predictions" in data, "Missing predictions array"
        assert "low_cash_alerts" in data, "Missing low_cash_alerts"
        assert "weekly_patterns" in data, "Missing weekly_patterns"
        assert "risk_level" in data, "Missing risk_level"
        
        # Validate risk_level values
        assert data["risk_level"] in ["low", "medium", "high"], f"Invalid risk_level: {data['risk_level']}"
        
        # Validate weekly_patterns structure
        wp = data["weekly_patterns"]
        assert "avg_daily_income" in wp, "Missing avg_daily_income in weekly_patterns"
        assert "avg_daily_expense" in wp, "Missing avg_daily_expense in weekly_patterns"
        assert "best_day" in wp, "Missing best_day in weekly_patterns"
        assert "worst_day" in wp, "Missing worst_day in weekly_patterns"
        
        print(f"✅ Cashflow prediction has all required fields. Risk: {data['risk_level']}")
    
    def test_cashflow_prediction_with_custom_days(self):
        """Test cashflow prediction with custom days parameter"""
        response = self.session.get(f"{BASE_URL}/api/reports/cashflow-prediction?days=7")
        assert response.status_code == 200
        
        data = response.json()
        predictions = data.get("predictions", [])
        
        # Should have 7 predictions
        assert len(predictions) == 7, f"Expected 7 predictions, got {len(predictions)}"
        
        # Each prediction should have required fields
        for pred in predictions:
            assert "date" in pred
            assert "day_name" in pred
            assert "predicted_income" in pred
            assert "predicted_expense" in pred
            assert "predicted_balance" in pred
        
        print(f"✅ Cashflow prediction with 7 days returns correct number of predictions")
    
    # ==========================================
    # 2. Seasonal Forecast Tests
    # ==========================================
    
    def test_seasonal_forecast_endpoint_returns_200(self):
        """Test that seasonal-forecast endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/reports/seasonal-forecast")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Seasonal forecast endpoint returns 200")
    
    def test_seasonal_forecast_has_required_fields(self):
        """Test seasonal forecast response structure"""
        response = self.session.get(f"{BASE_URL}/api/reports/seasonal-forecast")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "day_of_week_analysis" in data, "Missing day_of_week_analysis"
        assert "monthly_analysis" in data, "Missing monthly_analysis"
        assert "best_days" in data, "Missing best_days"
        assert "worst_days" in data, "Missing worst_days"
        assert "insights" in data, "Missing insights"
        assert "next_week_forecast" in data, "Missing next_week_forecast"
        
        # Validate day_of_week_analysis structure if not empty
        dow = data["day_of_week_analysis"]
        if dow:
            assert "day" in dow[0], "Missing day in day_of_week_analysis"
            assert "avg_sales" in dow[0], "Missing avg_sales in day_of_week_analysis"
        
        print(f"✅ Seasonal forecast has all required fields. Insights: {len(data['insights'])}")
    
    def test_seasonal_forecast_next_week_predictions(self):
        """Test seasonal forecast includes next week predictions"""
        response = self.session.get(f"{BASE_URL}/api/reports/seasonal-forecast")
        assert response.status_code == 200
        
        data = response.json()
        next_week = data.get("next_week_forecast", [])
        
        # Should have up to 7 predictions
        assert len(next_week) <= 7, f"Expected max 7 predictions, got {len(next_week)}"
        
        for pred in next_week:
            assert "date" in pred
            assert "day" in pred
            assert "predicted_sales" in pred
        
        print(f"✅ Seasonal forecast next week predictions: {len(next_week)}")
    
    # ==========================================
    # 3. Employee Performance Tests
    # ==========================================
    
    def test_employee_performance_endpoint_returns_200(self):
        """Test that employee-performance endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/reports/employee-performance")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Employee performance endpoint returns 200")
    
    def test_employee_performance_has_required_fields(self):
        """Test employee performance response structure"""
        response = self.session.get(f"{BASE_URL}/api/reports/employee-performance")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "employees" in data, "Missing employees array"
        assert "team_stats" in data, "Missing team_stats"
        assert "period" in data, "Missing period"
        
        # Validate team_stats structure
        stats = data["team_stats"]
        assert "total_employees" in stats, "Missing total_employees"
        assert "avg_score" in stats, "Missing avg_score"
        assert "top_performers_count" in stats, "Missing top_performers_count"
        assert "needs_improvement_count" in stats, "Missing needs_improvement_count"
        
        print(f"✅ Employee performance: {stats['total_employees']} employees, avg score: {stats['avg_score']}")
    
    def test_employee_performance_employee_structure(self):
        """Test employee data structure in performance report"""
        response = self.session.get(f"{BASE_URL}/api/reports/employee-performance")
        assert response.status_code == 200
        
        data = response.json()
        employees = data.get("employees", [])
        
        if employees:
            emp = employees[0]
            # Check employee fields
            assert "employee_id" in emp, "Missing employee_id"
            assert "name" in emp, "Missing name"
            assert "metrics" in emp, "Missing metrics"
            assert "scores" in emp, "Missing scores"
            assert "tier" in emp, "Missing tier"
            assert "tier_color" in emp, "Missing tier_color"
            
            # Check tier values
            valid_tiers = ["Top Performer", "Good", "Average", "Needs Improvement"]
            assert emp["tier"] in valid_tiers, f"Invalid tier: {emp['tier']}"
            
            # Check tier_color values
            valid_colors = ["emerald", "blue", "amber", "red"]
            assert emp["tier_color"] in valid_colors, f"Invalid tier_color: {emp['tier_color']}"
            
            # Check scores structure
            scores = emp["scores"]
            assert "overall" in scores, "Missing overall score"
            assert 0 <= scores["overall"] <= 100, f"Invalid overall score: {scores['overall']}"
            
            print(f"✅ Employee structure validated. Top employee: {emp['name']}, tier: {emp['tier']}")
        else:
            print("⚠️ No employees in performance report")
    
    # ==========================================
    # 4. Expense Anomalies Tests
    # ==========================================
    
    def test_expense_anomalies_endpoint_returns_200(self):
        """Test that expense-anomalies endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/reports/expense-anomalies")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Expense anomalies endpoint returns 200")
    
    def test_expense_anomalies_has_required_fields(self):
        """Test expense anomalies response structure"""
        response = self.session.get(f"{BASE_URL}/api/reports/expense-anomalies")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "anomalies" in data, "Missing anomalies array"
        assert "category_analysis" in data, "Missing category_analysis"
        assert "alerts" in data, "Missing alerts"
        assert "spending_trend" in data, "Missing spending_trend"
        assert "period" in data, "Missing period"
        
        # Validate spending_trend structure
        trend = data["spending_trend"]
        assert "last_month" in trend, "Missing last_month in spending_trend"
        assert "previous_month" in trend, "Missing previous_month in spending_trend"
        assert "change_percent" in trend, "Missing change_percent in spending_trend"
        
        print(f"✅ Expense anomalies: {len(data['anomalies'])} anomalies, change: {trend['change_percent']}%")
    
    def test_expense_anomalies_category_analysis(self):
        """Test expense anomalies category analysis structure"""
        response = self.session.get(f"{BASE_URL}/api/reports/expense-anomalies")
        assert response.status_code == 200
        
        data = response.json()
        categories = data.get("category_analysis", [])
        
        for cat in categories:
            assert "category" in cat, "Missing category name"
            assert "avg_transaction" in cat, "Missing avg_transaction"
            assert "monthly_total" in cat, "Missing monthly_total"
            assert "trend" in cat, "Missing trend"
            
            # Validate trend values
            valid_trends = ["increasing", "decreasing", "stable"]
            assert cat["trend"] in valid_trends, f"Invalid trend: {cat['trend']}"
        
        print(f"✅ Category analysis validated: {len(categories)} categories")
    
    # ==========================================
    # 5. Supplier Optimization Tests
    # ==========================================
    
    def test_supplier_optimization_endpoint_returns_200(self):
        """Test that supplier-optimization endpoint returns 200"""
        response = self.session.get(f"{BASE_URL}/api/reports/supplier-optimization")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✅ Supplier optimization endpoint returns 200")
    
    def test_supplier_optimization_has_required_fields(self):
        """Test supplier optimization response structure"""
        response = self.session.get(f"{BASE_URL}/api/reports/supplier-optimization")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check required fields
        assert "suppliers" in data, "Missing suppliers array"
        assert "urgent_payments" in data, "Missing urgent_payments"
        assert "summary" in data, "Missing summary"
        assert "cash_impact" in data, "Missing cash_impact"
        assert "recommended_schedule" in data, "Missing recommended_schedule"
        
        # Validate summary structure
        summary = data["summary"]
        assert "total_suppliers" in summary, "Missing total_suppliers"
        assert "total_pending_amount" in summary, "Missing total_pending_amount"
        assert "critical_count" in summary, "Missing critical_count"
        
        # Validate cash_impact structure
        cash = data["cash_impact"]
        assert "current_cash" in cash, "Missing current_cash"
        assert "cash_after_payments" in cash, "Missing cash_after_payments"
        assert "can_afford_all" in cash, "Missing can_afford_all"
        
        print(f"✅ Supplier optimization: {summary['total_suppliers']} suppliers, pending: {summary['total_pending_amount']}")
    
    def test_supplier_optimization_supplier_structure(self):
        """Test supplier data structure in optimization report"""
        response = self.session.get(f"{BASE_URL}/api/reports/supplier-optimization")
        assert response.status_code == 200
        
        data = response.json()
        suppliers = data.get("suppliers", [])
        
        if suppliers:
            sup = suppliers[0]
            # Check supplier fields
            assert "supplier_id" in sup, "Missing supplier_id"
            assert "name" in sup, "Missing name"
            assert "current_balance" in sup, "Missing current_balance"
            assert "priority" in sup, "Missing priority"
            assert "recommended_payment" in sup, "Missing recommended_payment"
            
            # Check priority values
            valid_priorities = ["critical", "high", "medium", "low"]
            assert sup["priority"] in valid_priorities, f"Invalid priority: {sup['priority']}"
            
            print(f"✅ Supplier structure validated: {len(suppliers)} suppliers analyzed")
        else:
            print("⚠️ No suppliers in optimization report")


# Run if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
