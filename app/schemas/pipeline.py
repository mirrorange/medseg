from typing import Any

from pydantic import BaseModel

from app.pipeline.interface import AvailabilityStatus


class ModuleInfoRead(BaseModel):
    name: str
    version: str
    description: str
    suggestion_priority: int
    max_ram_mb: int
    max_vram_mb: int
    params_schema: dict[str, Any] | None
    enabled: bool
    loaded: bool


class ModuleAvailabilityRead(BaseModel):
    module_name: str
    status: AvailabilityStatus
    target_subset_ids: list[str]
    reason: str | None


class ResourceStatusRead(BaseModel):
    total_ram_mb: int
    total_vram_mb: int
    threshold_ratio: float
    used_ram_mb: int
    used_vram_mb: int
    available_ram_mb: float
    available_vram_mb: float
    loaded_modules: list[str]
