"""High-level email notifications. Each function only queues the email; the caller commits."""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.email_outbox import EmailOutbox
from app.models.order import Order
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


async def send_order_emails(
    db: AsyncSession, order: Order, items: list[OrderItem], buyer: User
) -> None:
    """Confirmation to the buyer and one 'you sold' email per seller with their items only."""
    lines = [{"name": item.coin_name_snapshot, "price": item.price_paid} for item in items]
    enqueue_email(
        db,
        to_email=buyer.email,
        template="order_confirmation",
        user_id=buyer.id,
        context={
            "name": buyer.full_name,
            "order_id": order.id,
            "items": lines,
            "total": order.total_price,
            "shipping_address": order.shipping_address,
            "orders_link": _link("/purchases"),
        },
    )

    by_seller: dict[int, list[dict[str, object]]] = defaultdict(list)
    totals: dict[int, Decimal] = defaultdict(Decimal)
    for item in items:
        by_seller[item.seller_id].append(
            {"name": item.coin_name_snapshot, "price": item.price_paid}
        )
        totals[item.seller_id] += item.price_paid

    sellers = await db.execute(select(User).where(User.id.in_(by_seller.keys())))
    for seller in sellers.scalars():
        enqueue_email(
            db,
            to_email=seller.email,
            template="coin_sold",
            user_id=seller.id,
            context={
                "name": seller.full_name,
                "order_id": order.id,
                "items": by_seller[seller.id],
                "total": totals[seller.id],
                "buyer_name": buyer.full_name,
                "shipping_address": order.shipping_address,
            },
        )
