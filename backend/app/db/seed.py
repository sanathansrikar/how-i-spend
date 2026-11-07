"""Seed the local database with sample data: `uv run python -m app.db.seed`."""

import asyncio
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import SessionFactory, engine
from app.models import Category, Expense, User

SEED_EMAIL = "demo@example.com"
CATEGORY_NAMES = ["Food", "Transport", "Entertainment", "Bills"]
# (category, amount, merchant, day of month)
SAMPLE_EXPENSES = [
    ("Food", "450.00", "Dinner out", 2),
    ("Transport", "180.00", "Cab", 2),
    ("Entertainment", "400.00", "Movie", 2),
    ("Bills", "999.00", "Internet", 5),
    ("Food", "120.50", "Groceries", 9),
]


async def seed(session: AsyncSession) -> bool:
    # Idempotent: re-running must not duplicate data, so we bail out if the demo user exists.
    existing = await session.scalar(select(User).where(User.email == SEED_EMAIL))
    if existing is not None:
        return False

    user = User(
        full_name="Demo User",
        email=SEED_EMAIL,
        currency="INR",
        monthly_income=Decimal("60000.00"),
        monthly_budget=Decimal("40000.00"),
    )
    session.add(user)
    await session.flush()  # flush: the INSERT runs now, so DB defaults (user.id) are populated

    categories = {name: Category(user_id=user.id, name=name) for name in CATEGORY_NAMES}
    session.add_all(categories.values())
    await session.flush()

    session.add_all(
        Expense(
            user_id=user.id,
            category_id=categories[category].id,
            amount=Decimal(amount),
            currency="INR",
            spent_on=date(2026, 11, day),
            merchant=merchant,
        )
        for category, amount, merchant, day in SAMPLE_EXPENSES
    )
    await session.commit()
    return True


async def main() -> None:
    # Safety guard: seeding a non-local database with fake data would pollute real records.
    if get_settings().environment != "local":
        raise SystemExit("Refusing to seed: ENVIRONMENT is not 'local'.")
    async with SessionFactory() as session:
        created = await seed(session)
    await engine.dispose()
    print("Seeded demo data." if created else f"Already seeded ({SEED_EMAIL} exists); skipped.")


if __name__ == "__main__":
    asyncio.run(main())
