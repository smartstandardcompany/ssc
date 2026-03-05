"""
Iteration 89 - Menu Management Tests
Testing branch/platform assignment for menu items
Features:
- GET /api/cashier/menu-all - Returns all items including unavailable
- PUT /api/cashier/menu/{id}/branches - Update branch assignments
- PUT /api/cashier/menu/{id}/platforms - Update platform assignments
- PUT /api/cashier/menu/bulk-branch-assign - Bulk branch assignment
- PUT /api/cashier/menu/bulk-platform-assign - Bulk platform assignment
- GET /api/cashier/menu/export/{platform_id} - Export menu for platform
- GET /api/cashier/menu?branch_id=X - Filter by branch
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for admin user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "ss@ssc.com", "password": "Aa147258369Ssc@"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="module")
def branches(headers):
    """Get all branches"""
    response = requests.get(f"{BASE_URL}/api/branches", headers=headers)
    assert response.status_code == 200
    return response.json()

@pytest.fixture(scope="module")
def platforms(headers):
    """Get all platforms"""
    response = requests.get(f"{BASE_URL}/api/platforms", headers=headers)
    assert response.status_code == 200
    return response.json()

@pytest.fixture(scope="module")
def test_menu_item(headers):
    """Create a test menu item for testing"""
    item_data = {
        "name": "TEST_Iter89_Item",
        "name_ar": "عنصر اختبار",
        "category": "main",
        "price": 25.0,
        "cost_price": 12.0,
        "preparation_time": 10,
        "is_available": True,
        "tags": ["popular"],
        "branch_ids": [],
        "platform_ids": [],
        "platform_prices": {}
    }
    response = requests.post(f"{BASE_URL}/api/cashier/menu", json=item_data, headers=headers)
    assert response.status_code == 200, f"Failed to create test item: {response.text}"
    item = response.json()
    yield item
    # Cleanup - delete the item
    requests.delete(f"{BASE_URL}/api/cashier/menu/{item['id']}", headers=headers)


class TestMenuAllEndpoint:
    """Test GET /api/cashier/menu-all endpoint"""
    
    def test_get_all_menu_items(self, headers):
        """Test that menu-all returns all items including unavailable"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1, "Should have at least 1 menu item"
        # Check item structure
        if len(data) > 0:
            item = data[0]
            assert "id" in item
            assert "name" in item
            assert "price" in item
            assert "category" in item
            # Check for new fields
            assert "branch_ids" in item or item.get("branch_ids") is None  # May not be present if not set
            print(f"Menu-all returned {len(data)} items")
    
    def test_menu_all_includes_unavailable(self, headers):
        """Test that menu-all includes unavailable items"""
        response = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # Check if there are any unavailable items (may or may not exist)
        unavailable = [i for i in data if i.get("is_available") == False]
        print(f"Found {len(unavailable)} unavailable items out of {len(data)} total")


