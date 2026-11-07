import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Category, Expense


async def list_expenses(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    categories: Sequence[str] | None = None,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[Expense]:
    # Tenant scoping: every query starts from the caller's user_id, so one user can never read
    # another user's rows, whatever filters are passed.
    # selectinload: fetches all categories in one extra query, avoiding one query per row (N+1).
    query = (
        select(Expense).where(Expense.user_id == user_id).options(selectinload(Expense.category))
    )
    if date_from is not None:
        query = query.where(Expense.spent_on >= date_from)
    if date_to is not None:
        query = query.where(Expense.spent_on <= date_to)
    if categories:
        # Filter by names, which users can type; case-insensitive so "food" finds "Food". IN means
        # an expense matches if its category is any of the given names (OR, not AND: an expense
        # has only one category). Unknown names simply match nothing.
        query = query.join(Category, Expense.category_id == Category.id).where(
            func.lower(Category.name).in_([name.lower() for name in categories])
        )
    # Stable ordering: the id tiebreak keeps limit/offset pages from repeating or skipping rows.
    query = query.order_by(Expense.spent_on.desc(), Expense.created_at.desc(), Expense.id)
    # Pagination: LIMIT/OFFSET bounds the response size however large the table grows.
    result = await session.scalars(query.limit(limit).offset(offset))
    return result.all()
