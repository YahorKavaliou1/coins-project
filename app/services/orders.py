"""Order views for buyers, sellers and admins; cancelling and restoring orders; order links."""

import hashlib
import hmac
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.coin import Coin
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.schemas.order import (
    AdminOrderRead,
    BuyerOrderRead,
    OrderItemRead,
    OrderRead,
    SellerContact,
)

ORDER_LOAD_OPTIONS = (
    selectinload(Order.items).selectinload(OrderItem.coin).selectinload(Coin.images),
    selectinload(Order.buyer),
    selectinload(Order.seller),
)


def _order_fields(order: Order) -> dict[str, Any]:
    items = []
    for item in order.items:
        image = item.coin.images[0] if item.coin is not None and item.coin.images else None
        items.append(
            OrderItemRead(
                id=item.id,
                coin_id=item.coin_id,
                coin_name_snapshot=item.coin_name_snapshot,
                price_paid=item.price_paid,
                seller_id=item.seller_id,
                image_url=(image.thumbnail_url or image.url) if image else None,
            )
        )
    return {
        "id": order.id,
        "created_at": order.created_at,
        "status": order.status,
        "paid_at": order.paid_at,
        "shipped_at": order.shipped_at,
        "cancelled_at": order.cancelled_at,
        "tracking_code": order.tracking_code,
        "shipping_address": order.shipping_address,
        "shipping_method": order.shipping_method,
        "shipping_price": order.shipping_price,
        "total_price": order.total_price,
        "items": items,
        "buyer_id": order.buyer_id,
        "buyer_name": order.buyer_name,
        "seller_id": order.seller_id,
        "seller_name": order.seller.full_name,
    }


def order_read(order: Order) -> OrderRead:
    """For the seller: buyer name and address, no payment details (they are theirs)."""
    return OrderRead(**_order_fields(order))


def buyer_order_read(order: Order) -> BuyerOrderRead:
    """For the buyer: the seller's current payment details and contacts."""
    seller = order.seller
    return BuyerOrderRead(
        **_order_fields(order),
        seller=SellerContact(
            name=seller.full_name,
            payment_details=seller.payment_details,
            contact_email=seller.contact_email,
            contact_phone=seller.contact_phone,
            contact_note=seller.contact_note,
        ),
    )


def admin_order_read(order: Order) -> AdminOrderRead:
    return AdminOrderRead(
        **_order_fields(order), buyer_email=order.buyer.email, seller_email=order.seller.email
    )


def order_access_token(order_id: int) -> str:
    """The secret part of an order's own link (buyer emails of guest orders): lets whoever has
    the email see the order and mark it paid without an account. Signed, so nothing is
    stored and the link keeps working (settings.order_link_secret)."""
    message = f"order-access:{order_id}".encode()
    key = (settings.order_link_secret or settings.secret_key).encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def check_order_access_token(order_id: int, token: str) -> bool:
    return hmac.compare_digest(order_access_token(order_id), token)


def order_page_path(order: Order) -> str:
    """Where the buyer follows an order: their purchases, or for a guest the order's own link."""
    if order.placed_as_guest:
        return f"/order/{order.id}?token={order_access_token(order.id)}"
    return "/purchases"


async def cancel_order(db: AsyncSession, order: Order) -> None:
    """Cancels an unshipped order: its coins go back on sale. The order stays for the record.
    Needs order.items and their coins loaded; the caller sends the emails and commits."""
    # Coins locked in id order, like checkout and restore_order.
    await db.execute(
        select(Coin.id)
        .where(Coin.id.in_([item.coin_id for item in order.items]))
        .order_by(Coin.id)
        .with_for_update()
    )
    order.status = OrderStatus.CANCELLED
    order.cancelled_at = datetime.now(UTC)
    for item in order.items:
        item.cancelled = True
        if item.coin is not None and item.coin.status == "sold":
            item.coin.status = "for_sale"


RESTORE_UNAVAILABLE_DETAIL = (
    "Some of these coins were sold again or taken off sale meanwhile, so the order can't be "
    "restored. Please refund the buyer."
)


async def restore_order(db: AsyncSession, order: Order) -> None:
    """Undoes a cancellation when the payment arrived late: the order counts as paid and its
    coins are sold again, if they are all still on sale. Needs order.items loaded."""
    coin_ids = [item.coin_id for item in order.items]
    # Locked like in checkout, so the coins can't be bought at the same time.
    coins = (
        (
            await db.execute(
                select(Coin).where(Coin.id.in_(coin_ids)).order_by(Coin.id).with_for_update()
            )
        )
        .scalars()
        .all()
    )
    if len(coins) != len(coin_ids) or any(not coin.is_for_sale for coin in coins):
        raise HTTPException(status_code=409, detail=RESTORE_UNAVAILABLE_DETAIL)
    for coin in coins:
        coin.status = "sold"
    for item in order.items:
        item.cancelled = False
    order.status = OrderStatus.PAID
    order.paid_at = datetime.now(UTC)
    order.cancelled_at = None
