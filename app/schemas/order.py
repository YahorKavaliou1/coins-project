from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.fields import MoneyOut


class CheckoutRequest(BaseModel):
    shipping_address: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=5, max_length=500)
    ]
    # The cart total the buyer saw. If a seller changed a price since, checkout is refused
    # instead of charging an amount the buyer never agreed to.
    expected_total: Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    coin_id: int
    coin_name_snapshot: str
    price_paid: MoneyOut
    seller_id: int


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    shipping_address: str
    total_price: MoneyOut
    status: str
    created_at: datetime
    items: list[OrderItemRead]
