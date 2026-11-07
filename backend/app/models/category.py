import uuid

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Category(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "categories"
    # Composite unique: names only need to be unique *per user* (multi-tenancy scoping).
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_categories_user_id_name"),)

    # ON DELETE CASCADE: deleting a user removes their categories, leaving no orphan rows.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(50))
