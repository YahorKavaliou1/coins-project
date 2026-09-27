from pydantic import BaseModel, ConfigDict


class CountryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str | None = None
    region: str | None = None
    is_historical: bool
