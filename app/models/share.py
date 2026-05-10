import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column
from sqlmodel import Field, Relationship, SQLModel

from app.db.types import UTCDateTime

if TYPE_CHECKING:
    from app.models.sample_set import SampleSet


class Share(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sample_set_id: uuid.UUID = Field(
        foreign_key="sampleset.id", unique=True, index=True
    )
    shared_by: uuid.UUID = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_column=Column(UTCDateTime(), nullable=False),
    )

    sample_set: Optional["SampleSet"] = Relationship(back_populates="shares")
