from app.core.config import settings
from app.storage.base import StorageBackend
from app.storage.local import LocalStorageBackend


def get_storage() -> StorageBackend:
    return LocalStorageBackend(root=settings.storage_root)
