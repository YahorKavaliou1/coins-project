import secrets
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.auth import EMAIL_SENDING_LIMIT, find_user, normalize_email
from app.api.deps import get_current_user, require_admin, require_seller
from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.db.session import get_db
from app.models.cart_item import CartItem
from app.models.coin import Coin
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.shipping_address import ShippingAddress
from app.models.user import User, UserRole
from app.schemas.account import MAX_ADDRESSES, AddressBase, AddressRead, format_address
from app.schemas.order import (
    AdminOrderPage,
    BuyerOrderRead,
    CheckoutRequest,
    GuestCheckoutRequest,
    OrderAccessRequest,
    OrderRead,
    TrackingUpdate,
)
from app.services.captcha import require_captcha
from app.services.coin_naming import build_coin_name
from app.services.notifications import (
    send_order_cancelled_emails,
    send_order_emails,
    send_order_paid_email,
    send_order_restored_email,
    send_order_shipped_email,
)
from app.services.orders import (
    ORDER_LOAD_OPTIONS,
    admin_order_read,
    buyer_order_read,
    cancel_order,
    check_order_access_token,
    order_read,
    restore_order,
)

router = APIRouter(prefix="/orders", tags=["orders"])

StatusFilter = Literal["awaiting_payment", "paid", "shipped", "cancelled"]


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


GUEST_EMAIL_REFUSED_DETAIL = "This email address can't be used for an order. Please contact us."


GUEST_ORDERS_PER_EMAIL_PER_DAY = 3


async def _guest_buyer(db: AsyncSession, email: str, coins: list[Coin]) -> User:
    """The account a guest's orders go to: the one with this email, or a new one.

    A new account is unconfirmed and has no usable password. Whoever owns the mailbox takes
    it over with "Forgot password" (which also confirms it), or by registering with the same
    email, and then sees these orders in My purchases."""
    # Hashed on every path, so the response time doesn't reveal whether the email is taken.
    unusable_password = await hash_password(secrets.token_urlsafe(32))
    user = await find_user(db, email, for_update=True)
    if user is None:
        user = User(
            email=normalize_email(email),
            hashed_password=unusable_password,
            # No name: anyone can type one, and it would greet the mailbox owner in emails.
            # Sellers see the order's own buyer_name.
            full_name=None,
            role=UserRole.USER,
            is_verified=False,
        )
        db.add(user)
        await db.flush()
        return user
    recent_guest_orders = await db.scalar(
        select(func.count())
        .select_from(Order)
        .where(
            Order.buyer_id == user.id,
            Order.placed_as_guest.is_(True),
            Order.created_at > datetime.now(UTC) - timedelta(days=1),
        )
    )
    if (
        user.is_blocked
        or not user.is_active
        or any(coin.owner_id == user.id for coin in coins)
        # Anyone can order to any address: this caps the order emails one mailbox can get.
        or (recent_guest_orders or 0) >= GUEST_ORDERS_PER_EMAIL_PER_DAY
    ):
        # One answer for every refusal, so it doesn't tell which it is (blocked, the seller's
        # own, too many orders); and only for an order that would otherwise go through.
        raise HTTPException(status_code=403, detail=GUEST_EMAIL_REFUSED_DETAIL)
    return user


