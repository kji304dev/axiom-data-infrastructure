from fastapi.testclient import TestClient

from backend.api.app import app

client = TestClient(app)


def test_grade_aec_endpoint_success() -> None:
    response = client.post(
        "/grade/aec",
        json={
            "records": [
                {
                    "ticket_id": "1001",
                    "date": "2026-05-01",
                    "customer": "Acme",
                    "material": "Concrete",
                    "quantity": 5,
                    "unit": "yd3",
                    "job_site": "North Yard",
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_passed"] is True
    assert payload["cleaned_records"][0]["ticket_id"] == "1001"


def test_grade_aec_endpoint_unrecoverable() -> None:
    response = client.post(
        "/grade/aec",
        json={
            "records": [
                {
                    "ticket_id": "",
                    "date": "bad-date",
                    "customer": "",
                    "material": "Concrete",
                    "quantity": "not-a-number",
                    "unit": "",
                    "job_site": "",
                }
            ]
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_passed"] is False
    assert "retry_count" in payload
    assert isinstance(payload["retry_count"], int)
    assert payload["retry_count"] >= 0
    assert payload["health_score"] < 100
    assert payload["failed_records"] or payload["anomalies"]

    processing_nodes = {event["node"] for event in payload["processing_history"]}
    assert {"analyzer", "transformer", "auditor", "validator"}.issubset(
        processing_nodes
    )