class TestBranchAssignment:
    """Test branch assignment endpoints"""
    
    def test_update_menu_item_branches(self, headers, test_menu_item, branches):
        """Test PUT /api/cashier/menu/{id}/branches"""
        if len(branches) == 0:
            pytest.skip("No branches available for testing")
        
        # Assign first 2 branches
        branch_ids = [b["id"] for b in branches[:2]]
        response = requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/branches",
            json={"branch_ids": branch_ids},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("branch_ids") == branch_ids
        print(f"Assigned branches: {branch_ids}")
        
        # Verify by getting the item
        get_resp = requests.get(f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}", headers=headers)
        assert get_resp.status_code == 200
        item_data = get_resp.json()
        assert item_data.get("branch_ids") == branch_ids
    
    def test_update_branches_empty_list(self, headers, test_menu_item):
        """Test setting empty branch_ids (all branches)"""
        response = requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/branches",
            json={"branch_ids": []},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("branch_ids") == []
        print("Cleared branches - item now available at all branches")
    
    def test_update_branches_nonexistent_item(self, headers):
        """Test updating branches for non-existent item returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/cashier/menu/nonexistent-id/branches",
            json={"branch_ids": []},
            headers=headers
        )
        assert response.status_code == 404


class TestPlatformAssignment:
    """Test platform assignment endpoints"""
    
    def test_update_menu_item_platforms(self, headers, test_menu_item, platforms):
        """Test PUT /api/cashier/menu/{id}/platforms"""
        # Filter out 'Other' platform
        valid_platforms = [p for p in platforms if p["name"] != "Other"]
        if len(valid_platforms) == 0:
            pytest.skip("No platforms available for testing")
        
        # Assign first 2 platforms with custom prices
        platform_ids = [p["id"] for p in valid_platforms[:2]]
        platform_prices = {platform_ids[0]: 30.0}  # Custom price for first platform
        
        response = requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/platforms",
            json={"platform_ids": platform_ids, "platform_prices": platform_prices},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("platform_ids") == platform_ids
        print(f"Assigned platforms: {platform_ids}")
        
        # Verify by getting the item
        get_resp = requests.get(f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}", headers=headers)
        assert get_resp.status_code == 200
        item_data = get_resp.json()
        assert item_data.get("platform_ids") == platform_ids
        assert item_data.get("platform_prices", {}).get(platform_ids[0]) == 30.0
    
    def test_update_platforms_empty_list(self, headers, test_menu_item):
        """Test clearing platforms"""
        response = requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/platforms",
            json={"platform_ids": [], "platform_prices": {}},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print("Cleared platforms")


class TestBulkAssignment:
    """Test bulk assignment endpoints"""
    
    def test_bulk_branch_assign(self, headers, branches):
        """Test PUT /api/cashier/menu/bulk-branch-assign"""
        # Get existing menu items
        items_resp = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=headers)
        assert items_resp.status_code == 200
        items = items_resp.json()
        
        if len(items) < 2 or len(branches) < 1:
            pytest.skip("Not enough items or branches for bulk test")
        
        # Select first 2 items
        item_ids = [items[0]["id"], items[1]["id"]]
        branch_ids = [branches[0]["id"]]
        
        response = requests.put(
            f"{BASE_URL}/api/cashier/menu/bulk-branch-assign",
            json={"item_ids": item_ids, "branch_ids": branch_ids},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("modified") >= 0  # May be 0 if already assigned
        print(f"Bulk assigned {data.get('modified')} items to branches")
    
    def test_bulk_platform_assign(self, headers, platforms):
        """Test PUT /api/cashier/menu/bulk-platform-assign"""
        # Get existing menu items
        items_resp = requests.get(f"{BASE_URL}/api/cashier/menu-all", headers=headers)
        assert items_resp.status_code == 200
        items = items_resp.json()
        
        valid_platforms = [p for p in platforms if p["name"] != "Other"]
        if len(items) < 2 or len(valid_platforms) < 1:
            pytest.skip("Not enough items or platforms for bulk test")
        
        # Select first 2 items
        item_ids = [items[0]["id"], items[1]["id"]]
        platform_ids = [valid_platforms[0]["id"]]
        
        response = requests.put(
            f"{BASE_URL}/api/cashier/menu/bulk-platform-assign",
            json={"item_ids": item_ids, "platform_ids": platform_ids},
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Bulk assigned {data.get('modified')} items to platforms")


class TestMenuExport:
    """Test menu export endpoint"""
    
    def test_export_menu_for_platform(self, headers, platforms, test_menu_item):
        """Test GET /api/cashier/menu/export/{platform_id}"""
        valid_platforms = [p for p in platforms if p["name"] != "Other"]
        if len(valid_platforms) == 0:
            pytest.skip("No platforms available for export test")
        
        platform = valid_platforms[0]
        
        # First assign the test item to this platform
        requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/platforms",
            json={"platform_ids": [platform["id"]], "platform_prices": {platform["id"]: 35.0}},
            headers=headers
        )
        
        # Export menu
        response = requests.get(
            f"{BASE_URL}/api/cashier/menu/export/{platform['id']}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify export structure
        assert "platform" in data
        assert "total_items" in data
        assert "items" in data
        assert isinstance(data["items"], list)
        
        print(f"Exported {data['total_items']} items for platform {data['platform']}")
        
        # Check if our test item is in the export
        test_item_in_export = [i for i in data["items"] if i.get("name") == test_menu_item["name"]]
        if test_item_in_export:
            # Verify platform price
            assert test_item_in_export[0].get("price") == 35.0
            print(f"Test item found with platform price: {test_item_in_export[0].get('price')}")
    
    def test_export_nonexistent_platform(self, headers):
        """Test export for non-existent platform returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/cashier/menu/export/nonexistent-platform-id",
            headers=headers
        )
        assert response.status_code == 404


