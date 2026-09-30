import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_seller
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.coin import Coin
from app.models.country import Country
from app.models.metal import Metal
from app.models.user import User
from app.schemas.coin_import import CoinBatchCreate, CoinBatchResult, TableParseResult
from app.services.table_import import MAX_TABLE_FILE_SIZE_BYTES, parse_table

router = APIRouter(prefix="/coins", tags=["coin-import"])


@router.post("/import/parse", response_model=TableParseResult)
@limiter.limit("20/minute")
async def parse_import_table(
    request: Request,
    file: UploadFile = File(...),
    _: User = Depends(require_seller),
) -> TableParseResult:
    """Reads a CSV/XLSX table and returns its columns and rows as plain strings."""
    data = await file.read(MAX_TABLE_FILE_SIZE_BYTES + 1)
    columns, rows = await asyncio.to_thread(parse_table, file.filename or "", data)
    return TableParseResult(filename=file.filename or "", columns=columns, rows=rows)


async def _missing_ids(
    db: AsyncSession, model: type[Country] | type[Metal], ids: set[int]
) -> set[int]:
    result = await db.execute(select(model.id).where(model.id.in_(ids)))
    return ids - {row[0] for row in result.all()}


@router.post("/batch", response_model=CoinBatchResult, status_code=201)
async def create_coins_batch(
    data: CoinBatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> CoinBatchResult:
    """Creates all lots in one transaction: either every row is listed or none is."""
    missing_countries = await _missing_ids(db, Country, {item.country_id for item in data.items})
    missing_metals = await _missing_ids(db, Metal, {item.metal_id for item in data.items})

    errors = [
        f"Row {index}: unknown {field}"
        for index, item in enumerate(data.items, start=1)
        for field, missing in (
            ("country", item.country_id in missing_countries),
            ("metal", item.metal_id in missing_metals),
        )
        if missing
    ]
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors[:20]))

    coins = [Coin(**item.model_dump(), owner_id=current_user.id) for item in data.items]
    db.add_all(coins)
    await db.commit()
    return CoinBatchResult(ids=[coin.id for coin in coins])
