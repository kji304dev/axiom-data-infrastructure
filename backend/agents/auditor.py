from __future__ import annotations

from datetime import datetime

from backend.core.schemas import AECRecord


def _is_valid_iso_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def audit_records(cleaned_records: list[AECRecord]) -> tuple[bool, str | None]:
    failed_rows: list[str] = []

    for idx, record in enumerate(cleaned_records, start=1):
        if not record.ticket_id.strip():
            failed_rows.append(f"row {idx}: missing ticket_id")
            continue
        if not _is_valid_iso_date(record.date):
            failed_rows.append(f"row {idx}: invalid date")
            continue
        if record.quantity <= 0:
            failed_rows.append(f"row {idx}: non-positive quantity")

    if failed_rows:
        return False, " ; ".join(failed_rows)
    return True, None
