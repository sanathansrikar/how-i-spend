from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import Category, User
from app.schemas.category import CategoryCreate, CategoryRead
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


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> CategoryRead:
    """Create a category. Names are unique per user, ignoring case; a duplicate returns 409."""
    # 409 Conflict: the request is valid but clashes with existing state.
    if await category_service.find_category(session, user.id, payload.name) is not None:
        raise HTTPException(status_code=409, detail=f"Category already exists: {payload.name}.")
    category = await category_service.create_category(session, user.id, payload.name)
    return CategoryRead(name=category.name)


async def _get_own_category(session: AsyncSession, user: User, name: str) -> Category:
    category = await category_service.find_category(session, user.id, name)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    return category


@router.patch("/{name}", response_model=CategoryRead)
async def rename_category(
    name: str,
    payload: CategoryCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> CategoryRead:
    """Rename a category; its expenses follow. 404 if it is not yours, 409 if the name is taken."""
    category = await _get_own_category(session, user, name)
    clash = await category_service.find_category(session, user.id, payload.name)
    # Changing only the letter case of the same category is allowed; any other match is a clash.
    if clash is not None and clash.id != category.id:
        raise HTTPException(status_code=409, detail=f"Category already exists: {payload.name}.")
    category = await category_service.rename_category(session, category, payload.name)
    return CategoryRead(name=category.name)


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    name: str,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Delete a category. Its expenses are kept and become uncategorised. 404 if not yours."""
    category = await _get_own_category(session, user, name)
    await category_service.delete_category(session, category)
