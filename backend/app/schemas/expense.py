import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator


class ExpenseRead(BaseModel):
    # Response schema: the API contract, kept separate from the DB model so columns can change
    # without silently changing (or leaking through) what clients see.
    # from_attributes: lets Pydantic read fields straight off an ORM object.
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # The category's name only: users know categories by name, never by internal id.
    category: str | None
    amount: Decimal
    currency: str
    spent_on: date
    merchant: str | None
    note: str | None

    @field_validator("category", mode="before")
    @classmethod
    def _category_name(cls, value: object) -> object:
        # mode="before" runs ahead of type checking: the ORM gives us a Category object, and we
        # keep just its name. None (uncategorised) and plain strings pass through unchanged.
        return getattr(value, "name", value)
