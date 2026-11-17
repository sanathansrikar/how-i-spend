from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import User
from app.schemas.summary import MonthlySummary
from app.services import summary as summary_service

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("/monthly", response_model=MonthlySummary)
async def monthly_summary(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
    # pattern: YYYY-MM with a real month, so "2026-13" is a 422 rather than a crash.
    month: Annotated[str | None, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")] = None,
) -> MonthlySummary:
    """Spending for one month (default: this month) in your currency, total and per category.

    Compares against your monthly budget when you have one. Expenses in other currencies are
    not converted; `other_currency_count` says how many were left out.
    """
    if month is None:
        today = date.today()
        year, month_number = today.year, today.month
    else:
        year, month_number = int(month[:4]), int(month[5:])
    return await summary_service.monthly_summary(session, user, year, month_number)
