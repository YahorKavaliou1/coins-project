from pydantic import BaseModel, ConfigDict, Field

from app.schemas.coin import CoinRead
from app.schemas.fields import DbId, MoneyOut
from app.schemas.order import CartSeller


class CartItemAdd(BaseModel):
    coin_id: DbId


class CartPreviewRequest(BaseModel):
    """A guest's cart, kept in their browser: the coins' ids, in the order they were added."""

    coin_ids: list[DbId] = Field(max_length=100)  # cart.MAX_CART_ITEMS


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
