from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, Expense, User


async def make_user(session: AsyncSession, email: str = "a@example.com") -> User:
    user = User(email=email, full_name="Test User", currency="USD")
    session.add(user)
    await (
        session.flush()
    )  # flush sends the INSERT now so DB defaults (id, timestamps) are populated
    return user


def make_expense(user: User, **overrides: object) -> Expense:
    fields: dict[str, object] = {
        "user_id": user.id,
        "amount": Decimal("12.50"),
        "currency": "USD",
        "spent_on": date(2026, 11, 1),
    }
    return Expense(**{**fields, **overrides})


async def test_database_fills_id_and_timestamps(session: AsyncSession) -> None:
    user = await make_user(session)

    assert user.id is not None
    assert user.created_at.tzinfo is not None  # timestamptz round-trips as timezone-aware


async def test_amount_keeps_exact_decimal_precision(session: AsyncSession) -> None:
    user = await make_user(session)
    expense = make_expense(user, amount=Decimal("0.10"))
    session.add(expense)
    await session.flush()
    await session.refresh(expense)

    assert expense.amount == Decimal("0.10")


async def test_non_positive_amount_is_rejected(session: AsyncSession) -> None:
    user = await make_user(session)
    session.add(make_expense(user, amount=Decimal("0")))

    with pytest.raises(IntegrityError, match="amount_positive"):
        await session.flush()


async def test_email_must_be_unique(session: AsyncSession) -> None:
    await make_user(session, "dup@example.com")
    session.add(User(email="dup@example.com", full_name="Dup", currency="USD"))

    with pytest.raises(IntegrityError, match="uq_users_email"):
        await session.flush()


async def test_category_name_is_unique_per_user_only(session: AsyncSession) -> None:
    alice = await make_user(session, "alice@example.com")
    bob = await make_user(session, "bob@example.com")
    session.add_all(
        [Category(user_id=alice.id, name="Food"), Category(user_id=bob.id, name="Food")]
    )
    await session.flush()  # same name for different users is fine

    session.add(Category(user_id=alice.id, name="Food"))
    with pytest.raises(IntegrityError, match="uq_categories_user_id_name"):
        await session.flush()


async def test_deleting_category_keeps_expense_uncategorised(session: AsyncSession) -> None:
    user = await make_user(session)
    category = Category(user_id=user.id, name="Food")
    session.add(category)
    await session.flush()
    expense = make_expense(user, category_id=category.id)
    session.add(expense)
    await session.flush()

    await session.delete(category)
    await session.flush()
    await session.refresh(expense)

    assert expense.category_id is None


async def test_deleting_user_cascades_to_their_data(session: AsyncSession) -> None:
    user = await make_user(session)
    expense = make_expense(user)
    session.add(expense)
    await session.flush()
    expense_id = expense.id

    await session.delete(user)
    await session.flush()
    session.expunge_all()  # drop cached objects so the next get() really queries the DB

    assert await session.get(Expense, expense_id) is None


async def test_income_and_budget_are_optional(session: AsyncSession) -> None:
    user = await make_user(session)

    assert user.monthly_income is None
    assert user.monthly_budget is None


@pytest.mark.parametrize("field", ["monthly_income", "monthly_budget"])
async def test_negative_income_or_budget_is_rejected(session: AsyncSession, field: str) -> None:
    session.add(
        User(
            email="neg@example.com",
            full_name="Neg",
            currency="USD",
            **{field: Decimal("-1")},
        )
    )

    with pytest.raises(IntegrityError, match="non_negative"):
        await session.flush()


@pytest.mark.parametrize("phone", ["9876543210", "+0123456789", "+12", "+91 98765 43210"])
async def test_phone_must_be_e164(session: AsyncSession, phone: str) -> None:
    session.add(User(email="p@example.com", full_name="P", currency="USD", phone=phone))

    with pytest.raises(IntegrityError, match="phone_e164"):
        await session.flush()


async def test_phone_unique_but_many_users_may_omit_it(session: AsyncSession) -> None:
    # Two users with no phone is fine: NULLs never collide under a UNIQUE constraint.
    await make_user(session, "n1@example.com")
    await make_user(session, "n2@example.com")
    session.add(User(email="p1@example.com", full_name="A", currency="USD", phone="+919876543210"))
    await session.flush()

    session.add(User(email="p2@example.com", full_name="B", currency="USD", phone="+919876543210"))
    with pytest.raises(IntegrityError, match="uq_users_phone"):
        await session.flush()


async def test_currency_must_be_three_uppercase_letters(session: AsyncSession) -> None:
    session.add(User(email="c@example.com", full_name="C", currency="usd"))

    with pytest.raises(IntegrityError, match="currency_iso"):
        await session.flush()
