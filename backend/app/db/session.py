from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

# Connection pool: one engine per process reuses DB connections instead of reconnecting per request.
engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)

# expire_on_commit=False: objects stay readable after commit (no surprise async lazy loads).
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    # Dependency injection + unit of work: one session per request, always closed afterwards.
    async with SessionFactory() as session:
        yield session
