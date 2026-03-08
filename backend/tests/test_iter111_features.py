"""
Iteration 111 - Test Cases for:
1. PIN Regeneration for employees with existing PINs
2. Platform Reconciliation Summary with expected_fee fields
3. Platform CRUD with processing_fee field
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for admin user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestPINRegeneration:
    """Test PIN regeneration for employees who already have PINs"""
    
    def test_get_employees_with_pins(self, auth_headers):
        """Verify employees with existing PINs are returned"""
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        # Find employees with existing PINs
        employees_with_pins = [e for e in employees if e.get('cashier_pin')]
        assert len(employees_with_pins) >= 1, "Should have at least one employee with PIN"
        print(f"Found {len(employees_with_pins)} employees with PINs")
    
    def test_pin_regeneration_for_employee_with_existing_pin(self, auth_headers):
        """Test regenerating PIN for employee who already has a PIN"""
        # Get employee with existing PIN (aaaa with PIN 1234)
        response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        assert response.status_code == 200
        employees = response.json()
        
        emp_with_pin = next((e for e in employees if e.get('cashier_pin')), None)
        assert emp_with_pin is not None, "Need employee with existing PIN"
        
        old_pin = emp_with_pin['cashier_pin']
        emp_id = emp_with_pin['id']
        emp_name = emp_with_pin['name']
        print(f"Testing PIN regeneration for {emp_name} (current PIN: {old_pin})")
        
        # Regenerate PIN
        regen_response = requests.post(
            f"{BASE_URL}/api/cashier/generate-pin/{emp_id}", 
            headers=auth_headers
        )
        assert regen_response.status_code == 200, f"PIN regeneration failed: {regen_response.text}"
        
        result = regen_response.json()
        assert 'pin' in result, "Response should contain new PIN"
        new_pin = result['pin']
        assert len(new_pin) == 4, "PIN should be 4 digits"
        assert new_pin.isdigit(), "PIN should be numeric"
        
        # Verify PIN changed in database
        verify_response = requests.get(f"{BASE_URL}/api/employees", headers=auth_headers)
        employees = verify_response.json()
        updated_emp = next((e for e in employees if e['id'] == emp_id), None)
        assert updated_emp['cashier_pin'] == new_pin, "PIN should be updated in database"
        
        print(f"SUCCESS: PIN regenerated from {old_pin} to {new_pin}")


class TestPlatformReconciliationSummary:
    """Test Platform Reconciliation Summary endpoint with fee fields"""
    
    def test_summary_returns_expected_fee_fields(self, auth_headers):
        """Verify summary response contains expected_fee, expected_received, commission_rate, processing_fee"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check top-level fields
        assert 'total_expected_fee' in data, "Should have total_expected_fee"
        assert 'total_online_sales' in data, "Should have total_online_sales"
        assert 'total_received' in data, "Should have total_received"
        assert 'platforms' in data, "Should have platforms array"
        
        print(f"Total expected fee: {data['total_expected_fee']}")
        print(f"Total online sales: {data['total_online_sales']}")
    
    def test_platform_data_has_fee_fields(self, auth_headers):
        """Verify each platform in summary has fee-related fields"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        if data['platforms']:
            platform = data['platforms'][0]
            required_fields = ['expected_fee', 'expected_received', 'commission_rate', 'processing_fee']
            for field in required_fields:
                assert field in platform, f"Platform should have {field}"
            print(f"Platform {platform['platform_name']}: commission={platform['commission_rate']}%, expected_fee={platform['expected_fee']}")


class TestPlatformCRUDWithProcessingFee:
    """Test Platform CRUD operations with processing_fee field"""
    
    def test_create_platform_with_processing_fee(self, auth_headers):
        """Test creating a platform with processing_fee"""
        payload = {
            "name": "TEST_PlatformIter111",
            "commission_rate": 15,
            "processing_fee": 2.50
        }
        
        response = requests.post(f"{BASE_URL}/api/platforms", json=payload, headers=auth_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert 'platform' in result, "Should return created platform"
        created = result['platform']
        
        assert created['commission_rate'] == 15, "commission_rate should be 15"
        assert created['processing_fee'] == 2.5, "processing_fee should be 2.5"
        
        print(f"Created platform with processing_fee: {created['processing_fee']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/platforms/{created['id']}", headers=auth_headers)
    
    def test_update_platform_processing_fee(self, auth_headers):
        """Test updating platform's processing_fee"""
        # Create a test platform
        create_response = requests.post(f"{BASE_URL}/api/platforms", json={
            "name": "TEST_UpdatePlatform111",
            "commission_rate": 10,
            "processing_fee": 1.0
        }, headers=auth_headers)
        assert create_response.status_code == 200
        platform_id = create_response.json()['platform']['id']
        
        # Update processing_fee
        update_response = requests.put(f"{BASE_URL}/api/platforms/{platform_id}", json={
            "name": "TEST_UpdatePlatform111",
            "commission_rate": 12,
            "processing_fee": 3.50
        }, headers=auth_headers)
        assert update_response.status_code == 200
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/platforms", headers=auth_headers)
        platforms = get_response.json()
        updated = next((p for p in platforms if p['id'] == platform_id), None)
        
        assert updated is not None, "Platform should exist"
        assert updated['commission_rate'] == 12, "commission_rate should be updated"
        assert updated['processing_fee'] == 3.5, "processing_fee should be updated"
        
        print(f"Updated platform processing_fee to {updated['processing_fee']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/platforms/{platform_id}", headers=auth_headers)


class TestPlatformReconciliationFeeCalculation:
    """Test that fee calculation is correct in reconciliation"""
    
    def test_expected_fee_calculation(self, auth_headers):
        """Verify expected_fee = (commission_rate% * sales) + (processing_fee * order_count)"""
        response = requests.get(f"{BASE_URL}/api/platform-reconciliation/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        for platform in data.get('platforms', []):
            sales = platform['total_sales']
            comm_rate = platform['commission_rate']
            proc_fee = platform['processing_fee']
            order_count = platform['sales_count']
            expected_fee = platform['expected_fee']
            expected_received = platform['expected_received']
            
            # Calculate expected fee
            calc_commission = sales * (comm_rate / 100) if comm_rate > 0 else 0
            calc_processing = proc_fee * order_count if proc_fee > 0 else 0
            calc_expected_fee = round(calc_commission + calc_processing, 2)
            calc_expected_received = round(sales - calc_expected_fee, 2)
            
            # Verify calculations (allow small rounding differences)
            assert abs(expected_fee - calc_expected_fee) < 0.1, \
                f"Expected fee mismatch for {platform['platform_name']}: {expected_fee} vs calculated {calc_expected_fee}"
            assert abs(expected_received - calc_expected_received) < 0.1, \
                f"Expected received mismatch for {platform['platform_name']}: {expected_received} vs calculated {calc_expected_received}"
            
            print(f"{platform['platform_name']}: sales={sales}, commission={comm_rate}%, expected_fee={expected_fee}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
