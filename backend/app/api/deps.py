from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from app.models import User


async def get_current_user(session: Annotated[AsyncSession, Depends(get_session)]) -> User:
    # Dependency injection: routes ask for "the current user" and never learn how it is found,
    # so swapping this demo lookup for real auth later changes only this function.
    user = await session.scalar(select(User).where(User.email == get_settings().demo_user_email))
    if user is None:
        raise HTTPException(
            status_code=500, detail="Demo user missing; run `uv run python -m app.db.seed`."
        )
    return user
