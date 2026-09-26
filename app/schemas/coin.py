from pydantic import BaseModel, ConfigDict

from app.schemas.country import CountryRead
from app.schemas.denomination import DenominationRead
from app.schemas.metal import MetalRead


class CoinBase(BaseModel):
    name: str
    year: int
    description: str | None = None
    mintage: int | None = None


class CoinCreate(CoinBase):
    country_id: int
    metal_id: int | None = None
    denomination_id: int | None = None


class CoinUpdate(BaseModel):
    name: str | None = None
    year: int | None = None
    description: str | None = None
    mintage: int | None = None
    country_id: int | None = None
    metal_id: int | None = None
    denomination_id: int | None = None


class CoinRead(CoinBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    country: CountryRead
    metal: MetalRead | None = None
    denomination: DenominationRead | None = None


class Page(BaseModel):
    items: list[CoinRead]
    total: int
    page: int
    page_size: int
