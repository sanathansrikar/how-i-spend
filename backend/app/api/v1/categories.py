from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import User
from app.services import categories as category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[str])
async def list_categories(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[str]:
    """The current user's category names, sorted. Names are what clients filter expenses by."""
    rows = await category_service.list_categories(session, user.id)
    # Plain names, not objects: users identify categories by name, never by internal id.
    return [row.name for row in rows]
