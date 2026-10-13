"""Field types shared by the request/response schemas.

Every client-supplied value is bounded here, so bad input gets a 422 with a clear message
instead of a database error (value too long, integer out of range) or a nonsensical record
(negative or NaN price).
"""

from decimal import Decimal
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import AfterValidator, Field, PlainSerializer, StringConstraints

# Largest value of a PostgreSQL INTEGER column.
MAX_DB_INT = 2_147_483_647

# Money is Decimal end to end (NUMERIC columns): floats can't represent 0.10 exactly, so
# sums drift. It is still sent to clients as a JSON number, which the frontend expects.
_as_json_number = PlainSerializer(float, return_type=float, when_used="json")

Money = Annotated[
    Decimal, Field(gt=0, max_digits=10, decimal_places=2, allow_inf_nan=False), _as_json_number
]
MoneyOut = Annotated[Decimal, _as_json_number]

DbId = Annotated[int, Field(ge=1, le=MAX_DB_INT)]
Year = Annotated[int, Field(ge=-1000, le=2100)]
# Troy ounces, grams or kilograms; the upper bound only rules out typos and overflow.
Weight = Annotated[float, Field(gt=0, le=1_000_000, allow_inf_nan=False)]
WeightUnit = Literal["oz", "g", "kg"]
DiameterMm = Annotated[float, Field(gt=0, le=10_000, allow_inf_nan=False)]
Mintage = Annotated[int, Field(ge=0, le=MAX_DB_INT)]


# Strings trimmed of surrounding whitespace, limited to their database column length.
Text50 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]
Text100 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Text255 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]
Text1000 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]


def _blank_to_none(value: str) -> str | None:
    return value or None


# A blank category means "none", so the shop filter never offers an empty option.
Category = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=50), AfterValidator(_blank_to_none)
]

# Labels are short free-form tags ("Proof", "Low mintage"...); the shop filters by any of them.
MAX_LABELS_PER_COIN = 5
MAX_LABEL_LENGTH = 30


def _clean_labels(labels: list[str]) -> list[str]:
    """Collapses inner whitespace and drops blanks and case-insensitive duplicates."""
    cleaned: list[str] = []
    seen: set[str] = set()
    for label in labels:
        label = " ".join(label.split())
        if label and label.casefold() not in seen:
            seen.add(label.casefold())
            cleaned.append(label)
    if len(cleaned) > MAX_LABELS_PER_COIN:
        raise ValueError(f"A coin can have at most {MAX_LABELS_PER_COIN} labels")
    return cleaned


Label = Annotated[str, StringConstraints(strip_whitespace=True, max_length=MAX_LABEL_LENGTH)]
# The length bound here only stops huge payloads; _clean_labels enforces the real limit
# after blanks and duplicates are dropped.
Labels = Annotated[list[Label], Field(max_length=50), AfterValidator(_clean_labels)]

# The seller's own stock number, for matching lots with their records.
Sku = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=100), AfterValidator(_blank_to_none)
]


def _check_web_url(value: str) -> str | None:
    if not value:
        return None
    parts = urlsplit(value)
    # Shown to every visitor as a link: anything but a plain web address (javascript:,
    # data:, relative paths...) could run script or mislead.
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
        raise ValueError("Enter a full web address starting with https://")
    if any(char.isspace() for char in value):
        raise ValueError("A web address can't contain spaces")
    return value


# Where the coin is described, e.g. its Numista or uCoin page.
SourceUrl = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=500),
    AfterValidator(_check_web_url),
]
