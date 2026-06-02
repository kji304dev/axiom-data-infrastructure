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


def _make_repair(
    *,
    row: int,
    field: str,
    original_value: str,
    cleaned_value: str,
    action_taken: str,
    requires_review: bool,
    confidence: float,
) -> Repair:
    return Repair(
        row=row,
        field=field,
        original_value=original_value,
        cleaned_value=cleaned_value,
        action_taken=action_taken,
        requires_review=requires_review,
        confidence=confidence,
    )


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
        raw_customer = _string_value(record.get("customer"))
        raw_material = _string_value(record.get("material"))
        raw_unit = _string_value(record.get("unit"))
        raw_job_site = _string_value(record.get("job_site"))

        customer = raw_customer or "UNKNOWN_CUSTOMER"
        material = raw_material or "UNKNOWN_MATERIAL"
        unit = raw_unit or "UNKNOWN_UNIT"
        job_site = raw_job_site or "UNASSIGNED"

        if not raw_customer:
            repairs.append(
                _make_repair(
                    row=row_index,
                    field="customer",
                    original_value=raw_customer,
                    cleaned_value=customer,
                    action_taken="Filled missing customer with placeholder",
                    requires_review=True,
                    confidence=0.7,
                )
            )

        if not raw_material:
            repairs.append(
                _make_repair(
                    row=row_index,
                    field="material",
                    original_value=raw_material,
                    cleaned_value=material,
                    action_taken="Filled missing material with placeholder",
                    requires_review=True,
                    confidence=0.6,
                )
            )

        if not raw_unit:
            repairs.append(
                _make_repair(
                    row=row_index,
                    field="unit",
                    original_value=raw_unit,
                    cleaned_value=unit,
                    action_taken="Filled missing unit with placeholder",
                    requires_review=True,
                    confidence=0.5,
                )
            )

        if not raw_job_site:
            repairs.append(
                _make_repair(
                    row=row_index,
                    field="job_site",
                    original_value=raw_job_site,
                    cleaned_value=job_site,
                    action_taken="Filled missing job site with placeholder",
                    requires_review=True,
                    confidence=0.7,
                )
            )

        raw_quantity = _string_value(record.get("quantity"))
        quantity: float | None
        try:
            quantity = float(raw_quantity)
            if quantity < 0:
                repaired_quantity = abs(quantity)
                repairs.append(
                    _make_repair(
                        row=row_index,
                        field="quantity",
                        original_value=raw_quantity,
                        cleaned_value=str(repaired_quantity),
                        action_taken="Converted negative quantity to absolute value",
                        requires_review=True,
                        confidence=0.75,
                    )
                )
                quantity = repaired_quantity
        except ValueError:
            quantity = 1.0 if strict_retry else None
            repairs.append(
                _make_repair(
                    row=row_index,
                    field="quantity",
                    original_value=raw_quantity,
                    cleaned_value=str(quantity) if quantity is not None else "",
                    action_taken=(
                        "Applied strict retry default quantity"
                        if strict_retry
                        else "Unable to parse quantity"
                    ),
                    requires_review=True,
                    confidence=0.5 if strict_retry else 0.3,
                )
            )

        if raw_date and normalized_date != raw_date:
            repairs.append(
                _make_repair(
                    row=row_index,
                    field="date",
                    original_value=raw_date,
                    cleaned_value=normalized_date,
                    action_taken="Normalized date format to YYYY-MM-DD",
                    requires_review=False,
                    confidence=0.95,
                )
            )

        if strict_retry and normalized_date == raw_date and raw_date:
            normalized_date = "1970-01-01"
            repairs.append(
                _make_repair(
                    row=row_index,
                    field="date",
                    original_value=raw_date,
                    cleaned_value=normalized_date,
                    action_taken="Applied strict retry fallback date",
                    requires_review=True,
                    confidence=0.5,
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
