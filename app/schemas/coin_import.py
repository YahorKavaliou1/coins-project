from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.coin import CoinCreate
from app.services.table_import import MAX_TABLE_ROWS


class TableParseResult(BaseModel):
    filename: str
    columns: list[str]
    rows: list[list[str]]


class CoinBatchItem(CoinCreate):
    """A table row: validated like a single coin, and always listed for sale."""

    is_for_sale: Literal[True] = True


class CoinBatchCreate(BaseModel):
    items: list[CoinBatchItem] = Field(min_length=1, max_length=MAX_TABLE_ROWS)


class CoinBatchResult(BaseModel):
    ids: list[int]
