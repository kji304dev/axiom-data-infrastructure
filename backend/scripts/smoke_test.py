from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

REPAIRABLE_RECORD = {
    "ticket_id": "1002",
    "date": "05/02/26",
    "customer": "Acme",
    "material": "Gravel",
    "quantity": -4,
    "unit": "tons",
    "job_site": "North Yard",
}

DEFAULT_DIRTY_SAMPLE = Path("samples/dirty_aec_ticket.csv")


@dataclass(frozen=True)
class SmokeCheckResult:
    name: str
    passed: bool
    detail: str


def normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


def validate_health_payload(payload: dict[str, Any]) -> SmokeCheckResult:
    expected_keys = {"status", "service", "version"}
    if set(payload.keys()) != expected_keys:
        return SmokeCheckResult(
            name="health",
            passed=False,
            detail=f"unexpected health payload keys: {sorted(payload.keys())}",
        )
    if payload.get("status") != "ok" or payload.get("service") != "adi-backend":
        return SmokeCheckResult(
            name="health",
            passed=False,
            detail="status or service mismatch",
        )
    if not payload.get("version"):
        return SmokeCheckResult(
            name="health",
            passed=False,
            detail="missing version",
        )
    return SmokeCheckResult(
        name="health",
        passed=True,
        detail=f"status=ok service=adi-backend version={payload['version']}",
    )


def validate_grade_payload(payload: dict[str, Any], *, expect_success: bool) -> SmokeCheckResult:
    required_keys = {
        "cleaned_records",
        "repairs",
        "anomalies",
        "failed_records",
        "processing_history",
        "retry_count",
        "health_score",
        "health_score_explanation",
        "validation_passed",
        "run_id",
        "artifact_path",
        "artifact_uri",
    }
    missing = required_keys - set(payload.keys())
    if missing:
        return SmokeCheckResult(
            name="grade_aec",
            passed=False,
            detail=f"missing response keys: {sorted(missing)}",
        )

    if expect_success:
        if not payload["validation_passed"]:
            return SmokeCheckResult(
                name="grade_aec",
                passed=False,
                detail="expected validation_passed=true",
            )
        if not payload["cleaned_records"]:
            return SmokeCheckResult(
                name="grade_aec",
                passed=False,
                detail="expected at least one cleaned record",
            )

    summary = summarize_grade_payload(payload)
    return SmokeCheckResult(name="grade_aec", passed=True, detail=summary)


def validate_upload_payload(payload: dict[str, Any]) -> SmokeCheckResult:
    required_keys = {
        "cleaned_records",
        "failed_records",
        "validation_passed",
        "health_score",
        "processing_history",
        "run_id",
        "artifact_path",
        "artifact_uri",
    }
    missing = required_keys - set(payload.keys())
    if missing:
        return SmokeCheckResult(
            name="grade_aec_upload",
            passed=False,
            detail=f"missing response keys: {sorted(missing)}",
        )
    if not payload["cleaned_records"]:
        return SmokeCheckResult(
            name="grade_aec_upload",
            passed=False,
            detail="expected at least one cleaned record from dirty sample",
        )
    if not payload["failed_records"]:
        return SmokeCheckResult(
            name="grade_aec_upload",
            passed=False,
            detail="expected at least one failed record from dirty sample",
        )
    if payload["validation_passed"]:
        return SmokeCheckResult(
            name="grade_aec_upload",
            passed=False,
            detail="expected validation_passed=false for dirty sample batch",
        )

    summary = summarize_grade_payload(payload)
    return SmokeCheckResult(name="grade_aec_upload", passed=True, detail=summary)


def summarize_grade_payload(payload: dict[str, Any]) -> str:
    return (
        "validation_passed="
        f"{payload['validation_passed']} "
        f"cleaned={len(payload['cleaned_records'])} "
        f"failed={len(payload['failed_records'])} "
        f"repairs={len(payload.get('repairs', []))} "
        f"anomalies={len(payload.get('anomalies', []))} "
        f"health_score={payload['health_score']}"
    )


def check_health(client: httpx.Client) -> SmokeCheckResult:
    try:
        response = client.get("/health", timeout=30.0)
    except httpx.HTTPError as error:
        return SmokeCheckResult("health", False, f"request failed: {error}")

    if response.status_code != 200:
        return SmokeCheckResult(
            "health",
            False,
            f"HTTP {response.status_code}",
        )
    return validate_health_payload(response.json())


def check_grade_aec(client: httpx.Client) -> SmokeCheckResult:
    try:
        response = client.post(
            "/grade/aec",
            json={"records": [REPAIRABLE_RECORD]},
            timeout=60.0,
        )
    except httpx.HTTPError as error:
        return SmokeCheckResult("grade_aec", False, f"request failed: {error}")

    if response.status_code != 200:
        return SmokeCheckResult(
            "grade_aec",
            False,
            f"HTTP {response.status_code}",
        )
    return validate_grade_payload(response.json(), expect_success=True)


def check_grade_aec_upload(
    client: httpx.Client,
    csv_path: Path = DEFAULT_DIRTY_SAMPLE,
) -> SmokeCheckResult:
    if not csv_path.is_file():
        return SmokeCheckResult(
            "grade_aec_upload",
            False,
            f"sample CSV not found: {csv_path}",
        )

    try:
        with csv_path.open("rb") as csv_file:
            response = client.post(
                "/grade/aec/upload",
                files={"file": (csv_path.name, csv_file, "text/csv")},
                timeout=60.0,
            )
    except httpx.HTTPError as error:
        return SmokeCheckResult("grade_aec_upload", False, f"request failed: {error}")

    if response.status_code != 200:
        return SmokeCheckResult(
            "grade_aec_upload",
            False,
            f"HTTP {response.status_code}",
        )
    return validate_upload_payload(response.json())


def run_smoke_tests(
    client: httpx.Client,
    csv_path: Path = DEFAULT_DIRTY_SAMPLE,
) -> list[SmokeCheckResult]:
    return [
        check_health(client),
        check_grade_aec(client),
        check_grade_aec_upload(client, csv_path),
    ]


def print_results(results: list[SmokeCheckResult]) -> None:
    for result in results:
        status = "PASS" if result.passed else "FAIL"
        print(f"[{status}] {result.name}: {result.detail}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run ADI FastAPI backend deployment smoke checks.",
    )
    parser.add_argument(
        "--base-url",
        required=True,
        help="API base URL, for example http://127.0.0.1:8000",
    )
    parser.add_argument(
        "--csv-path",
        default=str(DEFAULT_DIRTY_SAMPLE),
        help="CSV file for upload smoke check",
    )
    args = parser.parse_args(argv)

    base_url = normalize_base_url(args.base_url)
    csv_path = Path(args.csv_path)

    print(f"Running ADI smoke tests against {base_url}")

    with httpx.Client(base_url=base_url) as client:
        results = run_smoke_tests(client, csv_path)

    print_results(results)

    if all(result.passed for result in results):
        print("All smoke checks passed.")
        return 0

    print("One or more smoke checks failed.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
