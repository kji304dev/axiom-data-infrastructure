import json
from pathlib import Path

from backend.core.schemas import FailedRecord, GradeAECResponse, HealthScoreExplanation
from backend.storage.local import LocalStorageBackend
from backend.storage.run_index import (
    RUN_INDEX_PATH,
    RunIndexEntry,
    append_run_index_entry,
    build_run_index_entry,
    load_run_index,
)


def _sample_enriched_result(*, failed_count: int = 0) -> GradeAECResponse:
    return GradeAECResponse(
        raw_records=[{"ticket_id": "1001"}],
        cleaned_records=[],
        repairs=[],
        anomalies=[],
        failed_records=[
            FailedRecord(row=idx, reason="bad", record={})
            for idx in range(1, failed_count + 1)
        ],
        processing_history=[],
        retry_count=0,
        health_score=80.0,
        health_score_explanation=HealthScoreExplanation(
            starting_score=100,
            high_severity_anomaly_count=0,
            medium_severity_anomaly_count=0,
            review_required_repair_count=0,
            confident_repair_count=0,
            failed_record_count=failed_count,
            final_score=80.0,
        ),
        validation_passed=failed_count == 0,
        run_id="run-1",
        artifact_path="runs/run-1/result.json",
        artifact_uri="local://runs/run-1/result.json",
    )


def test_build_run_index_entry_captures_failed_record_count() -> None:
    entry = build_run_index_entry(
        _sample_enriched_result(failed_count=2),
        input_type="csv_upload",
        record_count=4,
        created_at="2026-06-02T12:00:00+00:00",
    )

    assert entry.failed_record_count == 2
    assert entry.input_type == "csv_upload"
    assert entry.record_count == 4


def test_append_run_index_entry_appends_without_overwriting(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    first = RunIndexEntry(
        run_id="run-a",
        created_at="2026-06-02T12:00:00+00:00",
        input_type="json",
        record_count=1,
        artifact_uri="local://runs/run-a/result.json",
        health_score=100.0,
        validation_passed=True,
        failed_record_count=0,
    )
    second = RunIndexEntry(
        run_id="run-b",
        created_at="2026-06-02T12:01:00+00:00",
        input_type="csv_upload",
        record_count=3,
        artifact_uri="local://runs/run-b/result.json",
        health_score=50.0,
        validation_passed=False,
        failed_record_count=1,
    )

    append_run_index_entry(storage, first)
    append_run_index_entry(storage, second)

    runs = load_run_index(storage)
    assert [run.run_id for run in runs] == ["run-a", "run-b"]
    assert runs[1].failed_record_count == 1

    index_payload = json.loads(
        (tmp_path / RUN_INDEX_PATH).read_text(encoding="utf-8")
    )
    assert len(index_payload["runs"]) == 2
