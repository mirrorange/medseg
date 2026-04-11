"""Module Registry — discovery, registration, enable/disable management."""

import importlib
import inspect
import logging
from pathlib import Path

from app.pipeline.interface import ModuleInfo, PipelineModule

logger = logging.getLogger(__name__)


class ModuleRegistry:
    """Maintains a registry of pipeline modules discovered at startup."""

    def __init__(self) -> None:
        self._modules: dict[str, PipelineModule] = {}
        self._enabled: set[str] = set()

    # --------------- Discovery ---------------

    def discover(self, modules_dir: Path) -> int:
        """Scan *modules_dir* for PipelineModule subclasses and register them.

        Returns the number of newly registered modules.
        """
        count = 0
        if not modules_dir.is_dir():
            logger.warning("modules_dir does not exist: %s", modules_dir)
            return count

        for py_file in sorted(modules_dir.glob("*.py")):
            if py_file.name.startswith("_"):
                continue
            module_name = py_file.stem
            spec_name = f"app.pipeline.modules.{module_name}"
            try:
                mod = importlib.import_module(spec_name)
            except Exception:
                logger.exception("Failed to import module %s", spec_name)
                continue

            for _attr_name, obj in inspect.getmembers(mod, inspect.isclass):
                if issubclass(obj, PipelineModule) and obj is not PipelineModule:
                    try:
                        instance = obj()
                        self.register(instance)
                        count += 1
                    except Exception:
                        logger.exception("Failed to instantiate %s", obj.__name__)
        return count

    # --------------- Registration ---------------

    def register(self, module: PipelineModule) -> None:
        info = module.module_info()
        name = info.name
        if name in self._modules:
            logger.warning("Module %s already registered, overwriting", name)
        self._modules[name] = module
        self._enabled.add(name)
        logger.info("Registered module: %s v%s", name, info.version)

    def unregister(self, name: str) -> None:
        self._modules.pop(name, None)
        self._enabled.discard(name)

    # --------------- Enable / Disable ---------------

    def enable(self, name: str) -> bool:
        if name not in self._modules:
            return False
        self._enabled.add(name)
        return True

    def disable(self, name: str) -> bool:
        if name not in self._modules:
            return False
        self._enabled.discard(name)
        return True

    def is_enabled(self, name: str) -> bool:
        return name in self._enabled

    # --------------- Query ---------------

    def get(self, name: str) -> PipelineModule | None:
        return self._modules.get(name)

    def list_all(self) -> list[tuple[ModuleInfo, bool]]:
        """Return [(info, enabled), ...] sorted by name."""
        result = []
        for name, mod in sorted(self._modules.items()):
            result.append((mod.module_info(), name in self._enabled))
        return result

    def list_enabled(self) -> list[PipelineModule]:
        return [self._modules[n] for n in sorted(self._enabled) if n in self._modules]

    def __len__(self) -> int:
        return len(self._modules)
