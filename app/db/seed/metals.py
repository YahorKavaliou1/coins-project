"""Curated list of metals for the coin catalog.

Names use free text on the Coin model (via `composition`) for exact alloy
percentages; this list covers the common values used for filtering/selection.
"""

METALS: list[str] = [
    # Pure metals
    "Gold",
    "Silver",
    "Copper",
    "Nickel",
    "Zinc",
    "Aluminium",
    "Tin",
    "Lead",
    "Iron",
    "Platinum",
    "Palladium",
    "Steel",
    "Stainless Steel",
    "Titanium",
    "Manganese",
    "Niobium",
    # Alloys
    "Bronze",
    "Brass",
    "Copper-Nickel",
    "Nickel-Brass",
    "Aluminium-Bronze",
    "Nickel Silver",
    "Nordic Gold",
    "Copper-Nickel-Zinc",
    "Manganese Brass",
    "Billon",
    "Electrum",
    "Potin",
    "Pewter",
    "White Metal",
    # Clad / plated / multi-layer
    "Bi-Metallic",
    "Tri-Metallic",
    "Copper-Plated Steel",
    "Copper-Plated Zinc",
    "Nickel-Plated Steel",
    "Brass-Plated Steel",
    "Copper-Nickel Clad Copper",
    "Copper-Nickel Clad Steel",
]
