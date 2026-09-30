from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.cart_item import CartItem
from app.models.coin import Coin
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.user import User
from app.schemas.order import CheckoutRequest, OrderRead
from app.services.coin_naming import build_coin_name
from app.services.notifications import send_order_emails

router = APIRouter(prefix="/orders", tags=["orders"])


def _coin_display_name(coin: Coin) -> str:
    return build_coin_name(
        country_name=coin.country.name,
        year=coin.year,
        metal_name=coin.metal.name,
        weight=coin.weight,
        weight_unit=coin.weight_unit,
        denomination=coin.denomination,
        extra_info=coin.extra_info,
    )


@router.post("/checkout", response_model=OrderRead, status_code=201)
async def checkout(
    data: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Order:
    # Lock the cart's coins before checking availability, so two concurrent checkouts can't
    # both see a coin as for sale. The second one waits here, then sees it sold (or its cart
    # already emptied). Ordered by id so overlapping carts can't deadlock.
    await db.execute(
        select(Coin.id)
        .where(Coin.id.in_(select(CartItem.coin_id).where(CartItem.user_id == current_user.id)))
        .order_by(Coin.id)
        .with_for_update()
    )
    cart_result = await db.execute(
        select(CartItem)
        .options(
            selectinload(CartItem.coin).selectinload(Coin.country),
            selectinload(CartItem.coin).selectinload(Coin.metal),
        )
        .where(CartItem.user_id == current_user.id)
    )
    cart_items = list(cart_result.scalars().all())

    if not cart_items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    unavailable = [
        _coin_display_name(item.coin)
        for item in cart_items
        if not item.coin.is_for_sale or item.coin.price is None
    ]
    if unavailable:
        raise HTTPException(
            status_code=409,
            detail=f"No longer available: {', '.join(unavailable)}. Please review your cart.",
        )

    # Read under the row locks, so this is exactly what the buyer will pay.
    total_price = sum((item.coin.price or Decimal(0) for item in cart_items), Decimal(0))
    if total_price != data.expected_total:
        raise HTTPException(
            status_code=409,
            detail="Prices in your cart have changed. Please review your cart and try again.",
        )

    order = Order(
        buyer_id=current_user.id,
        shipping_address=data.shipping_address,
        total_price=total_price,
    )
    db.add(order)
    await db.flush()  # get order.id before creating order items

    order_items: list[OrderItem] = []
    for cart_item in cart_items:
        coin = cart_item.coin
        order_item = OrderItem(
            order_id=order.id,
            coin_id=coin.id,
            seller_id=coin.owner_id,
            coin_name_snapshot=_coin_display_name(coin),
            price_paid=coin.price,
        )
        db.add(order_item)
        order_items.append(order_item)

        # The coin's owner (the seller who listed it) never changes.
        # Purchase history and buyer information live on Order/OrderItem instead.
        coin.is_for_sale = False

        await db.delete(cart_item)

    # Queued in the same transaction: no email for a failed order, none lost for a placed one.
    await send_order_emails(db, order, order_items, current_user)
    await db.commit()

    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order.id)
    )
    return result.scalar_one()


@router.get("/me", response_model=list[OrderRead])
async def my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Order]:
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.buyer_id == current_user.id)
        .order_by(Order.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())
