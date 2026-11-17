from decimal import Decimal

from pydantic import BaseModel, ConfigDict


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
