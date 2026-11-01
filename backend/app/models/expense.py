import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Expense(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "expenses"
    __table_args__ = (
        # CHECK constraint: bad data is rejected at the DB layer, whatever code writes it.
        CheckConstraint("amount > 0", name="amount_positive"),
        # Composite index: serves "my expenses in a date range" without a full table scan.
        Index("ix_expenses_user_id_spent_on", "user_id", "spent_on"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    # ON DELETE SET NULL: removing a category keeps the expense history, just uncategorised.
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    # NUMERIC, never float: binary floats can't represent 0.10 exactly, corrupting money maths.
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # ISO 4217 code per row: no assumed currency, so multi-currency needs no migration.
    currency: Mapped[str] = mapped_column(String(3))
    # DATE not timestamp: the user-chosen calendar day, distinct from created_at.
    spent_on: Mapped[date]
    merchant: Mapped[str | None] = mapped_column(String(100))
    note: Mapped[str | None] = mapped_column(Text)
