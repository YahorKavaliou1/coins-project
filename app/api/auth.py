from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import BLOCKED_USER_DETAIL, EMAIL_NOT_VERIFIED_DETAIL, user_from_token
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import (
    burn_password_check,
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_and_update_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.models.user_token import TokenPurpose
from app.schemas.user import (
    EmailRequest,
    MessageResponse,
    ResetPasswordRequest,
    Token,
    TokenRefreshRequest,
    UserCreate,
    VerifyEmailRequest,
)
from app.services.captcha import require_captcha
from app.services.notifications import (
    send_account_exists_email,
    send_account_locked_email,
    send_password_changed_email,
    send_password_reset_email,
    send_verification_email,
)
from app.services.tokens import consume_token, invalidate_tokens

router = APIRouter(prefix="/auth", tags=["auth"])

INCORRECT_CREDENTIALS_DETAIL = "Incorrect email or password"
INVALID_LINK_DETAIL = "This link is invalid or has expired."
VERIFY_PASSWORD_MISMATCH_DETAIL = (
    "The password doesn't match. If you registered more than once, use the password from "
    'your latest registration, or set a new one with "Forgot password".'
)
# The same answers whether or not the address has an account, so these endpoints
# can't be used to find out who is registered.
REGISTERED_MESSAGE = "Check your inbox: we've sent you a link to confirm your email address."
VERIFICATION_RESENT_MESSAGE = (
    "If this address has an unconfirmed account, we've sent a new confirmation link."
)
RESET_REQUESTED_MESSAGE = "If an account exists for this address, we've sent a password reset link."
PASSWORD_RESET_MESSAGE = "Your password has been changed. You can now log in."

MAX_LOCKOUT = timedelta(hours=24)

# Per client IP. Tight on endpoints that send emails, since they could be used for spam.
EMAIL_SENDING_LIMIT = "5/minute;20/hour"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


async def _find_user(db: AsyncSession, email: str, *, for_update: bool = False) -> User | None:
    stmt = select(User).where(func.lower(User.email) == _normalize_email(email))
    if for_update:
        stmt = stmt.with_for_update()
    return (await db.execute(stmt)).scalar_one_or_none()


def _record_failed_login(db: AsyncSession, user: User, now: datetime) -> None:
    """Counts a wrong password; from the threshold on, locks the account for a while.

    The first lock lasts login_lockout_minutes, and each failure after it expires doubles
    the next one: a guesser gets a handful of tries a day, while the owner is never locked
    out for good and can lift the lock at once with a password reset."""
    user.failed_login_attempts += 1
    excess = user.failed_login_attempts - settings.max_failed_login_attempts
    if excess < 0:
        return
    duration = timedelta(minutes=settings.login_lockout_minutes) * 2 ** min(excess, 16)
    user.locked_until = now + min(duration, MAX_LOCKOUT)
    send_account_locked_email(db, user)


def _issue_tokens(user: User) -> Token:
    return Token(
        access_token=create_access_token(str(user.id), user.token_version),
        refresh_token=create_refresh_token(str(user.id), user.token_version),
    )


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit(EMAIL_SENDING_LIMIT)
async def register(
    request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    await require_captcha(data.captcha_token, request)
    # Hashed on every path, so the response time doesn't reveal whether the email is taken.
    hashed_password = await hash_password(data.password)
    existing = await _find_user(db, data.email, for_update=True)

    if existing is None:
        user = User(
            email=_normalize_email(data.email),
            hashed_password=hashed_password,
            full_name=data.full_name,
            role=settings.default_user_role,
            is_verified=False,
            verification_deadline=datetime.now(UTC)
            + timedelta(days=settings.unverified_account_ttl_days),
        )
        db.add(user)
        await db.flush()
        await send_verification_email(db, user)
    elif not existing.is_verified:
        # Nobody has proven they own this address yet, so the latest registration wins.
        # Confirming the email requires this password, so an attacker who pre-registered
        # someone else's address can't end up with a verified account they know the
        # password of (pre-account takeover).
        existing.hashed_password = hashed_password
        existing.full_name = data.full_name
        existing.revoke_tokens()
        await send_verification_email(db, existing)
    else:
        await send_account_exists_email(db, existing)

    await db.commit()
    return MessageResponse(message=REGISTERED_MESSAGE)


@router.post("/login", response_model=Token)
@limiter.limit("10/minute;100/hour")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    now = datetime.now(UTC)
    # Lock the row so concurrent attempts can't lose failed-login increments.
    user = await _find_user(db, form_data.username, for_update=True)

    # Every path checks exactly one password hash, so timing doesn't reveal whether the
    # account exists. While locked the real password isn't checked at all (otherwise the
    # answers would still tell right guesses from wrong ones), and the answer is the same
    # as for an unknown email; the owner learns about the lock by email.
    if user is None or user.is_locked(now):
        await burn_password_check(form_data.password)
        raise HTTPException(status_code=401, detail=INCORRECT_CREDENTIALS_DETAIL)

    valid, upgraded_hash = await verify_and_update_password(
        form_data.password, user.hashed_password
    )
    if not valid:
        _record_failed_login(db, user, now)
        await db.commit()
        raise HTTPException(status_code=401, detail=INCORRECT_CREDENTIALS_DETAIL)

    if upgraded_hash is not None:
        user.hashed_password = upgraded_hash
    user.clear_login_failures()

    # The states below are revealed only after a correct password, so they can't be used
    # to probe accounts.
    if user.is_blocked:
        await db.commit()
        raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)
    if not user.is_active:
        await db.commit()
        raise HTTPException(status_code=403, detail="User is inactive")
    if not user.is_verified:
        await send_verification_email(db, user)
        await db.commit()
        raise HTTPException(status_code=403, detail=EMAIL_NOT_VERIFIED_DETAIL)

    await db.commit()
    return _issue_tokens(user)


@router.post("/verify-email", response_model=Token)
@limiter.limit("10/minute")
async def verify_email(
    request: Request, data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)
) -> Token:
    """Confirms the address from the email link and logs the user in.

    Requires the account password: the link proves control of the mailbox, the password
    proves this person set the account up."""
    user = await consume_token(db, data.token, TokenPurpose.VERIFY_EMAIL)
    if user is None:
        raise HTTPException(status_code=400, detail=INVALID_LINK_DETAIL)
    if not await verify_password(data.password, user.hashed_password):
        # Not committed: the token stays valid for another attempt.
        await db.rollback()
        raise HTTPException(status_code=400, detail=VERIFY_PASSWORD_MISMATCH_DETAIL)

    user.is_verified = True
    user.verification_deadline = None
    await invalidate_tokens(db, user, TokenPurpose.VERIFY_EMAIL)
    await db.commit()

    if user.is_blocked:
        raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")
    return _issue_tokens(user)


