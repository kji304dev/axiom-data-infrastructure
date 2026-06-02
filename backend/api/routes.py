from fastapi import APIRouter

from backend.core.schemas import GradeAECRequest, GradeAECResponse
from backend.engine.graph import run_aec_grading

router = APIRouter()


@router.post("/grade/aec", response_model=GradeAECResponse)
def grade_aec(payload: GradeAECRequest) -> GradeAECResponse:
    return run_aec_grading(payload.records)
