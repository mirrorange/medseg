import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class Share(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    sample_set_id: uuid.UUID = Field(
        foreign_key="sampleset.id", unique=True, index=True
    )
    shared_by: uuid.UUID = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
