from __future__ import annotations

import logging
from typing import Any

from backend.agents.analyzer import analyze_records
from backend.agents.auditor import audit_records
from backend.agents.transformer import transform_records
from backend.core.config import MAX_RETRIES, configure_logging
from backend.core.schemas import FailedRecord, GradeAECResponse, ProcessingEvent
from backend.engine.state import EngineState
from backend.engine.validation import deterministic_final_validation

configure_logging()
logger = logging.getLogger("adi.backend.engine")


def _log_transition(node: str, status: str, message: str, retry_count: int) -> ProcessingEvent:
    payload = {
        "node": node,
        "status": status,
        "message": message,
        "retry_count": retry_count,
    }
    logger.info("state_transition", extra={"transition": payload})
    return ProcessingEvent(
        node=node, status=status, message=message, retry_count=retry_count
    )


def _dead_letter_failed_rows(state: EngineState, failure_message: str) -> None:
    for row_idx, record in enumerate(state.raw_records, start=1):
        state.failed_records.append(
            FailedRecord(row=row_idx, reason=failure_message, record=record)
        )
    state.cleaned_records = []


def run_aec_grading(records: list[dict[str, Any]]) -> GradeAECResponse:
    state = EngineState(raw_records=records)

    state.processing_history.append(
        _log_transition("analyzer", "start", "Running anomaly analysis", state.retry_count)
    )
    state.anomalies = analyze_records(state.raw_records)
    state.processing_history.append(
        _log_transition(
            "analyzer",
            "success",
            f"Analyzer detected {len(state.anomalies)} anomalies",
            state.retry_count,
        )
    )

    while True:
        state.processing_history.append(
            _log_transition(
                "transformer",
                "start",
                "Applying deterministic transformations",
                state.retry_count,
            )
        )
        state.cleaned_records, new_repairs = transform_records(
            state.raw_records, state.correction_instruction
        )
        state.repairs.extend(new_repairs)
        state.processing_history.append(
            _log_transition(
                "transformer",
                "success",
                f"Transformer produced {len(state.cleaned_records)} cleaned records",
                state.retry_count,
            )
        )

        state.processing_history.append(
            _log_transition(
                "auditor", "start", "Auditing transformed output", state.retry_count
            )
        )
        passed_audit, correction_instruction = audit_records(state.cleaned_records)
        if passed_audit:
            state.correction_instruction = None
            state.processing_history.append(
                _log_transition(
                    "auditor", "success", "Audit passed", state.retry_count
                )
            )
            break

        state.correction_instruction = correction_instruction
        if state.retry_count < MAX_RETRIES:
            state.retry_count += 1
            state.processing_history.append(
                _log_transition(
                    "auditor",
                    "retry",
                    f"Audit failed; correction required: {correction_instruction}",
                    state.retry_count,
                )
            )
            continue

        state.processing_history.append(
            _log_transition(
                "auditor",
                "failed",
                f"Audit failed after max retries: {correction_instruction}",
                state.retry_count,
            )
        )
        _dead_letter_failed_rows(state, correction_instruction or "Audit failed")
        break

    state.processing_history.append(
        _log_transition(
            "validator",
            "start",
            "Running deterministic final validation",
            state.retry_count,
        )
    )
    validation_passed, validation_errors = deterministic_final_validation(
        state.cleaned_records
    )
    if state.failed_records:
        validation_passed = False
        validation_errors.append("failed_records is not empty")
    state.validation_passed = validation_passed
    state.health_score = max(0.0, 100.0 - (len(state.anomalies) * 10.0) - (len(validation_errors) * 15.0))

    if validation_passed:
        state.processing_history.append(
            _log_transition("validator", "success", "Final validation passed", state.retry_count)
        )
    else:
        state.processing_history.append(
            _log_transition(
                "validator",
                "failed",
                f"Final validation failed: {'; '.join(validation_errors)}",
                state.retry_count,
            )
        )
        if not state.failed_records:
            _dead_letter_failed_rows(
                state, "Final deterministic validation failed"
            )

    state.processing_history.append(
        _log_transition("complete", "success", "Workflow completed", state.retry_count)
    )
    return GradeAECResponse(
        raw_records=state.raw_records,
        cleaned_records=state.cleaned_records,
        repairs=state.repairs,
        anomalies=state.anomalies,
        failed_records=state.failed_records,
        processing_history=state.processing_history,
        retry_count=state.retry_count,
        correction_instruction=state.correction_instruction,
        health_score=state.health_score,
        validation_passed=state.validation_passed,
    )
