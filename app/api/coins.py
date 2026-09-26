from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.coin import Coin
from app.schemas.coin import CoinCreate, CoinRead, CoinUpdate, Page

router = APIRouter(prefix="/coins", tags=["coins"])


@router.get("", response_model=Page)
async def list_coins(
    db: AsyncSession = Depends(get_db),
    country_id: int | None = None,
    metal_id: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    q: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page:
    stmt = select(Coin).options(
        selectinload(Coin.country),
        selectinload(Coin.metal),
        selectinload(Coin.denomination),
    )

    if country_id is not None:
        stmt = stmt.where(Coin.country_id == country_id)
    if metal_id is not None:
        stmt = stmt.where(Coin.metal_id == metal_id)
    if year_from is not None:
        stmt = stmt.where(Coin.year >= year_from)
    if year_to is not None:
        stmt = stmt.where(Coin.year <= year_to)
    if q:
        stmt = stmt.where(Coin.name.ilike(f"%{q}%"))

    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = list(result.scalars().all())

    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/{coin_id}", response_model=CoinRead)
async def get_coin(coin_id: int, db: AsyncSession = Depends(get_db)) -> Coin:
    stmt = (
        select(Coin)
        .options(
            selectinload(Coin.country),
            selectinload(Coin.metal),
            selectinload(Coin.denomination),
        )
        .where(Coin.id == coin_id)
    )
    coin = (await db.execute(stmt)).scalar_one_or_none()
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    return coin


@router.post("", response_model=CoinRead, status_code=201)
async def create_coin(data: CoinCreate, db: AsyncSession = Depends(get_db)) -> Coin:
    coin = Coin(**data.model_dump())
    db.add(coin)
    await db.commit()
    await db.refresh(coin, attribute_names=["country", "metal", "denomination"])
    return coin


@router.patch("/{coin_id}", response_model=CoinRead)
async def update_coin(coin_id: int, data: CoinUpdate, db: AsyncSession = Depends(get_db)) -> Coin:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(coin, field, value)

    await db.commit()
    await db.refresh(coin, attribute_names=["country", "metal", "denomination"])
    return coin


@router.delete("/{coin_id}", status_code=204)
async def delete_coin(coin_id: int, db: AsyncSession = Depends(get_db)) -> None:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    await db.delete(coin)
    await db.commit()
