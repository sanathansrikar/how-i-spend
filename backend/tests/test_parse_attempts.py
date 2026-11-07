from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Expense, ExpenseParseAttempt
from tests.factories import make_attempt, make_expense, make_user


async def test_expense_links_back_to_its_parse_attempt(session: AsyncSession) -> None:
    user = await make_user(session)
    attempt = make_attempt(user)
    session.add(attempt)
    await session.flush()
    expense = make_expense(user, parse_attempt_id=attempt.id)
    session.add(expense)
    await session.flush()

    assert expense.parse_attempt_id == attempt.id
    assert attempt.created_at is not None


async def test_one_attempt_can_create_many_expenses(session: AsyncSession) -> None:
    # "movie 400, dinner 800 and cab 200" is one sentence but three expenses.
    user = await make_user(session)
    attempt = make_attempt(user)
    session.add(attempt)
    await session.flush()
    session.add_all(
        [
            make_expense(user, parse_attempt_id=attempt.id, amount=Decimal(n))
            for n in (400, 800, 200)
        ]
    )
    await session.flush()

    count = await session.scalar(
        select(func.count()).select_from(Expense).where(Expense.parse_attempt_id == attempt.id)
    )
    assert count == 3


async def test_reasoning_is_mandatory(session: AsyncSession) -> None:
    user = await make_user(session)
    session.add(make_attempt(user, reasoning=None))

    with pytest.raises(IntegrityError, match="reasoning"):
        await session.flush()


async def test_rejected_attempt_may_have_no_payload(session: AsyncSession) -> None:
    user = await make_user(session)
    attempt = make_attempt(user, status="rejected", confidence=Decimal("0.40"))
    session.add(attempt)
    await session.flush()

    assert attempt.parsed_payload is None


async def test_voice_reuses_the_table_with_channel_metadata(session: AsyncSession) -> None:
    # Extensibility check: a voice attempt needs no new column, only input_mode + metadata.
    user = await make_user(session)
    attempt = make_attempt(
        user, input_mode="voice", input_metadata={"stt_confidence": 0.93, "language": "en-IN"}
    )
    session.add(attempt)
    await session.flush()
    await session.refresh(attempt)

    assert attempt.input_metadata == {"stt_confidence": 0.93, "language": "en-IN"}


@pytest.mark.parametrize(
    ("overrides", "constraint"),
    [
        ({"input_mode": "fax"}, "input_mode_valid"),
        ({"status": "maybe"}, "status_valid"),
        ({"confidence": Decimal("1.50")}, "confidence_range"),
        ({"confidence": Decimal("-0.10")}, "confidence_range"),
    ],
)
async def test_invalid_values_are_rejected(
    session: AsyncSession, overrides: dict[str, object], constraint: str
) -> None:
    user = await make_user(session)
    session.add(make_attempt(user, **overrides))

    with pytest.raises(IntegrityError, match=constraint):
        await session.flush()


async def test_deleting_the_attempt_keeps_its_expenses(session: AsyncSession) -> None:
    user = await make_user(session)
    attempt = make_attempt(user)
    session.add(attempt)
    await session.flush()
    expense = make_expense(user, parse_attempt_id=attempt.id)
    session.add(expense)
    await session.flush()

    await session.delete(attempt)
    await session.flush()
    await session.refresh(expense)

    assert expense.parse_attempt_id is None


async def test_deleting_the_user_removes_their_attempts(session: AsyncSession) -> None:
    user = await make_user(session)
    attempt = make_attempt(user)
    session.add(attempt)
    await session.flush()
    attempt_id = attempt.id

    await session.delete(user)
    await session.flush()
    session.expunge_all()

    assert await session.get(ExpenseParseAttempt, attempt_id) is None
