from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.coin import Coin


class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Continent-level grouping, used to avoid huge flat dropdown lists on the UI.
    # Kept as free text rather than an enum so new categories (e.g. a
    # "Multinational" bucket for currency unions) can be added without a migration.
    region: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)

    # True for defunct states, empires, and pre-independence administrations
    # (e.g. Soviet Union, Austria-Hungary, British India) that no longer issue
    # currency but are still needed to catalog historical coins.
    is_historical: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    coins: Mapped[list["Coin"]] = relationship(back_populates="country")
