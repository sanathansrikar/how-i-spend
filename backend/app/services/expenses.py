import uuid
from collections.abc import Sequence
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Category, Expense, User


async def create_expense(
    session: AsyncSession,
    user: User,
    *,
    amount: Decimal,
    spent_on: date,
    category: Category | None,
    currency: str | None,
    merchant: str | None,
    note: str | None,
) -> Expense:
    expense = Expense(
        # user_id comes from the authenticated user, never from the request body.
        user_id=user.id,
        category_id=category.id if category else None,
        amount=amount,
        # Default: fall back to the user's own currency when the client does not say.
        currency=currency or user.currency,
        spent_on=spent_on,
        merchant=merchant,
        note=note,
        # Set the relationship up front: the response needs the category name, and lazy loading
        # it later would fail in async code.
        category=category,
    )
    session.add(expense)
    # Unit of work: one commit makes the whole row durable (or none of it).
    await session.commit()
    return expense


async def get_expense(
    session: AsyncSession, user_id: uuid.UUID, expense_id: uuid.UUID
) -> Expense | None:
    # Filter by owner in the query itself: someone else's expense is indistinguishable from a
    # missing one, so the API never confirms that another user's ID exists.
    return await session.scalar(
        select(Expense)
        .where(Expense.id == expense_id, Expense.user_id == user_id)
        .options(selectinload(Expense.category))
    )


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


async def update_expense(
    session: AsyncSession, expense: Expense, fields: dict[str, Any]
) -> Expense:
    # Partial update: only the keys the caller sent are written; "category" holds a Category
    # object (or None to clear it), already resolved and scoped to the user by the caller.
    for name, value in fields.items():
        setattr(expense, name, value)
    await session.commit()
    return expense

