import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Expense, User
from tests.factories import make_expense, make_user

URL = "/api/v1/expenses"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    return await make_user(session, email=get_settings().demo_user_email)


async def test_deletes_the_expense(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    expense = make_expense(demo_user)
    session.add(expense)
    await session.flush()

    response = await client.delete(f"{URL}/{expense.id}")

    assert response.status_code == 204
    assert response.content == b""
    assert (await client.get(f"{URL}/{expense.id}")).status_code == 404


async def test_deleting_twice_is_404(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    expense = make_expense(demo_user)
    session.add(expense)
    await session.flush()

    await client.delete(f"{URL}/{expense.id}")

    assert (await client.delete(f"{URL}/{expense.id}")).status_code == 404


async def test_missing_expense_is_404(client: AsyncClient, demo_user: User) -> None:
    assert (await client.delete(f"{URL}/{uuid.uuid4()}")).status_code == 404


async def test_someone_elses_expense_is_404_and_kept(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    theirs = make_expense(other)
    session.add(theirs)
    await session.flush()

    response = await client.delete(f"{URL}/{theirs.id}")

    assert response.status_code == 404
    assert await session.get(Expense, theirs.id) is not None
