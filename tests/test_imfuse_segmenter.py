import uuid

import pytest

from app.pipeline.interface import (
    AwarenessInput,
    SubsetImageSummary,
    SubsetInfo,
)
from app.pipeline.modules.brats_normalizer import build_subset_metadata_hash
from app.pipeline.modules.imfuse_segmenter import IMFuseSegmenterModule


def test_imfuse_module_info():
    mod = IMFuseSegmenterModule()
    info = mod.module_info()

    assert info.name == "IM-Fuse Segmenter"
    assert info.version == "0.1.0"
    assert info.suggestion_priority == 100


def test_imfuse_module_info_cpu_resources():
    mod = IMFuseSegmenterModule()
    mod._detect_gpu = lambda: False
    info = mod.module_info()

    assert info.max_ram_mb == 49152
    assert info.max_vram_mb == 0


def test_imfuse_module_info_gpu_mamba_ssm_resources():
    mod = IMFuseSegmenterModule()
    mod._detect_gpu = lambda: True
    mod._detect_mamba_ssm = lambda: True
    info = mod.module_info()

    assert info.max_ram_mb == 4096
    assert info.max_vram_mb == 12288


@pytest.mark.asyncio
async def test_imfuse_not_available_without_package():
    mod = IMFuseSegmenterModule()
    mod._is_imfuse_available = lambda: False

    result = await mod.check_availability(
        AwarenessInput(
            sample_set_id=uuid.uuid4(),
            sample_set_name="Case 001",
            subsets=[],
        )
    )

    assert result.available_subset_ids == []
    assert result.recommended_subset_ids == []
    assert "not installed" in (result.reason or "")


@pytest.mark.asyncio
async def test_imfuse_no_normalized_subsets():
    mod = IMFuseSegmenterModule()
    mod._is_imfuse_available = lambda: True

    raw_subset = SubsetInfo(
        id=uuid.uuid4(),
        name="raw",
        type="raw",
        metadata={},
        images=[],
    )

    result = await mod.check_availability(
        AwarenessInput(
            sample_set_id=uuid.uuid4(),
            sample_set_name="Case 001",
            subsets=[raw_subset],
        )
    )

    assert result.available_subset_ids == []
    assert result.recommended_subset_ids == []


@pytest.mark.asyncio
async def test_imfuse_recommends_unprocessed_brats_subset():
    mod = IMFuseSegmenterModule()
    mod._is_imfuse_available = lambda: True

    normalized_id = uuid.uuid4()
    normalized_subset = SubsetInfo(
        id=normalized_id,
        name="normalized",
        type="normalized",
        metadata={"normalization_method": "brats"},
        images=[
            SubsetImageSummary(
                id=uuid.uuid4(),
                filename="t1c.nii.gz",
                format="nifti",
                metadata={"brats_modality": "t1c"},
            )
        ],
    )

    result = await mod.check_availability(
        AwarenessInput(
            sample_set_id=uuid.uuid4(),
            sample_set_name="Case 001",
            subsets=[normalized_subset],
        )
    )

    assert result.recommended_subset_ids == [normalized_id]
    assert result.available_subset_ids == []


@pytest.mark.asyncio
async def test_imfuse_marks_processed_subset_available():
    mod = IMFuseSegmenterModule()
    mod._is_imfuse_available = lambda: True

    normalized_id = uuid.uuid4()
    images = [
        SubsetImageSummary(
            id=uuid.uuid4(),
            filename="t1c.nii.gz",
            format="nifti",
            metadata={"brats_modality": "t1c"},
        )
    ]
    norm_metadata = {"normalization_method": "brats"}

    normalized_subset = SubsetInfo(
        id=normalized_id,
        name="normalized",
        type="normalized",
        metadata=norm_metadata,
        images=images,
    )

    metadata_hash = build_subset_metadata_hash(norm_metadata, images)
    seg_subset = SubsetInfo(
        id=uuid.uuid4(),
        name="segmentation",
        type="segmentation",
        metadata={
            "segmentation_method": "imfuse",
            "input_subset_metadata_hash": metadata_hash,
        },
        images=[],
    )

    result = await mod.check_availability(
        AwarenessInput(
            sample_set_id=uuid.uuid4(),
            sample_set_name="Case 001",
            subsets=[normalized_subset, seg_subset],
        )
    )

    assert result.available_subset_ids == [normalized_id]
    assert result.recommended_subset_ids == []
