from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

REQUIRED_AEC_FIELDS = (
    "ticket_id",
    "date",
    "customer",
    "material",
    "quantity",
    "unit",
    "job_site",
)


class Anomaly(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    row: int
    field: str
    issue: str
    severity: Literal["low", "medium", "high"] = "medium"


class Repair(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    row: int
    field: str
    original_value: str
    cleaned_value: str
    action_taken: str
    requires_review: bool = False
    confidence: float = 1.0


class HealthScoreExplanation(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    starting_score: int
    high_severity_anomaly_count: int
    medium_severity_anomaly_count: int
    review_required_repair_count: int
    confident_repair_count: int
    failed_record_count: int
    final_score: float


class ProcessingEvent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    node: Literal["analyzer", "transformer", "auditor", "validator", "complete"]
    status: Literal["start", "success", "retry", "failed"]
    message: str
    retry_count: int = 0
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class FailedRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    row: int
    reason: str
    record: dict[str, Any]


class AECRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    ticket_id: str
    date: str
    customer: str
    material: str
    quantity: float
    unit: str
    job_site: str


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    status: str
    service: str
    version: str


class GradeAECRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    records: list[dict[str, Any]]


class GradeAECResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    raw_records: list[dict[str, Any]]
    cleaned_records: list[AECRecord]
    repairs: list[Repair]
    anomalies: list[Anomaly]
    failed_records: list[FailedRecord]
    processing_history: list[ProcessingEvent]
    retry_count: int
    correction_instruction: str | None = None
    health_score: float
    health_score_explanation: HealthScoreExplanation
    validation_passed: bool
