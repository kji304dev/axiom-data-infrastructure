from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.app import app
from backend.api.routes import get_storage_backend
from backend.engine.scoring import (
    CONFIDENT_REPAIR_PENALTY,
    FAILED_RECORD_PENALTY,
    HIGH_ANOMALY_PENALTY,
    MEDIUM_ANOMALY_PENALTY,
    REVIEW_REPAIR_PENALTY,
    STARTING_SCORE,
)
from backend.storage.local import LocalStorageBackend

client = TestClient(app)

DIRTY_SAMPLE_CSV = Path("samples/dirty_aec_ticket.csv").read_text(encoding="utf-8")

VALID_CSV = """ticket_id,date,customer,material,quantity,unit,job_site
1002,05/02/26,Acme Builders,Gravel,-4,tons,North Yard
"""

UNRECOVERABLE_CSV = """ticket_id,date,customer,material,quantity,unit,job_site
,bad-date,,Concrete,not-a-number,,
"""


@pytest.fixture
def artifact_client(tmp_path: Path) -> tuple[TestClient, Path]:
    app.dependency_overrides[get_storage_backend] = lambda: LocalStorageBackend(
        tmp_path
    )
    yield TestClient(app), tmp_path
    app.dependency_overrides.clear()


def _assert_artifact_metadata(payload: dict) -> None:
    assert payload["run_id"]
    assert payload["artifact_path"] == f"runs/{payload['run_id']}/result.json"
    assert payload["artifact_uri"] == f"local://{payload['artifact_path']}"


def _validator_messages(payload: dict) -> list[str]:
    return [
        event["message"]
        for event in payload["processing_history"]
        if event["node"] == "validator"
    ]


def test_root_endpoint() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "service": "adi-backend",
        "status": "ok",
        "health": "/health",
        "docs": "/docs",
        "json_endpoint": "/grade/aec",
        "csv_upload_endpoint": "/grade/aec/upload",
    }


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "adi-backend",
        "version": "0.1.0",
    }


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
    validator_messages = _validator_messages(payload)
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


def test_grade_aec_upload_dirty_csv_with_failed_records() -> None:
    response = client.post(
        "/grade/aec/upload",
        files={"file": ("dirty_aec_ticket.csv", DIRTY_SAMPLE_CSV, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_passed"] is False
    assert len(payload["failed_records"]) == 1
    assert payload["failed_records"][0]["record"]["ticket_id"] == "1003"
    assert payload["failed_records"][0]["record"]["date"] == "bad-date"
    assert len(payload["cleaned_records"]) == 3

    cleaned_dates = [record["date"] for record in payload["cleaned_records"]]
    assert "2026-05-01" in cleaned_dates
    assert "2026-05-04" in cleaned_dates
    assert "1970-01-01" not in cleaned_dates
    assert all(
        repair["cleaned_value"] != "1970-01-01" for repair in payload["repairs"]
    )

    validator_messages = _validator_messages(payload)
    assert "Final validation passed" not in validator_messages
    assert any("dead-lettered records" in message for message in validator_messages)


def test_grade_aec_persists_result_artifact(
    artifact_client: tuple[TestClient, Path],
) -> None:
    client_with_storage, storage_root = artifact_client
    response = client_with_storage.post(
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
    _assert_artifact_metadata(payload)

    artifact_file = storage_root / payload["artifact_path"]
    assert artifact_file.is_file()
    assert artifact_file.read_text(encoding="utf-8")


def test_grade_aec_upload_persists_result_artifact(
    artifact_client: tuple[TestClient, Path],
) -> None:
    client_with_storage, storage_root = artifact_client
    response = client_with_storage.post(
        "/grade/aec/upload",
        files={"file": ("dirty.csv", VALID_CSV, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    _assert_artifact_metadata(payload)

    artifact_file = storage_root / payload["artifact_path"]
    assert artifact_file.is_file()
    assert artifact_file.read_text(encoding="utf-8")


def test_grade_aec_upload_reuses_same_grading_engine_as_json() -> None:
    record = {
        "ticket_id": "1002",
        "date": "05/02/26",
        "customer": "Acme Builders",
        "material": "Gravel",
        "quantity": "-4",
        "unit": "tons",
        "job_site": "North Yard",
    }
    json_response = client.post("/grade/aec", json={"records": [record]})
    upload_response = client.post(
        "/grade/aec/upload",
        files={"file": ("repairable.csv", VALID_CSV, "text/csv")},
    )

    assert json_response.status_code == 200
    assert upload_response.status_code == 200
    assert upload_response.json()["cleaned_records"] == json_response.json()["cleaned_records"]
    assert upload_response.json()["validation_passed"] == json_response.json()["validation_passed"]
    assert upload_response.json()["health_score"] == json_response.json()["health_score"]


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
    validator_messages = _validator_messages(payload)
    assert "Final validation passed" not in validator_messages
    assert any(
        "dead-lettered records" in message
        or "failed records" in message.lower()
        or "no active cleaned records" in message.lower()
        for message in validator_messages
    )
