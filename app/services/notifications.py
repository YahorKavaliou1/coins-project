"""High-level email notifications. Each function only queues the email; the caller commits."""

from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.email_outbox import EmailOutbox
from app.models.order import Order, OrderStatus
from app.models.order_item import OrderItem
from app.models.user import User
from app.models.user_token import TokenPurpose
from app.services.email.outbox import enqueue_email
from app.services.tokens import can_issue_token, issue_token

ACCOUNT_EXISTS_MAX_PER_DAY = 3


def _link(path: str) -> str:
    return f"{settings.frontend_url}{path}"


async def send_verification_email(db: AsyncSession, user: User) -> bool:
    """Queues a confirmation link. Returns False if rate-limited (nothing is sent)."""
    if not await can_issue_token(db, user, TokenPurpose.VERIFY_EMAIL):
        return False
    ttl = timedelta(hours=settings.email_verification_ttl_hours)
    token = await issue_token(db, user, TokenPurpose.VERIFY_EMAIL, ttl)
    enqueue_email(
        db,
        to_email=user.email,
        template="verify_email",
        user_id=user.id,
        # No user.full_name: whoever registers chooses it, but the email goes to the owner
        # of the address, who may be someone else.
        context={
            "email": user.email,
            "link": _link(f"/verify-email?token={token}"),
            "ttl_hours": settings.email_verification_ttl_hours,
        },
    )
    return True


async def send_password_reset_email(db: AsyncSession, user: User) -> bool:
    if not await can_issue_token(db, user, TokenPurpose.RESET_PASSWORD):
        return False
    ttl = timedelta(minutes=settings.password_reset_ttl_minutes)
    token = await issue_token(db, user, TokenPurpose.RESET_PASSWORD, ttl)
    enqueue_email(
        db,
        to_email=user.email,
        template="reset_password",
        user_id=user.id,
        context={
            "email": user.email,
            "link": _link(f"/reset-password?token={token}"),
            "ttl_minutes": settings.password_reset_ttl_minutes,
        },
    )
    return True


async def send_account_exists_email(db: AsyncSession, user: User) -> None:
    """Someone tried to register with an address that already has a verified account."""
    sent_today = await db.scalar(
        select(func.count()).where(
            EmailOutbox.user_id == user.id,
            EmailOutbox.template == "account_exists",
            EmailOutbox.created_at > datetime.now(UTC) - timedelta(days=1),
        )
    )
    if (sent_today or 0) >= ACCOUNT_EXISTS_MAX_PER_DAY:
        return
    enqueue_email(
        db,
        to_email=user.email,
        template="account_exists",
        user_id=user.id,
        context={"email": user.email, "reset_link": _link("/forgot-password")},
    )


def send_password_changed_email(db: AsyncSession, user: User) -> None:
    enqueue_email(
        db,
        to_email=user.email,
        template="password_changed",
        user_id=user.id,
        context={
            "email": user.email,
            "changed_at": datetime.now(UTC).strftime("%d %b %Y, %H:%M"),
            "reset_link": _link("/forgot-password"),
        },
    )


def send_account_blocked_email(db: AsyncSession, user: User) -> None:
    enqueue_email(
        db,
        to_email=user.email,
        template="account_blocked",
        user_id=user.id,
        context={"email": user.email},
    )


def send_account_locked_email(db: AsyncSession, user: User) -> None:
    """Too many wrong passwords: tells the owner, who may not have caused it."""
    assert user.locked_until is not None
    enqueue_email(
        db,
        to_email=user.email,
        template="account_locked",
        user_id=user.id,
        context={
            "email": user.email,
            "locked_until": user.locked_until.strftime("%d %b %Y, %H:%M"),
            "reset_link": _link("/forgot-password"),
        },
    )


def send_account_unblocked_email(db: AsyncSession, user: User) -> None:
    enqueue_email(
        db,
        to_email=user.email,
        template="account_unblocked",
        user_id=user.id,
        context={"email": user.email, "login_link": _link("/auth")},
    )


