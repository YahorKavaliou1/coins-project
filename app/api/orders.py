from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_admin, require_seller
from app.db.session import get_db
from app.models.cart_item import CartItem
from app.models.coin import Coin
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.shipping_address import ShippingAddress
from app.models.user import User
from app.schemas.account import MAX_ADDRESSES, AddressBase, AddressRead, format_address
from app.schemas.order import (
    AdminOrderPage,
    BuyerOrderRead,
    CheckoutRequest,
    OrderRead,
    TrackingUpdate,
)
from app.services.coin_naming import build_coin_name
from app.services.notifications import (
    send_order_emails,
    send_order_paid_email,
    send_order_shipped_email,
)
from app.services.orders import (
    ORDER_LOAD_OPTIONS,
    admin_order_read,
    buyer_order_read,
    order_read,
)

router = APIRouter(prefix="/orders", tags=["orders"])

StatusFilter = Literal["awaiting_payment", "paid", "shipped"]


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


async def _checkout_address(db: AsyncSession, data: CheckoutRequest, user: User) -> str:
    """The delivery address as text: a saved one, or the new one (saved if asked)."""
    if data.address_id is not None:
        saved = await db.get(ShippingAddress, data.address_id)
        if saved is None or saved.user_id != user.id:
            raise HTTPException(status_code=404, detail="Address not found")
        return format_address(AddressRead.model_validate(saved))

    assert data.address is not None  # CheckoutRequest requires one of the two
    if data.save_address:
        count = await db.scalar(
            select(func.count())
            .select_from(ShippingAddress)
            .where(ShippingAddress.user_id == user.id)
        )
        if (count or 0) < MAX_ADDRESSES:
            fields = data.address.model_dump(exclude={"is_default"})
            db.add(ShippingAddress(user_id=user.id, **fields, is_default=not count))
    return format_address(AddressBase.model_validate(data.address.model_dump()))


@router.post("/checkout", response_model=list[BuyerOrderRead], status_code=201)
async def checkout(
    data: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BuyerOrderRead]:
    """Buys the cart: one order per seller, each awaiting payment by the seller's details."""
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
            selectinload(CartItem.coin).selectinload(Coin.owner),
        )
        .where(CartItem.user_id == current_user.id)
        .order_by(CartItem.created_at)
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

    by_seller: dict[int, list[CartItem]] = defaultdict(list)
    for item in cart_items:
        by_seller[item.coin.owner_id].append(item)

    # Shipping per seller, read under the row locks like the prices.
    chosen = {choice.seller_id: choice.option_name for choice in data.shipping}
    shipping: dict[int, tuple[str | None, Decimal | None]] = {}
    for seller_id, items in by_seller.items():
        seller = items[0].coin.owner
        options = seller.shipping_options or []
        if not options:
            shipping[seller_id] = (None, None)  # arranged with the seller
            continue
        option = next((o for o in options if o["name"] == chosen.get(seller_id)), None)
        if option is None:
            raise HTTPException(
                status_code=409,
                detail=f"Choose a shipping method for the coins of {seller.full_name or 'each seller'}. "
                "The seller's shipping options may have changed: please review your cart.",
            )
        shipping[seller_id] = (option["name"], Decimal(option["price"]))

    totals = {
        seller_id: sum((item.coin.price or Decimal(0) for item in items), Decimal(0))
        + (shipping[seller_id][1] or Decimal(0))
        for seller_id, items in by_seller.items()
    }
    if sum(totals.values(), Decimal(0)) != data.expected_total:
        raise HTTPException(
            status_code=409,
            detail="Prices or shipping costs in your cart have changed. "
            "Please review your cart and try again.",
        )

    address = await _checkout_address(db, data, current_user)

    orders: list[Order] = []
    for seller_id, items in by_seller.items():
        method, price = shipping[seller_id]
        order = Order(
            buyer_id=current_user.id,
            seller_id=seller_id,
            shipping_address=address,
            shipping_method=method,
            shipping_price=price,
            total_price=totals[seller_id],
        )
        db.add(order)
        await db.flush()  # get order.id before creating order items

        order_items = []
        for cart_item in items:
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
            coin.status = "sold"
            await db.delete(cart_item)

        # Queued in the same transaction: no email for a failed order, none lost for a placed one.
        await send_order_emails(db, order, order_items, current_user, items[0].coin.owner)
        orders.append(order)

    await db.commit()
    return [buyer_order_read(order) for order in await _load_orders(db, [o.id for o in orders])]


