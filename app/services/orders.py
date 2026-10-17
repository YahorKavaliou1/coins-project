"""Building order views for buyers, sellers and admins."""

from typing import Any

from sqlalchemy.orm import selectinload

from app.models.coin import Coin
from app.models.order import Order
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
        "tracking_code": order.tracking_code,
        "shipping_address": order.shipping_address,
        "shipping_method": order.shipping_method,
        "shipping_price": order.shipping_price,
        "total_price": order.total_price,
        "items": items,
        "buyer_id": order.buyer_id,
        "buyer_name": order.buyer.full_name,
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
