from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.core.schemas import GradeAECRequest, GradeAECResponse, HealthResponse
from backend.engine.graph import run_aec_grading
from backend.io.csv_parser import CsvParseError, parse_csv_records

router = APIRouter()

ADI_BACKEND_VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="adi-backend",
        version=ADI_BACKEND_VERSION,
    )


@router.post("/grade/aec", response_model=GradeAECResponse)
def grade_aec(payload: GradeAECRequest) -> GradeAECResponse:
    return run_aec_grading(payload.records)


@router.post("/grade/aec/upload", response_model=GradeAECResponse)
async def grade_aec_upload(
    file: UploadFile | None = File(default=None),
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

    return run_aec_grading(records)
