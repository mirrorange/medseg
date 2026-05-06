"""IM-Fuse brain tumor segmentation module for MedSeg Cloud."""

import asyncio
import logging
import os
import shutil
import tempfile
import urllib.request
import uuid
import zipfile
from pathlib import Path
from threading import Lock
from typing import Any

from app.pipeline.interface import (
    AvailabilityResult,
    AwarenessInput,
    InputImageInfo,
    ModuleInfo,
    OutputImageInfo,
    PipelineModule,
    RunInput,
    RunOutput,
    SubsetInfo,
)
from app.pipeline.modules.brats_normalizer import build_subset_metadata_hash

logger = logging.getLogger(__name__)

METADATA_HASH_FIELD = "input_subset_metadata_hash"
SEGMENTATION_METHOD_FIELD = "segmentation_method"
SEGMENTATION_METHOD_VALUE = "imfuse"
IMFUSE_CHECKPOINT_URL = "https://ditto.ing.unimore.it/IM-FUSE/download/checkpoints"
IMFUSE_CHECKPOINT_FILENAME = "model_last.pth"
IMFUSE_CHECKPOINT_ROOT_ENV = "MEDSEG_IMFUSE_CHECKPOINT_DIR"
_DOWNLOAD_CHUNK_SIZE = 1024 * 1024
_DOWNLOAD_TIMEOUT_SECONDS = 30

# BraTS modality name → imfuse-infer modality name
_BRATS_TO_IMFUSE: dict[str, str] = {
    "t1c": "t1ce",
    "t1n": "t1",
    "t2f": "flair",
    "t2w": "t2",
}


