import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, Expense, User
from tests.factories import make_expense, make_user

URL = "/api/v1/expenses"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    return await make_user(session, email=get_settings().demo_user_email)


@pytest.fixture
async def expense(session: AsyncSession, demo_user: User) -> Expense:
    row = make_expense(demo_user, amount=Decimal("10.00"), merchant="Cafe", note="latte")
    session.add(row)
    await session.flush()
    return row


async def test_updates_only_the_fields_sent(client: AsyncClient, expense: Expense) -> None:
    response = await client.patch(f"{URL}/{expense.id}", json={"amount": "20.50"})

    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == "20.50"
    # Omitted fields are untouched.
    assert body["merchant"] == "Cafe"
    assert body["note"] == "latte"
    assert (await client.get(f"{URL}/{expense.id}")).json() == body


async def test_null_clears_optional_fields(client: AsyncClient, expense: Expense) -> None:
    response = await client.patch(f"{URL}/{expense.id}", json={"merchant": None, "note": None})

    assert response.status_code == 200
    assert response.json()["merchant"] is None
    assert response.json()["note"] is None


async def test_sets_and_clears_the_category(
    client: AsyncClient, session: AsyncSession, demo_user: User, expense: Expense
) -> None:
    session.add(Category(user_id=demo_user.id, name="Food"))
    await session.flush()

    set_ = await client.patch(f"{URL}/{expense.id}", json={"category": "food"})
    cleared = await client.patch(f"{URL}/{expense.id}", json={"category": None})

    assert set_.json()["category"] == "Food"
    assert cleared.json()["category"] is None


async def test_currency_is_upper_cased_and_date_changes(
    client: AsyncClient, expense: Expense
) -> None:
    response = await client.patch(
        f"{URL}/{expense.id}", json={"currency": "inr", "spent_on": "2026-10-31"}
    )

    assert response.json()["currency"] == "INR"
    assert response.json()["spent_on"] == "2026-10-31"


async def test_unknown_category_is_422_and_changes_nothing(
    client: AsyncClient, session: AsyncSession, expense: Expense
) -> None:
    other = await make_user(session, email="other@example.com")
    session.add(Category(user_id=other.id, name="Secret"))
    await session.flush()

    response = await client.patch(
        f"{URL}/{expense.id}", json={"amount": "99", "category": "Secret"}
    )

    assert response.status_code == 422
    assert (await client.get(f"{URL}/{expense.id}")).json()["amount"] == "10.00"


@pytest.mark.parametrize(
    "bad",
    [
        {},
        {"amount": None},
        {"spent_on": None},
        {"currency": None},
        {"amount": "0"},
        {"amount": "1.234"},
        {"currency": "US"},
        {"merchant": "x" * 101},
        {"user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"},
    ],
)
async def test_invalid_input_is_422(
    client: AsyncClient, expense: Expense, bad: dict[str, object]
) -> None:
    response = await client.patch(f"{URL}/{expense.id}", json=bad)

    assert response.status_code == 422


async def test_missing_expense_is_404(client: AsyncClient, demo_user: User) -> None:
    response = await client.patch(f"{URL}/{uuid.uuid4()}", json={"amount": "5"})

    assert response.status_code == 404


async def test_someone_elses_expense_is_404_and_untouched(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    theirs = make_expense(other, amount=Decimal("7.00"))
    session.add(theirs)
    await session.flush()

    response = await client.patch(f"{URL}/{theirs.id}", json={"amount": "1"})

    assert response.status_code == 404
    await session.refresh(theirs)
    assert theirs.amount == Decimal("7.00")
