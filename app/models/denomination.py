from typing import TYPE_CHECKING

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.coin import Coin


class Denomination(Base):
    __tablename__ = "denominations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    value: Mapped[float | None] = mapped_column(Float, nullable=True)

    coins: Mapped[list["Coin"]] = relationship(back_populates="denomination")
