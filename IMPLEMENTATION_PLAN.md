# IM-Fuse Segmentation Module — Implementation Plan

## Stage 1: Add dependency & create module skeleton
**Goal**: Add `imfuse-infer` as optional dependency, create module file with correct structure
**Success Criteria**:
- `imfuse-infer` listed in `[project.optional-dependencies]`
- Module file created with all abstract methods stubbed
- Module discoverable by registry
**Tests**: App starts without import errors; module appears in registry
**Status**: Complete

## Stage 2: Implement check_availability()
**Goal**: Correct availability logic for BraTS-normalized subsets
**Success Criteria**:
- Only `normalized` subsets with `normalization_method=brats` are considered
- Uses metadata hash to detect already-processed subsets
- Already-processed → `available`; not yet processed → `recommended`
**Tests**: Unit test with mock AwarenessInput
**Status**: Complete

## Stage 3: Implement load/unload with resource awareness
**Goal**: Load/unload IMFusePredictor with correct GPU/CPU detection and resource declaration
**Success Criteria**:
- Auto-detect GPU availability; use `mambapy` backend on CPU, `auto` on GPU
- Resource declaration: mamba_ssm → 12GB VRAM; mambapy+CPU → 48GB RAM, 0 VRAM
- Proper cleanup on unload
**Tests**: Manual verification of load/unload cycle
**Status**: Complete

## Stage 4: Implement run() — segmentation inference
**Goal**: End-to-end segmentation from normalized NIfTI inputs
**Success Criteria**:
- Reads BraTS-normalized NIfTI files from input_dir
- Maps modalities (t1c→t1ce, t1n→t1, t2f→flair, t2w→t2)
- Runs IMFusePredictor.predict_nifti()
- Outputs segmentation NIfTI with correct metadata
- `is_segmentation: True` in output metadata
- `segmentation_method: imfuse` in output metadata
- `input_subset_metadata_hash` in output metadata
**Tests**: Integration test with mock data if possible; manual end-to-end
**Status**: Complete

## Stage 5: Linting, formatting, final validation
**Goal**: All code passes linter, formatter, and app starts cleanly
**Success Criteria**:
- `ruff check` passes
- `ruff format` passes
- App starts and module is registered
**Tests**: CI-equivalent checks
**Status**: Complete
