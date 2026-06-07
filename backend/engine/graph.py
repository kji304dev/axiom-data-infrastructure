from __future__ import annotations

from typing import Any

from backend.agents.analyzer import analyze_records
from backend.agents.auditor import audit_records
from backend.agents.transformer import transform_records
from backend.core.config import MAX_RETRIES
from backend.core.logging import configure_logging, log_workflow_transition
from backend.core.schemas import FailedRecord, GradeAECResponse, ProcessingEvent
from backend.engine.scoring import calculate_health_score
from backend.engine.state import EngineState
from backend.engine.validation import deterministic_final_validation
from backend.reports.clean_vs_dirty import build_clean_vs_dirty_summary

configure_logging()


def _workflow_context(state: EngineState) -> dict[str, Any]:
    return {
        "retry_count": state.retry_count,
        "record_count": len(state.raw_records),
        "anomaly_count": len(state.anomalies),
        "failed_record_count": len(state.failed_records),
    }


def _log_transition(
    state: EngineState,
    node: str,
    status: str,
    message: str,
    *,
    event: str = "transition",
    validation_passed: bool | None = None,
) -> ProcessingEvent:
    log_workflow_transition(
        node=node,  # type: ignore[arg-type]
        status=status,  # type: ignore[arg-type]
        message=message,
        event=event,  # type: ignore[arg-type]
        validation_passed=validation_passed,
        **_workflow_context(state),
    )
    return ProcessingEvent(
        node=node, status=status, message=message, retry_count=state.retry_count
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
        _log_transition(
            state, "analyzer", "start", "Running anomaly analysis"
        )
    )
    state.anomalies = analyze_records(state.raw_records)
    state.processing_history.append(
        _log_transition(
            state,
            "analyzer",
            "success",
            f"Analyzer detected {len(state.anomalies)} anomalies",
        )
    )

    while True:
        state.processing_history.append(
            _log_transition(
                state,
                "transformer",
                "start",
                "Applying deterministic transformations",
            )
        )
        all_cleaned, new_repairs = transform_records(
            state.raw_records, state.correction_instruction
        )
        state.repairs = new_repairs
        skip_rows = _dead_lettered_rows(state)
        state.cleaned_records = _active_cleaned_records(all_cleaned, skip_rows)
        state.processing_history.append(
            _log_transition(
                state,
                "transformer",
                "success",
                f"Transformer produced {len(state.cleaned_records)} active cleaned records",
            )
        )

        state.processing_history.append(
            _log_transition(
                state, "auditor", "start", "Auditing transformed output"
            )
        )
        passed_audit, audit_failures = audit_records(all_cleaned, skip_rows=skip_rows)
        if not passed_audit:
            state.correction_instruction = _format_row_failures(audit_failures)
            if state.retry_count < MAX_RETRIES:
                state.retry_count += 1
                state.processing_history.append(
                    _log_transition(
                        state,
                        "auditor",
                        "retry",
                        (
                            "Audit failed; routing to transformer for self-correction "
                            f"({len(audit_failures)} unresolved row(s))"
                        ),
                        event="retry_routing",
                    )
                )
                continue

            _dead_letter_unresolved_rows(state, audit_failures)
            state.processing_history.append(
                _log_transition(
                    state,
                    "auditor",
                    "failed",
                    (
                        "Dead-lettered "
                        f"{len(audit_failures)} unresolved record(s) after max retries"
                    ),
                    event="dead_letter",
                )
            )
        else:
            state.correction_instruction = None
            state.processing_history.append(
                _log_transition(state, "auditor", "success", "Audit passed")
            )

        skip_rows = _dead_lettered_rows(state)
        active_cleaned = _active_cleaned_records(all_cleaned, skip_rows)

        state.processing_history.append(
            _log_transition(
                state,
                "validator",
                "start",
                "Running deterministic final validation",
            )
        )

        if not active_cleaned:
            validation_passed = False
            validation_errors = {}
            validator_message = (
                "Final validation failed due to dead-lettered records"
                if state.failed_records
                else "No active cleaned records available for final validation"
            )
            state.processing_history.append(
                _log_transition(
                    state,
                    "validator",
                    "failed",
                    validator_message,
                )
            )
            if state.failed_records:
                break
        else:
            validation_passed, validation_errors = deterministic_final_validation(
                all_cleaned, skip_rows=skip_rows
            )

        if validation_passed:
            if state.failed_records:
                state.processing_history.append(
                    _log_transition(
                        state,
                        "validator",
                        "failed",
                        "Final validation failed due to dead-lettered records",
                    )
                )
            else:
                state.processing_history.append(
                    _log_transition(
                        state, "validator", "success", "Final validation passed"
                    )
                )
            break

        state.correction_instruction = _format_row_failures(validation_errors)
        if state.retry_count < MAX_RETRIES:
            state.retry_count += 1
            state.processing_history.append(
                _log_transition(
                    state,
                    "validator",
                    "retry",
                    (
                        "Final validation failed; routing to transformer for "
                        f"self-correction ({len(validation_errors)} unresolved row(s))"
                    ),
                    event="retry_routing",
                )
            )
            continue

        _dead_letter_unresolved_rows(state, validation_errors)
        state.processing_history.append(
            _log_transition(
                state,
                "validator",
                "failed",
                (
                    "Dead-lettered "
                    f"{len(validation_errors)} unresolved record(s) after max retries"
                ),
                event="dead_letter",
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
        _log_transition(
            state,
            "complete",
            "success",
            "Workflow completed",
            event="complete",
            validation_passed=state.validation_passed,
        )
    )
    summary = build_clean_vs_dirty_summary(
        health_score=state.health_score,
        records_received=len(state.raw_records),
        failed_record_count=len(state.failed_records),
        anomalies=state.anomalies,
        failed_records=state.failed_records,
        repairs=state.repairs,
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
        summary=summary,
    )
