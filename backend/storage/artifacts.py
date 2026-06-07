from __future__ import annotations

import uuid

from backend.core.schemas import GradeAECResponse
from backend.storage.base import StorageBackend

RESULT_ARTIFACT_NAME = "result.json"
LOCAL_ARTIFACT_URI_SCHEME = "local"


def create_run_id() -> str:
    return uuid.uuid4().hex


def build_artifact_path(run_id: str) -> str:
    return f"runs/{run_id}/{RESULT_ARTIFACT_NAME}"


def build_artifact_uri(artifact_path: str, *, scheme: str = LOCAL_ARTIFACT_URI_SCHEME) -> str:
    return f"{scheme}://{artifact_path}"


def artifact_path_from_uri(artifact_uri: str) -> str:
    scheme, separator, path = artifact_uri.partition("://")
    if not scheme or not separator or not path:
        raise ValueError(f"invalid artifact_uri: {artifact_uri}")
    return path


def load_artifact_json(storage: StorageBackend, artifact_uri: str) -> dict | None:
    try:
        artifact_path = artifact_path_from_uri(artifact_uri)
    except ValueError:
        return None

    if not storage.exists(artifact_path):
        return None

    try:
        return storage.read_json(artifact_path)
    except (FileNotFoundError, ValueError):
        return None


def persist_grade_result(
    storage: StorageBackend,
    result: GradeAECResponse,
    *,
    run_id: str | None = None,
) -> GradeAECResponse:
    resolved_run_id = run_id or create_run_id()
    artifact_path = build_artifact_path(resolved_run_id)
    artifact_uri = build_artifact_uri(artifact_path)
    enriched = result.model_copy(
        update={
            "run_id": resolved_run_id,
            "artifact_path": artifact_path,
            "artifact_uri": artifact_uri,
        }
    )
    storage.write_json(artifact_path, enriched.model_dump(mode="json"))
    return enriched
