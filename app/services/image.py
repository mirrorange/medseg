import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import AppError
from app.models.image import Image
from app.storage.base import StorageBackend


class ImageNotFound(AppError):
    def __init__(self):
        super().__init__(
            error_code=403001,
            message_key="image.notFound",
            status_code=404,
        )


async def upload_image(
    session: AsyncSession,
    storage: StorageBackend,
    subset_id: uuid.UUID,
    owner_id: uuid.UUID,
    sample_set_id: uuid.UUID,
    filename: str,
    format_: str,
    data: bytes,
) -> Image:
    image = Image(
        subset_id=subset_id,
        filename=filename,
        format=format_,
        storage_path="",
    )
    # Build storage path: {owner_id}/{sample_set_id}/{subset_id}/{image_id}{ext}
    ext = ""
    if "." in filename:
        ext = filename[filename.rfind(".") :]
    path = f"{owner_id}/{sample_set_id}/{subset_id}/{image.id}{ext}"
    await storage.save(path, data)
    image.storage_path = path

    session.add(image)
    await session.commit()
    await session.refresh(image)
    return image


async def get_image(
    session: AsyncSession,
    image_id: uuid.UUID,
) -> Image:
    result = await session.exec(select(Image).where(Image.id == image_id))
    image = result.first()
    if image is None:
        raise ImageNotFound()
    return image


async def list_images(
    session: AsyncSession,
    subset_id: uuid.UUID,
) -> list[Image]:
    result = await session.exec(select(Image).where(Image.subset_id == subset_id))
    return list(result.all())


async def delete_image(
    session: AsyncSession,
    storage: StorageBackend,
    image: Image,
) -> None:
    if image.storage_path:
        await storage.delete(image.storage_path)
    await session.delete(image)
    await session.commit()
