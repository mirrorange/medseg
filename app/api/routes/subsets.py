import uuid

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import PermissionDenied
from app.db import get_session
from app.models.user import User, UserRole
from app.schemas.sample import ImageRead, SubsetCreate, SubsetDetail, SubsetRead, SubsetUpdate
from app.services.image import list_images
from app.services.sample_set import get_sample_set
from app.services.subset import (
    create_subset,
    delete_subset,
    get_subset,
    list_subsets,
    update_subset,
)

router = APIRouter(
    prefix="/sample-sets/{sample_set_id}/subsets",
    tags=["subsets"],
)


async def _verify_subset_access(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    user: User,
):
    ss = await get_sample_set(session, sample_set_id)
    if user.role != UserRole.admin and ss.owner_id != user.id:
        raise PermissionDenied()
    subset = await get_subset(session, subset_id)
    if subset.sample_set_id != sample_set_id:
        raise PermissionDenied()
    return ss, subset


@router.get("", response_model=list[SubsetRead])
async def list_all(
    sample_set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss = await get_sample_set(session, sample_set_id)
    if user.role != UserRole.admin and ss.owner_id != user.id:
        raise PermissionDenied()
    return await list_subsets(session, sample_set_id)


@router.post("", response_model=SubsetRead, status_code=201)
async def create(
    sample_set_id: uuid.UUID,
    body: SubsetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss = await get_sample_set(session, sample_set_id)
    if user.role != UserRole.admin and ss.owner_id != user.id:
        raise PermissionDenied()
    return await create_subset(session, sample_set_id, body.name, body.type)


@router.get("/{subset_id}", response_model=SubsetDetail)
async def get_detail(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _, subset = await _verify_subset_access(session, sample_set_id, subset_id, user)
    images = await list_images(session, subset_id)
    return SubsetDetail(
        id=subset.id,
        sample_set_id=subset.sample_set_id,
        name=subset.name,
        type=subset.type,
        metadata_=subset.metadata_,
        source_module=subset.source_module,
        source_subset_id=subset.source_subset_id,
        created_at=subset.created_at,
        images=[ImageRead.model_validate(i, from_attributes=True) for i in images],
    )


@router.put("/{subset_id}", response_model=SubsetRead)
async def update(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    body: SubsetUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _, subset = await _verify_subset_access(session, sample_set_id, subset_id, user)
    return await update_subset(session, subset, body.name)


@router.delete("/{subset_id}", status_code=204)
async def delete(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    _, subset = await _verify_subset_access(session, sample_set_id, subset_id, user)
    await delete_subset(session, subset)
