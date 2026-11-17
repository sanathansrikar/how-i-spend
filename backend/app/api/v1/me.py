from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import User
from app.schemas.user import UserRead, UserUpdate
from app.services import users as user_service

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=UserRead)
async def get_me(user: Annotated[User, Depends(get_current_user)]) -> UserRead:
    """The current user's profile: name, contact, default currency, income and budget."""
    return UserRead.model_validate(user)


@router.patch("", response_model=UserRead)
async def update_me(
    payload: UserUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> UserRead:
    """Change some profile fields; fields you leave out stay as they are.

    Send `null` for `phone`, `monthly_income` or `monthly_budget` to clear them. Email cannot be
    changed. A phone number that another account uses returns 409.
    """
    # exclude_unset: only what the client actually sent, so omitted fields are not overwritten.
    fields = payload.model_dump(exclude_unset=True)
    phone = fields.get("phone")
    if phone is not None and await user_service.phone_in_use_by_other(session, user, phone):
        raise HTTPException(status_code=409, detail="Phone number is already in use.")
    user = await user_service.update_user(session, user, fields)
    return UserRead.model_validate(user)
