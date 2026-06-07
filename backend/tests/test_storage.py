import json
from pathlib import Path

import pytest

from backend.storage.local import LocalStorageBackend


def test_write_json_creates_nested_file(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)

    written_path = storage.write_json(
        "runs/run-1/report.json",
        {"validation_passed": True, "health_score": 93.0},
    )

    target = tmp_path / "runs/run-1/report.json"
    assert written_path == str(target)
    assert target.is_file()
    assert json.loads(target.read_text(encoding="utf-8")) == {
        "health_score": 93.0,
        "validation_passed": True,
    }
    assert storage.exists("runs/run-1/report.json") is True


def test_write_text_creates_file(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)

    written_path = storage.write_text("runs/run-1/summary.md", "# Run summary\n")

    target = tmp_path / "runs/run-1/summary.md"
    assert written_path == str(target)
    assert target.read_text(encoding="utf-8") == "# Run summary\n"
    assert storage.exists("runs/run-1/summary.md") is True


def test_exists_returns_false_for_missing_path(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)

    assert storage.exists("missing/report.json") is False


def test_read_json_loads_written_payload(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)
    storage.write_json("index/state.json", {"runs": [{"run_id": "abc"}]})

    assert storage.read_json("index/state.json") == {"runs": [{"run_id": "abc"}]}


def test_rejects_absolute_paths(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)

    with pytest.raises(ValueError, match="relative"):
        storage.write_text("/etc/passwd", "nope")


def test_rejects_path_traversal(tmp_path: Path) -> None:
    storage = LocalStorageBackend(base_dir=tmp_path)

    with pytest.raises(ValueError, match="escapes"):
        storage.write_text("../outside.txt", "nope")
