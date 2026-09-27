def format_weight(weight: float) -> str:
    """Format weight without trailing zeros, e.g. 1.0 -> '1', 1.5 -> '1.5'."""
    return f"{weight:g}"


def build_coin_name(
    country_name: str,
    year: int,
    metal_name: str,
    weight: float,
    weight_unit: str,
    denomination: str | None = None,
    extra_info: str | None = None,
) -> str:
    parts = [country_name, str(year)]
    if denomination:
        parts.append(denomination)
    parts.append(metal_name)

    name = " ".join(parts) + f" ({format_weight(weight)} {weight_unit})"

    if extra_info:
        name += f' "{extra_info}"'

    return name
