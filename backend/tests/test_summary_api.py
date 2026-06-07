import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.app import app
from backend.api.routes import get_storage_backend
from backend.storage.local import LocalStorageBackend

client = TestClient(app)

VALID_CSV = """ticket_id,date,customer,material,quantity,unit,job_site
1002,05/02/26,Acme Builders,Gravel,-4,tons,North Yard
"""


@pytest.fixture
def artifact_client(tmp_path: Path) -> tuple[TestClient, Path]:
    app.dependency_overrides[get_storage_backend] = lambda: LocalStorageBackend(
        tmp_path
    )
    yield TestClient(app), tmp_path
    app.dependency_overrides.clear()


def _assert_summary_shape(summary: dict) -> None:
    assert "headline" in summary
    assert summary["data_grade"] in {"A", "B", "C", "D", "F"}
    assert "health_score" in summary
    assert "records_received" in summary
    assert "records_clean" in summary
    assert "records_flagged" in summary
    assert "top_issues" in summary
    assert "recommended_next_steps" in summary


def test_grade_aec_response_includes_summary() -> None:
    response = client.post(
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

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] is not None
    _assert_summary_shape(payload["summary"])
    assert payload["summary"]["records_received"] == 1
    assert payload["summary"]["records_flagged"] == 0
    assert payload["summary"]["records_clean"] == 1
    assert payload["summary"]["data_grade"] == "A"


def test_grade_aec_upload_response_includes_summary(
    artifact_client: tuple[TestClient, Path],
) -> None:
    client_with_storage, _storage_root = artifact_client
    response = client_with_storage.post(
        "/grade/aec/upload",
        files={"file": ("dirty.csv", VALID_CSV, "text/csv")},
    )

    assert response.status_code == 200
    payload = response.json()
    _assert_summary_shape(payload["summary"])
    assert payload["summary"]["records_received"] == 1


def test_saved_artifact_includes_summary(
    artifact_client: tuple[TestClient, Path],
) -> None:
    client_with_storage, storage_root = artifact_client
    grade_response = client_with_storage.post(
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

    artifact_response = client_with_storage.get(f"/runs/{run_id}/artifact")

    assert artifact_response.status_code == 200
    artifact = artifact_response.json()
    _assert_summary_shape(artifact["summary"])

    artifact_file = storage_root / artifact["artifact_path"]
    saved = json.loads(artifact_file.read_text(encoding="utf-8"))
    assert saved["summary"]["data_grade"] == artifact["summary"]["data_grade"]
