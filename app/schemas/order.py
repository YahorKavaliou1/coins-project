from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CheckoutRequest(BaseModel):
    shipping_address: str


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    coin_id: int
    coin_name_snapshot: str
    price_paid: float
    seller_id: int


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shipping_address: str
    total_price: float
    status: str
    created_at: datetime
    items: list[OrderItemRead]
