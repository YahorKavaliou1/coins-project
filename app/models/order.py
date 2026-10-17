from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.order_item import OrderItem
    from app.models.user import User


class OrderStatus(StrEnum):
    # The buyer received the seller's payment details by email.
    AWAITING_PAYMENT = "awaiting_payment"
    # The buyer says they paid; the seller checks their account (outside the site).
    PAID = "paid"
    # The seller sent the coins, optionally with a tracking code.
    SHIPPED = "shipped"


class Order(Base):
    """The coins one buyer bought from one seller: a cart with several sellers' coins becomes
    one order per seller, each paid, shipped and tracked on its own."""

    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint(
            "status IN ('awaiting_payment', 'paid', 'shipped')", name="ck_orders_status"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Formatted from the chosen address at checkout (a snapshot: later edits don't change it).
    shipping_address: Mapped[str] = mapped_column(Text)
    # Snapshot of the seller's shipping option; both null when shipping is arranged with them.
    shipping_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    # Coins plus shipping.
    total_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(
        String(20), default=OrderStatus.AWAITING_PAYMENT, server_default="awaiting_payment"
    )
    tracking_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    buyer: Mapped["User"] = relationship(foreign_keys=[buyer_id])
    seller: Mapped["User"] = relationship(foreign_keys=[seller_id])
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order")
