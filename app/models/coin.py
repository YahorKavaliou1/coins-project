from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Literal, get_args

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import ColumnElement, func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.coin_image import CoinImage
    from app.models.country import Country
    from app.models.metal import Metal
    from app.models.user import User

# for_sale: listed in the shop. withdrawn: taken off sale by its seller, who can relist it.
# sold: bought (see OrderItem); final.
CoinStatus = Literal["for_sale", "withdrawn", "sold"]
COIN_STATUSES: tuple[str, ...] = get_args(CoinStatus)


class Coin(Base):
    __tablename__ = "coins"
    __table_args__ = (
        CheckConstraint("price > 0", name="ck_coins_price_positive"),
        CheckConstraint(
            "status IN ('for_sale', 'withdrawn', 'sold')", name="ck_coins_status_valid"
        ),
        # GIN, so the shop's "has any of these labels" filter (&&) can use an index.
        Index("ix_coins_labels", "labels", postgresql_using="gin"),
    )

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
    # Up to 5 short free-form tags (e.g. "Proof", "Low mintage"); the shop filters by any of them.
    labels: Mapped[list[str]] = mapped_column(ARRAY(String(30)), default=list, server_default="{}")
    # The seller's own stock number (SKU), for matching lots with their own records.
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # A page describing the coin, e.g. on Numista or uCoin (http/https only).
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    catalog_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extra_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    mintage: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # NUMERIC, not FLOAT: money must add up exactly.
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default="for_sale", server_default="for_sale", index=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    country_id: Mapped[int] = mapped_column(ForeignKey("countries.id"))
    metal_id: Mapped[int] = mapped_column(ForeignKey("metals.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    country: Mapped["Country"] = relationship(back_populates="coins")
    metal: Mapped["Metal"] = relationship(back_populates="coins")

    # The user who listed this coin for sale. This never changes after a
    # purchase — buyer information and purchase history live on Order/OrderItem.
    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])

    @hybrid_property
    def is_for_sale(self) -> bool:
        """Can be bought right now. Read-only: change `status` instead."""
        return self.status == "for_sale"

    @is_for_sale.inplace.expression
    @classmethod
    def _is_for_sale_expression(cls) -> ColumnElement[bool]:
        return cls.status == "for_sale"

    images: Mapped[list["CoinImage"]] = relationship(
        back_populates="coin",
        order_by="CoinImage.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
