# Import all models so they register on Base.metadata; Alembic only sees imported ones.
from app.models.category import Category
from app.models.expense import Expense
from app.models.user import User

__all__ = ["Category", "Expense", "User"]
