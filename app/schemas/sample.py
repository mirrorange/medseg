import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

# --- SampleSet ---


class SampleSetCreate(BaseModel):
    name: str
    description: str | None = None
    folder_id: uuid.UUID | None = None


class SampleSetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    folder_id: uuid.UUID | None = None


class SampleSetRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    owner_id: uuid.UUID
    folder_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class AdminSampleSetRead(SampleSetRead):
    owner_username: str


class SampleSetDetail(SampleSetRead):
    subsets: list["SubsetRead"] = []
    is_shared: bool = False
    folder_name: str | None = None


# --- Subset ---


class SubsetRead(BaseModel):
    id: uuid.UUID
    sample_set_id: uuid.UUID
    name: str
    type: str
    metadata_: dict[str, Any]
    source_module: str | None
    source_subset_id: uuid.UUID | None
    created_at: datetime


class SubsetUpdate(BaseModel):
    name: str | None = None


class SubsetCreate(BaseModel):
    name: str
    type: str = "raw"


# --- Image ---


class ImageUpdate(BaseModel):
    filename: str | None = None


class ImageRead(BaseModel):
    id: uuid.UUID
    subset_id: uuid.UUID
    filename: str
    format: str
    metadata_: dict[str, Any]
    storage_path: str
    source_image_id: uuid.UUID | None
    created_at: datetime


class SubsetDetail(SubsetRead):
    images: list[ImageRead] = []
