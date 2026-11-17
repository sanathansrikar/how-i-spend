from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, User
from tests.factories import make_expense, make_user

URL = "/api/v1/summary/monthly"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    user = await make_user(session, email=get_settings().demo_user_email)
    user.monthly_budget = Decimal("100.00")
    await session.flush()
    return user


async def test_totals_by_category_and_budget(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    food = Category(user_id=demo_user.id, name="Food")
    bills = Category(user_id=demo_user.id, name="Bills")
    session.add_all([food, bills])
    await session.flush()
    session.add_all(
        [
            make_expense(demo_user, amount=Decimal("10.50"), category_id=food.id),
            make_expense(demo_user, amount=Decimal("4.50"), category_id=food.id),
            make_expense(demo_user, amount=Decimal("60.00"), category_id=bills.id),
            make_expense(demo_user, amount=Decimal("5.00")),
        ]
    )
    await session.flush()

    response = await client.get(URL, params={"month": "2026-11"})

    assert response.status_code == 200
    assert response.json() == {
        "month": "2026-11",
        "currency": "USD",
        "total_spent": "80.00",
        "expense_count": 4,
        "monthly_income": None,
        "monthly_budget": "100.00",
        "budget_remaining": "20.00",
        "by_category": [
            {"category": "Bills", "total": "60.00", "count": 1},
            {"category": "Food", "total": "15.00", "count": 2},
            {"category": None, "total": "5.00", "count": 1},
        ],
        "other_currency_count": 0,
    }


async def test_only_that_month_counts_including_its_edges(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    for day in (date(2026, 10, 31), date(2026, 11, 1), date(2026, 11, 30), date(2026, 12, 1)):
        session.add(make_expense(demo_user, amount=Decimal("1.00"), spent_on=day))
    await session.flush()

    body = (await client.get(URL, params={"month": "2026-11"})).json()

    assert body["expense_count"] == 2
    assert body["total_spent"] == "2.00"


async def test_december_does_not_spill_into_january(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    for day in (date(2026, 12, 31), date(2027, 1, 1)):
        session.add(make_expense(demo_user, amount=Decimal("1.00"), spent_on=day))
    await session.flush()

    assert (await client.get(URL, params={"month": "2026-12"})).json()["expense_count"] == 1


async def test_other_currencies_are_counted_not_summed(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add_all(
        [
            make_expense(demo_user, amount=Decimal("10.00")),
            make_expense(demo_user, amount=Decimal("900.00"), currency="EUR"),
        ]
    )
    await session.flush()

    body = (await client.get(URL, params={"month": "2026-11"})).json()

    assert body["total_spent"] == "10.00"
    assert body["other_currency_count"] == 1


async def test_someone_elses_expenses_are_ignored(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    session.add(make_expense(other, amount=Decimal("500.00")))
    await session.flush()

    body = (await client.get(URL, params={"month": "2026-11"})).json()

    assert body["total_spent"] == "0.00"
    assert body["by_category"] == []


async def test_empty_month_without_a_budget(client: AsyncClient, session: AsyncSession) -> None:
    await make_user(session, email=get_settings().demo_user_email)

    body = (await client.get(URL, params={"month": "2026-11"})).json()

    assert body["total_spent"] == "0.00"
    assert body["budget_remaining"] is None


async def test_over_budget_is_negative(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add(make_expense(demo_user, amount=Decimal("130.00")))
    await session.flush()

    body = (await client.get(URL, params={"month": "2026-11"})).json()

    assert body["budget_remaining"] == "-30.00"


async def test_defaults_to_the_current_month(client: AsyncClient, demo_user: User) -> None:
    body = (await client.get(URL)).json()

    assert body["month"] == date.today().strftime("%Y-%m")


@pytest.mark.parametrize("month", ["2026-13", "2026-00", "2026-1", "nov-2026", "2026-11-01"])
async def test_bad_month_is_422(client: AsyncClient, demo_user: User, month: str) -> None:
    assert (await client.get(URL, params={"month": month})).status_code == 422
