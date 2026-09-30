from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import BLOCKED_USER_DETAIL
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
from app.schemas.user import Token, TokenRefreshRequest, UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])

INCORRECT_CREDENTIALS_DETAIL = "Incorrect email or password"


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)) -> User:
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=settings.default_user_role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    # Lock the row so concurrent attempts can't lose failed-login increments.
    result = await db.execute(
        select(User).where(User.email == form_data.username).with_for_update()
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=401, detail=INCORRECT_CREDENTIALS_DETAIL)
    if user.is_blocked:
        raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)

    if not verify_password(form_data.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.max_failed_login_attempts:
            user.block(BlockReason.TOO_MANY_FAILED_LOGINS)
        await db.commit()
        if user.is_blocked:
            raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)
        raise HTTPException(status_code=401, detail=INCORRECT_CREDENTIALS_DETAIL)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    if user.failed_login_attempts:
        user.failed_login_attempts = 0
    await db.commit()

    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=Token)
async def refresh(data: TokenRefreshRequest, db: AsyncSession = Depends(get_db)) -> Token:
    try:
        payload = decode_token(data.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from e

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload["sub"]
    user = await db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail=BLOCKED_USER_DETAIL)

    return Token(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )
