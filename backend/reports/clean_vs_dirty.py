from __future__ import annotations

from collections import Counter

from backend.core.schemas import (
    Anomaly,
    CleanVsDirtySummary,
    FailedRecord,
    Repair,
    SummaryTopIssue,
)

GRADE_RULES: tuple[tuple[float, str, str], ...] = (
    (90.0, "A", "This file is ready for import."),
    (80.0, "B", "This file is mostly clean with minor issues."),
    (70.0, "C", "This file needs cleanup before import."),
    (60.0, "D", "This file has significant data quality issues."),
    (0.0, "F", "This file is not ready for import."),
)

FIELD_RECOMMENDATIONS: dict[str, str] = {
    "date": "Standardize ticket dates before import.",
    "ticket_id": "Require ticket IDs on all records.",
    "customer": "Require customer names on all records.",
    "material": "Require material values on all records.",
    "quantity": "Validate numeric quantity values before import.",
    "unit": "Standardize unit values across all records.",
    "job_site": "Require job site values on all records.",
}

GENERIC_RECOMMENDATIONS: tuple[str, ...] = (
    "Review flagged records before importing into downstream systems.",
    "Standardize required fields across all rows.",
    "Fix missing or invalid values in the highest-frequency issue fields.",
)

TOP_ISSUE_LIMIT = 5


def data_grade_from_health_score(health_score: float) -> tuple[str, str]:
    for threshold, grade, headline in GRADE_RULES:
        if health_score >= threshold:
            return grade, headline
    return GRADE_RULES[-1][1], GRADE_RULES[-1][2]


def _infer_field_from_reason(reason: str) -> str:
    lowered = reason.lower()
    for field in FIELD_RECOMMENDATIONS:
        if field in lowered:
            return field
    if "date" in lowered:
        return "date"
    return "record"


def aggregate_top_issues(
    anomalies: list[Anomaly],
    failed_records: list[FailedRecord],
    repairs: list[Repair],
    *,
    limit: int = TOP_ISSUE_LIMIT,
) -> list[SummaryTopIssue]:
    issue_counts: Counter[tuple[str, str]] = Counter()

    for anomaly in anomalies:
        issue_counts[(anomaly.field, anomaly.issue)] += 1

    for failed in failed_records:
        issue_counts[(_infer_field_from_reason(failed.reason), failed.reason)] += 1

    for repair in repairs:
        if repair.requires_review:
            issue_counts[
                (repair.field, f"{repair.field} repair requires review")
            ] += 1

    ranked = sorted(
        issue_counts.items(),
        key=lambda item: (-item[1], item[0][0], item[0][1]),
    )

    return [
        SummaryTopIssue(field=field, issue=issue, count=count)
        for (field, issue), count in ranked[:limit]
    ]


def build_recommended_next_steps(top_issues: list[SummaryTopIssue]) -> list[str]:
    recommendations: list[str] = []
    seen: set[str] = set()

    for issue in top_issues:
        recommendation = FIELD_RECOMMENDATIONS.get(issue.field)
        if recommendation and recommendation not in seen:
            recommendations.append(recommendation)
            seen.add(recommendation)

    for fallback in GENERIC_RECOMMENDATIONS:
        if len(recommendations) >= 3:
            break
        if fallback not in seen:
            recommendations.append(fallback)
            seen.add(fallback)

    return recommendations[:3]


def build_clean_vs_dirty_summary(
    *,
    health_score: float,
    records_received: int,
    failed_record_count: int,
    anomalies: list[Anomaly],
    failed_records: list[FailedRecord],
    repairs: list[Repair],
) -> CleanVsDirtySummary:
    data_grade, headline = data_grade_from_health_score(health_score)
    records_flagged = failed_record_count
    records_clean = max(records_received - records_flagged, 0)
    top_issues = aggregate_top_issues(anomalies, failed_records, repairs)

    return CleanVsDirtySummary(
        headline=headline,
        data_grade=data_grade,
        health_score=health_score,
        records_received=records_received,
        records_clean=records_clean,
        records_flagged=records_flagged,
        top_issues=top_issues,
        recommended_next_steps=build_recommended_next_steps(top_issues),
    )
