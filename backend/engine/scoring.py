from __future__ import annotations

from backend.core.schemas import Anomaly, FailedRecord, HealthScoreExplanation, Repair

STARTING_SCORE = 100
HIGH_ANOMALY_PENALTY = 20
MEDIUM_ANOMALY_PENALTY = 10
REVIEW_REPAIR_PENALTY = 5
CONFIDENT_REPAIR_PENALTY = 2
FAILED_RECORD_PENALTY = 20


def calculate_health_score(
    anomalies: list[Anomaly],
    repairs: list[Repair],
    failed_records: list[FailedRecord],
) -> tuple[float, HealthScoreExplanation]:
    high_severity_anomaly_count = sum(
        1 for anomaly in anomalies if anomaly.severity == "high"
    )
    medium_severity_anomaly_count = sum(
        1 for anomaly in anomalies if anomaly.severity == "medium"
    )
    review_required_repair_count = sum(
        1 for repair in repairs if repair.requires_review
    )
    confident_repair_count = sum(
        1 for repair in repairs if not repair.requires_review
    )
    failed_record_count = len(failed_records)

    final_score = (
        STARTING_SCORE
        - (high_severity_anomaly_count * HIGH_ANOMALY_PENALTY)
        - (medium_severity_anomaly_count * MEDIUM_ANOMALY_PENALTY)
        - (review_required_repair_count * REVIEW_REPAIR_PENALTY)
        - (confident_repair_count * CONFIDENT_REPAIR_PENALTY)
        - (failed_record_count * FAILED_RECORD_PENALTY)
    )
    final_score = float(max(0, min(100, final_score)))

    explanation = HealthScoreExplanation(
        starting_score=STARTING_SCORE,
        high_severity_anomaly_count=high_severity_anomaly_count,
        medium_severity_anomaly_count=medium_severity_anomaly_count,
        review_required_repair_count=review_required_repair_count,
        confident_repair_count=confident_repair_count,
        failed_record_count=failed_record_count,
        final_score=final_score,
    )
    return final_score, explanation
