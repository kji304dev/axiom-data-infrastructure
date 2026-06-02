from fastapi.testclient import TestClient

from backend.api.app import app
from backend.engine.scoring import (
    CONFIDENT_REPAIR_PENALTY,
    FAILED_RECORD_PENALTY,
    HIGH_ANOMALY_PENALTY,
    MEDIUM_ANOMALY_PENALTY,
    REVIEW_REPAIR_PENALTY,
    STARTING_SCORE,
)

client = TestClient(app)


def _expected_final_score(explanation: dict) -> float:
    score = (
        explanation["starting_score"]
        - (explanation["high_severity_anomaly_count"] * HIGH_ANOMALY_PENALTY)
        - (explanation["medium_severity_anomaly_count"] * MEDIUM_ANOMALY_PENALTY)
        - (explanation["review_required_repair_count"] * REVIEW_REPAIR_PENALTY)
        - (explanation["confident_repair_count"] * CONFIDENT_REPAIR_PENALTY)
        - (explanation["failed_record_count"] * FAILED_RECORD_PENALTY)
    )
    return float(max(0, min(100, score)))


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
    assert payload["health_score"] == 100
    explanation = payload["health_score_explanation"]
    assert explanation["starting_score"] == STARTING_SCORE
    assert explanation["final_score"] == payload["health_score"]
    assert explanation["final_score"] == _expected_final_score(explanation)


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
    assert payload["health_score"] <= 40
    assert len(payload["failed_records"]) == 1
    assert payload["failed_records"][0]["record"] == raw_record
    assert payload["failed_records"][0]["reason"]

    explanation = payload["health_score_explanation"]
    assert explanation["failed_record_count"] == 1
    assert explanation["final_score"] == payload["health_score"]
    assert explanation["final_score"] == _expected_final_score(explanation)

    processing_nodes = {event["node"] for event in payload["processing_history"]}
    assert {"analyzer", "transformer", "auditor", "validator"}.issubset(
        processing_nodes
    )
    assert any(event["status"] == "retry" for event in payload["processing_history"])
    assert any(
        "Dead-lettered" in event["message"]
        for event in payload["processing_history"]
    )
