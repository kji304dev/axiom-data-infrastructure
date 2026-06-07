import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.app import app
from backend.api.routes import get_storage_backend
from backend.storage.artifacts import artifact_path_from_uri, load_artifact_json
from backend.storage.local import LocalStorageBackend
from backend.storage.run_index import RUN_INDEX_PATH, RunIndexEntry, append_run_index_entry

VALID_CSV = """ticket_id,date,customer,material,quantity,unit,job_site
1002,05/02/26,Acme Builders,Gravel,-4,tons,North Yard
"""


def _sample_entry(*, run_id: str = "run-a") -> RunIndexEntry:
    return RunIndexEntry(
        run_id=run_id,
        created_at="2026-06-07T19:00:00+00:00",
        input_type="json",
        record_count=1,
        artifact_uri=f"local://runs/{run_id}/result.json",
        health_score=100.0,
        validation_passed=True,
        failed_record_count=0,
    )


def test_get_run_artifact_returns_saved_artifact(tmp_path: Path) -> None:
    app.dependency_overrides[get_storage_backend] = lambda: LocalStorageBackend(
        tmp_path
    )
    client = TestClient(app)

    grade_response = client.post(
        "/grade/aec",
        json={
            "records": [
                {
                    "ticket_id": "1001",
                    "date": "2026-05-01",
                    "customer": "Acme",
                    "material": "Concrete",
                    "quantity": 5,
                    "unit": "yd3",
                    "job_site": "North Yard",
                }
            ]
        },
    )
    run_id = grade_response.json()["run_id"]

    artifact_response = client.get(f"/runs/{run_id}/artifact")

    app.dependency_overrides.clear()
    assert grade_response.status_code == 200
    assert artifact_response.status_code == 200
    assert artifact_response.json()["run_id"] == run_id
    assert artifact_response.json()["validation_passed"] is True
    assert artifact_response.json()["cleaned_records"][0]["ticket_id"] == "1001"


def test_get_run_artifact_returns_404_for_unknown_run_id(tmp_path: Path) -> None:
    app.dependency_overrides[get_storage_backend] = lambda: LocalStorageBackend(
        tmp_path
    )
    client = TestClient(app)

    response = client.get("/runs/unknown-run/artifact")

    app.dependency_overrides.clear()
    assert response.status_code == 404
    assert response.json() == {"detail": "Run not found"}


def test_get_run_artifact_returns_410_when_artifact_missing(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    append_run_index_entry(storage, _sample_entry(run_id="run-missing-file"))
    app.dependency_overrides[get_storage_backend] = lambda: storage
    client = TestClient(app)

    response = client.get("/runs/run-missing-file/artifact")

    app.dependency_overrides.clear()
    assert response.status_code == 410
    assert response.json() == {"detail": "Run artifact not found"}


def test_get_run_artifact_does_not_mutate_run_index(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    app.dependency_overrides[get_storage_backend] = lambda: storage
    client = TestClient(app)

    grade_response = client.post(
        "/grade/aec/upload",
        files={"file": ("dirty.csv", VALID_CSV, "text/csv")},
    )
    run_id = grade_response.json()["run_id"]
    index_file = tmp_path / RUN_INDEX_PATH
    before = index_file.read_text(encoding="utf-8")

    artifact_response = client.get(f"/runs/{run_id}/artifact")
    after = index_file.read_text(encoding="utf-8")

    app.dependency_overrides.clear()
    assert grade_response.status_code == 200
    assert artifact_response.status_code == 200
    assert before == after
    assert len(json.loads(after)["runs"]) == 1


def test_artifact_path_from_uri_matches_local_format() -> None:
    assert artifact_path_from_uri("local://runs/abc123/result.json") == (
        "runs/abc123/result.json"
    )


def test_load_artifact_json_reads_saved_result(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    payload = {"run_id": "abc123", "validation_passed": True}
    storage.write_json("runs/abc123/result.json", payload)

    loaded = load_artifact_json(storage, "local://runs/abc123/result.json")

    assert loaded == payload
