from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.country import Country
    from app.models.denomination import Denomination
    from app.models.metal import Metal


class Coin(Base):
    __tablename__ = "coins"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    year: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    mintage: Mapped[int | None] = mapped_column(Integer, nullable=True)

    country_id: Mapped[int] = mapped_column(ForeignKey("countries.id"))
    metal_id: Mapped[int | None] = mapped_column(ForeignKey("metals.id"), nullable=True)
    denomination_id: Mapped[int | None] = mapped_column(
        ForeignKey("denominations.id"), nullable=True
    )

    country: Mapped["Country"] = relationship(back_populates="coins")
    metal: Mapped["Metal | None"] = relationship(back_populates="coins")
    denomination: Mapped["Denomination | None"] = relationship(back_populates="coins")
