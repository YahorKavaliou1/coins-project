from pydantic import BaseModel, ConfigDict

from app.schemas.country import CountryRead
from app.schemas.metal import MetalRead


class CoinBase(BaseModel):
    year: int
    weight: float
    weight_unit: str = "oz"
    denomination: str | None = None
    composition: str | None = None
    extra_info: str | None = None
    mintage: int | None = None


class CoinCreate(CoinBase):
    country_id: int
    metal_id: int


class CoinUpdate(BaseModel):
    year: int | None = None
    weight: float | None = None
    weight_unit: str | None = None
    denomination: str | None = None
    composition: str | None = None
    extra_info: str | None = None
    mintage: int | None = None
    country_id: int | None = None
    metal_id: int | None = None


class CoinRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    year: int
    weight: float
    weight_unit: str
    denomination: str | None
    composition: str | None
    extra_info: str | None
    mintage: int | None
    country: CountryRead
    metal: MetalRead


class Page(BaseModel):
    items: list[CoinRead]
    total: int
    page: int
    page_size: int
