"""Pipeline singleton instances — import from here to avoid circular imports."""

from app.core.config import settings
from app.pipeline.registry import ModuleRegistry
from app.pipeline.resource_manager import ResourceManager
from app.pipeline.scheduler import Scheduler

registry = ModuleRegistry()
resource_manager = ResourceManager(
    threshold_ratio=settings.resource_threshold_ratio,
)
scheduler = Scheduler(
    affinity_bonus_ms=settings.affinity_bonus_ms,
    max_retry_count=settings.max_retry_count,
)
