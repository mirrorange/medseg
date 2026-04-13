# Implementation Plan — v1.2 Feature Batch

## Overview

Five features to implement across backend and frontend:

1. Admin create user
2. Task list redesign + task delete/clear
3. Shared library search
4. Admin sample sets: owner name + search/filter

---

## Stage 1: Admin Create User (Backend + Frontend)

**Goal**: Admin can create new users from the user management page.

**Backend Changes**:
- `app/schemas/user.py`: Add `AdminUserCreate` schema (username, email, password, role, is_active)
- `app/services/user.py`: Add `admin_create_user()` function (reuse `register_user` logic with role/is_active params)
- `app/api/routes/users.py`: Add `POST /api/users` endpoint (admin only)

**Frontend Changes**:
- `front/app/routes/admin.users.tsx`: Add "Create User" button + dialog with form (username, email, password, role, is_active)
- Regenerate API client after backend changes

**Success Criteria**:
- [ ] Admin can create a user via the UI with username, email, password, role
- [ ] Validation errors (duplicate username/email) shown correctly
- [ ] New user appears in the table after creation

**Tests**: Extend `test_admin.py` with admin create user test

**Status**: Not Started

---

## Stage 2: Task List Redesign + Delete/Clear (Backend + Frontend)

**Goal**: Replace card-based task view with an elegant table. Add delete and batch clear.

**Backend Changes**:
- `app/schemas/task.py`: Add `TaskReadWithNames` or extend `TaskRead` with `sample_set_name`, `input_subset_name`
- `app/services/task.py`: Add `delete_task()` (only completed/failed/cancelled), `clear_finished_tasks()`, update queries to join names
- `app/api/routes/tasks.py`: Add `DELETE /api/tasks/{id}` (hard delete for finished), `DELETE /api/tasks` (batch clear finished)

**Frontend Changes**:
- `front/app/features/tasks/task-list.tsx`: Redesign as a data table with columns: Module, Sample Set, Subset, Status, Submitted, Duration, Actions
- `front/app/features/tasks/task-card.tsx`: Remove (replaced by table rows)
- `front/app/routes/tasks.tsx`: Add clear history button, integrate delete action
- Status badges with color coding, relative time display

**Success Criteria**:
- [ ] Tasks displayed in a clean table with key information columns
- [ ] Sample set name and subset name shown (not just IDs)
- [ ] Delete individual finished tasks
- [ ] "Clear History" button removes all completed/cancelled/failed tasks
- [ ] Cancel still works for queued tasks

**Tests**: Extend `test_tasks.py` with delete/clear tests

**Status**: Not Started

---

## Stage 3: Shared Library Search (Backend + Frontend)

**Goal**: Users can search shared sample sets by keyword (fuzzy match on name/description).

**Backend Changes**:
- `app/services/library.py`: Add `search` parameter to `list_shared_sample_sets()` with LIKE/ILIKE filter on name+description
- `app/api/routes/library.py`: Add `search` query param to `GET /api/library/shared`

**Frontend Changes**:
- `front/app/routes/shared-library.tsx`: Add search input with debounce, filter table client-side or re-fetch with query

**Success Criteria**:
- [ ] Search input visible above the shared library table
- [ ] Typing filters results in real-time (debounced server query)
- [ ] Matches name or description (case-insensitive)
- [ ] Empty search shows all results

**Tests**: Extend library tests with search scenarios

**Status**: Not Started

---

## Stage 4: Admin Sample Sets — Owner Name + Search/Filter (Backend + Frontend)

**Goal**: Show owner username instead of ID; add search and filter capabilities.

**Backend Changes**:
- `app/schemas/sample.py`: Add `AdminSampleSetRead` with `owner_username` field
- `app/api/routes/admin.py`: Update `GET /api/admin/sample-sets` to join User table, return `AdminSampleSetRead`, add `search` and `owner_id` query params

**Frontend Changes**:
- `front/app/routes/admin.sample-sets.tsx`: Display owner username, add search input and owner filter dropdown

**Success Criteria**:
- [ ] Owner username displayed instead of truncated UUID
- [ ] Search by sample set name works
- [ ] Filter by owner works
- [ ] All existing functionality preserved

**Tests**: Extend admin tests

**Status**: Not Started

---

## Stage 5: API Client Regeneration + Final Verification

**Goal**: Regenerate frontend API client from updated OpenAPI schema, verify all features work end-to-end.

**Steps**:
- Start backend server
- Run `pnpm openapi-ts` to regenerate SDK
- Verify no TypeScript errors
- Manual smoke test of all 4 features

**Status**: Not Started
