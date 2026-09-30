from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.order import Order
from app.models.user import BlockReason, User
from app.schemas.order import OrderRead
from app.schemas.user import MessageResponse, UserRead, UserRoleUpdate, UserUpdate
from app.services.notifications import (
    send_account_blocked_email,
    send_account_unblocked_email,
    send_password_changed_email,
    send_verification_email,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_current_user(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.password is not None:
        current_user.hashed_password = hash_password(data.password)
        send_password_changed_email(db, current_user)

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[User]:
    result = await db.execute(select(User).order_by(User.id))
    return list(result.scalars().all())


async def _get_user_or_404(db: AsyncSession, user_id: int) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    return await _get_user_or_404(db, user_id)


@router.get("/{user_id}/orders", response_model=list[OrderRead])
async def list_user_orders(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[Order]:
    await _get_user_or_404(db, user_id)
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.buyer_id == user_id)
        .order_by(Order.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.patch("/{user_id}/role", response_model=UserRead)
async def update_user_role(
    user_id: int,
    data: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> User:
    user = await _get_user_or_404(db, user_id)
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own role")

    user.role = data.role
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/block", response_model=UserRead)
async def block_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> User:
    user = await _get_user_or_404(db, user_id)
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot block yourself")
    if not user.is_blocked:
        user.block(BlockReason.ADMIN)
        send_account_blocked_email(db, user)
        await db.commit()
        await db.refresh(user)
    return user


@router.post("/{user_id}/unblock", response_model=UserRead)
async def unblock_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    user = await _get_user_or_404(db, user_id)
    was_blocked = user.is_blocked
    user.unblock()
    if was_blocked:
        send_account_unblocked_email(db, user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/verify", response_model=UserRead)
async def verify_user_manually(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> User:
    """Support action: mark the email as confirmed without the link."""
    user = await _get_user_or_404(db, user_id)
    user.is_verified = True
    user.verification_deadline = None
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/resend-verification", response_model=MessageResponse)
async def resend_verification_for_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> MessageResponse:
    user = await _get_user_or_404(db, user_id)
    if user.is_verified:
        raise HTTPException(status_code=400, detail="This user's email is already confirmed")
    if not await send_verification_email(db, user):
        raise HTTPException(
            status_code=429, detail="A link was sent recently. Try again in a minute."
        )
    await db.commit()
    return MessageResponse(message=f"Confirmation email sent to {user.email}")
