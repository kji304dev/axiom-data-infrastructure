import csv
import json
import sys
from pathlib import Path
from dateutil import parser as date_parser


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT_DIR / "samples" / "dirty_aec_ticket.csv"
DEFAULT_OUTPUT = ROOT_DIR / "output" / "report.json"


REQUIRED_FIELDS = [
    "ticket_id",
    "date",
    "customer",
    "material",
    "quantity",
    "unit",
    "job_site",
]


def normalize_date(value: str) -> str:
    parsed = date_parser.parse(value)
    return parsed.date().isoformat()


def validate_row(row: dict, row_number: int) -> tuple[dict | None, list[dict]]:
    errors = []

    for field in REQUIRED_FIELDS:
        if not row.get(field) or not row.get(field).strip():
            errors.append({
                "row": row_number,
                "field": field,
                "issue": "Missing required value",
            })

    clean_record = {}

    clean_record["ticket_id"] = row.get("ticket_id", "").strip()
    clean_record["customer"] = row.get("customer", "").strip()
    clean_record["material"] = row.get("material", "").strip()
    clean_record["unit"] = row.get("unit", "").strip()
    clean_record["job_site"] = row.get("job_site", "").strip()

    try:
        clean_record["date"] = normalize_date(row.get("date", "").strip())
    except Exception:
        errors.append({
            "row": row_number,
            "field": "date",
            "issue": "Invalid date format",
        })

    try:
        quantity = float(row.get("quantity", "").strip())
        if quantity <= 0:
            errors.append({
                "row": row_number,
                "field": "quantity",
                "issue": "Quantity must be greater than zero",
            })
        clean_record["quantity"] = quantity
    except Exception:
        errors.append({
            "row": row_number,
            "field": "quantity",
            "issue": "Invalid quantity",
        })

    if errors:
        return None, errors

    return clean_record, []


def validate_csv(input_path: Path = DEFAULT_INPUT, output_path: Path = DEFAULT_OUTPUT) -> dict:
    clean_records = []
    errors = []

    with input_path.open("r", newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)

        for index, row in enumerate(reader, start=2):
            clean_record, row_errors = validate_row(row, index)

            if row_errors:
                errors.extend(row_errors)
            else:
                clean_records.append(clean_record)

    report = {
        "summary": {
            "total_rows": len(clean_records) + len({error["row"] for error in errors}),
            "clean_count": len(clean_records),
            "error_count": len(errors),
        },
        "clean_records": clean_records,
        "errors": errors,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as outfile:
        json.dump(report, outfile, indent=2)

    return report


if __name__ == "__main__":
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT

    result = validate_csv(input_path=input_path)

    print("Validation complete.")
    print(f"Input file: {input_path}")
    print(f"Clean records: {result['summary']['clean_count']}")
    print(f"Errors found: {result['summary']['error_count']}")
    print(f"Report saved to {DEFAULT_OUTPUT}")