async def _place_orders(
    db: AsyncSession, coin_ids: list[int], data: CheckoutRequest, user: User | None
) -> list[int]:
    """Buys these coins: one order per seller, each awaiting payment by the seller's details.
    Shared by checkout from an account (`user`) and by guest checkout (`user` None, `data` a
    GuestCheckoutRequest). Returns the new orders' ids; the caller commits."""
    # Lock the coins before checking availability, so two concurrent checkouts can't both
    # see a coin as for sale: the second one waits here, then sees it sold. Ordered by id so
    # overlapping carts can't deadlock.
    await db.execute(
        select(Coin.id).where(Coin.id.in_(coin_ids)).order_by(Coin.id).with_for_update()
    )
    result = await db.execute(
        select(Coin)
        .options(selectinload(Coin.country), selectinload(Coin.metal), selectinload(Coin.owner))
        .where(Coin.id.in_(coin_ids))
    )
    by_id = {coin.id: coin for coin in result.scalars()}
    # In the cart's order, without duplicates; coins deleted meanwhile are gone.
    coins = [by_id[coin_id] for coin_id in dict.fromkeys(coin_ids) if coin_id in by_id]

    if not coins:
        raise HTTPException(status_code=400, detail="Cart is empty")

    unavailable = [
        _coin_display_name(coin) for coin in coins if not coin.is_for_sale or coin.price is None
    ]
    if unavailable:
        raise HTTPException(
            status_code=409,
            detail=f"No longer available: {', '.join(unavailable)}. Please review your cart.",
        )
    by_seller: dict[int, list[Coin]] = defaultdict(list)
    for coin in coins:
        by_seller[coin.owner_id].append(coin)

    # Shipping per seller, read under the row locks like the prices.
    chosen = {choice.seller_id: choice.option_name for choice in data.shipping}
    shipping: dict[int, tuple[str | None, Decimal | None]] = {}
    for seller_id, seller_coins in by_seller.items():
        seller = seller_coins[0].owner
        options = seller.shipping_options or []
        if not options:
            shipping[seller_id] = (None, None)  # arranged with the seller
            continue
        option = next((o for o in options if o["name"] == chosen.get(seller_id)), None)
        if option is None:
            raise HTTPException(
                status_code=409,
                detail="Choose a shipping method for each order. "
                "Shipping options may have changed: please review your cart.",
            )
        shipping[seller_id] = (option["name"], Decimal(option["price"]))

    totals = {
        seller_id: sum((coin.price or Decimal(0) for coin in seller_coins), Decimal(0))
        + (shipping[seller_id][1] or Decimal(0))
        for seller_id, seller_coins in by_seller.items()
    }
    if sum(totals.values(), Decimal(0)) != data.expected_total:
        raise HTTPException(
            status_code=409,
            detail="Prices or shipping costs in your cart have changed. "
            "Please review your cart and try again.",
        )

    # The buyer only now, once the order is otherwise valid: a guest's email can't be probed
    # with orders that would fail anyway.
    if user is None:
        assert isinstance(data, GuestCheckoutRequest) and data.address is not None
        buyer = await _guest_buyer(db, data.email, coins)
        buyer_name: str | None = data.address.recipient_name
    else:
        buyer, buyer_name = user, user.full_name
        if any(coin.owner_id == buyer.id for coin in coins):
            raise HTTPException(status_code=400, detail="You cannot buy your own coin")

    address = await _checkout_address(db, data, buyer)

    orders: list[Order] = []
    for seller_id, seller_coins in by_seller.items():
        method, price = shipping[seller_id]
        order = Order(
            buyer_id=buyer.id,
            buyer_name=buyer_name,
            placed_as_guest=user is None,
            seller_id=seller_id,
            shipping_address=address,
            shipping_method=method,
            shipping_price=price,
            total_price=totals[seller_id],
        )
        db.add(order)
        await db.flush()  # get order.id before creating order items

        order_items = []
        for coin in seller_coins:
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

        # Queued in the same transaction: no email for a failed order, none lost for a placed one.
        await send_order_emails(db, order, order_items, buyer, seller_coins[0].owner)
        orders.append(order)

    # Bought coins leave the buyer's cart (an account's; a guest's lives in their browser).
    await db.execute(
        delete(CartItem).where(CartItem.user_id == buyer.id, CartItem.coin_id.in_(by_id))
    )
    return [order.id for order in orders]


