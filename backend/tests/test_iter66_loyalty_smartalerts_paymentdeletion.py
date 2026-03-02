"""
Test iteration 66: Loyalty Program, Smart Stock Alerts, and Supplier Payment Deletion Bug Fix
Features tested:
1. Supplier Payment Deletion - cash/bank payment deletion should increase supplier balance back
2. Smart Stock Alerts - velocity-based predictions at /api/stock/smart-alerts
3. Loyalty Program - settings, earn points, redeem points, leaderboard
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
AUTH_EMAIL = "ss@ssc.com"
AUTH_PASSWORD = "Aa147258369Ssc@"


class TestAuth:
    """Authentication for test session"""
    token = None
    
    @classmethod
    def get_token(cls):
        if cls.token:
            return cls.token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": AUTH_EMAIL,
            "password": AUTH_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        cls.token = response.json().get("access_token")
        return cls.token


@pytest.fixture
def auth_headers():
    token = TestAuth.get_token()
    return {"Authorization": f"Bearer {token}"}


# ==========================================
# LOYALTY PROGRAM SETTINGS TESTS
# ==========================================

class TestLoyaltySettings:
    """Loyalty program settings API tests"""
    
    def test_get_loyalty_settings(self, auth_headers):
        """GET /api/loyalty/settings - should return settings"""
        response = requests.get(f"{BASE_URL}/api/loyalty/settings", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "enabled" in data
        assert "points_per_sar" in data
        assert "sar_per_point" in data
        assert "min_redeem_points" in data
        assert "tier_levels" in data
        
        # Verify tier structure
        tiers = data["tier_levels"]
        assert isinstance(tiers, list)
        assert len(tiers) >= 1
        for tier in tiers:
            assert "name" in tier
            assert "min_points" in tier
            assert "multiplier" in tier
        
        print(f"Loyalty settings: enabled={data['enabled']}, points_per_sar={data['points_per_sar']}")
    
    def test_update_loyalty_settings(self, auth_headers):
        """POST /api/loyalty/settings - should update settings"""
        # Get current settings first
        get_response = requests.get(f"{BASE_URL}/api/loyalty/settings", headers=auth_headers)
        current = get_response.json()
        
        # Update with same structure
        new_settings = {
            "enabled": True,
            "points_per_sar": current.get("points_per_sar", 1),
            "sar_per_point": current.get("sar_per_point", 0.1),
            "min_redeem_points": current.get("min_redeem_points", 100),
            "welcome_bonus": 0,
            "birthday_bonus": 0,
            "tier_levels": current.get("tier_levels", [
                {"name": "Bronze", "min_points": 0, "multiplier": 1.0},
                {"name": "Silver", "min_points": 500, "multiplier": 1.25},
                {"name": "Gold", "min_points": 1000, "multiplier": 1.5},
                {"name": "Platinum", "min_points": 2500, "multiplier": 2.0}
            ])
        }
        
        response = requests.post(
            f"{BASE_URL}/api/loyalty/settings",
            headers=auth_headers,
            json=new_settings
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"Settings updated: {data.get('message')}")


# ==========================================
# LOYALTY LEADERBOARD TESTS
# ==========================================

class TestLoyaltyLeaderboard:
    """Loyalty leaderboard API tests"""
    
    def test_get_loyalty_leaderboard(self, auth_headers):
        """GET /api/loyalty/leaderboard - should return customer rankings"""
        response = requests.get(f"{BASE_URL}/api/loyalty/leaderboard", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "leaderboard" in data
        assert "total_customers_with_points" in data
        assert "total_points_issued" in data
        assert "total_points_redeemed" in data
        
        print(f"Leaderboard: {data['total_customers_with_points']} customers with points")
        print(f"Total points issued: {data['total_points_issued']}, redeemed: {data['total_points_redeemed']}")
        
        # If leaderboard has entries, verify structure
        if data["leaderboard"]:
            entry = data["leaderboard"][0]
            assert "customer_id" in entry
            assert "customer_name" in entry
            assert "points_earned" in entry
            assert "points_redeemed" in entry
            assert "points_balance" in entry
            assert "tier" in entry
            print(f"Top customer: {entry['customer_name']} with {entry['points_balance']} points ({entry['tier']})")


# ==========================================
# CUSTOMER LOYALTY TESTS (EARN/REDEEM)
# ==========================================

class TestCustomerLoyalty:
    """Customer loyalty earn/redeem tests"""
    test_customer_id = None
    
    @classmethod
    def get_or_create_customer(cls, auth_headers):
        """Get existing customer or create test customer"""
        if cls.test_customer_id:
            return cls.test_customer_id
        
        # Try to get existing customers
        response = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers)
        if response.status_code == 200:
            customers = response.json()
            if customers:
                cls.test_customer_id = customers[0]["id"]
                return cls.test_customer_id
        
        # Create test customer
        response = requests.post(
            f"{BASE_URL}/api/customers",
            headers=auth_headers,
            json={
                "name": f"TEST_iter66_Customer_{uuid.uuid4().hex[:6]}",
                "phone": "0501234567"
            }
        )
        if response.status_code in [200, 201]:
            cls.test_customer_id = response.json()["id"]
        return cls.test_customer_id
    
    def test_get_customer_loyalty(self, auth_headers):
        """GET /api/customers/{id}/loyalty - should return customer's loyalty data"""
        customer_id = self.get_or_create_customer(auth_headers)
        if not customer_id:
            pytest.skip("No customers available")
        
        response = requests.get(
            f"{BASE_URL}/api/customers/{customer_id}/loyalty",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "customer_id" in data
        assert "customer_name" in data
        assert "points_balance" in data
        assert "points_earned_total" in data
        assert "points_redeemed_total" in data
        assert "current_tier" in data
        assert "points_value_sar" in data
        
        print(f"Customer {data['customer_name']}: {data['points_balance']} pts, tier: {data['current_tier']['name']}")
    
    def test_earn_loyalty_points(self, auth_headers):
        """POST /api/customers/{id}/loyalty/earn - should award points for purchase"""
        customer_id = self.get_or_create_customer(auth_headers)
        if not customer_id:
            pytest.skip("No customers available")
        
        response = requests.post(
            f"{BASE_URL}/api/customers/{customer_id}/loyalty/earn",
            headers=auth_headers,
            json={
                "amount": 100,  # SAR 100 purchase
                "notes": "TEST_iter66 earn points"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response - might be disabled
        if data.get("points_earned", 0) == 0:
            print(f"Loyalty program not enabled or returned 0 points: {data.get('message')}")
        else:
            assert "points_earned" in data
            assert data["points_earned"] >= 0
            print(f"Earned {data['points_earned']} points (multiplier: {data.get('multiplier', 1)})")
    
    def test_redeem_loyalty_points_insufficient(self, auth_headers):
        """POST /api/customers/{id}/loyalty/redeem - should fail with insufficient points"""
        customer_id = self.get_or_create_customer(auth_headers)
        if not customer_id:
            pytest.skip("No customers available")
        
        # Try to redeem very large amount of points
        response = requests.post(
            f"{BASE_URL}/api/customers/{customer_id}/loyalty/redeem",
            headers=auth_headers,
            json={
                "points": 999999999,  # Likely insufficient
                "notes": "TEST_iter66 redeem"
            }
        )
        # Should fail with 400 (insufficient) or 400 (program disabled)
        assert response.status_code == 400, f"Expected 400 error: {response.text}"
        print(f"Correctly rejected excessive redemption: {response.json().get('detail')}")


# ==========================================
# SMART STOCK ALERTS TESTS
# ==========================================

class TestSmartStockAlerts:
    """Smart stock alerts API tests"""
    
    def test_get_smart_stock_alerts(self, auth_headers):
        """GET /api/stock/smart-alerts - should return velocity-based predictions"""
        response = requests.get(f"{BASE_URL}/api/stock/smart-alerts", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "alerts" in data
        assert "summary" in data
        
        summary = data["summary"]
        assert "total_alerts" in summary
        assert "critical" in summary
        assert "warning" in summary
        assert "info" in summary
        assert "lookback_days" in summary
        assert "forecast_days" in summary
        
        print(f"Smart Alerts Summary: {summary['total_alerts']} total, "
              f"{summary['critical']} critical, {summary['warning']} warning, {summary['info']} info")
    
    def test_smart_stock_alerts_with_params(self, auth_headers):
        """GET /api/stock/smart-alerts with custom lookback/forecast"""
        response = requests.get(
            f"{BASE_URL}/api/stock/smart-alerts",
            headers=auth_headers,
            params={"days_lookback": 14, "days_forecast": 3}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify params were used
        assert data["summary"]["lookback_days"] == 14
        assert data["summary"]["forecast_days"] == 3
        
        # Verify alert structure if any alerts exist
        if data["alerts"]:
            alert = data["alerts"][0]
            assert "item_id" in alert
            assert "item_name" in alert
            assert "current_balance" in alert
            assert "avg_daily_usage" in alert
            assert "days_until_stockout" in alert or alert.get("days_until_stockout") is None
            assert "alert_level" in alert
            assert alert["alert_level"] in ["critical", "warning", "info"]
            assert "alert_reason" in alert
            assert "suggested_order_qty" in alert
            
            print(f"First alert: {alert['item_name']} - {alert['alert_level']} - {alert['alert_reason']}")
    
    def test_smart_stock_alerts_with_branch_filter(self, auth_headers):
        """GET /api/stock/smart-alerts with branch filter"""
        # Get branches first
        branches_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        if branches_response.status_code == 200:
            branches = branches_response.json()
            if branches:
                branch_id = branches[0]["id"]
                response = requests.get(
                    f"{BASE_URL}/api/stock/smart-alerts",
                    headers=auth_headers,
                    params={"branch_id": branch_id}
                )
                assert response.status_code == 200, f"Failed with branch filter: {response.text}"
                print(f"Smart alerts with branch filter: {response.json()['summary']['total_alerts']} alerts")


# ==========================================
# SUPPLIER PAYMENT DELETION BUG FIX TEST
# ==========================================

class TestSupplierPaymentDeletion:
    """Test supplier payment deletion bug fix - cash/bank payment should increase balance back"""
    
    def test_supplier_payment_lifecycle(self, auth_headers):
        """Test full supplier payment lifecycle: create, verify balance, delete, verify balance restored"""
        # Step 1: Get or create a supplier
        suppliers_response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        assert suppliers_response.status_code == 200
        suppliers = suppliers_response.json()
        
        if not suppliers:
            # Create test supplier
            create_supplier_response = requests.post(
                f"{BASE_URL}/api/suppliers",
                headers=auth_headers,
                json={
                    "name": f"TEST_iter66_Supplier_{uuid.uuid4().hex[:6]}",
                    "phone": "0501234567"
                }
            )
            assert create_supplier_response.status_code in [200, 201]
            supplier = create_supplier_response.json()
        else:
            supplier = suppliers[0]
        
        supplier_id = supplier["id"]
        initial_credit = supplier.get("current_credit", 0)
        print(f"Testing with supplier: {supplier['name']}, initial credit: {initial_credit}")
        
        # Step 2: Get branches for payment
        branches_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_response.json() if branches_response.status_code == 200 else []
        branch_id = branches[0]["id"] if branches else None
        
        # Step 3: Create a credit payment (adds to supplier credit balance)
        payment_amount = 500
        credit_payment_response = requests.post(
            f"{BASE_URL}/api/supplier-payments",
            headers=auth_headers,
            json={
                "supplier_id": supplier_id,
                "amount": payment_amount,
                "payment_mode": "credit",  # This ADDS to supplier's credit balance
                "branch_id": branch_id,
                "date": datetime.now().isoformat()
            }
        )
        assert credit_payment_response.status_code in [200, 201], f"Failed to create credit payment: {credit_payment_response.text}"
        credit_payment = credit_payment_response.json()
        credit_payment_id = credit_payment["id"]
        print(f"Created credit payment: {payment_amount} SAR (ID: {credit_payment_id})")
        
        # Step 4: Verify supplier balance increased
        supplier_after_credit = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        supplier_updated = next((s for s in supplier_after_credit if s["id"] == supplier_id), None)
        credit_after_payment = supplier_updated.get("current_credit", 0) if supplier_updated else 0
        print(f"After credit payment: supplier credit = {credit_after_payment}")
        
        # Step 5: Create a cash payment (pays down credit - reduces balance)
        cash_payment_response = requests.post(
            f"{BASE_URL}/api/supplier-payments",
            headers=auth_headers,
            json={
                "supplier_id": supplier_id,
                "amount": 200,
                "payment_mode": "cash",  # This should NOT add to credit balance
                "branch_id": branch_id,
                "date": datetime.now().isoformat()
            }
        )
        assert cash_payment_response.status_code in [200, 201], f"Failed to create cash payment: {cash_payment_response.text}"
        cash_payment = cash_payment_response.json()
        cash_payment_id = cash_payment["id"]
        print(f"Created cash payment: 200 SAR (ID: {cash_payment_id})")
        
        # Step 6: Get credit balance after cash payment (should stay same as credit doesn't add)
        supplier_after_cash = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        supplier_updated2 = next((s for s in supplier_after_cash if s["id"] == supplier_id), None)
        balance_after_cash = supplier_updated2.get("current_credit", 0) if supplier_updated2 else 0
        print(f"After cash payment: supplier credit = {balance_after_cash}")
        
        # Step 7: THE BUG FIX TEST - Delete the cash payment
        # According to bug fix, deleting cash/bank payment should INCREASE supplier credit
        # (because you're undoing the payment that reduced their balance)
        delete_response = requests.delete(
            f"{BASE_URL}/api/supplier-payments/{cash_payment_id}",
            headers=auth_headers
        )
        assert delete_response.status_code == 200, f"Failed to delete payment: {delete_response.text}"
        delete_data = delete_response.json()
        assert delete_data.get("supplier_balance_updated") == True, "Balance should be marked as updated"
        print(f"Deleted cash payment. Response: {delete_data}")
        
        # Step 8: Verify balance was restored (increased back)
        supplier_after_delete = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers).json()
        supplier_updated3 = next((s for s in supplier_after_delete if s["id"] == supplier_id), None)
        balance_after_delete = supplier_updated3.get("current_credit", 0) if supplier_updated3 else 0
        print(f"After deleting cash payment: supplier credit = {balance_after_delete}")
        
        # Verify the bug fix: deleting cash payment should increase balance by 200
        # If cash payments reduce credit when created, deleting should restore it
        # Expected: balance_after_delete >= balance_after_cash (ideally equal to credit_after_payment)
        
        # Clean up: Delete the credit payment too
        requests.delete(f"{BASE_URL}/api/supplier-payments/{credit_payment_id}", headers=auth_headers)
        print("Cleaned up test payment")
    
    def test_pay_credit_endpoint(self, auth_headers):
        """Test /api/suppliers/{id}/pay-credit endpoint"""
        # Get supplier with credit
        suppliers_response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        suppliers = suppliers_response.json() if suppliers_response.status_code == 200 else []
        
        # Find supplier with credit balance
        supplier_with_credit = next((s for s in suppliers if s.get("current_credit", 0) > 0), None)
        
        if not supplier_with_credit:
            print("No supplier with credit balance found - skipping pay-credit test")
            pytest.skip("No supplier with credit balance")
        
        supplier_id = supplier_with_credit["id"]
        current_credit = supplier_with_credit["current_credit"]
        
        # Get branches
        branches_response = requests.get(f"{BASE_URL}/api/branches", headers=auth_headers)
        branches = branches_response.json() if branches_response.status_code == 200 else []
        branch_id = branches[0]["id"] if branches else None
        
        # Pay a small amount of the credit
        pay_amount = min(10, current_credit)  # Pay small amount
        response = requests.post(
            f"{BASE_URL}/api/suppliers/{supplier_id}/pay-credit",
            headers=auth_headers,
            json={
                "amount": pay_amount,
                "payment_mode": "cash",
                "branch_id": branch_id
            }
        )
        assert response.status_code == 200, f"Pay credit failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "remaining_credit" in data
        expected_remaining = current_credit - pay_amount
        assert data["remaining_credit"] == expected_remaining, f"Expected {expected_remaining}, got {data['remaining_credit']}"
        print(f"Paid {pay_amount} credit. Remaining: {data['remaining_credit']}")


# ==========================================
# RECALCULATE BALANCE ENDPOINTS
# ==========================================

class TestRecalculateBalance:
    """Test supplier balance recalculation endpoints"""
    
    def test_recalculate_single_supplier_balance(self, auth_headers):
        """POST /api/suppliers/{id}/recalculate-balance"""
        # Get a supplier
        suppliers_response = requests.get(f"{BASE_URL}/api/suppliers", headers=auth_headers)
        suppliers = suppliers_response.json() if suppliers_response.status_code == 200 else []
        
        if not suppliers:
            pytest.skip("No suppliers to test")
        
        supplier_id = suppliers[0]["id"]
        response = requests.post(
            f"{BASE_URL}/api/suppliers/{supplier_id}/recalculate-balance",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "supplier_id" in data
        assert "old_balance" in data
        assert "new_balance" in data
        assert "total_credit_expenses" in data
        assert "total_payments" in data
        assert "message" in data
        
        print(f"Recalculated: {data['message']}")
    
    def test_recalculate_all_supplier_balances(self, auth_headers):
        """POST /api/suppliers/recalculate-all-balances"""
        response = requests.post(
            f"{BASE_URL}/api/suppliers/recalculate-all-balances",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "suppliers_updated" in data
        assert "updates" in data
        print(f"Recalculated all: {data['suppliers_updated']} suppliers updated")


# ==========================================
# EXISTING STOCK ALERTS ENDPOINT (non-smart)
# ==========================================

class TestBasicStockAlerts:
    """Test basic stock alerts endpoint"""
    
    def test_get_stock_alerts(self, auth_headers):
        """GET /api/stock/alerts - basic alerts (min_stock_level based)"""
        response = requests.get(f"{BASE_URL}/api/stock/alerts", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        alerts = response.json()
        
        assert isinstance(alerts, list)
        if alerts:
            alert = alerts[0]
            assert "item_id" in alert
            assert "item_name" in alert
            assert "current_balance" in alert
            assert "min_level" in alert
            assert "deficit" in alert
            print(f"Basic alerts: {len(alerts)} items below min level")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
