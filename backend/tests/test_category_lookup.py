from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category
from app.services.categories import find_category
from tests.factories import make_user


async def test_finds_a_category_by_name_ignoring_case(session: AsyncSession) -> None:
    user = await make_user(session)
    food = Category(user_id=user.id, name="Food")
    session.add(food)
    await session.flush()

    assert await find_category(session, user.id, "fOOD") == food


async def test_returns_none_for_an_unknown_name(session: AsyncSession) -> None:
    user = await make_user(session)

    assert await find_category(session, user.id, "Nope") is None


async def test_never_finds_another_users_category(session: AsyncSession) -> None:
    owner = await make_user(session, email="owner@example.com")
    other = await make_user(session, email="other@example.com")
    session.add(Category(user_id=owner.id, name="Food"))
    await session.flush()

    assert await find_category(session, other.id, "Food") is None
