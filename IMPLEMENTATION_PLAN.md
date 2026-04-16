## Stage 1: Research And Design
**Goal**: Confirm module contracts, BraTS2023 GLI normalization expectations, and BrainLes Suite integration approach.
**Success Criteria**: Concrete implementation approach is identified for availability checks, metadata hashing, DICOM to NIfTI conversion, and BrainLes preprocessing orchestration.
**Tests**: Review `docs/module-dev-guide.md`, inspect existing pipeline interfaces/tests, verify BrainLes preprocessing usage and BraTS modality expectations from upstream sources.
**Status**: Complete

## Stage 2: Awareness And Metadata Tracking
**Goal**: Add a pluggable BraTS normalization module skeleton with availability awareness and deterministic input metadata hashing.
**Success Criteria**: Raw subsets are available, raw subsets without a matching normalized metadata hash are recommended, and normalized outputs carry `normalization_method=brats` plus the input metadata hash.
**Tests**: Add/extend unit tests for `check_availability()`, metadata hashing behavior, and module info.
**Status**: In Progress

## Stage 3: BraTS Normalization Execution
**Goal**: Implement DICOM to NIfTI staging and BrainLes-based BraTS normalization output generation.
**Success Criteria**: NIfTI inputs bypass conversion, DICOM inputs are converted before preprocessing, normalized outputs are written to `output_dir`, and runtime dependency errors are descriptive.
**Tests**: Add unit tests around conversion branching, BrainLes orchestration, and `run()` metadata/output mapping.
**Status**: Not Started

## Stage 4: Verification And Integration
**Goal**: Finalize test coverage, register the module cleanly, and validate repo quality gates.
**Success Criteria**: Relevant tests pass, plan status is fully updated, and implementation is ready for use as a pluggable pipeline module.
**Tests**: Run focused `pytest` coverage for pipeline module behavior and any affected suites.
**Status**: Not Started
