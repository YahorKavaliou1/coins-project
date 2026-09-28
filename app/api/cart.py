from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.cart_item import CartItem
from app.models.coin import Coin
from app.models.user import User
from app.schemas.cart import CartItemAdd, CartRead

router = APIRouter(prefix="/cart", tags=["cart"])


async def _load_cart(db: AsyncSession, user_id: int) -> list[CartItem]:
    stmt = (
        select(CartItem)
        .options(
            selectinload(CartItem.coin).selectinload(Coin.country),
            selectinload(CartItem.coin).selectinload(Coin.metal),
            selectinload(CartItem.coin).selectinload(Coin.owner),
            selectinload(CartItem.coin).selectinload(Coin.images),
        )
        .where(CartItem.user_id == user_id)
        .order_by(CartItem.created_at)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("", response_model=CartRead)
async def get_cart(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CartRead:
    items = await _load_cart(db, current_user.id)
    total = sum((item.coin.price or 0) for item in items)
    return CartRead(items=items, total_price=total)


@router.post("/items", response_model=CartRead, status_code=201)
async def add_to_cart(
    data: CartItemAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CartRead:
    coin = await db.get(Coin, data.coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if not coin.is_for_sale:
        raise HTTPException(status_code=400, detail="Coin is not for sale")
    if coin.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot buy your own coin")

    existing = await db.execute(
        select(CartItem).where(
            CartItem.user_id == current_user.id, CartItem.coin_id == data.coin_id
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Coin is already in your cart")

    cart_item = CartItem(user_id=current_user.id, coin_id=data.coin_id)
    db.add(cart_item)
    await db.commit()

    items = await _load_cart(db, current_user.id)
    total = sum((item.coin.price or 0) for item in items)
    return CartRead(items=items, total_price=total)


@router.delete("/items/{coin_id}", response_model=CartRead)
async def remove_from_cart(
    coin_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CartRead:
    result = await db.execute(
        select(CartItem).where(CartItem.user_id == current_user.id, CartItem.coin_id == coin_id)
    )
    cart_item = result.scalar_one_or_none()
    if cart_item is None:
        raise HTTPException(status_code=404, detail="Item not found in cart")

    await db.delete(cart_item)
    await db.commit()

    items = await _load_cart(db, current_user.id)
    total = sum((item.coin.price or 0) for item in items)
    return CartRead(items=items, total_price=total)
