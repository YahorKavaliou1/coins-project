from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import BLOCKED_USER_DETAIL, EMAIL_NOT_VERIFIED_DETAIL
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import BlockReason, User
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
from app.services.notifications import (
    send_account_blocked_email,
    send_account_exists_email,
    send_password_changed_email,
    send_password_reset_email,
    send_verification_email,
)
from app.services.tokens import consume_token, invalidate_tokens

router = APIRouter(prefix="/auth", tags=["auth"])

INCORRECT_CREDENTIALS_DETAIL = "Incorrect email or password"
INVALID_LINK_DETAIL = "This link is invalid or has expired."
# The same answers whether or not the address has an account, so these endpoints
# can't be used to find out who is registered.
REGISTERED_MESSAGE = "Check your inbox: we've sent you a link to confirm your email address."
VERIFICATION_RESENT_MESSAGE = (
    "If this address has an unconfirmed account, we've sent a new confirmation link."
)
RESET_REQUESTED_MESSAGE = "If an account exists for this address, we've sent a password reset link."
PASSWORD_RESET_MESSAGE = "Your password has been changed. You can now log in."


def _normalize_email(email: str) -> str:
    return email.strip().lower()


async def _find_user(db: AsyncSession, email: str, *, for_update: bool = False) -> User | None:
    stmt = select(User).where(func.lower(User.email) == _normalize_email(email))
    if for_update:
        stmt = stmt.with_for_update()
    return (await db.execute(stmt)).scalar_one_or_none()


def _issue_tokens(user: User) -> Token:
    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)) -> MessageResponse:
    existing = await _find_user(db, data.email, for_update=True)

    if existing is None:
        user = User(
            email=_normalize_email(data.email),
            hashed_password=hash_password(data.password),
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
        # Don't overwrite the password of an unconfirmed account: just resend the link
        # to the address owner.
        await send_verification_email(db, existing)
    else:
        await send_account_exists_email(db, existing)

    await db.commit()
    return MessageResponse(message=REGISTERED_MESSAGE)


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    # Lock the row so concurrent attempts can't lose failed-login increments.
    user = await _find_user(db, form_data.username, for_update=True)

    if user is None:
        raise HTTPException(status_code=401, detail=INCORRECT_CREDENTIALS_DETAIL)
    if user.is_blocked:
        raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)

    if not verify_password(form_data.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.max_failed_login_attempts:
            user.block(BlockReason.TOO_MANY_FAILED_LOGINS)
            send_account_blocked_email(db, user)
        await db.commit()
        if user.is_blocked:
            raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)
        raise HTTPException(status_code=401, detail=INCORRECT_CREDENTIALS_DETAIL)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    user.failed_login_attempts = 0

    # Revealed only after a correct password, so it can't be used to probe accounts.
    if not user.is_verified:
        await send_verification_email(db, user)
        await db.commit()
        raise HTTPException(status_code=403, detail=EMAIL_NOT_VERIFIED_DETAIL)

    await db.commit()
    return _issue_tokens(user)


@router.post("/verify-email", response_model=Token)
async def verify_email(data: VerifyEmailRequest, db: AsyncSession = Depends(get_db)) -> Token:
    """Confirms the address from the email link and logs the user in."""
    user = await consume_token(db, data.token, TokenPurpose.VERIFY_EMAIL)
    if user is None:
        raise HTTPException(status_code=400, detail=INVALID_LINK_DETAIL)

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
async def resend_verification(
    data: EmailRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user = await _find_user(db, data.email, for_update=True)
    if user is not None and not user.is_verified:
        await send_verification_email(db, user)
        await db.commit()
    return MessageResponse(message=VERIFICATION_RESENT_MESSAGE)


@router.post(
    "/forgot-password", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED
)
async def forgot_password(
    data: EmailRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user = await _find_user(db, data.email, for_update=True)
    if user is not None:
        await send_password_reset_email(db, user)
        await db.commit()
    return MessageResponse(message=RESET_REQUESTED_MESSAGE)


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user = await consume_token(db, data.token, TokenPurpose.RESET_PASSWORD)
    if user is None:
        raise HTTPException(status_code=400, detail=INVALID_LINK_DETAIL)

    user.hashed_password = hash_password(data.password)
    user.failed_login_attempts = 0
    # The reset proves the user controls the mailbox.
    user.is_verified = True
    user.verification_deadline = None
    # A lockout from failed logins is lifted by a new password; an admin block is not.
    if user.is_blocked and user.blocked_reason == BlockReason.TOO_MANY_FAILED_LOGINS:
        user.unblock()
    await invalidate_tokens(db, user, TokenPurpose.RESET_PASSWORD)
    send_password_changed_email(db, user)
    await db.commit()
    return MessageResponse(message=PASSWORD_RESET_MESSAGE)


@router.post("/refresh", response_model=Token)
async def refresh(data: TokenRefreshRequest, db: AsyncSession = Depends(get_db)) -> Token:
    try:
        payload = decode_token(data.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from e

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user = await db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)
    if not user.is_verified:
        raise HTTPException(status_code=403, detail=EMAIL_NOT_VERIFIED_DETAIL)

    return _issue_tokens(user)
