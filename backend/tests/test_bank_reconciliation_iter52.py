"""
Iteration 52: Tests for Enhanced Bank Reconciliation and Keyboard Shortcuts Features
- GET /api/bank-statements/{stmt_id}/unmatched - returns unmatched transactions with suggestions
- POST /api/bank-statements/{stmt_id}/manual-match - manual linking of bank txn to system record
- Confidence tiers (exact, probable, possible) in suggestions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBankReconciliationFeatures:
    """Test enhanced bank reconciliation APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and statement ID"""
        # Login
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get first bank statement
        stmt_resp = requests.get(f"{BASE_URL}/api/bank-statements", headers=self.headers)
        assert stmt_resp.status_code == 200
        statements = stmt_resp.json()
        if len(statements) > 0:
            self.stmt_id = statements[0].get("id")
        else:
            self.stmt_id = None
    
    def test_get_bank_statements_list(self):
        """Test GET /api/bank-statements returns list of statements"""
        resp = requests.get(f"{BASE_URL}/api/bank-statements", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} bank statements")
        if len(data) > 0:
            stmt = data[0]
            assert "id" in stmt
            assert "file_name" in stmt or "bank_name" in stmt
            print(f"First statement: id={stmt.get('id')}, name={stmt.get('file_name')}")
    
    def test_get_unmatched_without_auth(self):
        """Test GET /api/bank-statements/{id}/unmatched requires auth"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        resp = requests.get(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/unmatched")
        assert resp.status_code in [401, 403], f"Expected 401/403 got {resp.status_code}"
    
    def test_get_unmatched_transactions(self):
        """Test GET /api/bank-statements/{id}/unmatched returns unmatched transactions"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        resp = requests.get(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/unmatched", headers=self.headers)
        assert resp.status_code == 200, f"Failed: {resp.text}"
        data = resp.json()
        
        # Check response structure
        assert "unmatched" in data, "Response missing 'unmatched' key"
        assert "total" in data, "Response missing 'total' key"
        assert isinstance(data["unmatched"], list)
        assert isinstance(data["total"], int)
        
        print(f"Found {data['total']} unmatched transactions")
        
        # Check structure of unmatched transaction
        if len(data["unmatched"]) > 0:
            txn = data["unmatched"][0]
            assert "index" in txn, "Missing 'index' field"
            assert "date" in txn, "Missing 'date' field"
            assert "amount" in txn, "Missing 'amount' field"
            assert "type" in txn, "Missing 'type' field (credit/debit)"
            assert "description" in txn, "Missing 'description' field"
            assert "suggestions" in txn, "Missing 'suggestions' array"
            
            print(f"Sample unmatched txn: date={txn['date']}, amount={txn['amount']}, type={txn['type']}")
    
    def test_unmatched_suggestions_structure(self):
        """Test that suggestions contain correct fields including tier and amt_diff"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        resp = requests.get(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/unmatched", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        # Find a transaction with suggestions
        txn_with_suggestions = None
        for txn in data.get("unmatched", []):
            if len(txn.get("suggestions", [])) > 0:
                txn_with_suggestions = txn
                break
        
        if not txn_with_suggestions:
            pytest.skip("No transactions with suggestions found")
        
        suggestion = txn_with_suggestions["suggestions"][0]
        
        # Check suggestion structure per spec
        assert "type" in suggestion, "Suggestion missing 'type'"
        assert "id" in suggestion, "Suggestion missing 'id'"
        assert "amount" in suggestion, "Suggestion missing 'amount'"
        assert "date" in suggestion, "Suggestion missing 'date'"
        assert "desc" in suggestion, "Suggestion missing 'desc'"
        assert "score" in suggestion, "Suggestion missing 'score'"
        assert "tier" in suggestion, "Suggestion missing 'tier'"
        assert "amt_diff" in suggestion, "Suggestion missing 'amt_diff'"
        
        # Validate tier is one of the expected values
        assert suggestion["tier"] in ["exact", "probable", "possible"], f"Invalid tier: {suggestion['tier']}"
        
        print(f"Suggestion: type={suggestion['type']}, score={suggestion['score']}, tier={suggestion['tier']}, amt_diff={suggestion['amt_diff']}")
    
    def test_confidence_tier_values(self):
        """Test that tiers correctly map to score ranges: exact>=90, probable>=65, possible<65"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        resp = requests.get(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/unmatched", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        
        tiers_found = {"exact": 0, "probable": 0, "possible": 0}
        tier_scores = {"exact": [], "probable": [], "possible": []}
        
        for txn in data.get("unmatched", []):
            for sug in txn.get("suggestions", []):
                tier = sug.get("tier")
                score = sug.get("score")
                if tier in tiers_found:
                    tiers_found[tier] += 1
                    tier_scores[tier].append(score)
        
        # Log tier distribution
        print(f"Tier distribution: {tiers_found}")
        
        # Validate tier-score mapping
        for score in tier_scores["exact"]:
            assert score >= 90, f"Exact tier should have score >= 90, got {score}"
        for score in tier_scores["probable"]:
            assert 65 <= score < 90, f"Probable tier should have 65 <= score < 90, got {score}"
        for score in tier_scores["possible"]:
            assert score < 65, f"Possible tier should have score < 65, got {score}"
        
        print("Tier-score mapping validated correctly")
    
    def test_manual_match_without_auth(self):
        """Test POST /api/bank-statements/{id}/manual-match requires auth"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        resp = requests.post(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/manual-match", json={
            "txn_index": 0,
            "match_type": "sale",
            "match_id": "test-id"
        })
        assert resp.status_code in [401, 403], f"Expected 401/403 got {resp.status_code}"
    
    def test_manual_match_missing_params(self):
        """Test POST /api/bank-statements/{id}/manual-match validates required params"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        
        # Missing all params
        resp = requests.post(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/manual-match", 
                            json={}, headers=self.headers)
        assert resp.status_code == 400, f"Expected 400 for missing params, got {resp.status_code}"
        
        # Missing match_id
        resp = requests.post(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/manual-match",
                            json={"txn_index": 0, "match_type": "sale"}, headers=self.headers)
        assert resp.status_code == 400, f"Expected 400 for missing match_id, got {resp.status_code}"
        
        print("Parameter validation working correctly")
    
    def test_manual_match_invalid_txn_index(self):
        """Test POST /api/bank-statements/{id}/manual-match rejects invalid txn_index"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        
        resp = requests.post(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/manual-match",
                            json={"txn_index": 999999, "match_type": "sale", "match_id": "test-id"},
                            headers=self.headers)
        assert resp.status_code == 400, f"Expected 400 for invalid txn_index, got {resp.status_code}"
    
    def test_manual_match_invalid_match_type(self):
        """Test POST /api/bank-statements/{id}/manual-match rejects invalid match_type"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        
        resp = requests.post(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/manual-match",
                            json={"txn_index": 0, "match_type": "invalid_type", "match_id": "test-id"},
                            headers=self.headers)
        assert resp.status_code == 400, f"Expected 400 for invalid match_type, got {resp.status_code}"
    
    def test_manual_match_nonexistent_record(self):
        """Test POST /api/bank-statements/{id}/manual-match handles nonexistent match_id"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        
        # Get an unmatched transaction
        unmatched_resp = requests.get(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/unmatched", headers=self.headers)
        if unmatched_resp.status_code != 200:
            pytest.skip("Could not get unmatched transactions")
        
        data = unmatched_resp.json()
        if data["total"] == 0:
            pytest.skip("No unmatched transactions")
        
        txn_index = data["unmatched"][0]["index"]
        
        # Try to match with nonexistent sale
        resp = requests.post(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/manual-match",
                            json={"txn_index": txn_index, "match_type": "sale", "match_id": "nonexistent-id-12345"},
                            headers=self.headers)
        assert resp.status_code == 404, f"Expected 404 for nonexistent match_id, got {resp.status_code}"
    
    def test_auto_match_endpoint(self):
        """Test POST /api/bank-statements/{id}/auto-match with tolerance and date_range params"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        
        # Test with custom tolerance and date_range
        resp = requests.post(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/auto-match?tolerance=5&date_range=3",
                            headers=self.headers)
        assert resp.status_code == 200, f"Auto-match failed: {resp.text}"
        data = resp.json()
        
        assert "matched" in data
        assert "unmatched" in data
        assert "stats" in data
        
        stats = data["stats"]
        assert "total_txns" in stats
        assert "auto_matched" in stats
        assert "unmatched" in stats
        
        print(f"Auto-match stats: total={stats['total_txns']}, matched={stats['auto_matched']}, unmatched={stats['unmatched']}")


class TestExistingAutoMatchFeatures:
    """Test existing auto-match related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and statement ID"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "ss@ssc.com",
            "password": "Aa147258369Ssc@"
        })
        assert login_resp.status_code == 200
        self.token = login_resp.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        stmt_resp = requests.get(f"{BASE_URL}/api/bank-statements", headers=self.headers)
        assert stmt_resp.status_code == 200
        statements = stmt_resp.json()
        self.stmt_id = statements[0].get("id") if statements else None
    
    def test_get_matches_endpoint(self):
        """Test GET /api/bank-statements/{id}/matches returns existing matches"""
        if not self.stmt_id:
            pytest.skip("No bank statement available")
        
        resp = requests.get(f"{BASE_URL}/api/bank-statements/{self.stmt_id}/matches", headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} existing matches")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
