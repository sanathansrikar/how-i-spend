import uuid
from datetime import datetime

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Naming convention: deterministic constraint names make migrations reproducible and
# let Alembic drop/alter constraints by name instead of guessing.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    # Single metadata registry: Alembic diffs this against the live DB to autogenerate migrations.
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKeyMixin:
    # Surrogate UUID key: non-guessable IDs, safe in URLs, creatable without coordination.
    # server_default: the database generates it, so raw SQL inserts also get an ID.
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )


class CreatedAtMixin:
    # Append-only tables (event/audit logs) need only a creation time; rows are never updated.
    # timestamptz stores an absolute instant in UTC; convert to local time only at the UI edge.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TimestampMixin(CreatedAtMixin):
    # Audit columns: when a row was created/changed, set by the DB clock (one source of truth).
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
