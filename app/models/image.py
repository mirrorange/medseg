import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.subset import Subset


class Image(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    subset_id: uuid.UUID = Field(foreign_key="subset.id", index=True)
    filename: str = Field(max_length=255)
    format: str = Field(max_length=50)
    metadata_: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column("metadata", JSON)
    )
    storage_path: str
    source_image_id: uuid.UUID | None = Field(default=None, foreign_key="image.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    subset: Optional["Subset"] = Relationship(back_populates="images")
