import logging

from backend.core.logging import ENGINE_LOGGER_NAME
from backend.engine.graph import run_aec_grading


def _workflow_logs(caplog) -> list[dict]:
    return [
        record.workflow
        for record in caplog.records
        if record.name == ENGINE_LOGGER_NAME and hasattr(record, "workflow")
    ]


def test_successful_flow_emits_structured_workflow_logs(caplog) -> None:
    with caplog.at_level(logging.INFO, logger=ENGINE_LOGGER_NAME):
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
    logs = _workflow_logs(caplog)
    assert logs

    nodes = {(entry["node"], entry["status"]) for entry in logs}
    assert ("analyzer", "start") in nodes
    assert ("analyzer", "success") in nodes
    assert ("transformer", "start") in nodes
    assert ("transformer", "success") in nodes
    assert ("auditor", "start") in nodes
    assert ("auditor", "success") in nodes
    assert ("validator", "start") in nodes
    assert ("validator", "success") in nodes
    assert any(entry["event"] == "complete" for entry in logs)

    complete_log = next(entry for entry in logs if entry["event"] == "complete")
    assert complete_log["validation_passed"] is True
    assert complete_log["record_count"] == 1
    assert complete_log["failed_record_count"] == 0

    logged_messages = " ".join(record.getMessage() for record in caplog.records)
    assert "Acme Builders" not in logged_messages


def test_unrecoverable_flow_emits_retry_and_dead_letter_logs(caplog) -> None:
    with caplog.at_level(logging.INFO, logger=ENGINE_LOGGER_NAME):
        result = run_aec_grading(
            [
                {
                    "ticket_id": "",
                    "date": "bad-date",
                    "customer": "Secret Customer Ltd",
                    "material": "Concrete",
                    "quantity": "not-a-number",
                    "unit": "",
                    "job_site": "",
                }
            ]
        )

    assert result.validation_passed is False
    assert len(result.failed_records) == 1

    logs = _workflow_logs(caplog)
    assert any(entry["status"] == "retry" for entry in logs)
    assert any(entry["event"] == "retry_routing" for entry in logs)
    assert any(entry["event"] == "dead_letter" for entry in logs)

    dead_letter_log = next(entry for entry in logs if entry["event"] == "dead_letter")
    assert dead_letter_log["failed_record_count"] >= 1
    assert dead_letter_log["record_count"] == 1

    complete_log = next(entry for entry in logs if entry["event"] == "complete")
    assert complete_log["validation_passed"] is False

    logged_messages = " ".join(record.getMessage() for record in caplog.records)
    assert "Secret Customer Ltd" not in logged_messages
