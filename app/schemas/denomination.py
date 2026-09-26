from pydantic import BaseModel, ConfigDict


class DenominationBase(BaseModel):
    name: str
    value: float | None = None


class DenominationCreate(DenominationBase):
    pass


class DenominationRead(DenominationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
