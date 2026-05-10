"""use utc datetime columns

Revision ID: 9f8a7c6b5d4e
Revises: dbd4610d6537
Create Date: 2026-05-10 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f8a7c6b5d4e"
down_revision: str | Sequence[str] | None = "dbd4610d6537"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_UTC_COLUMNS = {
    "user": ("created_at", "updated_at"),
    "sampleset": ("created_at", "updated_at"),
    "subset": ("created_at",),
    "image": ("created_at",),
    "folder": ("created_at", "updated_at"),
    "share": ("created_at",),
    "task": ("created_at", "started_at", "completed_at"),
}


def _alter_datetime_columns(timezone: bool) -> None:
    for table_name, column_names in _UTC_COLUMNS.items():
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            for column_name in column_names:
                batch_op.alter_column(
                    column_name,
                    existing_type=sa.DateTime(timezone=not timezone),
                    type_=sa.DateTime(timezone=timezone),
                    postgresql_using=f"{column_name} AT TIME ZONE 'UTC'",
                    existing_nullable=column_name in {"started_at", "completed_at"},
                )


def upgrade() -> None:
    """Upgrade schema."""
    if op.get_bind().dialect.name == "postgresql":
        _alter_datetime_columns(timezone=True)


def downgrade() -> None:
    """Downgrade schema."""
    if op.get_bind().dialect.name == "postgresql":
        _alter_datetime_columns(timezone=False)
