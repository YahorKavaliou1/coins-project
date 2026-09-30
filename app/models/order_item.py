from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.coin import Coin
    from app.models.order import Order
    from app.models.user import User


class OrderItem(Base):
    __tablename__ = "order_items"
    # A coin can be sold only once (backs up the row lock taken in checkout).
    __table_args__ = (UniqueConstraint("coin_id", name="uq_order_items_coin_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    coin_id: Mapped[int] = mapped_column(ForeignKey("coins.id"))
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Snapshots at the time of purchase, so order history stays accurate
    # even if the coin is later edited, relisted, or deleted.
    coin_name_snapshot: Mapped[str] = mapped_column(String(255))
    price_paid: Mapped[float] = mapped_column(Float)

    order: Mapped["Order"] = relationship(back_populates="items")
    coin: Mapped["Coin"] = relationship()
    seller: Mapped["User"] = relationship()
