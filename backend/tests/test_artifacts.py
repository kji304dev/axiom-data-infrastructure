import json
from pathlib import Path

import pytest

from backend.core.schemas import GradeAECResponse, HealthScoreExplanation
from backend.storage.artifacts import (
    build_artifact_path,
    build_artifact_uri,
    persist_grade_result,
)
from backend.storage.local import LocalStorageBackend


def _sample_result() -> GradeAECResponse:
    return GradeAECResponse(
        raw_records=[{"ticket_id": "1001"}],
        cleaned_records=[],
        repairs=[],
        anomalies=[],
        failed_records=[],
        processing_history=[],
        retry_count=0,
        health_score=100.0,
        health_score_explanation=HealthScoreExplanation(
            starting_score=100,
            high_severity_anomaly_count=0,
            medium_severity_anomaly_count=0,
            review_required_repair_count=0,
            confident_repair_count=0,
            failed_record_count=0,
            final_score=100.0,
        ),
        validation_passed=True,
    )


def test_build_artifact_path_uses_run_id() -> None:
    assert build_artifact_path("abc123") == "runs/abc123/result.json"


def test_build_artifact_uri_uses_local_scheme() -> None:
    assert build_artifact_uri("runs/abc123/result.json") == (
        "local://runs/abc123/result.json"
    )


def test_persist_grade_result_writes_enriched_payload(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    result = _sample_result()

    enriched = persist_grade_result(storage, result, run_id="run-test-1")

    assert enriched.run_id == "run-test-1"
    assert enriched.artifact_path == "runs/run-test-1/result.json"
    assert enriched.artifact_uri == "local://runs/run-test-1/result.json"
    assert storage.exists("runs/run-test-1/result.json") is True

    written = json.loads(
        (tmp_path / "runs/run-test-1/result.json").read_text(encoding="utf-8")
    )
    assert written["run_id"] == "run-test-1"
    assert written["artifact_path"] == "runs/run-test-1/result.json"
    assert written["validation_passed"] is True


def test_persist_grade_result_generates_run_id(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)

    enriched = persist_grade_result(storage, _sample_result())

    assert enriched.run_id
    assert enriched.artifact_path == build_artifact_path(enriched.run_id)
    assert storage.exists(enriched.artifact_path) is True