class IMFuseSegmenterModule(PipelineModule):
    """IM-Fuse brain tumor segmentation via sliding-window Mamba fusion."""

    _checkpoint_lock = Lock()

    def __init__(self) -> None:
        self._predictor: Any = None
        self._loaded = False
        self._use_gpu = False
        self._mamba_backend = "mambapy"

    # ---- ModuleInfo ----

    def module_info(self) -> ModuleInfo:
        use_gpu = self._detect_gpu()
        if use_gpu and self._detect_mamba_ssm():
            max_ram_mb = 4096
            max_vram_mb = 12288
        else:
            max_ram_mb = 49152
            max_vram_mb = 0

        return ModuleInfo(
            name="IM-Fuse Segmenter",
            version="0.1.0",
            description=(
                "IM-Fuse Mamba-based brain tumor segmentation "
                "(BraTS labels: NCR, ED, ET)"
            ),
            suggestion_priority=100,
            max_ram_mb=max_ram_mb,
            max_vram_mb=max_vram_mb,
        )

    # ---- Availability ----

    async def check_availability(
        self, awareness_input: AwarenessInput
    ) -> AvailabilityResult:
        if not self._is_imfuse_available():
            return AvailabilityResult(reason="imfuse-infer package not installed")

        normalized_subsets = [
            s for s in awareness_input.subsets if self._is_brats_normalized(s)
        ]
        if not normalized_subsets:
            return AvailabilityResult(reason="No BraTS-normalized subsets available")

        processed_hashes = {
            s.metadata.get(METADATA_HASH_FIELD)
            for s in awareness_input.subsets
            if self._is_imfuse_segmentation(s)
        }

        available: list[uuid.UUID] = []
        recommended: list[uuid.UUID] = []

        for subset in normalized_subsets:
            metadata_hash = build_subset_metadata_hash(subset.metadata, subset.images)
            if metadata_hash in processed_hashes:
                available.append(subset.id)
            else:
                recommended.append(subset.id)

        return AvailabilityResult(
            available_subset_ids=available,
            recommended_subset_ids=recommended,
        )

    # ---- Load / Unload ----

    async def load(self) -> None:
        from imfuse_infer import IMFusePredictor

        checkpoint_path = await asyncio.to_thread(self._ensure_checkpoint)

        self._use_gpu = self._detect_gpu()
        if self._use_gpu and self._detect_mamba_ssm():
            self._mamba_backend = "mamba_ssm"
            device = "cuda"
        elif self._use_gpu:
            self._mamba_backend = "mambapy"
            device = "cuda"
        else:
            self._mamba_backend = "mambapy"
            device = "cpu"

        self._predictor = IMFusePredictor(
            checkpoint=str(checkpoint_path),
            device=device,
            mamba_backend=self._mamba_backend,
        )
        self._loaded = True
        logger.info(
            "IM-Fuse loaded (device=%s, mamba_backend=%s)",
            device,
            self._mamba_backend,
        )

    async def unload(self) -> None:
        if self._predictor is not None:
            del self._predictor
            self._predictor = None
        self._loaded = False
        self._try_cuda_cleanup()
        logger.info("IM-Fuse unloaded")

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    # ---- Run ----

    async def run(self, run_input: RunInput) -> RunOutput:
        modality_paths = self._map_modalities(run_input)
        if not modality_paths:
            raise RuntimeError(
                "No BraTS modality images found in input. "
                "Input subset must be BraTS-normalized with modality metadata."
            )

        output_filename = "segmentation.nii.gz"
        output_path = run_input.output_dir / output_filename

        # Map to imfuse-infer modality names and resolve to full paths
        imfuse_paths: dict[str, str] = {}
        source_image_id: uuid.UUID | None = None
        for brats_mod, image in modality_paths.items():
            imfuse_mod = _BRATS_TO_IMFUSE.get(brats_mod)
            if imfuse_mod is None:
                continue
            imfuse_paths[imfuse_mod] = str(run_input.input_dir / image.filename)
            if source_image_id is None:
                source_image_id = image.id

        await asyncio.to_thread(self._run_inference, imfuse_paths, str(output_path))

        if not output_path.exists():
            raise RuntimeError("IM-Fuse inference did not produce output file.")

        subset_hash = build_subset_metadata_hash(
            run_input.input_subset_metadata,
            run_input.images,
        )

        return RunOutput(
            type="segmentation",
            metadata={
                "is_segmentation": True,
                SEGMENTATION_METHOD_FIELD: SEGMENTATION_METHOD_VALUE,
                METADATA_HASH_FIELD: subset_hash,
            },
            images=[
                OutputImageInfo(
                    filename=output_filename,
                    format="nifti",
                    metadata={"is_segmentation": True},
                    source_image_id=source_image_id,
                )
            ],
        )

    # ---- Private helpers ----

    def _ensure_checkpoint(self) -> Path:
        checkpoint_path = self._checkpoint_path()
        if checkpoint_path.is_file():
            return checkpoint_path

        with self._checkpoint_lock:
            if checkpoint_path.is_file():
                return checkpoint_path

            checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
            logger.info("Downloading IM-Fuse checkpoint to %s", checkpoint_path)

            try:
                with tempfile.TemporaryDirectory(
                    prefix="imfuse-checkpoint-",
                    dir=checkpoint_path.parent,
                ) as tmp_dir:
                    archive_path = Path(tmp_dir) / "checkpoints.zip"
                    self._download_checkpoint_archive(archive_path)
                    self._extract_checkpoint(archive_path, checkpoint_path)
            except RuntimeError:
                raise
            except Exception as exc:
                raise RuntimeError(
                    "Failed to prepare IM-Fuse checkpoint. "
                    f"Download it manually from {IMFUSE_CHECKPOINT_URL} and place "
                    f"{IMFUSE_CHECKPOINT_FILENAME} in {checkpoint_path.parent}."
                ) from exc

        return checkpoint_path

    def _checkpoint_path(self) -> Path:
        configured_root = os.environ.get(IMFUSE_CHECKPOINT_ROOT_ENV)
        if configured_root:
            checkpoint_root = Path(configured_root).expanduser()
        else:
            xdg_cache_home = os.environ.get("XDG_CACHE_HOME")
            cache_root = (
                Path(xdg_cache_home).expanduser()
                if xdg_cache_home
                else Path.home() / ".cache"
            )
            checkpoint_root = cache_root / "medseg" / "imfuse"

        return checkpoint_root / IMFUSE_CHECKPOINT_FILENAME

    def _download_checkpoint_archive(self, archive_path: Path) -> None:
        request = urllib.request.Request(
            IMFUSE_CHECKPOINT_URL,
            headers={"User-Agent": "MedSeg IM-Fuse checkpoint downloader"},
        )
        with (
            urllib.request.urlopen(
                request,
                timeout=_DOWNLOAD_TIMEOUT_SECONDS,
            ) as response,
            archive_path.open("wb") as output_file,
        ):
            shutil.copyfileobj(response, output_file, length=_DOWNLOAD_CHUNK_SIZE)

        if archive_path.stat().st_size == 0:
            raise RuntimeError("Downloaded IM-Fuse checkpoint archive is empty.")

    def _extract_checkpoint(self, archive_path: Path, checkpoint_path: Path) -> None:
        temp_checkpoint_path: Path | None = None
        try:
            with zipfile.ZipFile(archive_path) as archive:
                checkpoint_member = self._find_checkpoint_member(archive)
                if checkpoint_member is None:
                    raise RuntimeError(
                        "Downloaded IM-Fuse archive does not contain "
                        f"{IMFUSE_CHECKPOINT_FILENAME}."
                    )

                with tempfile.NamedTemporaryFile(
                    prefix=f".{IMFUSE_CHECKPOINT_FILENAME}.",
                    suffix=".tmp",
                    dir=checkpoint_path.parent,
                    delete=False,
                ) as temp_checkpoint:
                    temp_checkpoint_path = Path(temp_checkpoint.name)
                    with archive.open(checkpoint_member) as source:
                        shutil.copyfileobj(
                            source,
                            temp_checkpoint,
                            length=_DOWNLOAD_CHUNK_SIZE,
                        )

            if temp_checkpoint_path is None:
                raise RuntimeError("Failed to extract IM-Fuse checkpoint.")
            os.replace(temp_checkpoint_path, checkpoint_path)
            logger.info("IM-Fuse checkpoint ready at %s", checkpoint_path)
        finally:
            if temp_checkpoint_path is not None and temp_checkpoint_path.exists():
                temp_checkpoint_path.unlink()

    def _find_checkpoint_member(self, archive: zipfile.ZipFile) -> str | None:
        for member in archive.infolist():
            if (
                not member.is_dir()
                and Path(member.filename).name == IMFUSE_CHECKPOINT_FILENAME
            ):
                return member.filename
        return None

    def _run_inference(self, input_paths: dict[str, str], output_path: str) -> None:
        if self._predictor is None:
            raise RuntimeError("IM-Fuse predictor not loaded")
        self._predictor.predict_nifti(input_paths, output_path)

    def _map_modalities(self, run_input: RunInput) -> dict[str, InputImageInfo]:
        """Map input images to BraTS modalities via metadata."""
        result: dict[str, InputImageInfo] = {}
        for image in run_input.images:
            brats_mod = (image.metadata or {}).get("brats_modality")
            if brats_mod and brats_mod in _BRATS_TO_IMFUSE:
                result[brats_mod] = image
        return result

    def _is_brats_normalized(self, subset: SubsetInfo) -> bool:
        return (
            subset.type.strip().lower() == "normalized"
            and subset.metadata.get("normalization_method") == "brats"
        )

    def _is_imfuse_segmentation(self, subset: SubsetInfo) -> bool:
        return (
            subset.type.strip().lower() == "segmentation"
            and subset.metadata.get(SEGMENTATION_METHOD_FIELD)
            == SEGMENTATION_METHOD_VALUE
            and isinstance(subset.metadata.get(METADATA_HASH_FIELD), str)
        )

    def _is_imfuse_available(self) -> bool:
        try:
            import imfuse_infer  # noqa: F401

            return True
        except ImportError:
            return False

    def _detect_gpu(self) -> bool:
        try:
            import torch

            return bool(torch.cuda.is_available())
        except ImportError:
            return False

    def _detect_mamba_ssm(self) -> bool:
        try:
            import mamba_ssm  # noqa: F401

            return True
        except ImportError:
            return False

    def _try_cuda_cleanup(self) -> None:
        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
