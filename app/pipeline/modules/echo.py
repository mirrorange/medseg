"""Example pipeline module for testing and demonstration.

Demonstrates the filesystem sandbox protocol:
- Reads files from run_input.input_dir
- Copies them to run_input.output_dir (trivial "echo" processing)
- Returns RunOutput describing what was produced
"""

import shutil
from typing import Any

from app.pipeline.interface import (
    AvailabilityResult,
    AvailabilityStatus,
    ModuleInfo,
    OutputImageInfo,
    PipelineModule,
    RunInput,
    RunOutput,
)


class EchoModule(PipelineModule):
    """A trivial module that 'echoes' input images to output.

    Copies each input image to the output directory unchanged.
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
            target_subset_ids=subset_ids,
        )

    async def load(self) -> None:
        self._loaded = True

    async def unload(self) -> None:
        self._loaded = False

    async def run(self, run_input: RunInput) -> RunOutput:
        output_images = []
        for img in run_input.images:
            src = run_input.input_dir / img.filename
            dst = run_input.output_dir / img.filename
            if src.exists():
                shutil.copy2(src, dst)
            output_images.append(
                OutputImageInfo(
                    filename=img.filename,
                    format=img.format,
                    metadata=img.metadata,
                    source_image_id=img.id,
                )
            )
        return RunOutput(
            type="echo",
            metadata={
                "source_module": "echo",
                "params": run_input.params,
            },
            images=output_images,
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded
