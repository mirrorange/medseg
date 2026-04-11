"""Pipeline Module Interface — all processing modules must implement this ABC.

Design: modules communicate with the host via a filesystem sandbox.
- Host stages input images to a temp input_dir
- Module reads from input_dir, writes results to output_dir
- Host collects output files, saves to storage, creates DB records
- Module never accesses DB, storage, or any host internals directly
"""

import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from pydantic import BaseModel


class ModuleInfo(BaseModel):
    name: str
    version: str
    description: str
    suggestion_priority: int = 100
    max_ram_mb: int = 0
    max_vram_mb: int = 0
    params_schema: dict[str, Any] | None = None  # JSON Schema for params


# --------------- Awareness I/O ---------------


class SubsetImageSummary(BaseModel):
    """Image-level metadata summary for awareness checks."""

    id: uuid.UUID
    filename: str
    format: str  # "nifti" / "dicom"
    metadata: dict[str, Any] = {}


class SubsetInfo(BaseModel):
    """Subset info with image-level detail, used as awareness input."""

    id: uuid.UUID
    name: str
    type: str
    metadata: dict[str, Any] = {}
    images: list[SubsetImageSummary] = []


class AwarenessInput(BaseModel):
    """Structured input for check_availability — replaces raw dict."""

    sample_set_id: uuid.UUID
    sample_set_name: str
    subsets: list[SubsetInfo] = []


class AvailabilityResult(BaseModel):
    """Module's awareness response — separate available and recommended lists."""

    available_subset_ids: list[uuid.UUID] = []
    recommended_subset_ids: list[uuid.UUID] = []
    reason: str | None = None


# --------------- Run I/O (filesystem sandbox protocol) ---------------


class InputImageInfo(BaseModel):
    """Describes one input image file staged in input_dir."""

    id: uuid.UUID
    filename: str  # Relative to input_dir
    format: str  # "nifti" / "dicom"
    metadata: dict[str, Any] = {}


class OutputImageInfo(BaseModel):
    """Describes one output image file written to output_dir."""

    filename: str  # Relative to output_dir
    format: str
    metadata: dict[str, Any] = {}
    source_image_id: uuid.UUID | None = None  # Link back to input image


class RunInput(BaseModel):
    """Everything a module needs to execute — no host internals exposed."""

    model_config = {"arbitrary_types_allowed": True}

    work_dir: Path  # Temporary working directory (read/write)
    input_dir: Path  # Contains staged input images (read-only to module)
    output_dir: Path  # Module writes output images here
    images: list[InputImageInfo]  # Metadata about input images
    params: dict[str, Any] = {}  # User-specified run parameters
    sample_set_meta: dict[str, Any] = {}  # Sample set context


class RunOutput(BaseModel):
    """Module's processing result — host saves files and creates DB records."""

    type: str  # Output subset type (e.g. "segmentation", "normalized")
    metadata: dict[str, Any] = {}  # Subset-level metadata
    images: list[OutputImageInfo] = []  # Description of output images


# --------------- Abstract base class ---------------


class PipelineModule(ABC):
    """Abstract base class for all processing modules."""

    @abstractmethod
    def module_info(self) -> ModuleInfo:
        """Return module metadata."""

    @abstractmethod
    async def check_availability(
        self, awareness_input: AwarenessInput
    ) -> AvailabilityResult:
        """Check whether this module is applicable to a sample set.

        Receives structured input with image-level metadata per subset.
        Returns separate available and recommended subset ID lists.
        """

    @abstractmethod
    async def load(self) -> None:
        """Load model/resources into memory/GPU."""

    @abstractmethod
    async def unload(self) -> None:
        """Unload model/resources, free memory/GPU."""

    @abstractmethod
    async def run(self, run_input: RunInput) -> RunOutput:
        """Execute processing on staged input files, write output files.

        The module should:
        1. Read images from run_input.input_dir
        2. Process them (using run_input.params if needed)
        3. Write output images to run_input.output_dir
        4. Return a RunOutput describing what was produced
        """

    @property
    def is_loaded(self) -> bool:
        """Override to report load state. Default: False."""
        return False
