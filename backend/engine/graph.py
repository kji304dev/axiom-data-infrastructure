from __future__ import annotations

import logging
from typing import Any

from backend.agents.analyzer import analyze_records
from backend.agents.auditor import audit_records
from backend.agents.transformer import transform_records
from backend.core.config import MAX_RETRIES, configure_logging
from backend.core.schemas import FailedRecord, GradeAECResponse, ProcessingEvent
from backend.engine.state import EngineState
from backend.engine.scoring import calculate_health_score
from backend.engine.validation import deterministic_final_validation

configure_logging()
logger = logging.getLogger("adi.backend.engine")


def _log_transition(
    node: str, status: str, message: str, retry_count: int
) -> ProcessingEvent:
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


def _format_row_failures(failures: dict[int, str]) -> str:
    return " ; ".join(
        f"row {row}: {reason}" for row, reason in sorted(failures.items())
    )


def _dead_lettered_rows(state: EngineState) -> set[int]:
    return {failed.row for failed in state.failed_records}


def _dead_letter_unresolved_rows(
    state: EngineState,
    row_failures: dict[int, str],
) -> None:
    failed_row_numbers = set(row_failures.keys())
    for row_idx, reason in sorted(row_failures.items()):
        if row_idx in _dead_lettered_rows(state):
            continue
        state.failed_records.append(
            FailedRecord(
                row=row_idx,
                reason=reason,
                record=dict(state.raw_records[row_idx - 1]),
            )
        )

    state.cleaned_records = [
        record
        for idx, record in enumerate(state.cleaned_records, start=1)
        if idx not in failed_row_numbers
    ]


def _active_cleaned_records(
    cleaned_records: list[Any],
    skip_rows: set[int],
) -> list[Any]:
    return [
        record
        for idx, record in enumerate(cleaned_records, start=1)
        if idx not in skip_rows
    ]


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
        all_cleaned, new_repairs = transform_records(
            state.raw_records, state.correction_instruction
        )
        state.repairs.extend(new_repairs)
        skip_rows = _dead_lettered_rows(state)
        state.cleaned_records = _active_cleaned_records(all_cleaned, skip_rows)
        state.processing_history.append(
            _log_transition(
                "transformer",
                "success",
                f"Transformer produced {len(state.cleaned_records)} active cleaned records",
                state.retry_count,
            )
        )

        state.processing_history.append(
            _log_transition(
                "auditor", "start", "Auditing transformed output", state.retry_count
            )
        )
        passed_audit, audit_failures = audit_records(all_cleaned, skip_rows=skip_rows)
        if not passed_audit:
            state.correction_instruction = _format_row_failures(audit_failures)
            if state.retry_count < MAX_RETRIES:
                state.retry_count += 1
                state.processing_history.append(
                    _log_transition(
                        "auditor",
                        "retry",
                        f"Audit failed; correction required: {state.correction_instruction}",
                        state.retry_count,
                    )
                )
                continue

            _dead_letter_unresolved_rows(state, audit_failures)
            state.processing_history.append(
                _log_transition(
                    "auditor",
                    "failed",
                    (
                        "Dead-lettered "
                        f"{len(audit_failures)} unresolved record(s) after max retries: "
                        f"{state.correction_instruction}"
                    ),
                    state.retry_count,
                )
            )
        else:
            state.correction_instruction = None
            state.processing_history.append(
                _log_transition(
                    "auditor", "success", "Audit passed", state.retry_count
                )
            )

        skip_rows = _dead_lettered_rows(state)
        active_cleaned = _active_cleaned_records(all_cleaned, skip_rows)

        state.processing_history.append(
            _log_transition(
                "validator",
                "start",
                "Running deterministic final validation",
                state.retry_count,
            )
        )

        if not active_cleaned:
            validation_passed = False
            validation_errors: dict[int, str] = {}
            state.processing_history.append(
                _log_transition(
                    "validator",
                    "failed",
                    "No active cleaned records available for final validation",
                    state.retry_count,
                )
            )
        else:
            validation_passed, validation_errors = deterministic_final_validation(
                all_cleaned, skip_rows=skip_rows
            )

        if validation_passed:
            state.processing_history.append(
                _log_transition(
                    "validator", "success", "Final validation passed", state.retry_count
                )
            )
            break

        state.correction_instruction = _format_row_failures(validation_errors)
        if state.retry_count < MAX_RETRIES:
            state.retry_count += 1
            state.processing_history.append(
                _log_transition(
                    "validator",
                    "retry",
                    (
                        "Final validation failed; correction required: "
                        f"{state.correction_instruction}"
                    ),
                    state.retry_count,
                )
            )
            continue

        _dead_letter_unresolved_rows(state, validation_errors)
        state.processing_history.append(
            _log_transition(
                "validator",
                "failed",
                (
                    "Dead-lettered "
                    f"{len(validation_errors)} unresolved record(s) after max retries: "
                    f"{state.correction_instruction}"
                ),
                state.retry_count,
            )
        )
        break

    state.validation_passed = len(state.failed_records) == 0 and validation_passed
    state.health_score, state.health_score_explanation = calculate_health_score(
        state.anomalies,
        state.repairs,
        state.failed_records,
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
        health_score_explanation=state.health_score_explanation,
        validation_passed=state.validation_passed,
    )
