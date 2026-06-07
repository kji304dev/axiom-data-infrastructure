from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from backend.core.config import ADI_ENGINE_VERSION
from backend.core.schemas import (
    GradeAECRequest,
    GradeAECResponse,
    HealthResponse,
    RootResponse,
)
from backend.engine.graph import run_aec_grading
from backend.io.csv_parser import CsvParseError, parse_csv_records
from backend.storage.artifacts import load_artifact_json, persist_grade_result
from backend.storage.base import StorageBackend
from backend.storage.deps import get_storage_backend
from backend.storage.run_index import (
    RunHistoryResponse,
    RunIndexEntry,
    RunInputType,
    append_run_index_entry,
    build_run_index_entry,
    get_run_index_entry,
    list_run_index_entries,
)

router = APIRouter()


def _grade_and_persist(
    records: list[dict[str, Any]],
    storage: StorageBackend,
    *,
    input_type: RunInputType,
) -> GradeAECResponse:
    result = run_aec_grading(records)
    enriched = persist_grade_result(storage, result)
    append_run_index_entry(
        storage,
        build_run_index_entry(
            enriched,
            input_type=input_type,
            record_count=len(records),
        ),
    )
    return enriched


@router.get("/runs", response_model=RunHistoryResponse)
def list_runs(
    storage: StorageBackend = Depends(get_storage_backend),
) -> RunHistoryResponse:
    return RunHistoryResponse(
        runs=[RunIndexEntry.model_validate(entry) for entry in list_run_index_entries(storage)]
    )


@router.get("/runs/{run_id}/artifact", response_model=GradeAECResponse)
def get_run_artifact(
    run_id: str,
    storage: StorageBackend = Depends(get_storage_backend),
) -> GradeAECResponse:
    entry = get_run_index_entry(storage, run_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Run not found")

    artifact = load_artifact_json(storage, entry["artifact_uri"])
    if artifact is None:
        raise HTTPException(status_code=410, detail="Run artifact not found")

    return GradeAECResponse.model_validate(artifact)


@router.get("/runs/{run_id}", response_model=RunIndexEntry)
def get_run(
    run_id: str,
    storage: StorageBackend = Depends(get_storage_backend),
) -> RunIndexEntry:
    entry = get_run_index_entry(storage, run_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunIndexEntry.model_validate(entry)


@router.get("/", response_model=RootResponse)
def root() -> RootResponse:
    return RootResponse(
        service="adi-backend",
        status="ok",
        health="/health",
        docs="/docs",
        json_endpoint="/grade/aec",
        csv_upload_endpoint="/grade/aec/upload",
    )


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="adi-backend",
        version=ADI_ENGINE_VERSION,
    )


@router.post("/grade/aec", response_model=GradeAECResponse)
def grade_aec(
    payload: GradeAECRequest,
    storage: StorageBackend = Depends(get_storage_backend),
) -> GradeAECResponse:
    return _grade_and_persist(payload.records, storage, input_type="json")


@router.post("/grade/aec/upload", response_model=GradeAECResponse)
async def grade_aec_upload(
    file: UploadFile | None = File(default=None),
    storage: StorageBackend = Depends(get_storage_backend),
) -> GradeAECResponse:
    if file is None:
        raise HTTPException(status_code=400, detail="File must be present")

    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Filename must end with .csv")

    content = await file.read()
    if not content or not content.strip():
        raise HTTPException(status_code=400, detail="File must not be empty")

    try:
        records = parse_csv_records(content.decode("utf-8"))
    except CsvParseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except UnicodeDecodeError as error:
        raise HTTPException(
            status_code=400, detail="File must be valid UTF-8 CSV"
        ) from error

    return _grade_and_persist(records, storage, input_type="csv_upload")
