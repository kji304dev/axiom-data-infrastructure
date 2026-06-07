from __future__ import annotations

from abc import ABC, abstractmethod


class StorageBackend(ABC):
    @abstractmethod
    def write_json(self, path: str, payload: dict) -> str:
        """Serialize and persist a JSON payload at the given relative path."""

    @abstractmethod
    def write_text(self, path: str, content: str) -> str:
        """Persist text content at the given relative path."""

    @abstractmethod
    def read_json(self, path: str) -> dict:
        """Load a JSON object from the given relative path."""

    @abstractmethod
    def exists(self, path: str) -> bool:
        """Return whether an object exists at the given relative path."""
