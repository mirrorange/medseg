from datetime import datetime

from pydantic import BaseModel, field_serializer

from app.db.types import ensure_utc


def serialize_utc_datetime(value: datetime) -> str:
    """Serialize datetimes as explicit UTC ISO 8601 strings."""
    return ensure_utc(value).isoformat().replace("+00:00", "Z")


class UTCModel(BaseModel):
    @field_serializer("*", when_used="json")
    def serialize_datetimes(self, value):
        if isinstance(value, datetime):
            return serialize_utc_datetime(value)
        return value
