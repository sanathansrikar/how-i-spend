"""add user profile and budget fields

Revision ID: 649342107e04
Revises: 5165a79f4cd4
Create Date: 2026-11-01 15:22:20.826366

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "649342107e04"
down_revision: str | Sequence[str] | None = "5165a79f4cd4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # NOT NULL columns without a default only work on an empty table (true before first deploy).
    # With existing rows, use: add nullable -> backfill -> set NOT NULL.
    op.add_column("users", sa.Column("full_name", sa.String(length=100), nullable=False))
    op.add_column("users", sa.Column("phone", sa.String(length=16), nullable=True))
    op.add_column("users", sa.Column("currency", sa.String(length=3), nullable=False))
    op.add_column(
        "users", sa.Column("monthly_income", sa.Numeric(precision=12, scale=2), nullable=True)
    )
    op.add_column(
        "users", sa.Column("monthly_budget", sa.Numeric(precision=12, scale=2), nullable=True)
    )
    op.create_unique_constraint(op.f("uq_users_phone"), "users", ["phone"])
    # Alembic cannot autodetect CHECK constraints, so they are written by hand.
    op.create_check_constraint(
        op.f("ck_users_phone_e164"), "users", r"phone ~ '^\+[1-9][0-9]{6,14}$'"
    )
    op.create_check_constraint(op.f("ck_users_currency_iso"), "users", "currency ~ '^[A-Z]{3}$'")
    op.create_check_constraint(op.f("ck_users_income_non_negative"), "users", "monthly_income >= 0")
    op.create_check_constraint(op.f("ck_users_budget_non_negative"), "users", "monthly_budget >= 0")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("ck_users_budget_non_negative"), "users", type_="check")
    op.drop_constraint(op.f("ck_users_income_non_negative"), "users", type_="check")
    op.drop_constraint(op.f("ck_users_currency_iso"), "users", type_="check")
    op.drop_constraint(op.f("ck_users_phone_e164"), "users", type_="check")
    op.drop_constraint(op.f("uq_users_phone"), "users", type_="unique")
    op.drop_column("users", "monthly_budget")
    op.drop_column("users", "monthly_income")
    op.drop_column("users", "currency")
    op.drop_column("users", "phone")
    op.drop_column("users", "full_name")
