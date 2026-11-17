from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, Expense, User
from tests.factories import make_user

URL = "/api/v1/expenses"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    return await make_user(session, email=get_settings().demo_user_email)


async def test_creates_and_returns_the_expense(client: AsyncClient, demo_user: User) -> None:
    response = await client.post(
        URL, json={"amount": "99.90", "spent_on": "2026-11-02", "merchant": "Cafe", "note": "hi"}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["amount"] == "99.90"
    assert body["merchant"] == "Cafe"
    assert body["note"] == "hi"
    assert body["category"] is None
    # Round trip: the created expense is readable through the existing GET endpoint.
    assert (await client.get(f"{URL}/{body['id']}")).json() == body


async def test_currency_defaults_to_the_users_and_is_upper_cased(
    client: AsyncClient, demo_user: User
) -> None:
    default = await client.post(URL, json={"amount": "1", "spent_on": "2026-11-02"})
    explicit = await client.post(
        URL, json={"amount": "1", "spent_on": "2026-11-02", "currency": "eur"}
    )

    assert default.json()["currency"] == demo_user.currency
    assert explicit.json()["currency"] == "EUR"


async def test_category_is_matched_by_name_case_insensitively(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add(Category(user_id=demo_user.id, name="Food"))
    await session.flush()

    response = await client.post(
        URL, json={"amount": "5", "spent_on": "2026-11-02", "category": "food"}
    )

    assert response.status_code == 201
    assert response.json()["category"] == "Food"


async def test_unknown_category_is_422_and_nothing_is_saved(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    session.add(Category(user_id=other.id, name="Secret"))
    await session.flush()

    # Another user's category is "unknown" to the caller.
    response = await client.post(
        URL, json={"amount": "5", "spent_on": "2026-11-02", "category": "Secret"}
    )

    assert response.status_code == 422
    assert (await client.get(URL)).json() == []


@pytest.mark.parametrize(
    "bad",
    [
        {"amount": "0"},
        {"amount": "-3"},
        {"amount": "1.234"},
        {"amount": "12345678901"},
        {"amount": "abc"},
        {"currency": "US"},
        {"spent_on": "not-a-date"},
        {"merchant": "x" * 101},
        {"user_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"},
    ],
)
async def test_invalid_input_is_422(
    client: AsyncClient, demo_user: User, bad: dict[str, str]
) -> None:
    payload = {"amount": "5", "spent_on": "2026-11-02", **bad}

    response = await client.post(URL, json=payload)

    assert response.status_code == 422


async def test_missing_required_fields_is_422(client: AsyncClient, demo_user: User) -> None:
    assert (await client.post(URL, json={"amount": "5"})).status_code == 422
    assert (await client.post(URL, json={"spent_on": "2026-11-02"})).status_code == 422


async def test_expense_belongs_to_the_current_user(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    response = await client.post(URL, json={"amount": "5", "spent_on": "2026-11-02"})

    row = await session.get(Expense, response.json()["id"])
    assert row is not None
    assert row.user_id == demo_user.id
    assert row.amount == Decimal("5.00")


async def test_amount_is_returned_with_two_decimals(client: AsyncClient, demo_user: User) -> None:
    created = await client.post(URL, json={"amount": "5", "spent_on": "2026-11-02"})

    # Same shape as GET: the DB rounds to 2 places, so the response must not echo "5".
    assert created.json()["amount"] == "5.00"
