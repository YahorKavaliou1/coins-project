"""Account settings: a seller's payment details, contacts and shipping options, and every
user's saved delivery addresses."""

import unicodedata
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    PlainSerializer,
    StringConstraints,
    model_validator,
)

MAX_SHIPPING_OPTIONS = 5
MAX_ADDRESSES = 10


def _single_line(value: str) -> str:
    # Shown in emails and on order pages: no control characters (line breaks, RTL tricks).
    if any(unicodedata.category(char) in ("Cc", "Cf") for char in value):
        raise ValueError("Contains invalid characters")
    return value


def _multi_line(value: str) -> str:
    if any(unicodedata.category(c) in ("Cc", "Cf") and c not in "\n\r\t" for c in value):
        raise ValueError("Contains invalid characters")
    return value.replace("\r\n", "\n")


def _blank_to_none(value: str) -> str | None:
    return value or None


Line100 = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    AfterValidator(_single_line),
]
Line20 = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=20),
    AfterValidator(_single_line),
]
Line255 = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=255),
    AfterValidator(_single_line),
]
Phone = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=40, pattern=r"^[0-9+()\-. ]*$"),
    AfterValidator(_blank_to_none),
]
OptionalText500 = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=500),
    AfterValidator(_multi_line),
    AfterValidator(_blank_to_none),
]
OptionalText1000 = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=1000),
    AfterValidator(_multi_line),
    AfterValidator(_blank_to_none),
]
ShippingPrice = Annotated[
    Decimal,
    Field(ge=0, max_digits=8, decimal_places=2, allow_inf_nan=False),
    PlainSerializer(float, return_type=float, when_used="json"),
]


class ShippingOption(BaseModel):
    name: Line100
    price: ShippingPrice


class SellerSettings(BaseModel):
    payment_details: OptionalText1000 | None = None
    contact_email: EmailStr | None = None
    contact_phone: Phone | None = None
    contact_note: OptionalText500 | None = None
    shipping_options: list[ShippingOption] = Field(default=[], max_length=MAX_SHIPPING_OPTIONS)

    @model_validator(mode="after")
    def unique_option_names(self) -> Self:
        names = [option.name.casefold() for option in self.shipping_options]
        if len(names) != len(set(names)):
            raise ValueError("Shipping options need different names")
        return self


class SellerSettingsSaved(SellerSettings):
    # Buyers emailed the new payment details (their orders from the seller await payment).
    buyers_notified: int = 0


class AddressBase(BaseModel):
    recipient_name: Line100
    phone: Phone | None = None
    country: Line100
    city: Line100
    postal_code: Line20
    address_line: Line255


class AddressCreate(AddressBase):
    is_default: bool = False


class AddressRead(AddressBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_default: bool


def format_address(address: AddressBase) -> str:
    """The address as printed on a parcel; stored on orders and sent to the seller."""
    lines = [
        address.recipient_name,
        address.address_line,
        f"{address.postal_code} {address.city}",
        address.country,
    ]
    if address.phone:
        lines.append(f"Phone: {address.phone}")
    return "\n".join(lines)
