from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.app import app
from backend.scripts.smoke_test import (
    normalize_base_url,
    run_smoke_tests,
    summarize_grade_payload,
    validate_grade_payload,
    validate_health_payload,
    validate_upload_payload,
)

DIRTY_SAMPLE = Path("samples/dirty_aec_ticket.csv")


def test_normalize_base_url_strips_trailing_slash() -> None:
    assert normalize_base_url("http://127.0.0.1:8000/") == "http://127.0.0.1:8000"


def test_validate_health_payload_accepts_ok_response() -> None:
    result = validate_health_payload(
        {"status": "ok", "service": "adi-backend", "version": "0.1.0"}
    )
    assert result.passed is True


def test_validate_grade_payload_requires_success_when_expected() -> None:
    payload = {
        "cleaned_records": [],
        "repairs": [],
        "anomalies": [],
        "failed_records": [],
        "processing_history": [],
        "retry_count": 0,
        "health_score": 100.0,
        "health_score_explanation": {},
        "validation_passed": False,
    }
    result = validate_grade_payload(payload, expect_success=True)
    assert result.passed is False


def test_summarize_grade_payload_omits_customer_values() -> None:
    summary = summarize_grade_payload(
        {
            "validation_passed": False,
            "cleaned_records": [{"customer": "Secret Customer Ltd"}],
            "failed_records": [{"record": {"customer": "Another Customer"}}],
            "repairs": [],
            "anomalies": [],
            "health_score": 42.0,
        }
    )
    assert "Secret Customer Ltd" not in summary
    assert "Another Customer" not in summary
    assert "cleaned=1 failed=1" in summary


def test_validate_upload_payload_expects_mixed_dirty_batch_shape() -> None:
    payload = {
        "cleaned_records": [{"ticket_id": "1001"}],
        "failed_records": [{"row": 3}],
        "validation_passed": False,
        "health_score": 50.0,
        "processing_history": [],
        "repairs": [],
        "anomalies": [],
    }
    result = validate_upload_payload(payload)
    assert result.passed is True


def test_run_smoke_tests_against_local_app() -> None:
    with TestClient(app) as client:
        results = run_smoke_tests(client, csv_path=DIRTY_SAMPLE)

    assert len(results) == 3
    assert all(result.passed for result in results), results
