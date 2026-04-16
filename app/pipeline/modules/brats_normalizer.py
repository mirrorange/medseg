"""BraTS-style MRI normalization module backed by BrainLes preprocessing."""

import asyncio
import hashlib
import json
import re
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.pipeline.interface import (
    AvailabilityResult,
    AwarenessInput,
    InputImageInfo,
    ModuleInfo,
    OutputImageInfo,
    PipelineModule,
    RunInput,
    RunOutput,
    SubsetImageSummary,
    SubsetInfo,
)

BRATS_MODALITY_ORDER = ("t1c", "t1n", "t2f", "t2w")
DEFAULT_CENTER_MODALITY_ORDER = ("t1c", "t1n", "t2f", "t2w")
METADATA_HASH_FIELD = "input_subset_metadata_hash"
NORMALIZATION_METHOD_FIELD = "normalization_method"

_T1C_PATTERNS = (
    "t1c",
    "t1ce",
    "t1gd",
    "t1_gd",
    "t1-post",
    "t1post",
    "postcontrast",
    "post-contrast",
    "contrast",
)
_T2F_PATTERNS = ("t2f", "flair", "fla")
_T2W_PATTERNS = ("t2w",)
_T1N_PATTERNS = (
    "t1n",
    "noncontrast",
    "non-contrast",
    "precontrast",
    "pre-contrast",
    "native",
)
_METADATA_MODALITY_KEYS = (
    "brats_modality",
    "modality",
    "series_description",
    "sequence_name",
    "protocol_name",
    "series_type",
)


class BratsNormalizationParams(BaseModel):
    t1n_image: str | None = Field(
        default=None,
        description="Filename or image UUID to use as BraTS T1n.",
    )
    t1c_image: str | None = Field(
        default=None,
        description="Filename or image UUID to use as BraTS T1c.",
    )
    t2f_image: str | None = Field(
        default=None,
        description="Filename or image UUID to use as BraTS T2f/FLAIR.",
    )
    t2w_image: str | None = Field(
        default=None,
        description="Filename or image UUID to use as BraTS T2w.",
    )
    use_gpu: bool = Field(
        default=True,
        description="Allow BrainLes preprocessing backends to use GPU when available.",
    )


@dataclass(frozen=True)
class PreparedBratsInput:
    modality: str
    source_image_id: uuid.UUID
    input_path: Path
    format: str


