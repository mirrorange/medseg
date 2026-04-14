# Implementation Plan — UI/UX Improvements & Data Integrity Fixes

## Stage 1: Fix Share Cascade Delete (Data Integrity)
**Goal**: Ensure deleting a sample set also deletes its associated Share record, so admin stats remain accurate.
**Success Criteria**:
- Deleting a sample set that was previously shared removes the Share row from the database
- Admin stats `shared_count` reflects the correct number of active shares
- Existing tests pass; new test verifies cascade behavior
**Changes**:
- `app/models/sample_set.py`: Add `shares` relationship with `cascade_delete=True`
- `app/models/share.py`: Add `sample_set` relationship (back_populates)
- Alembic migration: Not needed (relationship-level cascade, no schema change)
- `tests/test_admin.py` or `tests/test_library.py`: Add test for delete-after-share scenario
**Status**: Not Started

## Stage 2: Sample Set Description Truncation & Multiline Support
**Goal**: Allow multiline descriptions; truncate long descriptions in listing views; use textarea for editing.
**Success Criteria**:
- Sample set description editing uses `<textarea>` instead of `<input>`
- Grid view, shared library, and admin pages truncate long descriptions with CSS `line-clamp`
- Multiline text is preserved and displayed correctly in detail view
**Changes**:
- `front/app/features/sample-set/sample-set-header.tsx`: Replace description `<input>` with `<textarea>`
- `front/app/features/library/library-grid-view.tsx`: Apply `line-clamp-2` to description
- `front/app/routes/shared-library.tsx`: Apply `max-w` + `line-clamp-2` to description cell
- `front/app/routes/admin.sample-sets.tsx`: Apply `line-clamp-2` to description
**Status**: Not Started

## Stage 3: Library Path URL Binding
**Goal**: Sync the library browser's current folder to the URL so users can bookmark/refresh/share folder paths.
**Success Criteria**:
- Navigating to a folder updates the URL to `/app/library?folder=<uuid>`
- Loading `/app/library?folder=<uuid>` navigates directly to that folder
- Root folder URL is `/app/library` (no query param)
- Browser back/forward buttons work correctly with folder navigation
**Changes**:
- `front/app/routes/library.tsx`: Read `folder` search param, pass to LibraryBrowser
- `front/app/features/library/library-browser.tsx`: Accept initial folder prop; sync folder changes to URL
- `front/app/stores/library.ts`: No change needed (navigateTo already accepts folderId)
**Status**: Not Started

## Stage 4: Back Navigation from Sample Set to Library
**Goal**: Add a breadcrumb or back button on the sample set page so users can return to the containing folder in the library.
**Success Criteria**:
- Sample set page header shows a breadcrumb: "Library / [folder_name] / [sample_set_name]" (or "Library / [sample_set_name]" for root-level sets)
- Clicking "Library" navigates to `/app/library`
- Clicking a folder name navigates to `/app/library?folder=<folder_id>`
- The breadcrumb data comes from the existing `SampleSetDetail` response (which includes `folder_id`)
**Changes**:
- Backend: Add `folder_name` to `SampleSetDetail` schema so frontend can display folder name
- `front/app/features/sample-set/sample-set-header.tsx`: Add breadcrumb navigation above the title
- Regenerate API types after backend change
**Status**: Not Started
