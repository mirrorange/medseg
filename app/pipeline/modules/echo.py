"""Example pipeline module for testing and demonstration."""

import uuid
from typing import Any

from app.pipeline.interface import (
    AvailabilityResult,
    AvailabilityStatus,
    ModuleInfo,
    PipelineModule,
    SubsetRunContext,
    SubsetRunResult,
)


class EchoModule(PipelineModule):
    """A trivial module that 'echoes' the input subset as output.

    Useful for testing the pipeline infrastructure without real AI models.
    """

    def __init__(self) -> None:
        self._loaded = False

    def module_info(self) -> ModuleInfo:
        return ModuleInfo(
            name="echo",
            version="0.1.0",
            description="Echo module for testing — copies input to output",
            suggestion_priority=999,
            max_ram_mb=10,
            max_vram_mb=0,
        )

    async def check_availability(
        self, sample_set_meta: dict[str, Any]
    ) -> AvailabilityResult:
        subset_ids = sample_set_meta.get("subset_ids", [])
        if not subset_ids:
            return AvailabilityResult(
                status=AvailabilityStatus.unavailable,
                reason="No subsets available",
            )
        return AvailabilityResult(
            status=AvailabilityStatus.available,
            target_subset_ids=[uuid.UUID(s) for s in subset_ids],
        )

    async def load(self) -> None:
        self._loaded = True

    async def unload(self) -> None:
        self._loaded = False

    async def run(self, context: SubsetRunContext) -> SubsetRunResult:
        # In a real module this would process images.
        # Echo just returns a new subset ID.
        output_id = uuid.uuid4()
        return SubsetRunResult(
            output_subset_id=output_id,
            metadata={
                "source_module": "echo",
                "source_subset_id": str(context.input_subset_id),
                "params": context.params,
            },
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded
