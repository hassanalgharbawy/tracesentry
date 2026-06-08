from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)

SCENARIOS = {
    "database_latency": "database",
    "auth_failure": "auth-service",
    "payment_timeout": "payment-service",
    "api_gateway_spike": "api-gateway",
    "network_packet_loss": "network",
}


def test_health_returns_seeded_data():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service_count"] == 6


def test_simulation_generates_incident():
    client.post("/api/reset")
    response = client.post("/api/simulate/database_latency")
    assert response.status_code == 200
    body = response.json()
    assert body["scenario"] == "database_latency"
    assert body["incident"]["analysis"]["likely_root_cause"] == "database"


def test_core_endpoints_and_all_scenarios():
    client.post("/api/reset")

    for path in ["/api/services", "/api/metrics", "/api/logs", "/api/incidents"]:
        response = client.get(path)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    for scenario, expected_root in SCENARIOS.items():
        reset_response = client.post("/api/reset")
        assert reset_response.status_code == 200

        response = client.post(f"/api/simulate/{scenario}")
        assert response.status_code == 200

        body = response.json()
        assert body["scenario"] == scenario

        actual_root = body["incident"]["analysis"]["likely_root_cause"]
        assert actual_root == expected_root, (
            f"scenario={scenario}, expected={expected_root}, got={actual_root}"
        )

    response = client.post("/api/reset")
    assert response.status_code == 200
    assert response.json()["status"] == "reset"

