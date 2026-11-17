from decimal import Decimal

from pydantic import BaseModel


class CategoryTotal(BaseModel):
    # None is the uncategorised bucket.
    category: str | None
    total: Decimal
    count: int


class MonthlySummary(BaseModel):
    month: str
    # All money below is in this currency (the user's own); see other_currency_count.
    currency: str
    total_spent: Decimal
    expense_count: int
    monthly_income: Decimal | None
    monthly_budget: Decimal | None
    # Budget minus spent; negative means over budget. None when no budget is set.
    budget_remaining: Decimal | None
    by_category: list[CategoryTotal]
    # Expenses in other currencies are not converted or summed; this says how many were left out.
    other_currency_count: int
