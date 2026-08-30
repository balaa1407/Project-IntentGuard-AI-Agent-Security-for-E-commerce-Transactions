import uuid


def test_intent_extract_and_confirm_flow(client):
    # 1. Extract intent from prompt
    res = client.post("/api/v1/intent/extract", json={
        "prompt": "Buy a gaming laptop under ₹80,000 with 16GB RAM from a trusted seller"
    })
    assert res.status_code == 200
    intent = res.json()
    assert intent["max_price"] == 80000.0
    assert intent["ram_min"] == 16
    assert intent["seller_requirement"] == "trusted"

    # 2. Confirm into immutable authorization contract
    confirm_res = client.post("/api/v1/intent/confirm", json={
        "prompt": "Buy a gaming laptop under ₹80,000 with 16GB RAM from a trusted seller",
        "intent": intent,
        "ttl_minutes": 120
    })
    assert confirm_res.status_code == 200
    contract = confirm_res.json()
    assert contract["status"] == "ACTIVE"
    assert len(contract["hash_fingerprint"]) == 64
    assert len(contract["signature"]) == 64

    # 3. Submit transaction conforming to contract -> APPROVE & Captured
    tx_res = client.post("/api/v1/transactions/submit", json={
        "contract_id": contract["id"],
        "idempotency_key": str(uuid.uuid4()),
        "agent_id": "shopping-agent-01",
        "merchant_name": "ASUS Official Store",
        "seller_id": "seller_asus_01",
        "seller_trust_level": "verified",
        "product_name": "ASUS TUF Gaming Laptop",
        "category": "gaming laptop",
        "price": 75000.0,
        "currency": "INR",
        "quantity": 1,
        "ram_gb": 16
    })
    assert tx_res.status_code == 200
    tx_data = tx_res.json()
    assert tx_data["decision"] == "APPROVE"
    assert tx_data["status"] == "PAYMENT_SUCCESS"
    assert tx_data["payment_reference"].startswith("pay_mock_rzp_")

    # 4. Verify audit ledger integrity
    audit_res = client.get("/api/v1/audit/verify")
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["is_valid"] is True, f"Audit message: {audit_data.get('message')}"
    assert audit_data["total_events"] >= 3


def test_simulation_run_endpoint(client):
    res = client.post("/api/v1/simulation/run/core_gaming_laptop_drift")
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "BLOCK"
    assert data["expected_decision"] == "BLOCK"
    assert len(data["violations"]) >= 3
    v_codes = [v["code"] for v in data["violations"]]
    assert "BUDGET_EXCEEDED" in v_codes
    assert "SELLER_NOT_TRUSTED" in v_codes
    assert "PRODUCT_REQUIREMENTS_VIOLATED" in v_codes


def test_analytics_overview_endpoint(client):
    res = client.get("/api/v1/analytics/overview")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "OPERATIONAL"
    assert data["mode"] == "SANDBOX"
    assert "total_transactions" in data
    assert "violations_breakdown" in data
