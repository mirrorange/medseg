import shutil
from pathlib import Path
from typing import BinaryIO

import aiofiles
import aiofiles.os

from app.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    def __init__(self, root: Path):
        self.root = root

    def _full_path(self, path: str) -> Path:
        full = (self.root / path).resolve()
        if not str(full).startswith(str(self.root.resolve())):
            raise ValueError("Invalid storage path")
        return full

    async def save(self, path: str, data: bytes | BinaryIO) -> str:
        full = self._full_path(path)
        await aiofiles.os.makedirs(full.parent, exist_ok=True)
        if isinstance(data, bytes):
            async with aiofiles.open(full, "wb") as f:
                await f.write(data)
        else:
            async with aiofiles.open(full, "wb") as f:
                while chunk := data.read(8192):
                    await f.write(chunk)
        return path

    async def load(self, path: str) -> bytes:
        full = self._full_path(path)
        async with aiofiles.open(full, "rb") as f:
            return await f.read()

    async def delete(self, path: str) -> None:
        full = self._full_path(path)
        if full.is_dir():
            shutil.rmtree(full)
        elif full.exists():
            await aiofiles.os.remove(full)

    async def exists(self, path: str) -> bool:
        full = self._full_path(path)
        return full.exists()
