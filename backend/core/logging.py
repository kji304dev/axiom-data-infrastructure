from __future__ import annotations

import json
import logging
import os
from typing import Any, Literal

LOG_LEVEL = os.getenv("ADI_LOG_LEVEL", "INFO").upper()
ENGINE_LOGGER_NAME = "adi.backend.engine"

WorkflowNode = Literal["analyzer", "transformer", "auditor", "validator", "complete"]
WorkflowStatus = Literal["start", "success", "failed", "retry"]
WorkflowEvent = Literal["transition", "retry_routing", "dead_letter", "complete"]


class StructuredLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        workflow = getattr(record, "workflow", None)
        if workflow:
            payload["workflow"] = workflow
        return json.dumps(payload, sort_keys=True)


def configure_logging() -> None:
    logger = logging.getLogger(ENGINE_LOGGER_NAME)
    if logger.handlers:
        return

    handler = logging.StreamHandler()
    handler.setFormatter(StructuredLogFormatter())
    logger.addHandler(handler)
    logger.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    logger.propagate = True


def log_workflow_transition(
    *,
    node: WorkflowNode,
    status: WorkflowStatus,
    message: str,
    retry_count: int,
    record_count: int | None = None,
    anomaly_count: int | None = None,
    failed_record_count: int | None = None,
    validation_passed: bool | None = None,
    event: WorkflowEvent = "transition",
) -> dict[str, Any]:
    workflow: dict[str, Any] = {
        "node": node,
        "status": status,
        "event": event,
        "retry_count": retry_count,
    }
    if record_count is not None:
        workflow["record_count"] = record_count
    if anomaly_count is not None:
        workflow["anomaly_count"] = anomaly_count
    if failed_record_count is not None:
        workflow["failed_record_count"] = failed_record_count
    if validation_passed is not None:
        workflow["validation_passed"] = validation_passed

    logging.getLogger(ENGINE_LOGGER_NAME).info(message, extra={"workflow": workflow})
    return workflow


def get_engine_logger() -> logging.Logger:
    return logging.getLogger(ENGINE_LOGGER_NAME)
