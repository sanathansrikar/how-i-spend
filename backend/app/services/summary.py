from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, Expense, User
from app.schemas.summary import CategoryTotal, MonthlySummary


def month_bounds(year: int, month: int) -> tuple[date, date]:
    # Half-open range [first day, first day of next month): no day is counted twice or missed.
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


async def monthly_summary(
    session: AsyncSession, user: User, year: int, month: int
) -> MonthlySummary:
    start, end = month_bounds(year, month)
    # Tenant scoping: every query starts from the caller's user_id.
    in_month = (Expense.user_id == user.id, Expense.spent_on >= start, Expense.spent_on < end)

    # Aggregation in SQL: the database sums, so only one row per category crosses the wire.
    rows = await session.execute(
        select(Category.name, func.sum(Expense.amount), func.count(Expense.id))
        .select_from(Expense)
        .outerjoin(Category, Expense.category_id == Category.id)
        .where(*in_month, Expense.currency == user.currency)
        .group_by(Category.name)
        .order_by(func.sum(Expense.amount).desc(), Category.name)
    )
    by_category = [CategoryTotal(category=n, total=t, count=c) for n, t, c in rows.all()]
    total = sum((row.total for row in by_category), Decimal("0.00"))

    other_currency_count = await session.scalar(
        select(func.count(Expense.id)).where(*in_month, Expense.currency != user.currency)
    )
    budget = user.monthly_budget
    return MonthlySummary(
        month=f"{year:04d}-{month:02d}",
        currency=user.currency,
        total_spent=total,
        expense_count=sum(row.count for row in by_category),
        monthly_income=user.monthly_income,
        monthly_budget=budget,
        budget_remaining=budget - total if budget is not None else None,
        by_category=by_category,
        other_currency_count=other_currency_count or 0,
    )
