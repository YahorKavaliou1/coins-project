from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.coin import CoinCreate
from app.services.table_import import MAX_TABLE_ROWS


class TableParseResult(BaseModel):
    filename: str
    columns: list[str]
    rows: list[list[str]]


class CoinBatchItem(CoinCreate):
    """Stricter than CoinCreate: batch rows come from user tables, so validate values."""

    year: int = Field(ge=-1000, le=2100)
    weight: float = Field(gt=0)
    weight_unit: Literal["oz", "g", "kg"] = "oz"
    diameter: float | None = Field(default=None, gt=0)
    mintage: int | None = Field(default=None, ge=0)
    price: float = Field(gt=0)
    is_for_sale: Literal[True] = True


class CoinBatchCreate(BaseModel):
    items: list[CoinBatchItem] = Field(min_length=1, max_length=MAX_TABLE_ROWS)


class CoinBatchResult(BaseModel):
    ids: list[int]
