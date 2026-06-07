from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict

from backend.core.schemas import GradeAECResponse
from backend.storage.base import StorageBackend

RUN_INDEX_PATH = "run_index.json"
RunInputType = Literal["json", "csv_upload"]


class RunIndexEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    run_id: str
    created_at: str
    input_type: RunInputType
    record_count: int
    artifact_uri: str
    health_score: float
    validation_passed: bool
    failed_record_count: int


class RunHistoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    runs: list[RunIndexEntry]


def list_run_index_entries(storage: StorageBackend) -> list[dict]:
    return [entry.model_dump(mode="json") for entry in load_run_index(storage)]


def get_run_index_entry(storage: StorageBackend, run_id: str) -> dict | None:
    for entry in load_run_index(storage):
        if entry.run_id == run_id:
            return entry.model_dump(mode="json")
    return None


def build_run_index_entry(
    result: GradeAECResponse,
    *,
    input_type: RunInputType,
    record_count: int,
    created_at: str | None = None,
) -> RunIndexEntry:
    if not result.run_id or not result.artifact_uri:
        raise ValueError("grade result must include run_id and artifact_uri")

    return RunIndexEntry(
        run_id=result.run_id,
        created_at=created_at
        or datetime.now(timezone.utc).isoformat(),
        input_type=input_type,
        record_count=record_count,
        artifact_uri=result.artifact_uri,
        health_score=result.health_score,
        validation_passed=result.validation_passed,
        failed_record_count=len(result.failed_records),
    )


def load_run_index(storage: StorageBackend) -> list[RunIndexEntry]:
    if not storage.exists(RUN_INDEX_PATH):
        return []

    payload = storage.read_json(RUN_INDEX_PATH)
    runs = payload.get("runs", [])
    if not isinstance(runs, list):
        raise ValueError(f"expected list at {RUN_INDEX_PATH}.runs")

    return [RunIndexEntry.model_validate(entry) for entry in runs]


def append_run_index_entry(
    storage: StorageBackend,
    entry: RunIndexEntry,
) -> RunIndexEntry:
    runs = load_run_index(storage)
    runs.append(entry)
    storage.write_json(
        RUN_INDEX_PATH,
        {"runs": [run.model_dump(mode="json") for run in runs]},
    )
    return entry
