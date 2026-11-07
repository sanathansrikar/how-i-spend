from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import StringConstraints
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import User
from app.schemas.expense import ExpenseRead
from app.services import categories as category_service
from app.services import expenses as expense_service

router = APIRouter(prefix="/expenses", tags=["expenses"])

# Constrained alias: each category name in the query must be 1-50 characters.
CategoryName = Annotated[str, StringConstraints(min_length=1, max_length=50)]


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
