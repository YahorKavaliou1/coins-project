"""Field types shared by the request/response schemas.

Every client-supplied value is bounded here, so bad input gets a 422 with a clear message
instead of a database error (value too long, integer out of range) or a nonsensical record
(negative or NaN price).
"""

from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field, PlainSerializer, StringConstraints

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
