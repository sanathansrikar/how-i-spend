from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import User
from tests.factories import make_user

URL = "/api/v1/me"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    user = await make_user(session, email=get_settings().demo_user_email)
    user.monthly_budget = Decimal("1000.00")
    await session.flush()
    return user


async def test_updates_only_the_fields_sent(client: AsyncClient, demo_user: User) -> None:
    response = await client.patch(
        URL, json={"full_name": "Asha", "currency": "inr", "monthly_income": "75000"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Asha"
    assert body["currency"] == "INR"
    assert body["monthly_income"] == "75000.00"
    assert body["monthly_budget"] == "1000.00"
    assert (await client.get(URL)).json() == body


async def test_null_clears_optional_fields(client: AsyncClient, demo_user: User) -> None:
    await client.patch(URL, json={"phone": "+919876543210"})

    response = await client.patch(URL, json={"phone": None, "monthly_budget": None})

    assert response.json()["phone"] is None
    assert response.json()["monthly_budget"] is None


async def test_phone_used_by_another_account_is_409(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    other.phone = "+919876543210"
    await session.flush()

    response = await client.patch(URL, json={"phone": "+919876543210"})

    assert response.status_code == 409
    assert (await client.get(URL)).json()["phone"] is None


async def test_keeping_your_own_phone_is_fine(client: AsyncClient, demo_user: User) -> None:
    await client.patch(URL, json={"phone": "+919876543210"})

    assert (await client.patch(URL, json={"phone": "+919876543210"})).status_code == 200


@pytest.mark.parametrize(
    "bad",
    [
        {},
        {"full_name": None},
        {"full_name": ""},
        {"currency": None},
        {"currency": "US"},
        {"phone": "9876543210"},
        {"monthly_income": "-1"},
        {"monthly_budget": "1.234"},
        {"email": "new@example.com"},
    ],
)
async def test_invalid_input_is_422(
    client: AsyncClient, demo_user: User, bad: dict[str, object]
) -> None:
    assert (await client.patch(URL, json=bad)).status_code == 422
