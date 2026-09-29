from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.coins import COIN_LOAD_OPTIONS
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.coin import Coin
from app.models.favourite import Favourite
from app.models.user import User
from app.schemas.coin import CoinRead, Page
from app.schemas.favourite import FavouriteAdd

router = APIRouter(prefix="/favourites", tags=["favourites"])


@router.get("", response_model=Page)
async def list_favourites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> Page:
    fav_ids_result = await db.execute(
        select(Favourite.coin_id).where(Favourite.user_id == current_user.id)
    )
    favourite_ids = {row[0] for row in fav_ids_result.all()}

    stmt = (
        select(Coin)
        .join(Favourite, Favourite.coin_id == Coin.id)
        .where(Favourite.user_id == current_user.id)
        .options(*COIN_LOAD_OPTIONS)
        .order_by(Favourite.created_at.desc())
    )

    total = len(favourite_ids)

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    coins = list(result.scalars().unique().all())

    items = [
        CoinRead.model_validate(coin, context={"favourite_coin_ids": favourite_ids})
        for coin in coins
    ]

    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", status_code=201)
async def add_favourite(
    data: FavouriteAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    coin = await db.get(Coin, data.coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")

    existing = await db.execute(
        select(Favourite).where(
            Favourite.user_id == current_user.id, Favourite.coin_id == data.coin_id
        )
    )
    if existing.scalar_one_or_none() is not None:
        return {"is_favourite": True}

    db.add(Favourite(user_id=current_user.id, coin_id=data.coin_id))
    await db.commit()
    return {"is_favourite": True}


@router.delete("/{coin_id}", status_code=200)
async def remove_favourite(
    coin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    result = await db.execute(
        select(Favourite).where(Favourite.user_id == current_user.id, Favourite.coin_id == coin_id)
    )
    favourite = result.scalar_one_or_none()
    if favourite is None:
        return {"is_favourite": False}

    await db.delete(favourite)
    await db.commit()
    return {"is_favourite": False}
