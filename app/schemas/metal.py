from pydantic import BaseModel, ConfigDict


class MetalBase(BaseModel):
    name: str


class MetalCreate(MetalBase):
    pass


class MetalRead(MetalBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
