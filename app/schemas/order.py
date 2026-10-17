from datetime import datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import BaseModel, Field, StringConstraints, model_validator

from app.models.order import OrderStatus
from app.schemas.account import AddressCreate, ShippingOption
from app.schemas.fields import DbId, MoneyOut


class ShippingChoice(BaseModel):
    seller_id: DbId
    # One of the seller's shipping options by name; null if the seller has none.
    option_name: Annotated[str, StringConstraints(max_length=100)] | None = None


class CheckoutRequest(BaseModel):
    # A saved address, or a new one (optionally saved for next time).
    address_id: DbId | None = None
    address: AddressCreate | None = None
    save_address: bool = False
    shipping: list[ShippingChoice] = Field(default=[], max_length=100)
    # The total the buyer saw (coins plus shipping, all sellers). If a seller changed a price
    # or a shipping cost since, checkout is refused instead of charging something unagreed.
    expected_total: Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]

    @model_validator(mode="after")
    def one_address(self) -> Self:
        if (self.address_id is None) == (self.address is None):
            raise ValueError("Choose a saved address or enter a new one")
        return self


class TrackingUpdate(BaseModel):
    tracking_code: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] | None
    ) = None


class OrderItemRead(BaseModel):
    id: int
    # None once the coin was deleted (only withdrawn lots can be, so rarely).
    coin_id: int | None
    coin_name_snapshot: str
    price_paid: MoneyOut
    seller_id: int
    image_url: str | None = None  # the coin's first photo, as a thumbnail


class SellerContact(BaseModel):
    """What the buyer needs to pay and to reach the seller."""

    name: str | None
    payment_details: str | None
    contact_email: str | None
    contact_phone: str | None
    contact_note: str | None


class OrderRead(BaseModel):
    id: int
    created_at: datetime
    status: OrderStatus
    paid_at: datetime | None
    shipped_at: datetime | None
    tracking_code: str | None
    shipping_address: str
    shipping_method: str | None
    shipping_price: MoneyOut | None
    total_price: MoneyOut
    items: list[OrderItemRead]
    buyer_id: int
    buyer_name: str | None
    seller_id: int
    seller_name: str | None


class BuyerOrderRead(OrderRead):
    seller: SellerContact


class AdminOrderRead(OrderRead):
    buyer_email: str
    seller_email: str


class AdminOrderPage(BaseModel):
    items: list[AdminOrderRead]
    total: int


class CartSeller(BaseModel):
    """A seller with coins in the cart: their shipping options to choose from."""

    id: int
    name: str | None
    shipping_options: list[ShippingOption]
    has_payment_details: bool
