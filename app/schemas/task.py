import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    module_name: str
    sample_set_id: uuid.UUID
    input_subset_id: uuid.UUID
    output_subset_name: str
    params: dict[str, Any] | None = None
    overwrite: bool = False


class TaskRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    module_name: str
    sample_set_id: uuid.UUID
    input_subset_id: uuid.UUID
    output_subset_name: str
    params: dict[str, Any] | None
    overwrite: bool
    status: TaskStatus
    error_message: str | None
    retry_count: int
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    sample_set_name: str | None = None
    input_subset_name: str | None = None


class BatchTaskCreate(BaseModel):
    module_name: str
    sample_set_id: uuid.UUID
    input_subset_ids: list[uuid.UUID]
    output_subset_name_template: str = "{input_name}_{module}"
    params: dict[str, Any] | None = None
    overwrite: bool = False


class BatchTaskError(BaseModel):
    input_subset_id: uuid.UUID
    error_code: int
    message: str


class BatchTaskResult(BaseModel):
    tasks: list[TaskRead]
    errors: list[BatchTaskError]
