from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from backend.core.schemas import (
    AECRecord,
    Anomaly,
    FailedRecord,
    HealthScoreExplanation,
    ProcessingEvent,
    Repair,
)


@dataclass
class EngineState:
    raw_records: list[dict[str, Any]]
    cleaned_records: list[AECRecord] = field(default_factory=list)
    repairs: list[Repair] = field(default_factory=list)
    anomalies: list[Anomaly] = field(default_factory=list)
    failed_records: list[FailedRecord] = field(default_factory=list)
    processing_history: list[ProcessingEvent] = field(default_factory=list)
    retry_count: int = 0
    correction_instruction: str | None = None
    health_score: float = 100.0
    health_score_explanation: HealthScoreExplanation | None = None
    validation_passed: bool = False