async def _load_orders(db: AsyncSession, ids: list[int]) -> list[Order]:
    result = await db.execute(
        select(Order).options(*ORDER_LOAD_OPTIONS).where(Order.id.in_(ids)).order_by(Order.id)
    )
    return list(result.scalars().all())


async def _get_order(db: AsyncSession, order_id: int) -> Order:
    result = await db.execute(
        select(Order).options(*ORDER_LOAD_OPTIONS).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/me", response_model=list[BuyerOrderRead])
async def my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BuyerOrderRead]:
    """The user's purchases, newest first, with each seller's payment details and contacts."""
    result = await db.execute(
        select(Order)
        .options(*ORDER_LOAD_OPTIONS)
        .where(Order.buyer_id == current_user.id)
        .order_by(Order.created_at.desc(), Order.id.desc())
    )
    return [buyer_order_read(order) for order in result.scalars().all()]


@router.post("/{order_id}/mark-paid", response_model=BuyerOrderRead)
async def mark_order_paid(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BuyerOrderRead:
    """The buyer reports having paid; the seller checks their account and ships."""
    order = await _get_order(db, order_id)
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.AWAITING_PAYMENT:
        raise HTTPException(status_code=409, detail="This order is already marked as paid")
    order.status = OrderStatus.PAID
    order.paid_at = datetime.now(UTC)
    send_order_paid_email(db, order)
    await db.commit()
    return buyer_order_read(await _get_order(db, order_id))


@router.get("/sales", response_model=list[OrderRead])
async def my_sales(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
    status: StatusFilter | None = None,
) -> list[OrderRead]:
    """Orders for the seller's coins, newest first: whom to ship to and what is paid."""
    stmt = select(Order).options(*ORDER_LOAD_OPTIONS).where(Order.seller_id == current_user.id)
    if status is not None:
        stmt = stmt.where(Order.status == status)
    result = await db.execute(stmt.order_by(Order.created_at.desc(), Order.id.desc()))
    return [order_read(order) for order in result.scalars().all()]


@router.post("/{order_id}/mark-shipped", response_model=OrderRead)
async def mark_order_shipped(
    order_id: int,
    data: TrackingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> OrderRead:
    """The seller sent the coins (or corrects the tracking code of a shipped order).

    Allowed before the buyer marks the order paid: the seller sees the money arrive."""
    order = await _get_order(db, order_id)
    if order.seller_id != current_user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    tracking_code = data.tracking_code or None
    first_time = order.status != OrderStatus.SHIPPED
    if not first_time and tracking_code == order.tracking_code:
        return order_read(order)
    order.status = OrderStatus.SHIPPED
    order.tracking_code = tracking_code
    if first_time:
        order.shipped_at = datetime.now(UTC)
    send_order_shipped_email(db, order, tracking_updated=not first_time)
    await db.commit()
    return order_read(await _get_order(db, order_id))


@router.get("", response_model=AdminOrderPage)
async def list_all_orders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
    status: StatusFilter | None = None,
    page: int = Query(default=1, ge=1, le=10_000),
    page_size: int = Query(default=50, ge=1, le=200),
) -> AdminOrderPage:
    """Every order on the site (admins), newest first."""
    conditions = [Order.status == status] if status is not None else []
    total = await db.scalar(select(func.count()).select_from(Order).where(*conditions))
    result = await db.execute(
        select(Order)
        .options(*ORDER_LOAD_OPTIONS)
        .where(*conditions)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return AdminOrderPage(
        items=[admin_order_read(order) for order in result.scalars().all()], total=total or 0
    )
