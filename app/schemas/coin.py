from datetime import datetime
from typing import Any, Self

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.coin_image import CoinImageRead
from app.schemas.country import CountryRead
from app.schemas.fields import (
    Category,
    DbId,
    DiameterMm,
    Mintage,
    Money,
    MoneyOut,
    Text50,
    Text100,
    Text255,
    Text1000,
    Weight,
    WeightUnit,
    Year,
)
from app.schemas.metal import MetalRead
from app.schemas.user import UserPublic
from app.services.coin_naming import build_coin_name


class CoinBase(BaseModel):
    year: Year
    weight: Weight
    weight_unit: WeightUnit = "oz"
    diameter: DiameterMm | None = None
    denomination: Text100 | None = None
    composition: Text255 | None = None
    grade: Text50 | None = None
    category: Category | None = None
    catalog_number: Text100 | None = None
    extra_info: Text1000 | None = None
    mintage: Mintage | None = None
    price: Money
    is_for_sale: bool = True


class CoinCreate(CoinBase):
    country_id: DbId
    metal_id: DbId


class CoinUpdate(BaseModel):
    """Partial update: only the fields sent are changed."""

    year: Year | None = None
    weight: Weight | None = None
    weight_unit: WeightUnit | None = None
    diameter: DiameterMm | None = None
    denomination: Text100 | None = None
    composition: Text255 | None = None
    grade: Text50 | None = None
    category: Category | None = None
    catalog_number: Text100 | None = None
    extra_info: Text1000 | None = None
    mintage: Mintage | None = None
    country_id: DbId | None = None
    metal_id: DbId | None = None
    price: Money | None = None
    is_for_sale: bool | None = None

    @model_validator(mode="after")
    def required_fields_not_cleared(self) -> Self:
        # null means "clear the value", which these fields don't allow.
        cleared = [
            field
            for field in ("year", "weight", "weight_unit", "country_id", "metal_id", "price")
            if field in self.model_fields_set and getattr(self, field) is None
        ]
        if cleared:
            raise ValueError(f"These fields can't be empty: {', '.join(cleared)}")
        return self


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
    category: str | None
    catalog_number: str | None
    extra_info: str | None
    mintage: int | None
    price: MoneyOut | None
    is_for_sale: bool
    country: CountryRead
    metal: MetalRead
    owner: UserPublic
    images: list[CoinImageRead] = []
    is_favourite: bool = False

    @model_validator(mode="before")
    @classmethod
    def compute_name(cls, data: Any, info: Any) -> Any:
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

        favourite_ids: set[int] = (info.context or {}).get("favourite_coin_ids", set())
        is_favourite = data.id in favourite_ids

        # Attach computed fields so from_attributes picks them up. We can't
        # mutate the ORM object's real columns, so we wrap it in a
        # lightweight proxy instead.
        return _CoinWithComputedName(data, computed_name, is_favourite)


class _CoinWithComputedName:
    """Thin proxy that exposes all Coin attributes plus computed extras."""

    def __init__(self, coin: Any, name: str, is_favourite: bool) -> None:
        self._coin = coin
        self.name = name
        self.is_favourite = is_favourite

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
    categories: list[str]
