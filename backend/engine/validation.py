from __future__ import annotations

from datetime import datetime

from backend.core.schemas import AECRecord, REQUIRED_AEC_FIELDS


def deterministic_final_validation(cleaned_records: list[AECRecord]) -> tuple[bool, list[str]]:
    errors: list[str] = []
    expected_fields = set(REQUIRED_AEC_FIELDS)
    if not cleaned_records:
        return False, ["no valid cleaned records available for final validation"]

    for row_idx, record in enumerate(cleaned_records, start=1):
        payload = record.model_dump()
        record_fields = set(payload.keys())
        if record_fields != expected_fields:
            errors.append(
                f"row {row_idx}: field mismatch, expected {sorted(expected_fields)}, found {sorted(record_fields)}"
            )

        if not payload["ticket_id"].strip():
            errors.append(f"row {row_idx}: ticket_id is empty")
        if not payload["customer"].strip():
            errors.append(f"row {row_idx}: customer is empty")
        if not payload["material"].strip():
            errors.append(f"row {row_idx}: material is empty")
        if not payload["unit"].strip():
            errors.append(f"row {row_idx}: unit is empty")
        if not payload["job_site"].strip():
            errors.append(f"row {row_idx}: job_site is empty")
        if payload["quantity"] <= 0:
            errors.append(f"row {row_idx}: quantity must be positive")

        try:
            datetime.strptime(payload["date"], "%Y-%m-%d")
        except ValueError:
            errors.append(f"row {row_idx}: date must be ISO YYYY-MM-DD")

    return len(errors) == 0, errors
