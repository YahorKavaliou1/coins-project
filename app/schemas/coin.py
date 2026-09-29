from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.coin_image import CoinImageRead
from app.schemas.country import CountryRead
from app.schemas.metal import MetalRead
from app.schemas.user import UserPublic
from app.services.coin_naming import build_coin_name


class CoinBase(BaseModel):
    year: int
    weight: float
    weight_unit: str = "oz"
    diameter: float | None = None
    denomination: str | None = None
    composition: str | None = None
    grade: str | None = None
    catalog_number: str | None = None
    extra_info: str | None = None
    mintage: int | None = None
    price: float | None = None
    is_for_sale: bool = True


class CoinCreate(CoinBase):
    country_id: int
    metal_id: int


class CoinUpdate(BaseModel):
    year: int | None = None
    weight: float | None = None
    weight_unit: str | None = None
    diameter: float | None = None
    denomination: str | None = None
    composition: str | None = None
    grade: str | None = None
    catalog_number: str | None = None
    extra_info: str | None = None
    mintage: int | None = None
    country_id: int | None = None
    metal_id: int | None = None
    price: float | None = None
    is_for_sale: bool | None = None


class CoinRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = ""  # computed in the validator below; placeholder keeps field ordering
    created_at: datetime
    year: int
    weight: float
    weight_unit: str
    diameter: float | None
    denomination: str | None
    composition: str | None
    grade: str | None
    catalog_number: str | None
    extra_info: str | None
    mintage: int | None
    price: float | None
    is_for_sale: bool
    country: CountryRead
    metal: MetalRead
    owner: UserPublic
    images: list[CoinImageRead] = []

    @model_validator(mode="before")
    @classmethod
    def compute_name(cls, data: Any) -> Any:
        """Derive the display name from country/metal/etc. rather than storing it.

        Runs before field validation, so it works whether `data` is an ORM
        Coin instance (from_attributes) or a plain dict.
        """
        if isinstance(data, dict):
            return data  # already prepared, e.g. in tests

        country_name = data.country.name
        metal_name = data.metal.name

        computed_name = build_coin_name(
            country_name=country_name,
            year=data.year,
            metal_name=metal_name,
            weight=data.weight,
            weight_unit=data.weight_unit,
            denomination=data.denomination,
            extra_info=data.extra_info,
        )

        # Attach the computed name as an attribute so from_attributes picks it up.
        # We can't mutate the ORM object's real columns, so we wrap it in a
        # lightweight namespace-like object instead.
        return _CoinWithComputedName(data, computed_name)


class _CoinWithComputedName:
    """Thin proxy that exposes all Coin attributes plus a computed `name`."""

    def __init__(self, coin: Any, name: str) -> None:
        self._coin = coin
        self.name = name

    def __getattr__(self, item: str) -> Any:
        return getattr(self._coin, item)


class Page(BaseModel):
    items: list[CoinRead]
    total: int
    page: int
    page_size: int


class MetalFacet(BaseModel):
    id: int
    name: str


class CoinFacets(BaseModel):
    metals: list[MetalFacet]
    grades: list[str]
