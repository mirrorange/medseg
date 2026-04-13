import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import Field, SQLModel


class TaskStatus(StrEnum):
    queued = "queued"
    loading = "loading"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class Task(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    module_name: str = Field(max_length=255)
    sample_set_id: uuid.UUID = Field(foreign_key="sampleset.id", index=True)
    input_subset_id: uuid.UUID = Field(foreign_key="subset.id")
    output_subset_name: str = Field(max_length=255)
    params: dict[str, Any] | None = Field(
        default=None, sa_column=Column("params", JSON)
    )
    overwrite: bool = Field(default=False)
    status: TaskStatus = Field(default=TaskStatus.queued)
    error_message: str | None = None
    retry_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    completed_at: datetime | None = None
