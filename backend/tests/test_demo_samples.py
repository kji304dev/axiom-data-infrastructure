from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.app import app
from backend.api.routes import get_storage_backend
from backend.core.schemas import REQUIRED_AEC_FIELDS
from backend.io.csv_parser import parse_csv_records
from backend.storage.local import LocalStorageBackend

SAMPLES_DIR = Path("samples")
CLEAN_SAMPLE = SAMPLES_DIR / "aec_clean_sample.csv"
MESSY_SAMPLE = SAMPLES_DIR / "aec_messy_sample.csv"
MESSY_JSON = SAMPLES_DIR / "aec_messy_sample.json"


@pytest.fixture
def isolated_client(tmp_path: Path) -> TestClient:
    app.dependency_overrides[get_storage_backend] = lambda: LocalStorageBackend(
        tmp_path
    )
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_demo_sample_files_exist() -> None:
    assert CLEAN_SAMPLE.is_file()
    assert MESSY_SAMPLE.is_file()
    assert MESSY_JSON.is_file()


def test_demo_sample_csv_headers_match_backend_schema() -> None:
    clean_headers = set(parse_csv_records(CLEAN_SAMPLE.read_text(encoding="utf-8"))[0])
    messy_headers = set(parse_csv_records(MESSY_SAMPLE.read_text(encoding="utf-8"))[0])

    assert set(REQUIRED_AEC_FIELDS).issubset(clean_headers)
    assert set(REQUIRED_AEC_FIELDS).issubset(messy_headers)


def test_clean_demo_sample_grades_successfully(isolated_client: TestClient) -> None:
    response = isolated_client.post(
        "/grade/aec/upload",
        files={
            "file": (
                "aec_clean_sample.csv",
                CLEAN_SAMPLE.read_text(encoding="utf-8"),
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["validation_passed"] is True
    assert payload["summary"]["records_flagged"] == 0
    assert payload["summary"]["data_grade"] == "A"


def test_messy_demo_sample_flags_records_and_summary(isolated_client: TestClient) -> None:
    response = isolated_client.post(
        "/grade/aec/upload",
        files={
            "file": (
                "aec_messy_sample.csv",
                MESSY_SAMPLE.read_text(encoding="utf-8"),
                "text/csv",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["records_flagged"] > 0
    assert payload["summary"]["data_grade"] != "A"
    assert len(payload["failed_records"]) > 0
    assert payload["summary"]["top_issues"] or payload["summary"]["recommended_next_steps"]


def test_messy_demo_sample_persists_summary_in_artifact(
    isolated_client: TestClient,
) -> None:
    upload_response = isolated_client.post(
        "/grade/aec/upload",
        files={
            "file": (
                "aec_messy_sample.csv",
                MESSY_SAMPLE.read_text(encoding="utf-8"),
                "text/csv",
            )
        },
    )

    assert upload_response.status_code == 200
    run_id = upload_response.json()["run_id"]
    artifact_response = isolated_client.get(f"/runs/{run_id}/artifact")

    assert artifact_response.status_code == 200
    artifact = artifact_response.json()
    assert artifact["summary"]["records_flagged"] > 0
    assert artifact["summary"]["data_grade"] != "A"


def test_demo_samples_are_not_written_to_repo_local_artifacts(
    isolated_client: TestClient,
    tmp_path: Path,
) -> None:
    repo_local_artifacts = Path("local_artifacts")
    before_exists = repo_local_artifacts.exists()

    isolated_client.post(
        "/grade/aec/upload",
        files={
            "file": (
                "aec_messy_sample.csv",
                MESSY_SAMPLE.read_text(encoding="utf-8"),
                "text/csv",
            )
        },
    )

    if not before_exists:
        assert not repo_local_artifacts.exists()
    assert list(tmp_path.glob("runs/*/result.json"))
