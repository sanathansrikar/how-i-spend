import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, User
from tests.factories import make_user

URL = "/api/v1/categories"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    return await make_user(session, email=get_settings().demo_user_email)


async def test_creates_a_category_that_then_lists(client: AsyncClient, demo_user: User) -> None:
    response = await client.post(URL, json={"name": "Travel"})

    assert response.status_code == 201
    assert response.json() == {"name": "Travel"}
    assert (await client.get(URL)).json() == ["Travel"]


async def test_name_is_trimmed(client: AsyncClient, demo_user: User) -> None:
    response = await client.post(URL, json={"name": "  Travel  "})

    assert response.json() == {"name": "Travel"}


async def test_duplicate_ignoring_case_is_409(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add(Category(user_id=demo_user.id, name="Food"))
    await session.flush()

    response = await client.post(URL, json={"name": "food"})

    assert response.status_code == 409
    assert (await client.get(URL)).json() == ["Food"]


async def test_another_users_category_does_not_clash(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    session.add(Category(user_id=other.id, name="Food"))
    await session.flush()

    assert (await client.post(URL, json={"name": "Food"})).status_code == 201


@pytest.mark.parametrize("bad", [{}, {"name": ""}, {"name": "   "}, {"name": "x" * 51}, {"id": 1}])
async def test_invalid_input_is_422(
    client: AsyncClient, demo_user: User, bad: dict[str, object]
) -> None:
    payload = bad if "id" not in bad else {"name": "Food", **bad}

    assert (await client.post(URL, json=payload)).status_code == 422
