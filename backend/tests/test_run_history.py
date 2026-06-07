import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.api.app import app
from backend.api.routes import get_storage_backend
from backend.storage.local import LocalStorageBackend
from backend.storage.run_index import (
    RUN_INDEX_PATH,
    RunIndexEntry,
    append_run_index_entry,
    get_run_index_entry,
    list_run_index_entries,
)

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


def test_list_run_index_entries_returns_empty_when_missing(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)

    assert list_run_index_entries(storage) == []


def test_get_run_index_entry_returns_none_for_missing_run(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)

    assert get_run_index_entry(storage, "missing-run") is None


def test_list_runs_returns_empty_list_when_index_missing(
    tmp_path: Path,
) -> None:
    app.dependency_overrides[get_storage_backend] = lambda: LocalStorageBackend(
        tmp_path
    )
    client = TestClient(app)

    response = client.get("/runs")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"runs": []}


def test_list_runs_returns_existing_entries(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    append_run_index_entry(storage, _sample_entry(run_id="run-a"))
    append_run_index_entry(
        storage,
        _sample_entry(run_id="run-b").model_copy(
            update={"input_type": "csv_upload", "record_count": 4}
        ),
    )
    app.dependency_overrides[get_storage_backend] = lambda: storage
    client = TestClient(app)

    response = client.get("/runs")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["runs"]) == 2
    assert payload["runs"][0]["run_id"] == "run-a"
    assert payload["runs"][1]["input_type"] == "csv_upload"


def test_get_run_returns_matching_entry(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    append_run_index_entry(storage, _sample_entry(run_id="run-target"))
    app.dependency_overrides[get_storage_backend] = lambda: storage
    client = TestClient(app)

    response = client.get("/runs/run-target")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json()["run_id"] == "run-target"
    assert response.json()["artifact_uri"] == "local://runs/run-target/result.json"


def test_get_run_returns_404_for_unknown_run_id(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    app.dependency_overrides[get_storage_backend] = lambda: storage
    client = TestClient(app)

    response = client.get("/runs/unknown-run")

    app.dependency_overrides.clear()
    assert response.status_code == 404
    assert response.json() == {"detail": "Run not found"}


def test_run_history_reads_do_not_mutate_index_file(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    append_run_index_entry(storage, _sample_entry(run_id="run-a"))
    append_run_index_entry(storage, _sample_entry(run_id="run-b"))
    index_file = tmp_path / RUN_INDEX_PATH
    before = index_file.read_text(encoding="utf-8")

    app.dependency_overrides[get_storage_backend] = lambda: storage
    client = TestClient(app)
    list_response = client.get("/runs")
    detail_response = client.get("/runs/run-a")
    missing_response = client.get("/runs/missing-run")
    app.dependency_overrides.clear()

    after = index_file.read_text(encoding="utf-8")
    assert list_response.status_code == 200
    assert detail_response.status_code == 200
    assert missing_response.status_code == 404
    assert before == after
    assert len(json.loads(after)["runs"]) == 2
