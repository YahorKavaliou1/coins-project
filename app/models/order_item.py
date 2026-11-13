from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, Numeric, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.coin import Coin
    from app.models.order import Order
    from app.models.user import User


class OrderItem(Base):
    __tablename__ = "order_items"
    # A coin can be in only one order that isn't cancelled (backs up the row lock taken in
    # checkout); a cancelled order keeps its items for the record.
    __table_args__ = (
        Index(
            "uq_order_items_active_coin",
            "coin_id",
            unique=True,
            postgresql_where=text("NOT cancelled"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    coin_id: Mapped[int] = mapped_column(ForeignKey("coins.id"))
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Snapshots at the time of purchase, so order history stays accurate
    # even if the coin is later edited, relisted, or deleted.
    # Text: the name includes the seller's free-form extra info.
    coin_name_snapshot: Mapped[str] = mapped_column(Text)
    price_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Mirrors the order's "cancelled" status, for the index above.
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    order: Mapped["Order"] = relationship(back_populates="items")
    coin: Mapped["Coin"] = relationship()
    seller: Mapped["User"] = relationship()
