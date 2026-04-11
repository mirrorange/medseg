"""Pipeline singleton instances — import from here to avoid circular imports."""

from app.core.config import settings
from app.pipeline.registry import ModuleRegistry
from app.pipeline.resource_manager import ResourceManager

registry = ModuleRegistry()
resource_manager = ResourceManager(
    threshold_ratio=settings.resource_threshold_ratio,
)
