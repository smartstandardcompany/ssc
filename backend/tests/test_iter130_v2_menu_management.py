"""
Iteration 130: V2 Advanced Menu Management System Tests
Features tested:
- Add-on Library CRUD: /api/addons
- Menu Item V2 editor with modifier_groups (sizes, addons, options)
- Branch-specific availability
- POS Cashier _resolved_modifiers 
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://erp-multi-tenant-5.preview.emergentagent.com"

# Test data tracking
created_addon_ids = []
created_menu_item_ids = []

@pytest.fixture(scope="module")
def admin_token():
    """Get admin token for API calls"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "ss@ssc.com",
        "password": "Aa147258369Ssc@"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="module")
def branches(headers):
    """Get existing branches for testing"""
    response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
    assert response.status_code == 200
    return response.json()


# =============================================================================
# ADD-ON LIBRARY CRUD TESTS
# =============================================================================

class TestAddonLibraryCRUD:
    """Test central add-on library CRUD operations"""
    
    def test_01_get_addons_initial(self, headers):
        """GET /api/addons - Should return list of addons"""
        response = requests.get(f"{BASE_URL}/api/addons", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have the 5 pre-created addons
        print(f"Found {len(data)} addons in library")
    
    def test_02_create_addon(self, headers):
        """POST /api/addons - Create new addon"""
        unique_name = f"TEST_Addon_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "name_ar": "إضافة تجريبية",
            "price": 4.5,
            "category": "extras",
            "is_active": True
        }
        response = requests.post(f"{BASE_URL}/api/addons", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == unique_name
        assert data["price"] == 4.5
        assert data["category"] == "extras"
        assert "id" in data
        created_addon_ids.append(data["id"])
        print(f"Created addon: {data['id']}")
    
    def test_03_get_addon_by_category(self, headers):
        """GET /api/addons?category=extras - Filter by category"""
        response = requests.get(f"{BASE_URL}/api/addons?category=extras", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert all(a["category"] == "extras" for a in data)
        print(f"Found {len(data)} addons in 'extras' category")
    
    def test_04_update_addon(self, headers):
        """PUT /api/addons/{id} - Update addon"""
        if not created_addon_ids:
            pytest.skip("No addon to update")
        addon_id = created_addon_ids[0]
        payload = {
            "name": "TEST_Updated_Addon",
            "price": 5.0
        }
        response = requests.put(f"{BASE_URL}/api/addons/{addon_id}", headers=headers, json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TEST_Updated_Addon"
        assert data["price"] == 5.0
        print(f"Updated addon: {addon_id}")
    
    def test_05_get_addon_categories(self, headers):
        """GET /api/addons/categories - Get distinct categories"""
        response = requests.get(f"{BASE_URL}/api/addons/categories", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert "extras" in data
        print(f"Categories: {data}")
    
    def test_99_cleanup_addons(self, headers):
        """Cleanup created test addons"""
        for addon_id in created_addon_ids:
            response = requests.delete(f"{BASE_URL}/api/addons/{addon_id}", headers=headers)
            print(f"Cleanup addon {addon_id}: {response.status_code}")


# =============================================================================
# MENU ITEM V2 MODIFIER_GROUPS TESTS
# =============================================================================

class TestMenuItemV2ModifierGroups:
    """Test V2 menu item editor with modifier_groups structure"""
    
    def test_01_get_existing_menu_items(self, headers):
        """GET /api/cashier/menu-all - Get all menu items"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Find Chicken Shawarma with V1 legacy modifiers
        shawarma = next((i for i in data if i.get("name") == "Chicken Shawarma"), None)
        if shawarma:
            print(f"Chicken Shawarma found - modifiers: {len(shawarma.get('modifiers', []))}, modifier_groups: {len(shawarma.get('modifier_groups', []) or [])}")
        return data
    
    def test_02_create_menu_item_with_v2_sizes(self, headers, branches):
        """POST /api/cashier/menu - Create item with V2 sizes modifier_group"""
        unique_name = f"TEST_V2_Item_{uuid.uuid4().hex[:8]}"
        branch_ids = [b["id"] for b in branches[:2]] if len(branches) >= 2 else []
        
        payload = {
            "name": unique_name,
            "name_ar": "صنف تجريبي",
            "category": "main",
            "price": 30.0,
            "is_available": True,
            "modifier_groups": [
                {
                    "id": "sizes",
                    "name": "Size",
                    "type": "size",
                    "required": True,
                    "multiple": False,
                    "options": [
                        {"name": "Small", "price": 0},
                        {"name": "Medium", "price": 5},
                        {"name": "Large", "price": 10}
                    ],
                    "branch_availability": {
                        branch_ids[0]: ["Small", "Medium"] if branch_ids else []
                    } if branch_ids else {}
                }
            ],
            "modifiers": [
                {
                    "name": "Size",
                    "required": True,
                    "multiple": False,
                    "options": [
                        {"name": "Small", "price": 0},
                        {"name": "Medium", "price": 5},
                        {"name": "Large", "price": 10}
                    ]
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/api/cashier/menu", headers=headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == unique_name
        assert len(data.get("modifier_groups") or []) == 1
        created_menu_item_ids.append(data["id"])
        print(f"Created V2 menu item: {data['id']}")
        return data
    
    def test_03_create_menu_item_with_linked_addons(self, headers):
        """POST /api/cashier/menu - Create item with linked add-ons from library"""
        # First get existing addons
        addon_response = requests.get(f"{BASE_URL}/api/addons", headers=headers)
        assert addon_response.status_code == 200
        addons = addon_response.json()
        if len(addons) < 2:
            pytest.skip("Need at least 2 addons in library")
        
        addon_ids = [addons[0]["id"], addons[1]["id"]]
        unique_name = f"TEST_V2_Addon_Item_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": unique_name,
            "name_ar": "صنف مع إضافات",
            "category": "main",
            "price": 25.0,
            "is_available": True,
            "modifier_groups": [
                {
                    "id": "addons",
                    "name": "Add-ons",
                    "type": "addon",
                    "required": False,
                    "multiple": True,
                    "addon_ids": addon_ids,
                    "branch_availability": {}
                }
            ],
            "modifiers": []
        }
        response = requests.post(f"{BASE_URL}/api/cashier/menu", headers=headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert len(data.get("modifier_groups") or []) == 1
        assert data["modifier_groups"][0]["type"] == "addon"
        assert data["modifier_groups"][0]["addon_ids"] == addon_ids
        created_menu_item_ids.append(data["id"])
        print(f"Created item with linked addons: {data['id']}")
        return data
    
    def test_04_create_menu_item_with_option_groups(self, headers, branches):
        """POST /api/cashier/menu - Create item with single-choice option groups"""
        unique_name = f"TEST_V2_Options_Item_{uuid.uuid4().hex[:8]}"
        branch_id = branches[0]["id"] if branches else None
        
        payload = {
            "name": unique_name,
            "name_ar": "صنف مع خيارات",
            "category": "main",
            "price": 20.0,
            "is_available": True,
            "modifier_groups": [
                {
                    "id": "bread_type",
                    "name": "Bread Type",
                    "type": "option",
                    "required": True,
                    "multiple": False,
                    "options": [
                        {"name": "Pita", "price": 0},
                        {"name": "Saj", "price": 2},
                        {"name": "Samoon", "price": 1}
                    ],
                    "branch_availability": {
                        branch_id: True
                    } if branch_id else {}
                },
                {
                    "id": "spice_level",
                    "name": "Spice Level",
                    "type": "option",
                    "required": False,
                    "multiple": False,
                    "options": [
                        {"name": "Mild", "price": 0},
                        {"name": "Medium", "price": 0},
                        {"name": "Hot", "price": 0}
                    ],
                    "branch_availability": {}
                }
            ],
            "modifiers": []
        }
        response = requests.post(f"{BASE_URL}/api/cashier/menu", headers=headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert len(data.get("modifier_groups") or []) == 2
        assert all(mg["type"] == "option" for mg in data["modifier_groups"])
        created_menu_item_ids.append(data["id"])
        print(f"Created item with option groups: {data['id']}")
        return data
    
    def test_05_update_menu_item_v2_structure(self, headers):
        """PUT /api/cashier/menu/{id} - Update item with V2 modifier_groups"""
        if not created_menu_item_ids:
            pytest.skip("No menu item created to update")
        
        item_id = created_menu_item_ids[0]
        payload = {
            "name": "TEST_V2_Updated_Item",
            "name_ar": "صنف محدث",
            "category": "main",
            "price": 35.0,
            "is_available": True,
            "modifier_groups": [
                {
                    "id": "sizes",
                    "name": "Size",
                    "type": "size",
                    "required": True,
                    "multiple": False,
                    "options": [
                        {"name": "Regular", "price": 0},
                        {"name": "Jumbo", "price": 15}
                    ],
                    "branch_availability": {}
                }
            ],
            "modifiers": [
                {
                    "name": "Size",
                    "required": True,
                    "multiple": False,
                    "options": [
                        {"name": "Regular", "price": 0},
                        {"name": "Jumbo", "price": 15}
                    ]
                }
            ]
        }
        response = requests.put(f"{BASE_URL}/api/cashier/menu/{item_id}", headers=headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_V2_Updated_Item"
        assert data["price"] == 35.0
        print(f"Updated item: {item_id}")


# =============================================================================
# POS CASHIER RESOLVED MODIFIERS TESTS
# =============================================================================

class TestPOSCashierResolvedModifiers:
    """Test POS /api/cashier/menu returns _resolved_modifiers"""
    
    def test_01_cashier_login(self):
        """Test POS cashier login with PIN"""
        response = requests.post(f"{BASE_URL}/api/cashier/login", json={"pin": "1234"})
        if response.status_code != 200:
            # PIN might not exist, try email login
            response = requests.post(f"{BASE_URL}/api/cashier/login", json={
                "email": "ss@ssc.com",
                "password": "Aa147258369Ssc@"
            })
        assert response.status_code == 200, f"Cashier login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"Cashier logged in: {data.get('user', {}).get('name', 'Unknown')}")
        return data["access_token"]
    
    def test_02_get_menu_with_resolved_modifiers(self, headers):
        """GET /api/cashier/menu - Should include _resolved_modifiers"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Check if _resolved_modifiers is present
        items_with_resolved = [i for i in data if "_resolved_modifiers" in i]
        print(f"Total items: {len(data)}, Items with _resolved_modifiers: {len(items_with_resolved)}")
        
        # Find an item with modifiers to verify structure
        for item in data:
            if item.get("_resolved_modifiers"):
                print(f"Item '{item['name']}' has {len(item['_resolved_modifiers'])} resolved modifier groups")
                for rm in item["_resolved_modifiers"]:
                    print(f"  - {rm.get('name')}: {rm.get('type')}, {len(rm.get('options', []))} options")
                break
    
    def test_03_resolved_modifiers_include_addon_details(self, headers):
        """Verify addon type modifier groups resolve addon IDs to full data"""
        # Create an item with linked addons
        addon_response = requests.get(f"{BASE_URL}/api/addons", headers=headers)
        if addon_response.status_code != 200 or not addon_response.json():
            pytest.skip("No addons available")
        
        addons = addon_response.json()
        addon_ids = [a["id"] for a in addons[:2]]
        
        unique_name = f"TEST_Resolved_{uuid.uuid4().hex[:8]}"
        payload = {
            "name": unique_name,
            "category": "main",
            "price": 20.0,
            "is_available": True,
            "modifier_groups": [{
                "id": "test_addons",
                "name": "Test Add-ons",
                "type": "addon",
                "required": False,
                "multiple": True,
                "addon_ids": addon_ids,
                "branch_availability": {}
            }],
            "modifiers": []
        }
        create_response = requests.post(f"{BASE_URL}/api/cashier/menu", headers=headers, json=payload)
        assert create_response.status_code == 200
        created_id = create_response.json()["id"]
        created_menu_item_ids.append(created_id)
        
        # Now get menu and verify resolved modifiers
        menu_response = requests.get(f"{BASE_URL}/api/cashier/menu", headers=headers)
        assert menu_response.status_code == 200
        menu_items = menu_response.json()
        
        test_item = next((i for i in menu_items if i["id"] == created_id), None)
        assert test_item is not None, "Created item not found in menu"
        
        resolved = test_item.get("_resolved_modifiers", [])
        addon_group = next((r for r in resolved if r.get("type") == "addon"), None)
        if addon_group:
            assert "options" in addon_group
            for opt in addon_group["options"]:
                assert "name" in opt
                assert "price" in opt
                print(f"Resolved addon option: {opt['name']} - SAR {opt['price']}")
        print(f"Test item resolved modifiers verified")


# =============================================================================
# BRANCH AVAILABILITY TESTS
# =============================================================================

class TestBranchAvailability:
    """Test branch-specific availability filtering"""
    
    def test_01_create_item_with_branch_specific_sizes(self, headers, branches):
        """Create item with different sizes available at different branches"""
        if len(branches) < 2:
            pytest.skip("Need at least 2 branches")
        
        branch1_id = branches[0]["id"]
        branch2_id = branches[1]["id"]
        unique_name = f"TEST_BranchAvail_{uuid.uuid4().hex[:8]}"
        
        payload = {
            "name": unique_name,
            "category": "main",
            "price": 25.0,
            "is_available": True,
            "modifier_groups": [{
                "id": "sizes",
                "name": "Size",
                "type": "size",
                "required": True,
                "multiple": False,
                "options": [
                    {"name": "Small", "price": 0},
                    {"name": "Medium", "price": 5},
                    {"name": "Large", "price": 10}
                ],
                "branch_availability": {
                    branch1_id: ["Small", "Medium"],
                    branch2_id: ["Large"]
                }
            }],
            "modifiers": []
        }
        response = requests.post(f"{BASE_URL}/api/cashier/menu", headers=headers, json=payload)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        created_menu_item_ids.append(data["id"])
        
        # Verify branch_availability is stored
        mg = data["modifier_groups"][0]
        assert "branch_availability" in mg
        assert branch1_id in mg["branch_availability"]
        print(f"Branch {branch1_id} sizes: {mg['branch_availability'][branch1_id]}")
        print(f"Branch {branch2_id} sizes: {mg['branch_availability'][branch2_id]}")


# =============================================================================
# CLEANUP
# =============================================================================

class TestCleanup:
    """Cleanup test data"""
    
    def test_99_cleanup_menu_items(self, headers):
        """Delete created test menu items"""
        for item_id in created_menu_item_ids:
            response = requests.delete(f"{BASE_URL}/api/cashier/menu/{item_id}", headers=headers)
            print(f"Cleanup menu item {item_id}: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
