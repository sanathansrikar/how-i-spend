import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import StringConstraints
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import Category, User
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseUpdate
from app.services import categories as category_service
from app.services import expenses as expense_service

router = APIRouter(prefix="/expenses", tags=["expenses"])

# Constrained alias: each category name in the query must be 1-50 characters.
CategoryName = Annotated[str, StringConstraints(min_length=1, max_length=50)]


async def _resolve_category(session: AsyncSession, user: User, name: str | None) -> Category | None:
    # Names in, objects out: None means uncategorised; a name that is not the user's is a 422.
    if name is None:
        return None
    category = await category_service.get_by_name(session, user.id, name)
    if category is None:
        raise HTTPException(status_code=422, detail=f"Unknown categories: {name}.")
    return category


@router.get("", response_model=list[ExpenseRead])
async def list_expenses(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
    # Repeat the parameter to filter by several: ?category=Food&category=Bills (at most 20).
    # A plain list that defaults to empty, not `list | None`: Swagger UI cannot render an
    # "add item" control for an array-or-null type. It sits before the `= None` parameters
    # because Python requires parameters without a `=` default to come first.
    category: Annotated[list[CategoryName], Query(max_length=20, default_factory=list)],
    date_from: date | None = None,
    date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ExpenseRead]:
    """The current user's expenses, newest first.

    Dates are inclusive. `category` takes names and may be repeated; an expense matches if it is
    in any of them. A name that is not one of your categories returns 422.
    """
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must not be after date_to.")
    # Reject typos: a name that is not one of the user's categories is a client mistake, and
    # silently returning an empty list would hide it.
    unknown = await category_service.find_unknown_names(session, user.id, category)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown categories: {', '.join(unknown)}.")
    rows = await expense_service.list_expenses(
        session,
        user.id,
        date_from=date_from,
        date_to=date_to,
        categories=category,
        limit=limit,
        offset=offset,
    )
    return [ExpenseRead.model_validate(row) for row in rows]


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> ExpenseRead:
    """Create an expense for the current user.

    `category` is a name; one that is not yours returns 422. `currency` defaults to yours.
    """
    category = await _resolve_category(session, user, payload.category)
    expense = await expense_service.create_expense(
        session,
        user,
        amount=payload.amount,
        spent_on=payload.spent_on,
        category=category,
        currency=payload.currency,
        merchant=payload.merchant,
        note=payload.note,
    )
    return ExpenseRead.model_validate(expense)


@router.get("/{expense_id}", response_model=ExpenseRead)
async def get_expense(
    expense_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> ExpenseRead:
    """One of the current user's expenses; 404 if it does not exist or is not theirs."""
    expense = await expense_service.get_expense(session, user.id, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    return ExpenseRead.model_validate(expense)


@router.patch("/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: uuid.UUID,
    payload: ExpenseUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> ExpenseRead:
    """Change some fields of one of your expenses; fields you leave out stay as they are.

    Send `null` for `category`, `merchant` or `note` to clear them. 404 if it is not yours.
    """
    expense = await expense_service.get_expense(session, user.id, expense_id)
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")
    # exclude_unset: only what the client actually sent, so omitted fields are not overwritten.
    fields = payload.model_dump(exclude_unset=True)
    if "category" in fields:
        fields["category"] = await _resolve_category(session, user, fields["category"])
    expense = await expense_service.update_expense(session, expense, fields)
    return ExpenseRead.model_validate(expense)

