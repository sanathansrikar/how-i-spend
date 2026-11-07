import uuid
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, User
from tests.factories import make_expense, make_user

URL = "/api/v1/expenses"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    return await make_user(session, email=get_settings().demo_user_email)


async def test_returns_one_expense(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    expense = make_expense(demo_user, amount=Decimal("99.90"), merchant="Cafe")
    session.add(expense)
    await session.flush()

    response = await client.get(f"{URL}/{expense.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(expense.id)
    assert body["amount"] == "99.90"
    assert body["merchant"] == "Cafe"


async def test_includes_the_category_name(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    bills = Category(user_id=demo_user.id, name="Bills")
    session.add(bills)
    await session.flush()
    expense = make_expense(demo_user, category_id=bills.id)
    session.add(expense)
    await session.flush()

    body = (await client.get(f"{URL}/{expense.id}")).json()

    assert body["category"] == "Bills"


async def test_unknown_id_is_404(client: AsyncClient, demo_user: User) -> None:
    response = await client.get(f"{URL}/{uuid.uuid4()}")

    assert response.status_code == 404


async def test_another_users_expense_is_404_not_403(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    theirs = make_expense(other)
    session.add(theirs)
    await session.flush()

    response = await client.get(f"{URL}/{theirs.id}")

    assert response.status_code == 404  # same answer as a missing ID: existence is not leaked


async def test_malformed_id_is_422(client: AsyncClient, demo_user: User) -> None:
    assert (await client.get(f"{URL}/not-a-uuid")).status_code == 422
