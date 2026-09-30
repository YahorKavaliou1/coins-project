from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class AdminActionType(StrEnum):
    ROLE_CHANGED = "role_changed"
    BLOCKED = "blocked"
    UNBLOCKED = "unblocked"
    EMAIL_VERIFIED = "email_verified"
    VERIFICATION_RESENT = "verification_resent"


class AdminAction(Base):
    """Audit log of what admins did to user accounts. Rows are only ever added.

    Emails are copied, and the user references are cleared rather than cascaded, so the
    record survives deletion of either account."""

    __tablename__ = "admin_actions"

    id: Mapped[int] = mapped_column(primary_key=True)
    admin_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    admin_email: Mapped[str] = mapped_column(String(255))
    target_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_email: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(30))
    # E.g. "user → seller" for a role change.
    details: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
