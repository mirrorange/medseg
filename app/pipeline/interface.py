"""Pipeline Module Interface — all processing modules must implement this ABC."""

import uuid
from abc import ABC, abstractmethod
from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class AvailabilityStatus(StrEnum):
    unavailable = "unavailable"
    available = "available"
    recommended = "recommended"


class ModuleInfo(BaseModel):
    name: str
    version: str
    description: str
    suggestion_priority: int = 100
    max_ram_mb: int = 0
    max_vram_mb: int = 0
    params_schema: dict[str, Any] | None = None  # JSON Schema for params


class AvailabilityResult(BaseModel):
    status: AvailabilityStatus
    target_subset_ids: list[uuid.UUID] = []
    reason: str | None = None


class SubsetRunContext(BaseModel):
    sample_set_id: uuid.UUID
    input_subset_id: uuid.UUID
    output_subset_name: str
    params: dict[str, Any] = {}
    storage_root: str = ""


class SubsetRunResult(BaseModel):
    output_subset_id: uuid.UUID
    image_ids: list[uuid.UUID] = []
    metadata: dict[str, Any] = {}


class PipelineModule(ABC):
    """Abstract base class for all processing modules."""

    @abstractmethod
    def module_info(self) -> ModuleInfo:
        """Return module metadata."""

    @abstractmethod
    async def check_availability(
        self, sample_set_meta: dict[str, Any]
    ) -> AvailabilityResult:
        """Check whether this module is applicable to a sample set."""

    @abstractmethod
    async def load(self) -> None:
        """Load model/resources into memory/GPU."""

    @abstractmethod
    async def unload(self) -> None:
        """Unload model/resources, free memory/GPU."""

    @abstractmethod
    async def run(self, context: SubsetRunContext) -> SubsetRunResult:
        """Execute processing, producing a new subset."""

    @property
    def is_loaded(self) -> bool:
        """Override to report load state. Default: False."""
        return False
