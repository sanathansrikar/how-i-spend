from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


async def phone_in_use_by_other(session: AsyncSession, user: User, phone: str) -> bool:
    # Phones are unique across users; checking first gives a clear 409 instead of a DB error.
    other = await session.scalar(select(User.id).where(User.phone == phone, User.id != user.id))
    return other is not None


async def update_user(session: AsyncSession, user: User, fields: dict[str, Any]) -> User:
    # Partial update: only the keys the caller sent are written.
    for name, value in fields.items():
        setattr(user, name, value)
    await session.commit()
    # Re-read the money columns: the DB rounds to 2 places, so "75000" comes back as "75000.00".
    await session.refresh(user, ["monthly_income", "monthly_budget"])
    return user