def _order_lines(items: list[OrderItem]) -> list[dict[str, object]]:
    return [{"name": item.coin_name_snapshot, "price": item.price_paid} for item in items]


def _shipping_context(order: Order) -> dict[str, object]:
    return {"shipping_method": order.shipping_method, "shipping_price": order.shipping_price}


async def send_order_emails(
    db: AsyncSession, order: Order, items: list[OrderItem], buyer: User, seller: User
) -> None:
    """The buyer gets the seller's payment details; the seller, whom to ship to."""
    lines = _order_lines(items)
    enqueue_email(
        db,
        to_email=buyer.email,
        template="order_confirmation",
        user_id=buyer.id,
        context={
            "name": buyer.full_name,
            "order_id": order.id,
            "items": lines,
            **_shipping_context(order),
            "total": order.total_price,
            "shipping_address": order.shipping_address,
            "seller_name": seller.full_name,
            "payment_details": seller.payment_details,
            "contact_email": seller.contact_email,
            "contact_phone": seller.contact_phone,
            "contact_note": seller.contact_note,
            "orders_link": _link("/purchases"),
        },
    )
    enqueue_email(
        db,
        to_email=seller.email,
        template="coin_sold",
        user_id=seller.id,
        context={
            "name": seller.full_name,
            "order_id": order.id,
            "items": lines,
            **_shipping_context(order),
            "total": order.total_price,
            "buyer_name": buyer.full_name,
            "shipping_address": order.shipping_address,
            "sales_link": _link("/sales"),
            # The buyer sees the seller's details on the order page as soon as they are added.
            "payment_details_missing": not seller.payment_details,
            "account_link": _link("/account"),
        },
    )


def send_order_paid_email(db: AsyncSession, order: Order) -> None:
    """Tells the seller the buyer says they paid. Needs order.buyer and order.seller loaded."""
    enqueue_email(
        db,
        to_email=order.seller.email,
        template="order_paid",
        user_id=order.seller_id,
        context={
            "name": order.seller.full_name,
            "order_id": order.id,
            "buyer_name": order.buyer.full_name,
            "total": order.total_price,
            "sales_link": _link("/sales"),
        },
    )


def send_order_shipped_email(db: AsyncSession, order: Order, *, tracking_updated: bool) -> None:
    """Tells the buyer the coins are on their way. Needs order.buyer and order.seller loaded."""
    enqueue_email(
        db,
        to_email=order.buyer.email,
        template="order_shipped",
        user_id=order.buyer_id,
        context={
            "name": order.buyer.full_name,
            "order_id": order.id,
            "seller_name": order.seller.full_name,
            "tracking_code": order.tracking_code,
            "tracking_updated": tracking_updated,
            "orders_link": _link("/purchases"),
        },
    )


async def send_payment_details_updated_emails(db: AsyncSession, seller: User) -> int:
    """Emails the seller's new payment details to every buyer with an order from them still
    awaiting payment (one email per buyer, listing their orders). Returns how many buyers."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.buyer))
        .where(Order.seller_id == seller.id, Order.status == OrderStatus.AWAITING_PAYMENT)
        .order_by(Order.id)
    )
    by_buyer: dict[int, list[Order]] = defaultdict(list)
    for order in result.scalars():
        by_buyer[order.buyer_id].append(order)

    for orders in by_buyer.values():
        buyer = orders[0].buyer
        enqueue_email(
            db,
            to_email=buyer.email,
            template="payment_details_updated",
            user_id=buyer.id,
            context={
                "name": buyer.full_name,
                "seller_name": seller.full_name,
                "orders": [{"id": o.id, "total": o.total_price} for o in orders],
                # "order #3" or "orders #3, #5": the subject line.
                "order_label": ("orders " if len(orders) > 1 else "order ")
                + ", ".join(f"#{o.id}" for o in orders),
                "payment_details": seller.payment_details,
                "orders_link": _link("/purchases"),
            },
        )
    return len(by_buyer)
