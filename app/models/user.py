from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class UserRole(StrEnum):
    USER = "user"
    SELLER = "seller"
    ADMIN = "admin"


class BlockReason(StrEnum):
    ADMIN = "admin"
    TOO_MANY_FAILED_LOGINS = "too_many_failed_logins"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('user', 'seller', 'admin')", name="ck_users_role"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20), default=UserRole.USER, server_default=UserRole.USER
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    blocked_reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Consecutive wrong-password attempts; reset on successful login or unblock.
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    def block(self, reason: BlockReason) -> None:
        self.is_blocked = True
        self.blocked_reason = reason
        self.blocked_at = datetime.now(UTC)

    def unblock(self) -> None:
        self.is_blocked = False
        self.blocked_reason = None
        self.blocked_at = None
        self.failed_login_attempts = 0

    @property
    def can_sell(self) -> bool:
        return self.role in (UserRole.SELLER, UserRole.ADMIN)

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN
