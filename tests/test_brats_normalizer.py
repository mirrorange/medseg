import uuid
from pathlib import Path

import pytest

from app.pipeline.interface import (
    AwarenessInput,
    InputImageInfo,
    RunInput,
    SubsetImageSummary,
    SubsetInfo,
)
from app.pipeline.modules.brats_normalizer import (
    BratsNormalizerModule,
    build_subset_metadata_hash,
)


def test_brats_normalizer_module_info():
    mod = BratsNormalizerModule()
    mod._gpu_available = lambda: True
    info = mod.module_info()

    assert info.name == "brats_normalizer"
    assert info.version == "0.1.0"
    assert info.max_vram_mb == 4096
    assert info.params_schema is not None
    assert "use_gpu" not in info.params_schema["properties"]


def test_brats_normalizer_module_info_sets_vram_to_zero_without_gpu():
    mod = BratsNormalizerModule()
    mod._gpu_available = lambda: False

    info = mod.module_info()

    assert info.max_vram_mb == 0


@pytest.mark.asyncio
async def test_brats_normalizer_recommends_unprocessed_raw_subset():
    mod = BratsNormalizerModule()
    raw_subset_id = uuid.uuid4()
    raw_subset = SubsetInfo(
        id=raw_subset_id,
        name="raw",
        type="raw",
        metadata={"study_uid": "study-1"},
        images=[
            SubsetImageSummary(
                id=uuid.uuid4(),
                filename="case_t1c.nii.gz",
                format="NIfTI",
                metadata={"modality": "t1c"},
            )
        ],
    )

    result = await mod.check_availability(
        AwarenessInput(
            sample_set_id=uuid.uuid4(),
            sample_set_name="Case 001",
            subsets=[raw_subset],
        )
    )

    assert result.available_subset_ids == []
    assert result.recommended_subset_ids == [raw_subset_id]


@pytest.mark.asyncio
async def test_brats_normalizer_marks_processed_raw_subset_available():
    mod = BratsNormalizerModule()
    raw_subset_id = uuid.uuid4()
    raw_subset = SubsetInfo(
        id=raw_subset_id,
        name="raw",
        type="raw",
        metadata={"study_uid": "study-1"},
        images=[
            SubsetImageSummary(
                id=uuid.uuid4(),
                filename="case_t1c.nii.gz",
                format="NIfTI",
                metadata={"modality": "t1c"},
            )
        ],
    )
    metadata_hash = build_subset_metadata_hash(
        raw_subset.metadata,
        raw_subset.images,
    )
    normalized_subset = SubsetInfo(
        id=uuid.uuid4(),
        name="normalized",
        type="normalized",
        metadata={
            "normalization_method": "brats",
            "input_subset_metadata_hash": metadata_hash,
        },
        images=[],
    )

    result = await mod.check_availability(
        AwarenessInput(
            sample_set_id=uuid.uuid4(),
            sample_set_name="Case 001",
            subsets=[raw_subset, normalized_subset],
        )
    )

    assert result.available_subset_ids == [raw_subset_id]
    assert result.recommended_subset_ids == []


class _FakePercentileNormalizer:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class _FakeCenterModality:
    def __init__(self, **kwargs):
        self.modality_name = kwargs["modality_name"]
        self.input_path = Path(kwargs["input_path"])
        self.normalized_bet_output_path = Path(kwargs["normalized_bet_output_path"])
        self.kwargs = kwargs


class _FakeModality:
    def __init__(self, **kwargs):
        self.modality_name = kwargs["modality_name"]
        self.input_path = Path(kwargs["input_path"])
        self.normalized_bet_output_path = Path(kwargs["normalized_bet_output_path"])
        self.kwargs = kwargs


class _FakeAtlas:
    BRATS_SRI24 = "BRATS_SRI24"


class _FakePreprocessor:
    latest_instance = None

    def __init__(
        self,
        *,
        center_modality,
        moving_modalities,
        atlas_image_path,
        temp_folder,
        use_gpu,
    ):
        self.center_modality = center_modality
        self.moving_modalities = moving_modalities
        self.atlas_image_path = atlas_image_path
        self.temp_folder = Path(temp_folder)
        self.use_gpu = use_gpu
        self.run_calls = []
        type(self).latest_instance = self

    def run(self, **kwargs):
        self.run_calls.append(kwargs)
        modalities = [self.center_modality, *self.moving_modalities]
        for modality in modalities:
            modality.normalized_bet_output_path.parent.mkdir(
                parents=True,
                exist_ok=True,
            )
            modality.normalized_bet_output_path.write_bytes(
                f"normalized:{modality.modality_name}".encode()
            )


def _fake_brainles_components():
    return {
        "Atlas": _FakeAtlas,
        "CenterModality": _FakeCenterModality,
        "Modality": _FakeModality,
        "PercentileNormalizer": _FakePercentileNormalizer,
        "AtlasCentricPreprocessor": _FakePreprocessor,
    }


@pytest.mark.asyncio
async def test_brats_normalizer_run_skips_dicom_conversion_for_nifti(
    tmp_path,
    monkeypatch,
):
    mod = BratsNormalizerModule()
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    work_dir = tmp_path / "work"
    input_dir.mkdir()
    output_dir.mkdir()
    work_dir.mkdir()

    (input_dir / "case_t1c.nii.gz").write_bytes(b"t1c")
    (input_dir / "case_flair.nii.gz").write_bytes(b"flair")

    monkeypatch.setattr(
        mod,
        "_load_brainles_components",
        _fake_brainles_components,
    )
    monkeypatch.setattr(mod, "_gpu_available", lambda: True)

    def _fail_convert(*args, **kwargs):
        raise AssertionError("DICOM conversion should be skipped for NIfTI inputs")

    monkeypatch.setattr(mod, "_convert_dicom_image", _fail_convert)

    result = await mod.run(
        RunInput(
            work_dir=work_dir,
            input_dir=input_dir,
            output_dir=output_dir,
            images=[
                InputImageInfo(
                    id=uuid.uuid4(),
                    filename="case_t1c.nii.gz",
                    format="NIfTI",
                    metadata={"modality": "t1c"},
                ),
                InputImageInfo(
                    id=uuid.uuid4(),
                    filename="case_flair.nii.gz",
                    format="NIfTI",
                    metadata={"modality": "flair"},
                ),
            ],
            params={},
            sample_set_meta={"sample_set_name": "Case 001"},
            input_subset_id=uuid.uuid4(),
            input_subset_name="raw",
            input_subset_type="raw",
            input_subset_metadata={"study_uid": "study-1"},
        )
    )

    assert result.type == "normalized"
    assert result.metadata["normalization_method"] == "brats"
    assert len(result.images) == 2
    assert (output_dir / "t1c.nii.gz").exists()
    assert (output_dir / "t2f.nii.gz").exists()
    assert _FakePreprocessor.latest_instance is not None
    assert _FakePreprocessor.latest_instance.atlas_image_path == _FakeAtlas.BRATS_SRI24
    assert _FakePreprocessor.latest_instance.use_gpu is True


@pytest.mark.asyncio
async def test_brats_normalizer_run_converts_dicom_inputs(tmp_path, monkeypatch):
    mod = BratsNormalizerModule()
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    work_dir = tmp_path / "work"
    input_dir.mkdir()
    output_dir.mkdir()
    work_dir.mkdir()

    (input_dir / "case_t1.dcm").write_bytes(b"dicom")

    monkeypatch.setattr(
        mod,
        "_load_brainles_components",
        _fake_brainles_components,
    )
    monkeypatch.setattr(mod, "_gpu_available", lambda: False)

    converted_paths = []

    def _fake_convert(source_path, output_path):
        converted_paths.append((Path(source_path), Path(output_path)))
        Path(output_path).write_bytes(b"converted")
        return Path(output_path)

    monkeypatch.setattr(mod, "_convert_dicom_image", _fake_convert)

    result = await mod.run(
        RunInput(
            work_dir=work_dir,
            input_dir=input_dir,
            output_dir=output_dir,
            images=[
                InputImageInfo(
                    id=uuid.uuid4(),
                    filename="case_t1.dcm",
                    format="DICOM",
                    metadata={"modality": "t1"},
                )
            ],
            params={"t1n_image": "case_t1.dcm"},
            sample_set_meta={"sample_set_name": "Case 001"},
            input_subset_id=uuid.uuid4(),
            input_subset_name="raw",
            input_subset_type="raw",
            input_subset_metadata={"study_uid": "study-1"},
        )
    )

    assert len(converted_paths) == 1
    assert converted_paths[0][0] == input_dir / "case_t1.dcm"
    assert converted_paths[0][1].name == "t1n.nii.gz"
    assert result.images[0].filename == "t1n.nii.gz"
    assert (output_dir / "t1n.nii.gz").exists()
    assert _FakePreprocessor.latest_instance is not None
    assert _FakePreprocessor.latest_instance.use_gpu is False


@pytest.mark.asyncio
async def test_brats_normalizer_run_reports_missing_brainles_dependency(
    tmp_path,
    monkeypatch,
):
    mod = BratsNormalizerModule()
    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    work_dir = tmp_path / "work"
    input_dir.mkdir()
    output_dir.mkdir()
    work_dir.mkdir()

    (input_dir / "case_t1c.nii.gz").write_bytes(b"t1c")

    def _raise_import_error():
        raise RuntimeError("brainles-preprocessing is required")

    monkeypatch.setattr(mod, "_load_brainles_components", _raise_import_error)

    with pytest.raises(RuntimeError, match="brainles-preprocessing is required"):
        await mod.run(
            RunInput(
                work_dir=work_dir,
                input_dir=input_dir,
                output_dir=output_dir,
                images=[
                    InputImageInfo(
                        id=uuid.uuid4(),
                        filename="case_t1c.nii.gz",
                        format="NIfTI",
                        metadata={"modality": "t1c"},
                    )
                ],
                params={},
                sample_set_meta={"sample_set_name": "Case 001"},
                input_subset_metadata={"study_uid": "study-1"},
            )
        )
