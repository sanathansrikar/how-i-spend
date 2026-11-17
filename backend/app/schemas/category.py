from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

# strip_whitespace: " Food " is stored as "Food"; min_length=1 then rejects blank names.
CategoryNameStr = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)
]


class CategoryCreate(BaseModel):
    # extra="forbid": unknown fields are rejected instead of silently ignored.
    model_config = ConfigDict(extra="forbid")

    name: CategoryNameStr


class CategoryRead(BaseModel):
    # Response schema: just the name, since users identify categories by name, never by id.
    name: str
