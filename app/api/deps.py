from collections.abc import Awaitable, Callable

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

BLOCKED_USER_DETAIL = "Your account is blocked. Please contact the administrator."
EMAIL_NOT_VERIFIED_DETAIL = (
    "Please confirm your email address. We've sent a confirmation link to your inbox."
)


async def user_from_token(db: AsyncSession, token: str, token_type: str) -> User | None:
    """Returns the user a valid, unrevoked JWT of `token_type` belongs to, or None.

    Status checks (blocked, active, verified) are left to the caller."""
    try:
        payload = decode_token(token)
    except ValueError:
        return None
    if payload.get("type") != token_type:
        return None
    try:
        user_id = int(payload["sub"])
        version = payload["ver"]
    except (KeyError, TypeError, ValueError):
        # Tokens issued before "ver" was introduced are rejected: the user logs in again.
        return None

    user = await db.get(User, user_id)
    if user is None or user.token_version != version:
        return None
    return user


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    user = await user_from_token(db, token, "access")
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Checked on every request, so blocking takes effect immediately for issued tokens.
    if user.is_blocked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=BLOCKED_USER_DETAIL)
    # Tokens are only issued to verified users; this also covers tokens issued before
    # verification became mandatory.
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=EMAIL_NOT_VERIFIED_DETAIL)

    return user


async def get_optional_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None

    user = await user_from_token(db, authorization.removeprefix("Bearer "), "access")
    if user is None or not user.is_active or user.is_blocked or not user.is_verified:
        return None

    return user


def require_roles(*roles: UserRole) -> Callable[..., Awaitable[User]]:
    """Dependency factory: allows the request only for users with one of `roles`."""

    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return dependency


require_seller = require_roles(UserRole.SELLER, UserRole.ADMIN)
require_admin = require_roles(UserRole.ADMIN)
