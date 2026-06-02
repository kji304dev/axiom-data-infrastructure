from __future__ import annotations

from datetime import datetime
from typing import Any

from backend.core.schemas import AECRecord, Repair


def _string_value(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_date(raw_date: str) -> str:
    for fmt in ("%Y-%m-%d", "%m/%d/%y", "%m/%d/%Y"):
        try:
            parsed = datetime.strptime(raw_date, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw_date


def transform_records(
    raw_records: list[dict[str, Any]],
    correction_instruction: str | None = None,
) -> tuple[list[AECRecord], list[Repair]]:
    cleaned_records: list[AECRecord] = []
    repairs: list[Repair] = []
    strict_retry = bool(correction_instruction)

    for row_index, record in enumerate(raw_records, start=1):
        ticket_id = _string_value(record.get("ticket_id"))
        raw_date = _string_value(record.get("date"))
        normalized_date = _normalize_date(raw_date) if raw_date else ""
        customer = _string_value(record.get("customer")) or "UNKNOWN_CUSTOMER"
        material = _string_value(record.get("material")) or "UNKNOWN_MATERIAL"
        unit = _string_value(record.get("unit")) or "UNKNOWN_UNIT"
        job_site = _string_value(record.get("job_site")) or "UNASSIGNED"

        raw_quantity = _string_value(record.get("quantity"))
        quantity: float | None
        try:
            quantity = float(raw_quantity)
            if quantity < 0:
                repaired_quantity = abs(quantity)
                repairs.append(
                    Repair(
                        row=row_index,
                        field="quantity",
                        original_value=raw_quantity,
                        cleaned_value=str(repaired_quantity),
                        action_taken="Converted negative quantity to absolute value",
                    )
                )
                quantity = repaired_quantity
        except ValueError:
            quantity = 1.0 if strict_retry else None
            repairs.append(
                Repair(
                    row=row_index,
                    field="quantity",
                    original_value=raw_quantity,
                    cleaned_value=str(quantity) if quantity is not None else "",
                    action_taken=(
                        "Applied strict retry default quantity"
                        if strict_retry
                        else "Unable to parse quantity"
                    ),
                )
            )

        if raw_date and normalized_date != raw_date:
            repairs.append(
                Repair(
                    row=row_index,
                    field="date",
                    original_value=raw_date,
                    cleaned_value=normalized_date,
                    action_taken="Normalized date format to YYYY-MM-DD",
                )
            )

        if strict_retry and normalized_date == raw_date and raw_date:
            normalized_date = "1970-01-01"
            repairs.append(
                Repair(
                    row=row_index,
                    field="date",
                    original_value=raw_date,
                    cleaned_value=normalized_date,
                    action_taken="Applied strict retry fallback date",
                )
            )

        cleaned_records.append(
            AECRecord(
                ticket_id=ticket_id,
                date=normalized_date,
                customer=customer,
                material=material,
                quantity=quantity if quantity is not None else 0.0,
                unit=unit,
                job_site=job_site,
            )
        )

    return cleaned_records, repairs
