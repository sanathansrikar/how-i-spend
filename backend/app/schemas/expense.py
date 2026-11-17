import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ExpenseCreate(BaseModel):
    # Request schema: what clients may send. Separate from ExpenseRead so server-owned fields
    # (id, user_id, timestamps) can never be set by the caller.
    # extra="forbid": unknown fields are rejected instead of silently ignored, catching typos.
    model_config = ConfigDict(extra="forbid")

    # Field constraints: validated at the edge. gt=0 mirrors the DB CHECK; max_digits and
    # decimal_places mirror NUMERIC(12, 2) so an over-precise amount fails with 422, not a DB error.
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    spent_on: date
    # Category by name (case-insensitive), like the read side; None means uncategorised.
    category: str | None = Field(default=None, min_length=1, max_length=50)
    # None means "use the user's own currency".
    currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    merchant: str | None = Field(default=None, max_length=100)
    note: str | None = None

    @field_validator("currency")
    @classmethod
    def _upper_currency(cls, value: str | None) -> str | None:
        # Normalise: ISO 4217 codes are upper case, so "usd" and "USD" are stored identically.
        return value.upper() if value is not None else None


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


class ExpenseUpdate(BaseModel):
    # PATCH body: every field optional, and "omitted" differs from "null". Omitted leaves the field
    # alone; an explicit null clears category, merchant and note. model_fields_set tells them apart.
    model_config = ConfigDict(extra="forbid")

    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    spent_on: date | None = None
    category: str | None = Field(default=None, min_length=1, max_length=50)
    currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    merchant: str | None = Field(default=None, max_length=100)
    note: str | None = None

    @field_validator("currency")
    @classmethod
    def _upper_currency(cls, value: str | None) -> str | None:
        return value.upper() if value is not None else None

    @model_validator(mode="after")
    def _check_fields(self) -> "ExpenseUpdate":
        # Required columns cannot be cleared, so an explicit null for them is a client error.
        for name in ("amount", "spent_on", "currency"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null.")
        if not self.model_fields_set:
            raise ValueError("Send at least one field to update.")
        return self
