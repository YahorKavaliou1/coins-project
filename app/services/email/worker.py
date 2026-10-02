"""Background worker: delivers queued emails and runs periodic cleanup.

Runs as an asyncio task inside the API process (see app.main lifespan). Rows are claimed
with SELECT ... FOR UPDATE SKIP LOCKED, so several API processes can run it safely.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.cart_item import CartItem
from app.models.coin import Coin
from app.models.email_outbox import EmailOutbox, EmailStatus
from app.models.favourite import Favourite
from app.models.order import Order
from app.models.user import User
from app.models.user_token import UserToken
from app.services.email.smtp import PermanentEmailError, send_email

logger = logging.getLogger("app.email")

POLL_INTERVAL_SECONDS = 3
MAINTENANCE_INTERVAL = timedelta(hours=1)
# Delay before attempt 2, 3, ...; after the last one the email is marked failed.
RETRY_DELAYS = [
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=30),
    timedelta(hours=2),
    timedelta(hours=6),
]
MAX_ATTEMPTS = len(RETRY_DELAYS) + 1
EMAIL_LOG_RETENTION = timedelta(days=90)
USED_TOKEN_RETENTION = timedelta(days=1)

# A separate small engine without SQL echo: polling would otherwise flood the logs.
_engine = create_async_engine(
    settings.database_url, pool_size=2, max_overflow=0, pool_pre_ping=True
)
_session_maker = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


def _finish(email: EmailOutbox, status: EmailStatus) -> None:
    email.status = status
    # Bodies may contain one-time links; keep only metadata as the email log.
    email.html_body = None
    email.text_body = None


async def deliver_next_email() -> bool:
    """Sends one due email. Returns False when there is nothing to send."""
    async with _session_maker() as db:
        email = (
            await db.execute(
                select(EmailOutbox)
                .where(
                    EmailOutbox.status == EmailStatus.PENDING,
                    EmailOutbox.next_attempt_at <= datetime.now(UTC),
                )
                .order_by(EmailOutbox.next_attempt_at)
                .limit(1)
                .with_for_update(skip_locked=True)
            )
        ).scalar_one_or_none()
        if email is None:
            return False

        email.attempts += 1
        try:
            await send_email(
                email.to_email, email.subject, email.html_body or "", email.text_body or ""
            )
        except PermanentEmailError as e:
            email.last_error = str(e)[:1000]
            _finish(email, EmailStatus.FAILED)
            logger.warning("Email %s to %s rejected permanently: %s", email.id, email.to_email, e)
        except Exception as e:  # network, auth, timeouts: retry later
            email.last_error = f"{type(e).__name__}: {e}"[:1000]
            if email.attempts >= MAX_ATTEMPTS:
                _finish(email, EmailStatus.FAILED)
                logger.error(
                    "Email %s to %s failed after %s attempts: %s",
                    email.id,
                    email.to_email,
                    email.attempts,
                    e,
                )
            else:
                email.next_attempt_at = datetime.now(UTC) + RETRY_DELAYS[email.attempts - 1]
                logger.warning(
                    "Email %s to %s failed (attempt %s), will retry: %s",
                    email.id,
                    email.to_email,
                    email.attempts,
                    e,
                )
        else:
            email.sent_at = datetime.now(UTC)
            email.last_error = None
            _finish(email, EmailStatus.SENT)
            logger.info("Email %s (%s) sent to %s", email.id, email.template, email.to_email)
        await db.commit()
        return True


async def run_maintenance() -> None:
    now = datetime.now(UTC)
    async with _session_maker() as db:
        # Email log retention (GDPR: keep personal data only as long as needed).
        await db.execute(
            delete(EmailOutbox).where(
                EmailOutbox.status.in_([EmailStatus.SENT, EmailStatus.FAILED]),
                EmailOutbox.created_at < now - EMAIL_LOG_RETENTION,
            )
        )
        # Expired or used one-time tokens.
        await db.execute(
            delete(UserToken).where(
                or_(
                    UserToken.expires_at < now,
                    UserToken.used_at < now - USED_TOKEN_RETENTION,
                )
            )
        )
        # Accounts that never confirmed their email. Accounts that somehow own coins or
        # orders are kept for manual review rather than breaking foreign keys.
        stale_users = select(User.id).where(
            User.is_verified.is_(False),
            User.verification_deadline.is_not(None),
            User.verification_deadline < now,
            ~exists().where(Coin.owner_id == User.id),
            ~exists().where(Order.buyer_id == User.id),
        )
        stale_ids = list((await db.execute(stale_users)).scalars().all())
        if stale_ids:
            await db.execute(delete(EmailOutbox).where(EmailOutbox.user_id.in_(stale_ids)))
            await db.execute(delete(CartItem).where(CartItem.user_id.in_(stale_ids)))
            await db.execute(delete(Favourite).where(Favourite.user_id.in_(stale_ids)))
            await db.execute(delete(User).where(User.id.in_(stale_ids)))
            logger.info("Deleted %s unverified accounts past their deadline", len(stale_ids))
        await db.commit()


async def run_email_worker() -> None:
    logger.info("Email worker started (SMTP %s:%s)", settings.smtp_host, settings.smtp_port)
    last_maintenance = datetime.min.replace(tzinfo=UTC)
    while True:
        try:
            if datetime.now(UTC) - last_maintenance >= MAINTENANCE_INTERVAL:
                await run_maintenance()
                last_maintenance = datetime.now(UTC)
            while await deliver_next_email():
                pass
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Email worker iteration failed")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
