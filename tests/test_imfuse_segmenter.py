import sys
import types
import uuid
import zipfile

import pytest

from app.pipeline.interface import (
    AwarenessInput,
    SubsetImageSummary,
    SubsetInfo,
)
from app.pipeline.modules.brats_normalizer import build_subset_metadata_hash
from app.pipeline.modules.imfuse_segmenter import (
    IMFUSE_CHECKPOINT_FILENAME,
    IMFUSE_CHECKPOINT_ROOT_ENV,
    IMFuseSegmenterModule,
)


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


def test_imfuse_checkpoint_path_uses_env_override(tmp_path, monkeypatch):
    checkpoint_root = tmp_path / "weights"
    monkeypatch.setenv(IMFUSE_CHECKPOINT_ROOT_ENV, str(checkpoint_root))

    mod = IMFuseSegmenterModule()

    assert mod._checkpoint_path() == checkpoint_root / IMFUSE_CHECKPOINT_FILENAME


def test_imfuse_ensure_checkpoint_reuses_existing_file(tmp_path):
    checkpoint_path = tmp_path / IMFUSE_CHECKPOINT_FILENAME
    checkpoint_path.write_bytes(b"already downloaded")

    mod = IMFuseSegmenterModule()
    mod._checkpoint_path = lambda: checkpoint_path
    mod._download_checkpoint_archive = lambda archive_path: pytest.fail(
        "existing checkpoints should not be downloaded again"
    )

    assert mod._ensure_checkpoint() == checkpoint_path


def test_imfuse_ensure_checkpoint_downloads_and_extracts_zip(tmp_path):
    source_archive = tmp_path / "source.zip"
    checkpoint_root = tmp_path / "cache"
    checkpoint_path = checkpoint_root / IMFUSE_CHECKPOINT_FILENAME
    expected_weights = b"fake model weights"

    with zipfile.ZipFile(source_archive, "w") as archive:
        archive.writestr(f"nested/{IMFUSE_CHECKPOINT_FILENAME}", expected_weights)

    mod = IMFuseSegmenterModule()
    mod._checkpoint_path = lambda: checkpoint_path
    mod._download_checkpoint_archive = lambda archive_path: archive_path.write_bytes(
        source_archive.read_bytes()
    )

    assert mod._ensure_checkpoint() == checkpoint_path
    assert checkpoint_path.read_bytes() == expected_weights


def test_imfuse_ensure_checkpoint_rejects_zip_without_model(tmp_path):
    source_archive = tmp_path / "source.zip"
    checkpoint_path = tmp_path / "cache" / IMFUSE_CHECKPOINT_FILENAME

    with zipfile.ZipFile(source_archive, "w") as archive:
        archive.writestr("README.txt", "no checkpoint here")

    mod = IMFuseSegmenterModule()
    mod._checkpoint_path = lambda: checkpoint_path
    mod._download_checkpoint_archive = lambda archive_path: archive_path.write_bytes(
        source_archive.read_bytes()
    )

    with pytest.raises(RuntimeError, match=IMFUSE_CHECKPOINT_FILENAME):
        mod._ensure_checkpoint()


@pytest.mark.asyncio
async def test_imfuse_load_uses_resolved_checkpoint_path(tmp_path, monkeypatch):
    checkpoint_path = tmp_path / IMFUSE_CHECKPOINT_FILENAME
    captured_kwargs = {}

    class FakePredictor:
        def __init__(self, **kwargs):
            captured_kwargs.update(kwargs)

    fake_module = types.SimpleNamespace(IMFusePredictor=FakePredictor)
    monkeypatch.setitem(sys.modules, "imfuse_infer", fake_module)

    mod = IMFuseSegmenterModule()
    mod._detect_gpu = lambda: False
    mod._ensure_checkpoint = lambda: checkpoint_path

    await mod.load()

    assert captured_kwargs["checkpoint"] == str(checkpoint_path)
    assert captured_kwargs["device"] == "cpu"
    assert captured_kwargs["mamba_backend"] == "mambapy"


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
