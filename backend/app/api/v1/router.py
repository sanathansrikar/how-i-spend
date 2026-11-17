from fastapi import APIRouter

from app.api.v1 import categories, expenses, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(categories.router)
api_router.include_router(expenses.router)
