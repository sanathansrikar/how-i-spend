import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, User
from tests.factories import make_expense, make_user

URL = "/api/v1/categories"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    return await make_user(session, email=get_settings().demo_user_email)


async def test_renames_and_expenses_follow(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    food = Category(user_id=demo_user.id, name="Food")
    session.add(food)
    await session.flush()
    expense = make_expense(demo_user, category_id=food.id)
    session.add(expense)
    await session.flush()

    response = await client.patch(f"{URL}/food", json={"name": "Eating out"})

    assert response.status_code == 200
    assert response.json() == {"name": "Eating out"}
    assert (await client.get(URL)).json() == ["Eating out"]
    assert (await client.get(f"/api/v1/expenses/{expense.id}")).json()["category"] == "Eating out"


async def test_changing_only_the_case_is_allowed(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add(Category(user_id=demo_user.id, name="food"))
    await session.flush()

    response = await client.patch(f"{URL}/food", json={"name": "Food"})

    assert response.status_code == 200
    assert (await client.get(URL)).json() == ["Food"]


async def test_taking_another_categorys_name_is_409(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add_all(Category(user_id=demo_user.id, name=n) for n in ("Food", "Bills"))
    await session.flush()

    response = await client.patch(f"{URL}/Food", json={"name": "bills"})

    assert response.status_code == 409
    assert (await client.get(URL)).json() == ["Bills", "Food"]


async def test_missing_or_someone_elses_category_is_404(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    session.add(Category(user_id=other.id, name="Secret"))
    await session.flush()

    assert (await client.patch(f"{URL}/Secret", json={"name": "x"})).status_code == 404
    assert (await client.patch(f"{URL}/Nope", json={"name": "x"})).status_code == 404


@pytest.mark.parametrize("bad", [{}, {"name": ""}, {"name": "x" * 51}])
async def test_invalid_input_is_422(
    client: AsyncClient, session: AsyncSession, demo_user: User, bad: dict[str, object]
) -> None:
    session.add(Category(user_id=demo_user.id, name="Food"))
    await session.flush()

    assert (await client.patch(f"{URL}/Food", json=bad)).status_code == 422
