from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.coin import Coin


class CoinImage(Base):
    __tablename__ = "coin_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    coin_id: Mapped[int] = mapped_column(ForeignKey("coins.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(500))
    # Small WebP for coin cards and lists; null for photos uploaded before thumbnails existed
    # until `make thumbnails` creates them (the UI then falls back to `url`).
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    coin: Mapped["Coin"] = relationship(back_populates="images")
