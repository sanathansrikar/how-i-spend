import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category


async def find_unknown_names(
    session: AsyncSession, user_id: uuid.UUID, names: Sequence[str]
) -> list[str]:
    """The given names that are not among the user's categories (case-insensitive)."""
    known = {category.name.lower() for category in await list_categories(session, user_id)}
    # dict.fromkeys: drops repeats while keeping the order the caller typed them in.
    return [name for name in dict.fromkeys(names) if name.lower() not in known]


async def list_categories(session: AsyncSession, user_id: uuid.UUID) -> Sequence[Category]:
    # Tenant scoping: only the caller's own categories are ever returned.
    # Case-insensitive sort so "bills" and "Bills" order together; id breaks any tie.
    result = await session.scalars(
        select(Category)
        .where(Category.user_id == user_id)
        .order_by(func.lower(Category.name), Category.id)
    )
    return result.all()
