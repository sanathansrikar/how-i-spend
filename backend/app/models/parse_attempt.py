import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin


class ExpenseParseAttempt(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    """One AI attempt to turn free-form input into expenses, kept whether it succeeded or not.

    The link runs from expenses to attempts (expenses.parse_attempt_id), so one attempt can
    create several expenses, e.g. "movie 400, dinner 800 and cab 200".
    """

    __tablename__ = "expense_parse_attempts"
    __table_args__ = (
        # Text + CHECK instead of a Postgres ENUM: adding a value later is a plain migration.
        CheckConstraint("input_mode IN ('text', 'voice')", name="input_mode_valid"),
        CheckConstraint("status IN ('accepted', 'rejected')", name="status_valid"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="confidence_range"),
        # Composite index: serves "this user's recent attempts" without scanning the table.
        Index("ix_expense_parse_attempts_user_id_created_at", "user_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    # Extensibility: one table for every input channel; voice reuses it with input_mode='voice'.
    input_mode: Mapped[str] = mapped_column(String(10))
    # Original user input kept verbatim (for voice: the transcript), so a parse can be redone later.
    raw_input: Mapped[str] = mapped_column(Text)
    # Schemaless JSONB for channel extras (e.g. speech confidence): voice needs no migration.
    input_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(10))
    # Heuristic score, not a calibrated probability; the accept threshold lives in app config.
    confidence: Mapped[Decimal] = mapped_column(Numeric(3, 2))
    # Mandatory short rationale. Length is capped in the prompt, not here: the app must truncate
    # model output before insert so an over-long answer never costs us the whole attempt.
    reasoning: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(String(100))
    # Raw extraction output; nullable because a failed parse may produce nothing usable.
    parsed_payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
