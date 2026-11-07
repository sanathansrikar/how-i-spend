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


async def test_lists_names_sorted_ignoring_case(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add_all(
        Category(user_id=demo_user.id, name=name) for name in ("travel", "Bills", "Food")
    )
    await session.flush()

    response = await client.get(URL)

    assert response.status_code == 200
    assert response.json() == ["Bills", "Food", "travel"]


async def test_returns_plain_names_without_ids(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add(Category(user_id=demo_user.id, name="Food"))
    await session.flush()

    assert (await client.get(URL)).json() == ["Food"]


async def test_only_the_current_users_categories(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    session.add_all(
        [
            Category(user_id=demo_user.id, name="Mine"),
            Category(user_id=other.id, name="Theirs"),
        ]
    )
    await session.flush()

    assert (await client.get(URL)).json() == ["Mine"]


async def test_empty_list_when_user_has_no_categories(client: AsyncClient, demo_user: User) -> None:
    response = await client.get(URL)

    assert response.status_code == 200
    assert response.json() == []
