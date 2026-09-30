"""One-time tokens for email links (email verification, password reset)."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.user_token import TokenPurpose, UserToken

# Per user and purpose: at most one email per minute and five per hour.
MIN_INTERVAL = timedelta(minutes=1)
MAX_PER_HOUR = 5


def _hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def can_issue_token(db: AsyncSession, user: User, purpose: TokenPurpose) -> bool:
    now = datetime.now(UTC)
    last_hour = await db.execute(
        select(func.count(), func.max(UserToken.created_at)).where(
            UserToken.user_id == user.id,
            UserToken.purpose == purpose,
            UserToken.created_at > now - timedelta(hours=1),
        )
    )
    count, latest = last_hour.one()
    if count >= MAX_PER_HOUR:
        return False
    return latest is None or latest < now - MIN_INTERVAL


async def invalidate_tokens(db: AsyncSession, user: User, purpose: TokenPurpose) -> None:
    await db.execute(
        update(UserToken)
        .where(
            UserToken.user_id == user.id,
            UserToken.purpose == purpose,
            UserToken.used_at.is_(None),
        )
        .values(used_at=datetime.now(UTC))
    )


async def issue_token(db: AsyncSession, user: User, purpose: TokenPurpose, ttl: timedelta) -> str:
    """Creates a token and returns the raw value for the email link. Older links stop working."""
    await invalidate_tokens(db, user, purpose)
    raw = secrets.token_urlsafe(32)
    db.add(
        UserToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=_hash(raw),
            expires_at=datetime.now(UTC) + ttl,
        )
    )
    return raw


async def consume_token(db: AsyncSession, raw_token: str, purpose: TokenPurpose) -> User | None:
    """Marks a valid token as used and returns its user; None if invalid, used or expired."""
    token = (
        await db.execute(
            select(UserToken)
            .where(UserToken.token_hash == _hash(raw_token), UserToken.purpose == purpose)
            .with_for_update()
        )
    ).scalar_one_or_none()
    now = datetime.now(UTC)
    if token is None or token.used_at is not None or token.expires_at < now:
        return None
    token.used_at = now
    return await db.get(User, token.user_id, with_for_update=True)
