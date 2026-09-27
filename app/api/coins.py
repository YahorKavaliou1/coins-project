from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.coin import Coin
from app.models.country import Country
from app.models.metal import Metal
from app.models.user import User
from app.schemas.coin import CoinCreate, CoinRead, CoinUpdate, Page

router = APIRouter(prefix="/coins", tags=["coins"])

COIN_LOAD_OPTIONS = (
    selectinload(Coin.country),
    selectinload(Coin.metal),
    selectinload(Coin.owner),
    selectinload(Coin.images),
)


async def _validate_country_and_metal(db: AsyncSession, country_id: int, metal_id: int) -> None:
    country = await db.get(Country, country_id)
    if country is None:
        raise HTTPException(status_code=404, detail="Country not found")

    metal = await db.get(Metal, metal_id)
    if metal is None:
        raise HTTPException(status_code=404, detail="Metal not found")


@router.get("", response_model=Page)
async def list_coins(
    db: AsyncSession = Depends(get_db),
    country_id: int | None = None,
    metal_id: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    q: str | None = None,
    for_sale_only: bool = False,
    owner_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page:
    stmt = (
        select(Coin)
        .join(Coin.country)
        .join(Coin.metal)
        .options(*COIN_LOAD_OPTIONS)
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
        pattern = f"%{q}%"
        conditions: list[ColumnElement[bool]] = [
            Country.name.ilike(pattern),
            Metal.name.ilike(pattern),
            Coin.denomination.ilike(pattern),
            Coin.extra_info.ilike(pattern),
        ]

        # Also match the year when the query looks like a number,
        # e.g. searching "1990" matches coins minted that year.
        try:
            q_as_int = int(q)
            conditions.append(Coin.year == q_as_int)
        except ValueError:
            pass

        stmt = stmt.where(or_(*conditions))
    if for_sale_only:
        stmt = stmt.where(Coin.is_for_sale.is_(True))
    if owner_id is not None:
        stmt = stmt.where(Coin.owner_id == owner_id)

    total = (
        await db.execute(select(func.count()).select_from(stmt.subquery()))
    ).scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = list(result.scalars().unique().all())

    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/{coin_id}", response_model=CoinRead)
async def get_coin(coin_id: int, db: AsyncSession = Depends(get_db)) -> Coin:
    stmt = select(Coin).options(*COIN_LOAD_OPTIONS).where(Coin.id == coin_id)
    coin = (await db.execute(stmt)).scalar_one_or_none()
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    return coin


@router.post("", response_model=CoinRead, status_code=201)
async def create_coin(
    data: CoinCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Coin:
    await _validate_country_and_metal(db, data.country_id, data.metal_id)

    coin = Coin(**data.model_dump(), owner_id=current_user.id)
    db.add(coin)
    await db.commit()
    await db.refresh(coin, attribute_names=["country", "metal", "owner", "images"])
    return coin


@router.patch("/{coin_id}", response_model=CoinRead)
async def update_coin(
    coin_id: int,
    data: CoinUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Coin:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if coin.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this coin")
    if not coin.is_for_sale:
        raise HTTPException(status_code=409, detail="Sold coins cannot be edited")

    update_data = data.model_dump(exclude_unset=True)
    update_data.pop("is_for_sale", None)

    new_country_id = update_data.get("country_id", coin.country_id)
    new_metal_id = update_data.get("metal_id", coin.metal_id)
    if "country_id" in update_data or "metal_id" in update_data:
        await _validate_country_and_metal(db, new_country_id, new_metal_id)

    for field, value in update_data.items():
        setattr(coin, field, value)

    await db.commit()
    await db.refresh(coin, attribute_names=["country", "metal", "owner", "images"])
    return coin


@router.delete("/{coin_id}", status_code=204)
async def delete_coin(
    coin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if coin.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="You do not own this coin")
    await db.delete(coin)
    await db.commit()
