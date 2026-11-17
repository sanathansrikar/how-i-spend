import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, User
from tests.factories import make_expense, make_user

URL = "/api/v1/categories"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    return await make_user(session, email=get_settings().demo_user_email)


async def test_deletes_the_category_but_keeps_its_expenses(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    food = Category(user_id=demo_user.id, name="Food")
    session.add(food)
    await session.flush()
    expense = make_expense(demo_user, category_id=food.id)
    session.add(expense)
    await session.flush()

    response = await client.delete(f"{URL}/FOOD")

    assert response.status_code == 204
    assert (await client.get(URL)).json() == []
    kept = await client.get(f"/api/v1/expenses/{expense.id}")
    assert kept.status_code == 200
    assert kept.json()["category"] is None


async def test_missing_or_someone_elses_category_is_404_and_kept(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    session.add(Category(user_id=other.id, name="Secret"))
    await session.flush()

    assert (await client.delete(f"{URL}/Secret")).status_code == 404
    assert (await client.delete(f"{URL}/Nope")).status_code == 404
    still_there = await session.scalar(select(Category).where(Category.user_id == other.id))
    assert still_there is not None
