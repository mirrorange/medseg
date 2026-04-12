import uuid
from datetime import UTC, datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import AppError
from app.models.sample_set import SampleSet


class SampleSetNotFound(AppError):
    def __init__(self):
        super().__init__(
            error_code=402001,
            message_key="sample.setNotFound",
            status_code=404,
        )


class SubsetNameConflict(AppError):
    def __init__(self):
        super().__init__(
            error_code=402002,
            message_key="sample.subsetNameConflict",
            status_code=409,
        )


async def create_sample_set(
    session: AsyncSession,
    owner_id: uuid.UUID,
    name: str,
    description: str | None = None,
    folder_id: uuid.UUID | None = None,
) -> SampleSet:
    from app.services.library import _check_name_unique

    await _check_name_unique(session, folder_id, owner_id, name)

    ss = SampleSet(
        name=name,
        description=description,
        owner_id=owner_id,
        folder_id=folder_id,
    )
    session.add(ss)
    await session.commit()
    await session.refresh(ss)
    return ss


async def get_sample_set(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
) -> SampleSet:
    result = await session.exec(select(SampleSet).where(SampleSet.id == sample_set_id))
    ss = result.first()
    if ss is None:
        raise SampleSetNotFound()
    return ss


async def list_sample_sets_by_owner(
    session: AsyncSession,
    owner_id: uuid.UUID,
) -> list[SampleSet]:
    result = await session.exec(select(SampleSet).where(SampleSet.owner_id == owner_id))
    return list(result.all())


async def update_sample_set(
    session: AsyncSession,
    sample_set: SampleSet,
    name: str | None = None,
    description: str | None = None,
    folder_id: uuid.UUID | None = None,
) -> SampleSet:
    new_name = name if name is not None else sample_set.name
    new_folder = folder_id if folder_id is not None else sample_set.folder_id

    if name is not None or folder_id is not None:
        from app.services.library import _check_name_unique

        await _check_name_unique(
            session, new_folder, sample_set.owner_id, new_name,
            exclude_sample_set_id=sample_set.id,
        )

    if name is not None:
        sample_set.name = name
    if description is not None:
        sample_set.description = description
    if folder_id is not None:
        sample_set.folder_id = folder_id

    sample_set.updated_at = datetime.now(UTC)
    session.add(sample_set)
    await session.commit()
    await session.refresh(sample_set)
    return sample_set


async def delete_sample_set(
    session: AsyncSession,
    sample_set: SampleSet,
) -> None:
    await session.delete(sample_set)
    await session.commit()
