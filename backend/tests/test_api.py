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

VALID_CSV = """ticket_id,date,customer,material,quantity,unit,job_site
1002,05/02/26,Acme Builders,Gravel,-4,tons,North Yard
"""

UNRECOVERABLE_CSV = """ticket_id,date,customer,material,quantity,unit,job_site
,bad-date,,Concrete,not-a-number,,
"""

MIXED_CSV = """ticket_id,date,customer,material,quantity,unit,job_site
1001,2026-05-01,Acme Builders,Concrete,12,yd3,North Yard
1003,bad-date,River Works,Asphalt,8,tons,Lot 7
1004,2026-05-04,Delta Construction,Sand,15,tons,South Yard
"""


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
    validator_messages = [
        event["message"]
        for event in payload["processing_history"]
        if event["node"] == "validator"
    ]
    assert "Final validation passed" not in validator_messages
    assert any(
        "dead-lettered records" in message
        or "failed records" in message.lower()
        or "no active cleaned records" in message.lower()
        for message in validator_messages
    )


def test_grade_aec_upload_success() -> None:
    response = client.post(
        "/grade/aec/upload",
        files={"file": ("dirty.csv", VALID_CSV, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_passed"] is True
    assert payload["cleaned_records"][0]["ticket_id"] == "1002"
    assert payload["cleaned_records"][0]["date"] == "2026-05-02"
    assert payload["cleaned_records"][0]["quantity"] == 4.0
    assert payload["failed_records"] == []
    assert "health_score_explanation" in payload
    assert "processing_history" in payload


def test_grade_aec_upload_missing_file() -> None:
    response = client.post("/grade/aec/upload")

    assert response.status_code == 400
    assert response.json()["detail"] == "File must be present"


def test_grade_aec_upload_empty_file() -> None:
    response = client.post(
        "/grade/aec/upload",
        files={"file": ("empty.csv", "", "text/csv")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "File must not be empty"


def test_grade_aec_upload_non_csv_filename() -> None:
    response = client.post(
        "/grade/aec/upload",
        files={"file": ("records.txt", VALID_CSV, "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Filename must end with .csv"


def test_grade_aec_upload_unrecoverable_csv() -> None:
    response = client.post(
        "/grade/aec/upload",
        files={"file": ("bad.csv", UNRECOVERABLE_CSV, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_passed"] is False
    assert payload["retry_count"] == 2
    assert len(payload["failed_records"]) == 1
    assert payload["failed_records"][0]["record"]["date"] == "bad-date"
    assert payload["health_score"] <= 40
    assert all(
        repair["cleaned_value"] != "1970-01-01" for repair in payload["repairs"]
    )
    validator_messages = [
        event["message"]
        for event in payload["processing_history"]
        if event["node"] == "validator"
    ]
    assert "Final validation passed" not in validator_messages
    assert any(
        "dead-lettered records" in message
        or "failed records" in message.lower()
        or "no active cleaned records" in message.lower()
        for message in validator_messages
    )


def test_grade_aec_upload_preserves_valid_iso_dates_in_mixed_csv() -> None:
    response = client.post(
        "/grade/aec/upload",
        files={"file": ("dirty.csv", MIXED_CSV, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_passed"] is False
    assert len(payload["failed_records"]) == 1
    assert payload["failed_records"][0]["record"]["date"] == "bad-date"
    cleaned_dates = [record["date"] for record in payload["cleaned_records"]]
    assert "2026-05-01" in cleaned_dates
    assert "2026-05-04" in cleaned_dates
    assert "1970-01-01" not in cleaned_dates
    assert all(
        repair["cleaned_value"] != "1970-01-01" for repair in payload["repairs"]
    )
    validator_messages = [
        event["message"]
        for event in payload["processing_history"]
        if event["node"] == "validator"
    ]
    assert "Final validation passed" not in validator_messages
    assert any(
        "dead-lettered records" in message
        or "failed records" in message.lower()
        or "no active cleaned records" in message.lower()
        for message in validator_messages
    )
