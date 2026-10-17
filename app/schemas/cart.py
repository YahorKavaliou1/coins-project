from pydantic import BaseModel, ConfigDict

from app.schemas.coin import CoinRead
from app.schemas.fields import DbId, MoneyOut
from app.schemas.order import CartSeller


class CartItemAdd(BaseModel):
    coin_id: DbId


class CartItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    coin: CoinRead


class CartRead(BaseModel):
    items: list[CartItemRead]
    # Coins only: shipping depends on the options chosen at checkout.
    total_price: MoneyOut
    # One per seller with coins in the cart; checkout makes one order per seller.
    sellers: list[CartSeller] = []
