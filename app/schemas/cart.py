from pydantic import BaseModel, ConfigDict

from app.schemas.coin import CoinRead


class CartItemAdd(BaseModel):
    coin_id: int


class CartItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    coin: CoinRead


class CartRead(BaseModel):
    items: list[CartItemRead]
    total_price: float
