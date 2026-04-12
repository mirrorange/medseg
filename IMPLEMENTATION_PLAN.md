# Library V2 — Implementation Plan

## Stage 1: Backend — Schemas & Service Layer
**Goal**: Add new schemas, service functions, and uniqueness constraint for the Library V2 API
**Success Criteria**:
- `LibraryItem`, `LibraryContents`, `BreadcrumbItem`, `BatchMoveRequest/Item` schemas defined
- `DuplicateName` exception added
- `check_name_unique()` helper implemented
- `get_library_contents()` service returns flat folder listing with breadcrumb
- `get_folder_breadcrumb()` service returns ancestor chain
- `batch_move_items()` service with cycle detection and uniqueness validation
- `create_folder()` and `update_folder()` enforce name uniqueness
- `create_sample_set()` enforces name uniqueness
**Tests**: Unit tested via Stage 2
**Status**: Complete

## Stage 2: Backend — Routes & Tests
**Goal**: Add new HTTP endpoints and comprehensive tests
**Success Criteria**:
- `GET /api/library/contents` route
- `GET /api/library/path/{folder_id}` route
- `POST /api/library/batch-move` route
- All existing tests still pass
- New tests for: contents listing, breadcrumb, batch move, name uniqueness (create/rename/move conflicts)
**Tests**: `tests/test_library.py` extended with 13 new test cases (25 total)
**Status**: Complete

## Stage 3: Frontend — Store & API Regeneration
**Goal**: Regenerate API client and create the Library Zustand store
**Success Criteria**:
- API client regenerated with new endpoints/types
- `stores/library.ts` created with state management (navigation, selection, sorting, view mode)
- Store can fetch contents and navigate between folders
**Tests**: Manual verification via dev tools
**Status**: Complete

## Stage 4: Frontend — Browser UI Components
**Goal**: Implement the file-manager-style Library Browser UI
**Success Criteria**:
- `LibraryBrowser` main container with action dispatch and keyboard shortcuts
- `LibraryToolbar` with navigation buttons, breadcrumb, view toggle, create actions
- `LibraryBreadcrumb` with clickable path segments
- `LibraryListView` (table) with sortable columns, selection, double-click open
- `LibraryGridView` (cards) with selection, double-click open
- `LibraryContextMenu` with context-aware actions
- `LibraryItemIcon` for folder/sample_set icons
- Route updated to use LibraryBrowser
**Tests**: Manual verification
**Status**: Complete

## Stage 5: Frontend — Dialogs & Drag-and-Drop
**Goal**: Implement action dialogs and drag-and-drop moving
**Success Criteria**:
- `RenameDialog` — unified rename for folders and sample sets
- `MoveDialog` — tree browser to select target folder, calls batch-move
- `DeleteDialog` — batch delete with confirmation
- Updated `CreateFolderDialog` and `CreateSampleSetDialog` with current folder context
- HTML5 drag-and-drop: drag items onto folders to move
- All interactions tested end-to-end
**Tests**: Manual E2E verification
**Status**: Complete
