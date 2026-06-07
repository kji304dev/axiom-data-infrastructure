from __future__ import annotations

import json
from pathlib import Path

from backend.storage.base import StorageBackend

DEFAULT_LOCAL_ARTIFACTS_DIR = "local_artifacts"


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: Path | str = DEFAULT_LOCAL_ARTIFACTS_DIR) -> None:
        self.base_dir = Path(base_dir).resolve()

    def _resolve_path(self, path: str) -> Path:
        relative = Path(path)
        if relative.is_absolute():
            raise ValueError("path must be relative to the storage base directory")

        target = (self.base_dir / relative).resolve()
        try:
            target.relative_to(self.base_dir)
        except ValueError as error:
            raise ValueError("path escapes storage base directory") from error
        return target

    def write_json(self, path: str, payload: dict) -> str:
        target = self._resolve_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        return str(target)

    def write_text(self, path: str, content: str) -> str:
        target = self._resolve_path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return str(target)

    def read_json(self, path: str) -> dict:
        target = self._resolve_path(path)
        if not target.is_file():
            raise FileNotFoundError(f"JSON object not found: {path}")
        payload = json.loads(target.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            raise ValueError(f"expected JSON object at {path}")
        return payload

    def exists(self, path: str) -> bool:
        return self._resolve_path(path).exists()