@router.post(
    "/resend-verification", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED
)
@limiter.limit(EMAIL_SENDING_LIMIT)
async def resend_verification(
    request: Request, data: EmailRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    await require_captcha(data.captcha_token, request)
    user = await _find_user(db, data.email, for_update=True)
    if user is not None and not user.is_verified:
        await send_verification_email(db, user)
        await db.commit()
    return MessageResponse(message=VERIFICATION_RESENT_MESSAGE)


@router.post(
    "/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED
)
@limiter.limit(EMAIL_SENDING_LIMIT)
async def forgot_password(
    request: Request, data: EmailRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    await require_captcha(data.captcha_token, request)
    user = await _find_user(db, data.email, for_update=True)
    if user is not None:
        await send_password_reset_email(db, user)
        await db.commit()
    return MessageResponse(message=RESET_REQUESTED_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("10/minute")
async def reset_password(
    request: Request, data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user = await consume_token(db, data.token, TokenPurpose.RESET_PASSWORD)
    if user is None:
        raise HTTPException(status_code=400, detail=INVALID_LINK_DETAIL)

    user.hashed_password = await hash_password(data.password)
    # Log out every existing session: the old password may have been compromised.
    user.revoke_tokens()
    # The reset proves the user controls the mailbox.
    user.is_verified = True
    user.verification_deadline = None
    # A lockout from failed logins is lifted by a new password; an admin block is not.
    user.clear_login_failures()
    await invalidate_tokens(db, user, TokenPurpose.RESET_PASSWORD)
    send_password_changed_email(db, user)
    await db.commit()
    return MessageResponse(message=PASSWORD_RESET_MESSAGE)


@router.post("/refresh", response_model=Token)
@limiter.limit("30/minute")
async def refresh(
    request: Request, data: TokenRefreshRequest, db: AsyncSession = Depends(get_db)
) -> Token:
    user = await user_from_token(db, data.refresh_token, "refresh")
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)
    if not user.is_verified:
        raise HTTPException(status_code=403, detail=EMAIL_NOT_VERIFIED_DETAIL)

    return _issue_tokens(user)
