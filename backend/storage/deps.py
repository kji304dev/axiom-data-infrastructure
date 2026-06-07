import os

from backend.storage.base import StorageBackend
from backend.storage.local import DEFAULT_LOCAL_ARTIFACTS_DIR, LocalStorageBackend


def get_storage_backend() -> StorageBackend:
    base_dir = os.getenv("ADI_ARTIFACT_DIR", DEFAULT_LOCAL_ARTIFACTS_DIR)
    return LocalStorageBackend(base_dir=base_dir)
