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
    assert payload["failed_records"] == []


def test_grade_aec_endpoint_unrecoverable() -> None:
    raw_record = {
        "ticket_id": "",
        "date": "bad-date",
        "customer": "",
        "material": "Concrete",
        "quantity": "not-a-number",
        "unit": "",
        "job_site": "",
    }
    response = client.post(
        "/grade/aec",
        json={"records": [raw_record]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_passed"] is False
    assert payload["retry_count"] == 2
    assert payload["health_score"] < 100
    assert len(payload["failed_records"]) == 1
    assert payload["failed_records"][0]["record"] == raw_record
    assert payload["failed_records"][0]["reason"]

    processing_nodes = {event["node"] for event in payload["processing_history"]}
    assert {"analyzer", "transformer", "auditor", "validator"}.issubset(
        processing_nodes
    )
    assert any(event["status"] == "retry" for event in payload["processing_history"])
    assert any(
        "Dead-lettered" in event["message"]
        for event in payload["processing_history"]
    )
