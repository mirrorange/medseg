from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)


async def get_session() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency that provides an async database session."""
    async with AsyncSession(engine) as session:
        yield session


async def init_db() -> None:
    """Create all tables. Used for development/testing only."""
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
