import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

# --- Folder ---


class FolderCreate(BaseModel):
    name: str
    parent_id: uuid.UUID | None = None


class FolderUpdate(BaseModel):
    name: str | None = None
    parent_id: uuid.UUID | None = None


class FolderRead(BaseModel):
    id: uuid.UUID
    name: str
    owner_id: uuid.UUID
    parent_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class FolderTreeNode(BaseModel):
    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None
    children: list["FolderTreeNode"] = []
    sample_sets: list["TreeSampleSet"] = []


class TreeSampleSet(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


# --- Library contents (flat view) ---


class BreadcrumbItem(BaseModel):
    id: uuid.UUID | None
    name: str


class LibraryItem(BaseModel):
    """A unified item in folder contents (folder or sample_set)."""
    id: uuid.UUID
    name: str
    type: Literal["folder", "sample_set"]
    description: str | None = None
    child_count: int | None = None
    created_at: datetime
    updated_at: datetime


class LibraryContents(BaseModel):
    folder_id: uuid.UUID | None
    breadcrumb: list[BreadcrumbItem]
    items: list[LibraryItem]


# --- Batch move ---


class BatchMoveItem(BaseModel):
    type: Literal["folder", "sample_set"]
    id: uuid.UUID


class BatchMoveRequest(BaseModel):
    items: list[BatchMoveItem]
    target_folder_id: uuid.UUID | None = None


# --- Share ---


class SharedSampleSetRead(BaseModel):
    id: uuid.UUID
    sample_set_id: uuid.UUID
    sample_set_name: str
    sample_set_description: str | None
    shared_by: uuid.UUID
    shared_by_username: str
    created_at: datetime


# --- Library tree ---


class LibraryTree(BaseModel):
    folders: list[FolderTreeNode]
    root_sample_sets: list[TreeSampleSet]
