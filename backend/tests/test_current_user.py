import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from tests.factories import make_user


async def test_returns_the_demo_user(session: AsyncSession) -> None:
    demo = await make_user(session, email=get_settings().demo_user_email)
    await make_user(session, email="someone-else@example.com")

    assert await get_current_user(session) == demo


async def test_missing_demo_user_gives_a_helpful_error(session: AsyncSession) -> None:
    with pytest.raises(HTTPException) as error:
        await get_current_user(session)

    assert error.value.status_code == 500
    assert "seed" in error.value.detail
