from pydantic import BaseModel, ConfigDict


class CountryBase(BaseModel):
    name: str
    code: str | None = None


class CountryCreate(CountryBase):
    pass


class CountryRead(CountryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
