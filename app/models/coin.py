from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.coin_image import CoinImage
    from app.models.country import Country
    from app.models.metal import Metal
    from app.models.user import User


class Coin(Base):
    __tablename__ = "coins"
    __table_args__ = (CheckConstraint("price > 0", name="ck_coins_price_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int] = mapped_column(Integer)
    weight: Mapped[float] = mapped_column(Float)
    weight_unit: Mapped[str] = mapped_column(String(10), default="oz", server_default="oz")
    diameter: Mapped[float | None] = mapped_column(Float, nullable=True)  # in mm
    denomination: Mapped[str | None] = mapped_column(String(100), nullable=True)
    composition: Mapped[str | None] = mapped_column(String(255), nullable=True)
    grade: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Free-form grouping of lots (e.g. "Bullion", "Commemorative"); the shop filters by it.
    category: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    # The seller's own stock number (SKU), for matching lots with their own records.
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # A page describing the coin, e.g. on Numista or uCoin (http/https only).
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    catalog_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extra_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    mintage: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # NUMERIC, not FLOAT: money must add up exactly.
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    is_for_sale: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    country_id: Mapped[int] = mapped_column(ForeignKey("countries.id"))
    metal_id: Mapped[int] = mapped_column(ForeignKey("metals.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    country: Mapped["Country"] = relationship(back_populates="coins")
    metal: Mapped["Metal"] = relationship(back_populates="coins")

    # The user who listed this coin for sale. This never changes after a
    # purchase — buyer information and purchase history live on Order/OrderItem.
    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])

    images: Mapped[list["CoinImage"]] = relationship(
        back_populates="coin",
        order_by="CoinImage.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
