from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_admin
from app.core.rate_limit import limiter
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.admin_action import AdminAction, AdminActionType
from app.models.order import Order
from app.models.user import BlockReason, User
from app.schemas.order import OrderRead
from app.schemas.user import (
    AdminActionRead,
    MessageResponse,
    UserRead,
    UserRoleUpdate,
    UserUpdate,
)
from app.services.notifications import (
    send_account_blocked_email,
    send_account_unblocked_email,
    send_password_changed_email,
    send_verification_email,
)

router = APIRouter(prefix="/users", tags=["users"])


def _log_admin_action(
    db: AsyncSession,
    admin: User,
    target: User,
    action: AdminActionType,
    details: str | None = None,
) -> None:
    """Records the action in the same transaction as the change itself."""
    db.add(
        AdminAction(
            admin_id=admin.id,
            admin_email=admin.email,
            target_user_id=target.id,
            target_email=target.email,
            action=action,
            details=details,
        )
    )


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
# Checks the current password, so it is limited like login.
@limiter.limit("10/minute")
async def update_current_user(
    request: Request,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.password is not None:
        if data.current_password is None or not await verify_password(
            data.current_password, current_user.hashed_password
        ):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        current_user.hashed_password = await hash_password(data.password)
        # Ends every session, including this one: the client logs in with the new password.
        current_user.revoke_tokens()
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


@router.get("/{user_id}/admin-actions", response_model=list[AdminActionRead])
async def list_admin_actions(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[AdminAction]:
    """What admins did to this account, newest first."""
    await _get_user_or_404(db, user_id)
    stmt = (
        select(AdminAction)
        .where(AdminAction.target_user_id == user_id)
        .order_by(AdminAction.created_at.desc(), AdminAction.id.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


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

    if user.role != data.role:
        _log_admin_action(
            db, current_user, user, AdminActionType.ROLE_CHANGED, f"{user.role} → {data.role}"
        )
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
        _log_admin_action(db, current_user, user, AdminActionType.BLOCKED)
        await db.commit()
        await db.refresh(user)
    return user


@router.post("/{user_id}/unblock", response_model=UserRead)
async def unblock_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> User:
    user = await _get_user_or_404(db, user_id)
    was_blocked = user.is_blocked
    was_locked = user.is_locked(datetime.now(UTC))
    # Also lifts a temporary lock after failed logins.
    user.unblock()
    if was_blocked:
        send_account_unblocked_email(db, user)
    if was_blocked or was_locked:
        details = None if was_blocked else "lifted a lock after failed logins"
        _log_admin_action(db, current_user, user, AdminActionType.UNBLOCKED, details)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/verify", response_model=UserRead)
async def verify_user_manually(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> User:
    """Support action: mark the email as confirmed without the link."""
    user = await _get_user_or_404(db, user_id)
    if not user.is_verified:
        _log_admin_action(db, current_user, user, AdminActionType.EMAIL_VERIFIED)
    user.is_verified = True
    user.verification_deadline = None
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/resend-verification", response_model=MessageResponse)
async def resend_verification_for_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> MessageResponse:
    user = await _get_user_or_404(db, user_id)
    if user.is_verified:
        raise HTTPException(status_code=400, detail="This user's email is already confirmed")
    if not await send_verification_email(db, user):
        raise HTTPException(
            status_code=429, detail="A link was sent recently. Try again in a minute."
        )
    _log_admin_action(db, current_user, user, AdminActionType.VERIFICATION_RESENT)
    await db.commit()
    return MessageResponse(message=f"Confirmation email sent to {user.email}")
