from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # Unique constraint: the database, not app code, guarantees one account per email (race-proof).
    email: Mapped[str] = mapped_column(String(320), unique=True)
