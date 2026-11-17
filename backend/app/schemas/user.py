from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class UserRead(BaseModel):
    # Response schema: the profile only its owner sees. No internal id and no timestamps.
    # from_attributes: lets Pydantic read fields straight off an ORM object.
    model_config = ConfigDict(from_attributes=True)

    full_name: str
    email: str
    phone: str | None
    currency: str
    # Sensitive PII: returned only by /me, to the user it belongs to.
    monthly_income: Decimal | None
    monthly_budget: Decimal | None


class UserUpdate(BaseModel):
    # PATCH body: omitted leaves a field alone; null clears phone, income and budget.
    # extra="forbid": email and unknown fields are rejected, not silently ignored.
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    # E.164 (+country code, up to 15 digits): the same shape the database enforces.
    phone: str | None = Field(default=None, pattern=r"^\+[1-9][0-9]{6,14}$")
    currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    monthly_income: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    monthly_budget: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)

    @field_validator("currency")
    @classmethod
    def _upper_currency(cls, value: str | None) -> str | None:
        return value.upper() if value is not None else None

    @model_validator(mode="after")
    def _check_fields(self) -> "UserUpdate":
        # Required columns cannot be cleared, so an explicit null for them is a client error.
        for name in ("full_name", "currency"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null.")
        if not self.model_fields_set:
            raise ValueError("Send at least one field to update.")
        return self
