from backend.core.config import MAX_RETRIES
from backend.engine.graph import run_aec_grading
from backend.engine.scoring import (
    CONFIDENT_REPAIR_PENALTY,
    FAILED_RECORD_PENALTY,
    HIGH_ANOMALY_PENALTY,
    MEDIUM_ANOMALY_PENALTY,
    REVIEW_REPAIR_PENALTY,
    STARTING_SCORE,
)


def _auditor_retry_followed_by_transformer_retry(history) -> bool:
    for index, event in enumerate(history):
        if event.node == "auditor" and event.status == "retry":
            remaining = history[index + 1 : index + 4]
            return any(
                next_event.node == "transformer" and next_event.status == "start"
                for next_event in remaining
            )
    return False


def _correction_instruction_captured(history, final_instruction: str | None) -> bool:
    if final_instruction:
        return True
    return any("correction required" in event.message for event in history)


def _expected_final_score(explanation) -> float:
    score = (
        explanation.starting_score
        - (explanation.high_severity_anomaly_count * HIGH_ANOMALY_PENALTY)
        - (explanation.medium_severity_anomaly_count * MEDIUM_ANOMALY_PENALTY)
        - (explanation.review_required_repair_count * REVIEW_REPAIR_PENALTY)
        - (explanation.confident_repair_count * CONFIDENT_REPAIR_PENALTY)
        - (explanation.failed_record_count * FAILED_RECORD_PENALTY)
    )
    return float(max(0, min(100, score)))


def _assert_explanation_matches_score(result) -> None:
    explanation = result.health_score_explanation
    assert explanation.starting_score == STARTING_SCORE
    assert explanation.final_score == result.health_score
    assert explanation.final_score == _expected_final_score(explanation)


def test_clean_record_health_score_is_100() -> None:
    result = run_aec_grading(
        [
            {
                "ticket_id": "1001",
                "date": "2026-05-01",
                "customer": "Acme Builders",
                "material": "Concrete",
                "quantity": 12,
                "unit": "yd3",
                "job_site": "North Yard",
            }
        ]
    )

    assert result.validation_passed is True
    assert result.retry_count == 0
    assert len(result.cleaned_records) == 1
    assert len(result.failed_records) == 0
    assert result.health_score == 100
    assert result.health_score_explanation.confident_repair_count == 0
    assert result.health_score_explanation.review_required_repair_count == 0
    assert result.health_score_explanation.failed_record_count == 0
    _assert_explanation_matches_score(result)


def test_repairable_dirty_record_scores_below_100() -> None:
    result = run_aec_grading(
        [
            {
                "ticket_id": "1002",
                "date": "05/02/26",
                "customer": "",
                "material": "Gravel",
                "quantity": -4,
                "unit": "tons",
                "job_site": "",
            }
        ]
    )

    assert result.validation_passed is True
    assert result.cleaned_records[0].date == "2026-05-02"
    assert result.cleaned_records[0].quantity == 4
    assert result.cleaned_records[0].customer == "UNKNOWN_CUSTOMER"
    assert result.cleaned_records[0].job_site == "UNASSIGNED"
    assert len(result.failed_records) == 0
    assert result.health_score < 100
    assert result.health_score_explanation.review_required_repair_count >= 1
    assert result.health_score_explanation.high_severity_anomaly_count >= 1
    _assert_explanation_matches_score(result)


def test_self_correction_loop_recovers_on_retry() -> None:
    result = run_aec_grading(
        [
            {
                "ticket_id": "1003",
                "date": "bad-date",
                "customer": "Acme Builders",
                "material": "Concrete",
                "quantity": 10,
                "unit": "yd3",
                "job_site": "North Yard",
            }
        ]
    )

    assert result.retry_count >= 1
    assert _correction_instruction_captured(
        result.processing_history, result.correction_instruction
    )
    assert _auditor_retry_followed_by_transformer_retry(result.processing_history)
    assert result.validation_passed is True
    assert len(result.failed_records) == 0
    assert result.cleaned_records[0].date == "1970-01-01"
    assert any(
        event.node == "auditor" and event.status == "retry"
        for event in result.processing_history
    )
    _assert_explanation_matches_score(result)


def test_self_correction_loop_dead_letters_after_max_retries() -> None:
    raw_record = {
        "ticket_id": "",
        "date": "bad-date",
        "customer": "",
        "material": "Concrete",
        "quantity": "not-a-number",
        "unit": "",
        "job_site": "",
    }
    result = run_aec_grading([raw_record])

    assert result.retry_count == MAX_RETRIES
    assert len(result.failed_records) >= 1
    assert result.validation_passed is False
    assert result.failed_records[0].record == raw_record
    assert result.health_score <= 40
    assert result.health_score_explanation.failed_record_count >= 1
    assert any(event.status == "retry" for event in result.processing_history)
    assert any(
        "Dead-lettered" in event.message for event in result.processing_history
    )
    _assert_explanation_matches_score(result)


def test_unrecoverable_record_moves_to_failed_records() -> None:
    raw_record = {
        "ticket_id": "",
        "date": "bad-date",
        "customer": "River Works",
        "material": "Asphalt",
        "quantity": "not-a-number",
        "unit": "tons",
        "job_site": "Lot 7",
    }
    result = run_aec_grading([raw_record])

    assert result.validation_passed is False
    assert result.retry_count == 2
    assert len(result.cleaned_records) == 0
    assert len(result.failed_records) == 1
    assert result.failed_records[0].record == raw_record
    assert result.failed_records[0].reason
    assert result.health_score <= 40
    assert result.health_score_explanation.failed_record_count == 1
    assert any(event.status == "retry" for event in result.processing_history)
    assert any(
        "Dead-lettered" in event.message for event in result.processing_history
    )
    _assert_explanation_matches_score(result)


def test_retry_dead_letter_behavior_after_max_attempts() -> None:
    bad_record = {
        "ticket_id": "",
        "date": "bad-date",
        "customer": "Alpha",
        "material": "Concrete",
        "quantity": "abc",
        "unit": "yd3",
        "job_site": "Site A",
    }
    good_record = {
        "ticket_id": "2002",
        "date": "2026-05-03",
        "customer": "Beta",
        "material": "Sand",
        "quantity": 3,
        "unit": "tons",
        "job_site": "Site B",
    }
    result = run_aec_grading([bad_record, good_record])

    assert result.retry_count == 2
    assert len(result.failed_records) == 1
    assert result.failed_records[0].row == 1
    assert result.failed_records[0].record == bad_record
    assert result.validation_passed is False
    assert len(result.cleaned_records) == 1
    assert result.cleaned_records[0].ticket_id == "2002"
    assert result.health_score < 100
    assert result.health_score_explanation.failed_record_count == 1
    assert any(event.status == "retry" for event in result.processing_history)
    assert any(
        "Dead-lettered" in event.message for event in result.processing_history
    )
    _assert_explanation_matches_score(result)
