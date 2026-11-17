from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Category, User
from tests.factories import make_expense, make_user

URL = "/api/v1/expenses"


@pytest.fixture
async def demo_user(session: AsyncSession) -> User:
    return await make_user(session, email=get_settings().demo_user_email)


async def test_lists_only_the_current_users_expenses(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    session.add_all([make_expense(demo_user, merchant="mine"), make_expense(other)])
    await session.flush()

    response = await client.get(URL)

    assert response.status_code == 200
    assert [e["merchant"] for e in response.json()] == ["mine"]


async def test_returns_the_documented_fields_with_exact_amounts(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add(make_expense(demo_user, amount=Decimal("0.10"), merchant="Kiosk", note="tea"))
    await session.flush()

    [item] = (await client.get(URL)).json()

    assert item["amount"] == "0.10"  # a string: JSON floats would corrupt money
    assert item["currency"] == "USD"
    assert item["spent_on"] == "2026-11-01"
    assert item["merchant"] == "Kiosk"
    assert item["note"] == "tea"
    assert set(item) == {
        "id",
        "category",
        "amount",
        "currency",
        "spent_on",
        "merchant",
        "note",
    }


async def test_includes_category_name_or_null(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    food = Category(user_id=demo_user.id, name="Food")
    session.add(food)
    await session.flush()
    session.add_all(
        [
            make_expense(demo_user, merchant="lunch", category_id=food.id),
            make_expense(demo_user, merchant="loose"),
        ]
    )
    await session.flush()

    by_merchant = {e["merchant"]: e for e in (await client.get(URL)).json()}

    assert by_merchant["lunch"]["category"] == "Food"
    assert by_merchant["loose"]["category"] is None
    assert "category_id" not in by_merchant["lunch"]


async def test_newest_expense_comes_first(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add_all(
        [
            make_expense(demo_user, merchant="old", spent_on=date(2026, 10, 1)),
            make_expense(demo_user, merchant="new", spent_on=date(2026, 11, 5)),
            make_expense(demo_user, merchant="mid", spent_on=date(2026, 10, 20)),
        ]
    )
    await session.flush()

    merchants = [e["merchant"] for e in (await client.get(URL)).json()]

    assert merchants == ["new", "mid", "old"]


async def test_date_range_filter_is_inclusive(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    for day in (1, 2, 3, 4):
        session.add(make_expense(demo_user, merchant=f"d{day}", spent_on=date(2026, 11, day)))
    await session.flush()

    response = await client.get(URL, params={"date_from": "2026-11-02", "date_to": "2026-11-03"})

    assert sorted(e["merchant"] for e in response.json()) == ["d2", "d3"]


async def test_category_filter(client: AsyncClient, session: AsyncSession, demo_user: User) -> None:
    food = Category(user_id=demo_user.id, name="Food")
    bills = Category(user_id=demo_user.id, name="Bills")
    session.add_all([food, bills])
    await session.flush()
    session.add_all(
        [
            make_expense(demo_user, merchant="lunch", category_id=food.id),
            make_expense(demo_user, merchant="rent", category_id=bills.id),
            make_expense(demo_user, merchant="uncategorised"),
        ]
    )
    await session.flush()

    exact = await client.get(URL, params={"category": "Food"})
    any_case = await client.get(URL, params={"category": "fOOd"})

    assert [e["merchant"] for e in exact.json()] == ["lunch"]
    assert [e["merchant"] for e in any_case.json()] == ["lunch"]


async def test_known_category_without_expenses_gives_an_empty_list(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add(Category(user_id=demo_user.id, name="Travel"))
    await session.flush()

    response = await client.get(URL, params={"category": "Travel"})

    assert response.status_code == 200
    assert response.json() == []


async def test_unknown_categories_are_rejected_and_named(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    session.add(Category(user_id=demo_user.id, name="Food"))
    await session.flush()

    response = await client.get(URL, params={"category": ["Food", "Nope", "nope", "Zzz"]})

    assert response.status_code == 422
    assert response.json()["detail"] == "Unknown categories: Nope, nope, Zzz."


async def test_several_categories_match_any_of_them(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    food = Category(user_id=demo_user.id, name="Food")
    bills = Category(user_id=demo_user.id, name="Bills")
    fun = Category(user_id=demo_user.id, name="Fun")
    session.add_all([food, bills, fun])
    await session.flush()
    session.add_all(
        [
            make_expense(demo_user, merchant="lunch", category_id=food.id),
            make_expense(demo_user, merchant="rent", category_id=bills.id),
            make_expense(demo_user, merchant="movie", category_id=fun.id),
            make_expense(demo_user, merchant="uncategorised"),
        ]
    )
    await session.flush()

    response = await client.get(URL, params={"category": ["Food", "bills"]})

    assert sorted(e["merchant"] for e in response.json()) == ["lunch", "rent"]


async def test_category_filter_ignores_other_users_categories(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    other = await make_user(session, email="other@example.com")
    theirs = Category(user_id=other.id, name="Food")
    session.add(theirs)
    await session.flush()
    session.add(make_expense(other, merchant="their lunch", category_id=theirs.id))
    await session.flush()

    response = await client.get(URL, params={"category": "Food"})

    # Another user's category is not yours, so it counts as unknown rather than leaking data.
    assert response.status_code == 422


async def test_limit_and_offset_page_through_results(
    client: AsyncClient, session: AsyncSession, demo_user: User
) -> None:
    for day in range(1, 6):
        session.add(make_expense(demo_user, merchant=f"d{day}", spent_on=date(2026, 11, day)))
    await session.flush()

    first = (await client.get(URL, params={"limit": 2})).json()
    second = (await client.get(URL, params={"limit": 2, "offset": 2})).json()

    assert [e["merchant"] for e in first] == ["d5", "d4"]
    assert [e["merchant"] for e in second] == ["d3", "d2"]


@pytest.mark.parametrize(
    "params",
    [
        {"date_from": "2026-11-05", "date_to": "2026-11-01"},
        {"limit": 0},
        {"limit": 201},
        {"offset": -1},
        {"date_from": "not-a-date"},
        {"category": ""},
        {"category": ["Food", ""]},
        {"category": "x" * 51},
        {"category": [f"c{i}" for i in range(21)]},
    ],
)
async def test_invalid_query_is_rejected(
    client: AsyncClient, demo_user: User, params: dict[str, str | int | list[str]]
) -> None:
    assert (await client.get(URL, params=params)).status_code == 422


async def test_empty_list_when_user_has_no_expenses(client: AsyncClient, demo_user: User) -> None:
    response = await client.get(URL)

    assert response.status_code == 200
    assert response.json() == []
