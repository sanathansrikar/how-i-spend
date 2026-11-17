from decimal import Decimal

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from tests.factories import make_user

URL = "/api/v1/me"


async def test_returns_the_current_users_profile(
    client: AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, email=get_settings().demo_user_email)
    user.phone = "+919876543210"
    user.monthly_income = Decimal("50000.00")
    user.monthly_budget = Decimal("30000.00")
    await session.flush()
    await make_user(session, email="other@example.com")

    response = await client.get(URL)

    assert response.status_code == 200
    assert response.json() == {
        "full_name": "Test User",
        "email": get_settings().demo_user_email,
        "phone": "+919876543210",
        "currency": "USD",
        "monthly_income": "50000.00",
        "monthly_budget": "30000.00",
    }


async def test_optional_fields_are_null_when_unset(
    client: AsyncClient, session: AsyncSession
) -> None:
    await make_user(session, email=get_settings().demo_user_email)

    body = (await client.get(URL)).json()

    assert body["phone"] is None
    assert body["monthly_income"] is None
    assert body["monthly_budget"] is None