def _canonicalize_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _canonicalize_json(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [_canonicalize_json(item) for item in value]
    if isinstance(value, tuple):
        return [_canonicalize_json(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _normalize_format(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"nifti", "nii", "nii.gz"}:
        return "nifti"
    if normalized in {"dicom", "dcm"}:
        return "dicom"
    return normalized


def _subset_hash_payload(
    subset_metadata: dict[str, Any] | None,
    images: Iterable[SubsetImageSummary | InputImageInfo],
) -> dict[str, Any]:
    return {
        "subset_metadata": _canonicalize_json(subset_metadata or {}),
        "images": [
            {
                "filename": image.filename,
                "format": _normalize_format(image.format),
                "metadata": _canonicalize_json(image.metadata or {}),
            }
            for image in sorted(images, key=lambda item: item.filename)
        ],
    }


def build_subset_metadata_hash(
    subset_metadata: dict[str, Any] | None,
    images: Iterable[SubsetImageSummary | InputImageInfo],
) -> str:
    payload = _subset_hash_payload(subset_metadata, images)
    serialized = json.dumps(
        payload,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class BratsNormalizerModule(PipelineModule):
    def __init__(self) -> None:
        self._loaded = False

    def module_info(self) -> ModuleInfo:
        return ModuleInfo(
            name="brats_normalizer",
            version="0.1.0",
            description=(
                "BraTS2023 GLI-style MRI normalization via "
                "BrainLes preprocessing"
            ),
            suggestion_priority=80,
            max_ram_mb=4096,
            max_vram_mb=4096,
            params_schema=BratsNormalizationParams.model_json_schema(),
        )

    async def check_availability(
        self, awareness_input: AwarenessInput
    ) -> AvailabilityResult:
        raw_subsets = [
            subset
            for subset in awareness_input.subsets
            if self._is_raw_subset(subset)
        ]
        if not raw_subsets:
            return AvailabilityResult(reason="No raw subsets available")

        processed_hashes = {
            subset.metadata.get(METADATA_HASH_FIELD)
            for subset in awareness_input.subsets
            if self._is_matching_normalized_subset(subset)
        }

        available = []
        recommended = []
        for subset in raw_subsets:
            metadata_hash = build_subset_metadata_hash(subset.metadata, subset.images)
            if metadata_hash in processed_hashes:
                available.append(subset.id)
            else:
                recommended.append(subset.id)

        return AvailabilityResult(
            available_subset_ids=available,
            recommended_subset_ids=recommended,
        )

    async def load(self) -> None:
        self._load_brainles_components()
        self._loaded = True

    async def unload(self) -> None:
        self._loaded = False

    async def run(self, run_input: RunInput) -> RunOutput:
        params = BratsNormalizationParams.model_validate(run_input.params or {})
        selected_inputs = self._select_brats_inputs(run_input.images, params)
        if not selected_inputs:
            raise RuntimeError(
                "No BraTS-compatible images were found. "
                "Provide modality metadata or explicit modality params."
            )

        prepared_inputs = self._prepare_inputs(run_input, selected_inputs)
        await asyncio.to_thread(
            self._run_brainles_preprocessing,
            prepared_inputs,
            run_input.output_dir,
            run_input.work_dir,
            params.use_gpu,
        )

        output_images = []
        for modality in self._ordered_modalities(prepared_inputs):
            output_filename = f"{modality}.nii.gz"
            output_path = run_input.output_dir / output_filename
            if not output_path.exists():
                raise RuntimeError(
                    "BrainLes preprocessing did not produce expected output "
                    f"for {modality}."
                )
            prepared = prepared_inputs[modality]
            output_images.append(
                OutputImageInfo(
                    filename=output_filename,
                    format="nifti",
                    metadata={"brats_modality": modality},
                    source_image_id=prepared.source_image_id,
                )
            )

        subset_hash = build_subset_metadata_hash(
            run_input.input_subset_metadata,
            run_input.images,
        )
        return RunOutput(
            type="normalized",
            metadata={
                NORMALIZATION_METHOD_FIELD: "brats",
                METADATA_HASH_FIELD: subset_hash,
                "brats_atlas": "SRI24",
                "brats_modalities": self._ordered_modalities(prepared_inputs),
            },
            images=output_images,
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def _prepare_inputs(
        self,
        run_input: RunInput,
        selected_inputs: dict[str, InputImageInfo],
    ) -> dict[str, PreparedBratsInput]:
        converted_dir = run_input.work_dir / "converted"
        prepared_inputs: dict[str, PreparedBratsInput] = {}

        for modality, image in selected_inputs.items():
            input_path = run_input.input_dir / image.filename
            input_format = _normalize_format(image.format)
            if input_format == "nifti":
                prepared_path = input_path
            elif input_format == "dicom":
                converted_dir.mkdir(parents=True, exist_ok=True)
                prepared_path = self._convert_dicom_image(
                    input_path,
                    converted_dir / f"{modality}.nii.gz",
                )
            else:
                raise RuntimeError(
                    f"Unsupported input format '{image.format}' for {image.filename}."
                )

            prepared_inputs[modality] = PreparedBratsInput(
                modality=modality,
                source_image_id=image.id,
                input_path=prepared_path,
                format="nifti",
            )

        return prepared_inputs

    def _run_brainles_preprocessing(
        self,
        prepared_inputs: dict[str, PreparedBratsInput],
        output_dir: Path,
        work_dir: Path,
        use_gpu: bool,
    ) -> None:
        components = self._load_brainles_components()
        normalizer = components["PercentileNormalizer"](
            lower_percentile=0.1,
            upper_percentile=99.9,
            lower_limit=0,
            upper_limit=1,
        )

        center_modality_name = self._choose_center_modality(prepared_inputs)
        center_input = prepared_inputs[center_modality_name]
        center_modality = components["CenterModality"](
            modality_name=center_modality_name,
            input_path=center_input.input_path,
            normalizer=normalizer,
            normalized_bet_output_path=output_dir / f"{center_modality_name}.nii.gz",
            atlas_correction=True,
            n4_bias_correction=True,
        )

        moving_modalities = []
        for modality in self._ordered_modalities(prepared_inputs):
            if modality == center_modality_name:
                continue
            moving_input = prepared_inputs[modality]
            moving_modalities.append(
                components["Modality"](
                    modality_name=modality,
                    input_path=moving_input.input_path,
                    normalizer=normalizer,
                    normalized_bet_output_path=output_dir / f"{modality}.nii.gz",
                    atlas_correction=True,
                    n4_bias_correction=True,
                )
            )

        preprocessor = components["AtlasCentricPreprocessor"](
            center_modality=center_modality,
            moving_modalities=moving_modalities,
            atlas_image_path=components["Atlas"].BRATS_SRI24,
            temp_folder=work_dir / "brainles",
            use_gpu=use_gpu,
        )
        preprocessor.run()

    def _convert_dicom_image(self, source_path: Path, output_path: Path) -> Path:
        sitk = self._load_simpleitk()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if source_path.is_dir():
            reader = sitk.ImageSeriesReader()
            dicom_names = reader.GetGDCMSeriesFileNames(str(source_path))
            if not dicom_names:
                raise RuntimeError(f"No DICOM series found in {source_path}.")
            reader.SetFileNames(dicom_names)
            image = reader.Execute()
        else:
            image = sitk.ReadImage(str(source_path))

        sitk.WriteImage(image, str(output_path))
        return output_path

    def _load_simpleitk(self):
        try:
            import SimpleITK as sitk
        except ImportError as exc:
            raise RuntimeError(
                "SimpleITK is required for DICOM to NIfTI conversion."
            ) from exc
        return sitk

    def _load_brainles_components(self) -> dict[str, Any]:
        try:
            from brainles_preprocessing.constants import Atlas
            from brainles_preprocessing.modality import CenterModality, Modality
            from brainles_preprocessing.normalization.percentile_normalizer import (
                PercentileNormalizer,
            )
            from brainles_preprocessing.preprocessor import AtlasCentricPreprocessor
        except ImportError as exc:
            raise RuntimeError(
                "brainles-preprocessing is required for BraTS normalization. "
                "Upstream notes Python 3.13 installations may also need antspyx "
                "build prerequisites such as cmake."
            ) from exc

        return {
            "Atlas": Atlas,
            "CenterModality": CenterModality,
            "Modality": Modality,
            "PercentileNormalizer": PercentileNormalizer,
            "AtlasCentricPreprocessor": AtlasCentricPreprocessor,
        }

    def _select_brats_inputs(
        self,
        images: list[InputImageInfo],
        params: BratsNormalizationParams,
    ) -> dict[str, InputImageInfo]:
        by_identity = {
            image.filename: image for image in images
        }
        by_identity.update({str(image.id): image for image in images})

        selected: dict[str, InputImageInfo] = {}
        assigned_ids: set[uuid.UUID] = set()

        for modality, selector in (
            ("t1n", params.t1n_image),
            ("t1c", params.t1c_image),
            ("t2f", params.t2f_image),
            ("t2w", params.t2w_image),
        ):
            if selector is None:
                continue
            image = by_identity.get(selector)
            if image is None:
                raise RuntimeError(
                    "Unable to resolve configured image "
                    f"'{selector}' for modality {modality}."
                )
            if image.id in assigned_ids:
                raise RuntimeError(
                    f"Image '{selector}' was assigned to multiple BraTS modalities."
                )
            selected[modality] = image
            assigned_ids.add(image.id)

        inferred: dict[str, InputImageInfo] = {}
        for image in images:
            if image.id in assigned_ids:
                continue
            modality = self._infer_modality(image)
            if modality is None or modality in selected:
                continue
            if modality in inferred and inferred[modality].id != image.id:
                raise RuntimeError(
                    f"Multiple images matched BraTS modality {modality}. "
                    "Specify modality params to disambiguate."
                )
            inferred[modality] = image

        selected.update(inferred)
        return {
            modality: image
            for modality, image in selected.items()
            if modality in BRATS_MODALITY_ORDER
        }

    def _infer_modality(self, image: InputImageInfo) -> str | None:
        filename_stem = image.filename.lower().removesuffix(".gz")
        candidates = [filename_stem]
        metadata = image.metadata or {}
        for key in _METADATA_MODALITY_KEYS:
            value = metadata.get(key)
            if isinstance(value, str) and value.strip():
                candidates.append(value.lower())

        for text in candidates:
            modality = self._match_modality_text(text)
            if modality is not None:
                return modality
        return None

    def _match_modality_text(self, text: str) -> str | None:
        normalized = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
        compact = normalized.replace(" ", "")

        if self._contains_any(compact, _T1C_PATTERNS):
            return "t1c"
        if self._contains_any(compact, _T2F_PATTERNS):
            return "t2f"
        if self._contains_any(compact, _T2W_PATTERNS) or " t2 " in f" {normalized} ":
            return "t2w"
        if self._contains_any(compact, _T1N_PATTERNS) or " t1 " in f" {normalized} ":
            return "t1n"
        return None

    def _contains_any(self, text: str, patterns: tuple[str, ...]) -> bool:
        return any(pattern in text for pattern in patterns)

    def _ordered_modalities(
        self,
        prepared_inputs: dict[str, PreparedBratsInput] | dict[str, InputImageInfo],
    ) -> list[str]:
        return [
            modality
            for modality in BRATS_MODALITY_ORDER
            if modality in prepared_inputs
        ]

    def _choose_center_modality(
        self,
        prepared_inputs: dict[str, PreparedBratsInput],
    ) -> str:
        for modality in DEFAULT_CENTER_MODALITY_ORDER:
            if modality in prepared_inputs:
                return modality
        raise RuntimeError("At least one BraTS modality is required for normalization.")

    def _is_raw_subset(self, subset: SubsetInfo) -> bool:
        return subset.type.strip().lower() == "raw"

    def _is_matching_normalized_subset(self, subset: SubsetInfo) -> bool:
        return (
            subset.type.strip().lower() == "normalized"
            and subset.metadata.get(NORMALIZATION_METHOD_FIELD) == "brats"
            and isinstance(subset.metadata.get(METADATA_HASH_FIELD), str)
        )
