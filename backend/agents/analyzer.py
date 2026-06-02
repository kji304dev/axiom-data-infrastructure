from __future__ import annotations

from datetime import datetime
from typing import Any

from backend.core.schemas import Anomaly, REQUIRED_AEC_FIELDS


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


def _is_parseable_date(raw_value: Any) -> bool:
    if _is_blank(raw_value):
        return False
    value = str(raw_value).strip()
    for fmt in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y"):
        try:
            datetime.strptime(value, fmt)
            return True
        except ValueError:
            continue
    return False


def analyze_records(raw_records: list[dict[str, Any]]) -> list[Anomaly]:
    anomalies: list[Anomaly] = []
    for row_index, record in enumerate(raw_records, start=1):
        for field in REQUIRED_AEC_FIELDS:
            if field not in record or _is_blank(record.get(field)):
                anomalies.append(
                    Anomaly(
                        row=row_index,
                        field=field,
                        issue="Missing required field",
                        severity="high",
                    )
                )

        if "date" in record and not _is_blank(record.get("date")) and not _is_parseable_date(
            record.get("date")
        ):
            anomalies.append(
                Anomaly(
                    row=row_index,
                    field="date",
                    issue="Invalid date format",
                    severity="high",
                )
            )

        quantity_value = record.get("quantity")
        if not _is_blank(quantity_value):
            try:
                float(str(quantity_value).strip())
            except ValueError:
                anomalies.append(
                    Anomaly(
                        row=row_index,
                        field="quantity",
                        issue="Quantity is not numeric",
                        severity="high",
                    )
                )

    return anomalies