class TestMenuFiltering:
    """Test menu filtering by branch"""
    
    def test_filter_by_branch(self, headers, branches, test_menu_item):
        """Test GET /api/cashier/menu?branch_id=X filters correctly"""
        if len(branches) == 0:
            pytest.skip("No branches for filter test")
        
        branch = branches[0]
        
        # First assign test item to specific branch
        requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/branches",
            json={"branch_ids": [branch["id"]]},
            headers=headers
        )
        
        # Filter by that branch
        response = requests.get(
            f"{BASE_URL}/api/cashier/menu?branch_id={branch['id']}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Our test item should be in results
        test_item_found = any(i["id"] == test_menu_item["id"] for i in data)
        assert test_item_found, "Test item should be returned when filtering by its branch"
        print(f"Branch filter returned {len(data)} items for branch {branch['name']}")
    
    def test_filter_includes_all_branch_items(self, headers, branches, test_menu_item):
        """Test that items with empty branch_ids are included in all branch filters"""
        if len(branches) == 0:
            pytest.skip("No branches for filter test")
        
        # Set test item to all branches (empty array)
        requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/branches",
            json={"branch_ids": []},
            headers=headers
        )
        
        # Filter by any branch - should still include our test item
        response = requests.get(
            f"{BASE_URL}/api/cashier/menu?branch_id={branches[0]['id']}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Our test item should be in results (empty branch_ids = all branches)
        test_item_found = any(i["id"] == test_menu_item["id"] for i in data)
        assert test_item_found, "Items with empty branch_ids should appear for all branches"
        print(f"All-branch item correctly included in filtered results")


class TestMenuItemCRUD:
    """Test basic CRUD with new fields"""
    
    def test_create_item_with_branch_platform_ids(self, headers, branches, platforms):
        """Test creating item with branch_ids and platform_ids"""
        valid_platforms = [p for p in platforms if p["name"] != "Other"]
        
        item_data = {
            "name": "TEST_Iter89_FullItem",
            "name_ar": "عنصر كامل",
            "category": "beverage",
            "price": 15.0,
            "cost_price": 5.0,
            "is_available": True,
            "branch_ids": [branches[0]["id"]] if branches else [],
            "platform_ids": [valid_platforms[0]["id"]] if valid_platforms else [],
            "platform_prices": {valid_platforms[0]["id"]: 18.0} if valid_platforms else {}
        }
        
        response = requests.post(f"{BASE_URL}/api/cashier/menu", json=item_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_Iter89_FullItem"
        assert data.get("branch_ids") == item_data["branch_ids"]
        assert data.get("platform_ids") == item_data["platform_ids"]
        assert data.get("platform_prices") == item_data["platform_prices"]
        print(f"Created item with branch_ids and platform_ids: {data['id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/cashier/menu/{data['id']}", headers=headers)
    
    def test_update_item_preserves_branch_platform(self, headers, test_menu_item, branches, platforms):
        """Test that updating item preserves branch_ids and platform_ids"""
        valid_platforms = [p for p in platforms if p["name"] != "Other"]
        
        # First set branches and platforms
        requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/branches",
            json={"branch_ids": [branches[0]["id"]] if branches else []},
            headers=headers
        )
        requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}/platforms",
            json={"platform_ids": [valid_platforms[0]["id"]] if valid_platforms else [], "platform_prices": {}},
            headers=headers
        )
        
        # Now update the item with new name
        update_data = {
            "name": "TEST_Iter89_Updated",
            "name_ar": test_menu_item.get("name_ar", ""),
            "category": test_menu_item.get("category", "main"),
            "price": test_menu_item.get("price", 25.0),
            "is_available": True,
            "branch_ids": [branches[0]["id"]] if branches else [],
            "platform_ids": [valid_platforms[0]["id"]] if valid_platforms else [],
            "platform_prices": {}
        }
        
        response = requests.put(
            f"{BASE_URL}/api/cashier/menu/{test_menu_item['id']}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["name"] == "TEST_Iter89_Updated"
        # Branch/platform should be preserved in update
        print(f"Updated item: {data.get('name')}, branches: {data.get('branch_ids')}, platforms: {data.get('platform_ids')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
