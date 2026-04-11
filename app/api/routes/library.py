import uuid

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import PermissionDenied
from app.db import get_session
from app.models.user import User, UserRole
from app.schemas.library import (
    FolderCreate,
    FolderRead,
    FolderUpdate,
    LibraryTree,
    SharedSampleSetRead,
)
from app.schemas.sample import SampleSetRead
from app.services.library import (
    copy_shared_sample_set,
    create_folder,
    delete_folder,
    get_folder,
    get_library_tree,
    list_shared_sample_sets,
    share_sample_set,
    unshare_sample_set,
    update_folder,
)
from app.services.sample_set import get_sample_set

router = APIRouter(prefix="/library", tags=["library"])


# --------------- Tree ---------------


@router.get("/tree", response_model=LibraryTree)
async def tree(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await get_library_tree(session, user.id)


# --------------- Folders ---------------


@router.post("/folders", response_model=FolderRead, status_code=201)
async def create(
    body: FolderCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await create_folder(
        session, owner_id=user.id, name=body.name, parent_id=body.parent_id
    )


@router.put("/folders/{folder_id}", response_model=FolderRead)
async def update(
    folder_id: uuid.UUID,
    body: FolderUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    folder = await get_folder(session, folder_id, user.id)
    return await update_folder(
        session, folder, name=body.name, parent_id=body.parent_id
    )


@router.delete("/folders/{folder_id}", status_code=204)
async def delete(
    folder_id: uuid.UUID,
    recursive: bool = False,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    folder = await get_folder(session, folder_id, user.id)
    await delete_folder(session, folder, recursive=recursive)


# --------------- Shared library ---------------


@router.get("/shared", response_model=list[SharedSampleSetRead])
async def list_shared(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await list_shared_sample_sets(session)


@router.post("/shared/{sample_set_id}", status_code=201)
async def publish_shared(
    sample_set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss = await get_sample_set(session, sample_set_id)
    if ss.owner_id != user.id and user.role != UserRole.admin:
        raise PermissionDenied()
    share = await share_sample_set(session, sample_set_id, user.id)
    return {"id": str(share.id), "sample_set_id": str(share.sample_set_id)}


@router.delete("/shared/{sample_set_id}", status_code=204)
async def unpublish_shared(
    sample_set_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss = await get_sample_set(session, sample_set_id)
    if ss.owner_id != user.id and user.role != UserRole.admin:
        raise PermissionDenied()
    await unshare_sample_set(session, sample_set_id)


@router.post(
    "/shared/{sample_set_id}/copy",
    response_model=SampleSetRead,
    status_code=201,
)
async def copy_shared(
    sample_set_id: uuid.UUID,
    folder_id: uuid.UUID | None = None,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await copy_shared_sample_set(
        session,
        sample_set_id=sample_set_id,
        new_owner_id=user.id,
        folder_id=folder_id,
    )
