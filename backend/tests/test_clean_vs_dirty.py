from backend.core.schemas import Anomaly, FailedRecord, Repair
from backend.reports.clean_vs_dirty import (
    aggregate_top_issues,
    build_clean_vs_dirty_summary,
    data_grade_from_health_score,
)


def test_data_grade_from_health_score() -> None:
    assert data_grade_from_health_score(95) == ("A", "This file is ready for import.")
    assert data_grade_from_health_score(90) == ("A", "This file is ready for import.")
    assert data_grade_from_health_score(85) == (
        "B",
        "This file is mostly clean with minor issues.",
    )
    assert data_grade_from_health_score(75) == (
        "C",
        "This file needs cleanup before import.",
    )
    assert data_grade_from_health_score(65) == (
        "D",
        "This file has significant data quality issues.",
    )
    assert data_grade_from_health_score(40) == (
        "F",
        "This file is not ready for import.",
    )


def test_aggregate_top_issues_sorts_by_count() -> None:
    issues = aggregate_top_issues(
        [
            Anomaly(row=1, field="date", issue="Invalid date format", severity="high"),
            Anomaly(row=2, field="date", issue="Invalid date format", severity="high"),
            Anomaly(row=3, field="customer", issue="Missing required field", severity="high"),
        ],
        [
            FailedRecord(row=4, reason="date could not be normalized", record={}),
        ],
        [],
    )

    assert issues[0].field == "date"
    assert issues[0].issue == "Invalid date format"
    assert issues[0].count == 2
    assert any(issue.field == "customer" for issue in issues)
    assert any(
        issue.field == "date" and issue.issue == "date could not be normalized"
        for issue in issues
    )


def test_build_clean_vs_dirty_summary_calculates_record_counts() -> None:
    summary = build_clean_vs_dirty_summary(
        health_score=72,
        records_received=10,
        failed_record_count=3,
        anomalies=[],
        failed_records=[
            FailedRecord(row=1, reason="Missing date", record={}),
            FailedRecord(row=2, reason="Missing customer", record={}),
            FailedRecord(row=3, reason="Invalid quantity", record={}),
        ],
        repairs=[],
    )

    assert summary.data_grade == "C"
    assert summary.health_score == 72
    assert summary.records_received == 10
    assert summary.records_clean == 7
    assert summary.records_flagged == 3
    assert summary.headline == "This file needs cleanup before import."
    assert summary.recommended_next_steps


def test_build_clean_vs_dirty_summary_handles_zero_failures() -> None:
    summary = build_clean_vs_dirty_summary(
        health_score=100,
        records_received=5,
        failed_record_count=0,
        anomalies=[],
        failed_records=[],
        repairs=[],
    )

    assert summary.records_clean == 5
    assert summary.records_flagged == 0
    assert summary.top_issues == []
    assert len(summary.recommended_next_steps) >= 1
