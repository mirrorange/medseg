"""Admin-only API routes — sample set management and system stats."""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import require_admin
from app.db import get_session
from app.models.sample_set import SampleSet
from app.models.share import Share
from app.models.user import User
from app.schemas.sample import AdminSampleSetRead
from app.services.library import unshare_sample_set

router = APIRouter(prefix="/admin", tags=["admin"])


# --------------- Sample Sets ---------------


@router.get("/sample-sets", response_model=list[AdminSampleSetRead])
async def list_all_sample_sets(
    search: str | None = Query(None),
    owner_id: uuid.UUID | None = Query(None),
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """List all sample sets across all users with owner username."""
    stmt = (
        select(SampleSet, User.username)
        .join(User, SampleSet.owner_id == User.id)
        .order_by(SampleSet.created_at.desc())
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            SampleSet.name.ilike(pattern) | SampleSet.description.ilike(pattern)  # type: ignore[union-attr]
        )
    if owner_id:
        stmt = stmt.where(SampleSet.owner_id == owner_id)
    rows = (await session.exec(stmt)).all()
    return [
        AdminSampleSetRead(
            **ss.model_dump(),
            owner_username=username,
        )
        for ss, username in rows
    ]


# --------------- Shared management ---------------


@router.delete("/shared/{sample_set_id}", status_code=200)
async def admin_remove_shared(
    sample_set_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Remove a sample set from the shared library (admin override)."""
    await unshare_sample_set(session, sample_set_id)
    return {"sample_set_id": str(sample_set_id), "shared": False}


# --------------- Stats ---------------


@router.get("/stats")
async def get_stats(
    _admin: User = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Return system-wide statistics."""
    user_count = (await session.exec(select(func.count(User.id)))).one()
    sample_set_count = (await session.exec(select(func.count(SampleSet.id)))).one()
    shared_count = (await session.exec(select(func.count(Share.id)))).one()

    return {
        "user_count": user_count,
        "sample_set_count": sample_set_count,
        "shared_count": shared_count,
    }
