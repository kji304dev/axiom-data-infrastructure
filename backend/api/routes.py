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
from backend.storage.artifacts import persist_grade_result
from backend.storage.base import StorageBackend
from backend.storage.deps import get_storage_backend

router = APIRouter()


def _grade_and_persist(
    records: list[dict[str, Any]],
    storage: StorageBackend,
) -> GradeAECResponse:
    result = run_aec_grading(records)
    return persist_grade_result(storage, result)


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
    return _grade_and_persist(payload.records, storage)


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

    return _grade_and_persist(records, storage)
