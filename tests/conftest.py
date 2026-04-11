import asyncio
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db import get_session
from app.main import app

# Import all models so tables are registered
from app.models import *  # noqa: F401, F403

TEST_DATABASE_URL = "sqlite+aiosqlite://"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def session(engine) -> AsyncGenerator[AsyncSession]:
    async with AsyncSession(engine) as session:
        yield session


@pytest.fixture
async def client(engine) -> AsyncGenerator[AsyncClient]:
    async def _override_get_session() -> AsyncGenerator[AsyncSession]:
        async with AsyncSession(engine) as session:
            yield session

    app.dependency_overrides[get_session] = _override_get_session
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
