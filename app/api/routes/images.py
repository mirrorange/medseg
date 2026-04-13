import uuid

from fastapi import APIRouter, Depends, UploadFile
from fastapi.responses import Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api.dependencies import get_current_user
from app.core.exceptions import PermissionDenied
from app.db import get_session
from app.models.user import User, UserRole
from app.schemas.sample import ImageRead, ImageUpdate
from app.services.image import delete_image, get_image, list_images, update_image, upload_image
from app.services.sample_set import get_sample_set
from app.services.subset import get_subset
from app.storage import get_storage

router = APIRouter(
    prefix="/sample-sets/{sample_set_id}/subsets/{subset_id}/images",
    tags=["images"],
)


async def _verify_image_access(
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


@router.post("", response_model=ImageRead, status_code=201)
async def upload(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    file: UploadFile,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    ss, _subset = await _verify_image_access(session, sample_set_id, subset_id, user)
    data = await file.read()
    filename = file.filename or "unknown"
    fmt = _detect_format(filename)
    storage = get_storage()
    return await upload_image(
        session, storage, subset_id, ss.owner_id, sample_set_id, filename, fmt, data
    )


@router.get("", response_model=list[ImageRead])
async def list_all(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _verify_image_access(session, sample_set_id, subset_id, user)
    return await list_images(session, subset_id)


@router.get("/{image_id}", response_model=ImageRead)
async def get_meta(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    image_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _verify_image_access(session, sample_set_id, subset_id, user)
    image = await get_image(session, image_id)
    if image.subset_id != subset_id:
        raise PermissionDenied()
    return image


@router.get("/{image_id}/download")
async def download(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    image_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _verify_image_access(session, sample_set_id, subset_id, user)
    image = await get_image(session, image_id)
    if image.subset_id != subset_id:
        raise PermissionDenied()
    storage = get_storage()
    data = await storage.load(image.storage_path)
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{image.filename}"'},
    )


@router.put("/{image_id}", response_model=ImageRead)
async def update(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    image_id: uuid.UUID,
    body: ImageUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _verify_image_access(session, sample_set_id, subset_id, user)
    image = await get_image(session, image_id)
    if image.subset_id != subset_id:
        raise PermissionDenied()
    return await update_image(session, image, body.filename)


@router.delete("/{image_id}", status_code=204)
async def delete(
    sample_set_id: uuid.UUID,
    subset_id: uuid.UUID,
    image_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await _verify_image_access(session, sample_set_id, subset_id, user)
    image = await get_image(session, image_id)
    if image.subset_id != subset_id:
        raise PermissionDenied()
    storage = get_storage()
    await delete_image(session, storage, image)


def _detect_format(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".nii") or lower.endswith(".nii.gz"):
        return "NIfTI"
    if lower.endswith(".dcm"):
        return "DICOM"
    return "unknown"
