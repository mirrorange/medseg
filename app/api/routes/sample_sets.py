import uuid

from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import PermissionDenied
from app.db import get_session
from app.models.share import Share
from app.models.user import User, UserRole
from app.schemas.sample import (
    SampleSetCreate,
    SampleSetDetail,
    SampleSetRead,
    SampleSetUpdate,
    SubsetRead,
)
from app.services.sample_set import (
    create_sample_set,
    delete_sample_set,
    get_sample_set,
    list_sample_sets_by_owner,
    update_sample_set,
)
from app.services.subset import list_subsets

router = APIRouter(prefix="/sample-sets", tags=["sample-sets"])


def _check_owner_or_admin(sample_set_owner_id: uuid.UUID, user: User):
    if user.role != UserRole.admin and sample_set_owner_id != user.id:
        raise PermissionDenied()


@router.post("", response_model=SampleSetRead, status_code=201)
async def create(
    body: SampleSetCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await create_sample_set(
        session, user.id, body.name, body.description, body.folder_id
    )


@router.get("", response_model=list[SampleSetRead])
async def list_mine(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await list_sample_sets_by_owner(session, user.id)


@router.get("/{sample_set_id}", response_model=SampleSetDetail)
async def get_detail(
    sample_set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss = await get_sample_set(session, sample_set_id)
    _check_owner_or_admin(ss.owner_id, user)
    subsets = await list_subsets(session, ss.id)

    # Check if this sample set is shared
    result = await session.exec(
        select(Share).where(Share.sample_set_id == ss.id)
    )
    is_shared = result.first() is not None

    return SampleSetDetail(
        id=ss.id,
        name=ss.name,
        description=ss.description,
        owner_id=ss.owner_id,
        folder_id=ss.folder_id,
        created_at=ss.created_at,
        updated_at=ss.updated_at,
        subsets=[SubsetRead.model_validate(s, from_attributes=True) for s in subsets],
        is_shared=is_shared,
    )


@router.put("/{sample_set_id}", response_model=SampleSetRead)
async def update(
    sample_set_id: uuid.UUID,
    body: SampleSetUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss = await get_sample_set(session, sample_set_id)
    _check_owner_or_admin(ss.owner_id, user)
    return await update_sample_set(
        session, ss, body.name, body.description, body.folder_id
    )


@router.delete("/{sample_set_id}", status_code=204)
async def delete(
    sample_set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss = await get_sample_set(session, sample_set_id)
    _check_owner_or_admin(ss.owner_id, user)
    await delete_sample_set(session, ss)
