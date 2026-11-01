from decimal import Decimal

from sqlalchemy import CheckConstraint, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        # E.164 phone (+country code, max 15 digits): one canonical shape, so phones compare equal.
        CheckConstraint(r"phone ~ '^\+[1-9][0-9]{6,14}$'", name="phone_e164"),
        # ISO 4217 shape enforced in the DB; the app should still validate real currency codes.
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name="currency_iso"),
        # Optional money fields: NULL means "not provided", but a provided value can't be negative.
        CheckConstraint("monthly_income >= 0", name="income_non_negative"),
        CheckConstraint("monthly_budget >= 0", name="budget_non_negative"),
    )

    full_name: Mapped[str] = mapped_column(String(100))
    # Unique constraint: the database, not app code, guarantees one account per email (race-proof).
    email: Mapped[str] = mapped_column(String(320), unique=True)
    # Nullable + UNIQUE: Postgres allows many NULLs, so only provided numbers must be unique.
    phone: Mapped[str | None] = mapped_column(String(16), unique=True)
    # Default currency for the user's income, budget and new expenses.
    currency: Mapped[str] = mapped_column(String(3))
    # Sensitive PII: keep out of logs and API responses meant for anyone but the owner.
    monthly_income: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    monthly_budget: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
