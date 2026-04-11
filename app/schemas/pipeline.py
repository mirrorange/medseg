from typing import Any

from pydantic import BaseModel


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


class ModuleAwarenessItem(BaseModel):
    module_name: str
    available_subset_ids: list[str]
    recommended_subset_ids: list[str]
    reason: str | None


class AwarenessResponse(BaseModel):
    primary: ModuleAwarenessItem | None
    suggested: list[ModuleAwarenessItem]
    available: list[ModuleAwarenessItem]


class ResourceStatusRead(BaseModel):
    total_ram_mb: int
    total_vram_mb: int
    threshold_ratio: float
    used_ram_mb: int
    used_vram_mb: int
    available_ram_mb: float
    available_vram_mb: float
    loaded_modules: list[str]
