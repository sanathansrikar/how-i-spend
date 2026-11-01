import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.db.base import Base
from app.models import *  # noqa: F403  # Registers every model on Base.metadata for autogenerate.

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Single source of truth: the migration URL comes from app settings, not a duplicate in alembic.ini.
database_url = get_settings().database_url
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting (useful for reviewing or hand-applying a migration)."""
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    # compare_type: detect column type changes too, not only added/removed columns.
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(database_url)
    async with engine.connect() as connection:
        # run_sync bridges Alembic's synchronous API onto the async driver.
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