@router.post("/checkout", response_model=list[BuyerOrderRead], status_code=201)
async def checkout(
    data: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[BuyerOrderRead]:
    """Buys the user's cart."""
    # The cart's coins first, then the cart (coins before cart rows, like deleting a coin):
    # a second checkout of the same cart (double submit) waits here, then finds the cart
    # emptied by the first one.
    await db.execute(
        select(Coin.id)
        .where(Coin.id.in_(select(CartItem.coin_id).where(CartItem.user_id == current_user.id)))
        .order_by(Coin.id)
        .with_for_update()
    )
    cart = await db.execute(
        select(CartItem.coin_id)
        .where(CartItem.user_id == current_user.id)
        .order_by(CartItem.created_at)
        .with_for_update()
    )
    coin_ids = list(cart.scalars())
    order_ids = await _place_orders(db, coin_ids, data, current_user)
    await db.commit()
    return [buyer_order_read(order) for order in await _load_orders(db, order_ids)]


@router.post("/guest-checkout", response_model=list[BuyerOrderRead], status_code=201)
@limiter.limit(EMAIL_SENDING_LIMIT)
async def guest_checkout(
    request: Request, data: GuestCheckoutRequest, db: AsyncSession = Depends(get_db)
) -> list[BuyerOrderRead]:
    """Buys a guest's cart without logging in; the order emails go to the given address."""
    await require_captcha(data.captcha_token, request)
    order_ids = await _place_orders(db, data.coin_ids, data, None)
    await db.commit()
    # Without the account's id: the email may belong to someone else's account.
    return [
        buyer_order_read(order).model_copy(update={"buyer_id": 0})
        for order in await _load_orders(db, order_ids)
    ]


async def _load_orders(db: AsyncSession, ids: list[int]) -> list[Order]:
    result = await db.execute(
        select(Order).options(*ORDER_LOAD_OPTIONS).where(Order.id.in_(ids)).order_by(Order.id)
    )
    return list(result.scalars().all())


async def _get_order(db: AsyncSession, order_id: int, *, lock: bool = False) -> Order:
    """`lock`: before changing the status, so a concurrent cancel (seller or worker) can't be
    overwritten, e.g. a cancelled order turned paid while its coins are back on sale."""
    stmt = select(Order).options(*ORDER_LOAD_OPTIONS).where(Order.id == order_id)
    if lock:
        stmt = stmt.with_for_update(of=Order)
    result = await db.execute(stmt)
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
    order = await _get_order(db, order_id, lock=True)
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    await _mark_paid(db, order)
    return buyer_order_read(await _get_order(db, order_id))


async def _mark_paid(db: AsyncSession, order: Order) -> None:
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(
            status_code=409,
            detail="This order was cancelled. If you have already paid, please contact us.",
        )
    if order.status != OrderStatus.AWAITING_PAYMENT:
        raise HTTPException(status_code=409, detail="This order is already marked as paid")
    order.status = OrderStatus.PAID
    order.paid_at = datetime.now(UTC)
    send_order_paid_email(db, order)
    await db.commit()


async def _get_order_by_link(
    db: AsyncSession, order_id: int, token: str, *, lock: bool = False
) -> Order:
    # The same answer for a wrong token and a missing order.
    if not check_order_access_token(order_id, token):
        raise HTTPException(status_code=404, detail="Order not found")
    return await _get_order(db, order_id, lock=lock)


def _link_order_read(order: Order) -> BuyerOrderRead:
    # Without the account's id: the order's link may be forwarded.
    return buyer_order_read(order).model_copy(update={"buyer_id": 0})


@router.post("/{order_id}/access", response_model=BuyerOrderRead)
@limiter.limit("30/minute")
async def get_order_by_link(
    request: Request, order_id: int, data: OrderAccessRequest, db: AsyncSession = Depends(get_db)
) -> BuyerOrderRead:
    """An order from its own link (emails of guest orders): no account needed."""
    return _link_order_read(await _get_order_by_link(db, order_id, data.token))


@router.post("/{order_id}/access/mark-paid", response_model=BuyerOrderRead)
@limiter.limit("10/minute")
async def mark_order_paid_by_link(
    request: Request, order_id: int, data: OrderAccessRequest, db: AsyncSession = Depends(get_db)
) -> BuyerOrderRead:
    """Like mark-paid, for a guest following the order's own link."""
    await _mark_paid(db, await _get_order_by_link(db, order_id, data.token, lock=True))
    return _link_order_read(await _get_order(db, order_id))


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
    order = await _get_order(db, order_id, lock=True)
    if order.seller_id != current_user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="This order was cancelled: restore it first")
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


async def _get_own_sale(db: AsyncSession, order_id: int, seller: User) -> Order:
    result = await db.execute(
        select(Order)
        .options(*ORDER_LOAD_OPTIONS)
        .where(Order.id == order_id, Order.seller_id == seller.id)
        .with_for_update(of=Order)
    )
    order = result.scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/{order_id}/cancel", response_model=OrderRead)
async def cancel_sale(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> OrderRead:
    """The seller cancels an order not shipped yet (e.g. never paid): its coins go back on
    sale and the buyer is told."""
    order = await _get_own_sale(db, order_id, current_user)
    if order.status not in (OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID):
        raise HTTPException(status_code=409, detail="Only orders not shipped yet can be cancelled")
    await cancel_order(db, order)
    send_order_cancelled_emails(db, order, expired=False)
    await db.commit()
    return order_read(await _get_order(db, order_id))


@router.post("/{order_id}/restore", response_model=OrderRead)
async def restore_sale(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> OrderRead:
    """The payment of a cancelled order arrived after all: the order counts as paid again,
    if its coins are still on sale."""
    order = await _get_own_sale(db, order_id, current_user)
    if order.status != OrderStatus.CANCELLED:
        raise HTTPException(status_code=409, detail="Only cancelled orders can be restored")
    await restore_order(db, order)
    send_order_restored_email(db, order)
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
