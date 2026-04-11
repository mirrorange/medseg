import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import Column
from sqlalchemy.types import JSON
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.image import Image
    from app.models.sample_set import SampleSet


class Subset(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sample_set_id: uuid.UUID = Field(foreign_key="sampleset.id", index=True)
    name: str = Field(max_length=255)
    type: str = Field(max_length=100)
    metadata_: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column("metadata", JSON)
    )
    source_module: str | None = None
    source_subset_id: uuid.UUID | None = Field(default=None, foreign_key="subset.id")
    source_params: dict[str, Any] | None = Field(
        default=None, sa_column=Column("source_params", JSON)
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    sample_set: Optional["SampleSet"] = Relationship(back_populates="subsets")
    images: list["Image"] = Relationship(
        back_populates="subset",
        cascade_delete=True,
    )
