import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.folder import Folder
    from app.models.share import Share
    from app.models.subset import Subset


class SampleSet(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(max_length=255)
    description: str | None = None
    owner_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    folder_id: uuid.UUID | None = Field(
        default=None, foreign_key="folder.id", index=True
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    folder: Optional["Folder"] = Relationship(back_populates="sample_sets")
    subsets: list["Subset"] = Relationship(
        back_populates="sample_set",
        cascade_delete=True,
    )
    shares: list["Share"] = Relationship(
        back_populates="sample_set",
        cascade_delete=True,
    )
