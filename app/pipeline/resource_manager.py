"""Resource Manager — track loaded modules, enforce thresholds, eviction."""

import logging

from app.pipeline.interface import PipelineModule

logger = logging.getLogger(__name__)


class InsufficientResources(Exception):
    """Raised when resources are insufficient even after eviction."""


class ResourceManager:
    """Track resource usage and manage module loading/unloading."""

    def __init__(
        self,
        *,
        total_ram_mb: int = 0,
        total_vram_mb: int = 0,
        threshold_ratio: float = 0.8,
    ) -> None:
        self.total_ram_mb = total_ram_mb
        self.total_vram_mb = total_vram_mb
        self.threshold_ratio = threshold_ratio

        # {module_name: PipelineModule} — currently loaded
        self._loaded: dict[str, PipelineModule] = {}

    # --------------- Properties ---------------

    @property
    def ram_threshold(self) -> float:
        return self.total_ram_mb * self.threshold_ratio

    @property
    def vram_threshold(self) -> float:
        return self.total_vram_mb * self.threshold_ratio

    @property
    def used_ram_mb(self) -> int:
        return sum(m.module_info().max_ram_mb for m in self._loaded.values())

    @property
    def used_vram_mb(self) -> int:
        return sum(m.module_info().max_vram_mb for m in self._loaded.values())

    @property
    def loaded_module_names(self) -> set[str]:
        return set(self._loaded)

    def is_loaded(self, name: str) -> bool:
        return name in self._loaded

    # --------------- Load / Unload ---------------

    async def load_module(
        self,
        module: PipelineModule,
        *,
        queue_wait_times: dict[str, float] | None = None,
    ) -> None:
        """Load a module, evicting others if necessary.

        Args:
            module: The module to load.
            queue_wait_times: {module_name: wait_ms} for eviction priority.
        """
        info = module.module_info()
        if info.name in self._loaded:
            return  # Already loaded

        needed_ram = info.max_ram_mb
        needed_vram = info.max_vram_mb

        # Check if eviction is needed
        while (
            self.used_ram_mb + needed_ram > self.ram_threshold
            or self.used_vram_mb + needed_vram > self.vram_threshold
        ):
            evicted = await self._evict_one(queue_wait_times or {}, exclude={info.name})
            if not evicted:
                raise InsufficientResources(
                    f"Cannot load {info.name}: insufficient resources "
                    f"(need RAM={needed_ram}MB VRAM={needed_vram}MB, "
                    f"available RAM={self.ram_threshold - self.used_ram_mb:.0f}MB "
                    f"VRAM={self.vram_threshold - self.used_vram_mb:.0f}MB)"
                )

        await module.load()
        self._loaded[info.name] = module
        logger.info(
            "Loaded module %s (RAM=%dMB, VRAM=%dMB)",
            info.name,
            needed_ram,
            needed_vram,
        )

    async def unload_module(self, name: str) -> bool:
        module = self._loaded.pop(name, None)
        if module is None:
            return False
        await module.unload()
        info = module.module_info()
        logger.info(
            "Unloaded module %s (freed RAM=%dMB, VRAM=%dMB)",
            name,
            info.max_ram_mb,
            info.max_vram_mb,
        )
        return True

    # --------------- Eviction ---------------

    async def _evict_one(
        self,
        queue_wait_times: dict[str, float],
        exclude: set[str],
    ) -> bool:
        """Evict one loaded module per FR-2.3 strategy.

        1. Prefer modules with empty queues (wait_time absent or 0).
        2. Then evict the module whose queue head has shortest wait time.

        Returns True if a module was evicted, False otherwise.
        """
        candidates = [name for name in self._loaded if name not in exclude]

        if not candidates:
            return False

        # Split into empty-queue and non-empty-queue
        empty_queue = [n for n in candidates if queue_wait_times.get(n, 0) == 0]
        non_empty_queue = [n for n in candidates if queue_wait_times.get(n, 0) > 0]

        if empty_queue:
            victim = empty_queue[0]
        elif non_empty_queue:
            # Evict the one with shortest wait time
            victim = min(non_empty_queue, key=lambda n: queue_wait_times.get(n, 0))
        else:
            return False

        await self.unload_module(victim)
        return True

    # --------------- Status ---------------

    def status(self) -> dict:
        return {
            "total_ram_mb": self.total_ram_mb,
            "total_vram_mb": self.total_vram_mb,
            "threshold_ratio": self.threshold_ratio,
            "used_ram_mb": self.used_ram_mb,
            "used_vram_mb": self.used_vram_mb,
            "available_ram_mb": max(0, self.ram_threshold - self.used_ram_mb),
            "available_vram_mb": max(0, self.vram_threshold - self.used_vram_mb),
            "loaded_modules": list(self._loaded.keys()),
        }
