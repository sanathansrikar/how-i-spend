import asyncio
from collections.abc import AsyncIterator, Iterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_session
from app.main import app
from app.models import *  # noqa: F403  # Registers models on Base.metadata for create_all.


def _test_database_url() -> URL:
    # Test isolation: a separate database means tests can never touch real dev data.
    url = make_url(get_settings().database_url)
    return url.set(database=f"{url.database}_test")


async def _create_schema() -> None:
    test_url = _test_database_url()
    # CREATE DATABASE can't run inside a transaction, hence AUTOCOMMIT on the admin connection.
    admin = create_async_engine(
        test_url.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool
    )
    async with admin.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": test_url.database}
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{test_url.database}"'))
    await admin.dispose()

    engine = create_async_engine(test_url, poolclass=NullPool)
    async with engine.begin() as conn:
        # Reset the whole schema (not drop_all): robust to leftovers from older schema shapes,
        # which would otherwise block drops through foreign keys that no longer exist in the models.
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def _database() -> Iterator[None]:
    # Session-scoped fixture: the expensive schema setup runs once per test run, not per test.
    asyncio.run(_create_schema())
    yield


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(_test_database_url(), poolclass=NullPool)
    async with engine.connect() as conn:
        outer = await conn.begin()
        # Transaction-per-test: all writes are rolled back, so tests stay independent.
        # create_savepoint lets code under test call commit() without ending the outer transaction.
        async with AsyncSession(
            bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint"
        ) as s:
            yield s
        await outer.rollback()
    await engine.dispose()


@pytest.fixture
async def client(session: AsyncSession) -> AsyncIterator[AsyncClient]:
    # Dependency override: the app uses the test's rolled-back session, so API tests see test
    # data and leave nothing behind.
    async def _session_override() -> AsyncSession:
        return session

    app.dependency_overrides[get_session] = _session_override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
