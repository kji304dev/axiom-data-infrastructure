from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.app import app
from backend.scripts.smoke_test import (
    normalize_base_url,
    resolve_base_url,
    run_smoke_tests,
    summarize_grade_payload,
    validate_grade_payload,
    validate_health_payload,
    validate_summary_payload,
    validate_upload_payload,
)

MESSY_SAMPLE = Path("samples/aec_messy_sample.csv")


def test_normalize_base_url_strips_trailing_slash() -> None:
    assert normalize_base_url("http://127.0.0.1:8000/") == "http://127.0.0.1:8000"


def test_resolve_base_url_prefers_cli_value(monkeypatch) -> None:
    monkeypatch.setenv("ADI_API_BASE_URL", "http://example.com")
    assert resolve_base_url("http://127.0.0.1:8000") == "http://127.0.0.1:8000"


def test_resolve_base_url_reads_env_when_cli_missing(monkeypatch) -> None:
    monkeypatch.setenv("ADI_API_BASE_URL", "http://example.com/")
    assert resolve_base_url(None) == "http://example.com"


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
        "run_id": "abc123",
        "artifact_path": "runs/abc123/result.json",
        "artifact_uri": "local://runs/abc123/result.json",
        "summary": {
            "headline": "Demo",
            "data_grade": "C",
            "health_score": 50.0,
            "records_received": 2,
            "records_clean": 1,
            "records_flagged": 1,
            "top_issues": [],
            "recommended_next_steps": [],
        },
    }
    result = validate_upload_payload(payload)
    assert result.passed is True


def test_validate_summary_payload_requires_core_fields() -> None:
    result = validate_summary_payload({"data_grade": "A"})
    assert result.passed is False


def test_run_smoke_tests_against_local_app() -> None:
    with TestClient(app) as client:
        results = run_smoke_tests(client, csv_path=MESSY_SAMPLE)

    assert len(results) == 4
    assert all(result.passed for result in results), results
