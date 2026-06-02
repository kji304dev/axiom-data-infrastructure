from __future__ import annotations

import csv
from io import StringIO
from typing import Any


class CsvParseError(ValueError):
    pass


def parse_csv_records(content: str) -> list[dict[str, Any]]:
    trimmed = content.strip()
    if not trimmed:
        raise CsvParseError("File must not be empty")

    reader = csv.DictReader(StringIO(trimmed))
    if not reader.fieldnames:
        raise CsvParseError("File must not be empty")

    records: list[dict[str, Any]] = []
    for row in reader:
        if not any((value or "").strip() for value in row.values()):
            continue
        records.append(
            {
                field: (value or "").strip()
                for field, value in row.items()
                if field is not None
            }
        )

    if not records:
        raise CsvParseError("File must not be empty")

    return records
