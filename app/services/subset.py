import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.exceptions import AppError
from app.models.subset import Subset


class SubsetNotFound(AppError):
    def __init__(self):
        super().__init__(
            error_code=402003,
            message_key="sample.subsetNotFound",
            status_code=404,
        )


async def get_subset(
    session: AsyncSession,
    subset_id: uuid.UUID,
) -> Subset:
    result = await session.exec(select(Subset).where(Subset.id == subset_id))
    subset = result.first()
    if subset is None:
        raise SubsetNotFound()
    return subset


async def list_subsets(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
) -> list[Subset]:
    result = await session.exec(
        select(Subset).where(Subset.sample_set_id == sample_set_id)
    )
    return list(result.all())


async def create_raw_subset(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
    name: str,
) -> Subset:
    return await create_subset(session, sample_set_id, name, "raw")


async def create_subset(
    session: AsyncSession,
    sample_set_id: uuid.UUID,
    name: str,
    type: str = "raw",
) -> Subset:
    subset = Subset(
        sample_set_id=sample_set_id,
        name=name,
        type=type,
        metadata_={},
    )
    session.add(subset)
    await session.commit()
    await session.refresh(subset)
    return subset


async def update_subset(
    session: AsyncSession,
    subset: Subset,
    name: str | None = None,
) -> Subset:
    if name is not None:
        subset.name = name
    session.add(subset)
    await session.commit()
    await session.refresh(subset)
    return subset


async def delete_subset(
    session: AsyncSession,
    subset: Subset,
) -> None:
    await session.delete(subset)
    await session.commit()
