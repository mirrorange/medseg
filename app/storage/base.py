from abc import ABC, abstractmethod
from typing import BinaryIO


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, path: str, data: bytes | BinaryIO) -> str: ...

    @abstractmethod
    async def load(self, path: str) -> bytes: ...

    @abstractmethod
    async def delete(self, path: str) -> None: ...

    @abstractmethod
    async def exists(self, path: str) -> bool: ...
