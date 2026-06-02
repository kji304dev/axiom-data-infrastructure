from __future__ import annotations

from datetime import datetime

from backend.core.schemas import AECRecord, REQUIRED_AEC_FIELDS


def deterministic_final_validation(
    cleaned_records: list[AECRecord],
    *,
    skip_rows: set[int] | None = None,
) -> tuple[bool, dict[int, str]]:
    skip_rows = skip_rows or set()
    row_errors: dict[int, str] = {}
    expected_fields = set(REQUIRED_AEC_FIELDS)

    if not cleaned_records:
        return False, {}

    for row_idx, record in enumerate(cleaned_records, start=1):
        if row_idx in skip_rows:
            continue

        errors: list[str] = []
        payload = record.model_dump()
        record_fields = set(payload.keys())
        if record_fields != expected_fields:
            errors.append(
                "field mismatch, expected "
                f"{sorted(expected_fields)}, found {sorted(record_fields)}"
            )

        if not payload["ticket_id"].strip():
            errors.append("ticket_id is empty")
        if not payload["customer"].strip():
            errors.append("customer is empty")
        if not payload["material"].strip():
            errors.append("material is empty")
        if not payload["unit"].strip():
            errors.append("unit is empty")
        if not payload["job_site"].strip():
            errors.append("job_site is empty")
        if payload["quantity"] <= 0:
            errors.append("quantity must be positive")

        try:
            datetime.strptime(payload["date"], "%Y-%m-%d")
        except ValueError:
            errors.append("date must be ISO YYYY-MM-DD")

        if errors:
            row_errors[row_idx] = "; ".join(errors)

    return len(row_errors) == 0, row_errors
