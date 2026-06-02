from __future__ import annotations

from datetime import datetime

from backend.core.schemas import AECRecord


def _is_valid_iso_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def audit_records(
    cleaned_records: list[AECRecord],
    *,
    skip_rows: set[int] | None = None,
) -> tuple[bool, dict[int, str]]:
    skip_rows = skip_rows or set()
    failures: dict[int, str] = {}

    for idx, record in enumerate(cleaned_records, start=1):
        if idx in skip_rows:
            continue

        reasons: list[str] = []
        if not record.ticket_id.strip():
            reasons.append("missing ticket_id")
        if not _is_valid_iso_date(record.date):
            reasons.append("invalid date")
        if record.quantity <= 0:
            reasons.append("non-positive quantity")

        if reasons:
            failures[idx] = "; ".join(reasons)

    return len(failures) == 0, failures
