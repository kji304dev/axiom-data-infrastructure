from backend.core.schemas import Anomaly, FailedRecord, Repair
from backend.engine.scoring import calculate_health_score


def test_calculate_health_score_matches_explanation_math() -> None:
    score, explanation = calculate_health_score(
        anomalies=[
            Anomaly(row=1, field="date", issue="Invalid date format", severity="high"),
            Anomaly(row=2, field="customer", issue="Missing", severity="medium"),
        ],
        repairs=[
            Repair(
                row=1,
                field="customer",
                original_value="",
                cleaned_value="UNKNOWN_CUSTOMER",
                action_taken="Filled missing customer with placeholder",
                requires_review=True,
                confidence=0.7,
            ),
            Repair(
                row=1,
                field="date",
                original_value="05/02/26",
                cleaned_value="2026-05-02",
                action_taken="Normalized date format to YYYY-MM-DD",
                requires_review=False,
                confidence=0.95,
            ),
        ],
        failed_records=[
            FailedRecord(row=3, reason="missing ticket_id", record={"ticket_id": ""})
        ],
    )

    assert explanation.high_severity_anomaly_count == 1
    assert explanation.medium_severity_anomaly_count == 1
    assert explanation.review_required_repair_count == 1
    assert explanation.confident_repair_count == 1
    assert explanation.failed_record_count == 1
    assert score == 43
    assert explanation.final_score == score
