"""Test data builders: one place to create valid rows so tests only state what they vary."""

from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Expense, ExpenseParseAttempt, User


async def make_user(session: AsyncSession, email: str = "a@example.com") -> User:
    user = User(email=email, full_name="Test User", currency="USD")
    session.add(user)
    # flush sends the INSERT now so DB defaults (id, timestamps) are populated.
    await session.flush()
    return user


def make_expense(user: User, **overrides: object) -> Expense:
    fields: dict[str, object] = {
        "user_id": user.id,
        "amount": Decimal("12.50"),
        "currency": "USD",
        "spent_on": date(2026, 11, 1),
    }
    return Expense(**{**fields, **overrides})


def make_attempt(user: User, **overrides: object) -> ExpenseParseAttempt:
    fields: dict[str, object] = {
        "user_id": user.id,
        "input_mode": "text",
        "raw_input": "spent 250 at starbucks yesterday",
        "status": "accepted",
        "confidence": Decimal("0.92"),
        "reasoning": "Read 250 as the amount and matched Starbucks to Food",
        "model": "test-model",
    }
    return ExpenseParseAttempt(**{**fields, **overrides})
