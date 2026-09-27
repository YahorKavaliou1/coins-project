"""Populate reference tables with curated data.

Usage:
    python -m app.db.seed.run
"""

import asyncio

from sqlalchemy import select

from app.db.seed.countries import COUNTRIES
from app.db.seed.metals import METALS
from app.db.session import async_session_maker
from app.models.country import Country
from app.models.metal import Metal


async def seed_metals() -> None:
    async with async_session_maker() as session:
        result = await session.execute(select(Metal.name))
        existing = set(result.scalars().all())

        new_metals = [Metal(name=name) for name in METALS if name not in existing]

        if not new_metals:
            print("Metals: nothing to seed, already up to date.")
            return

        session.add_all(new_metals)
        await session.commit()
        print(f"Metals: seeded {len(new_metals)} new entries.")


async def seed_countries() -> None:
    async with async_session_maker() as session:
        result = await session.execute(select(Country.name))
        existing = set(result.scalars().all())

        new_countries = [
            Country(name=name, code=code, region=region, is_historical=is_historical)
            for name, code, region, is_historical in COUNTRIES
            if name not in existing
        ]

        if not new_countries:
            print("Countries: nothing to seed, already up to date.")
            return

        session.add_all(new_countries)
        await session.commit()
        print(f"Countries: seeded {len(new_countries)} new entries.")


async def main() -> None:
    await seed_metals()
    await seed_countries()


if __name__ == "__main__":
    asyncio.run(main())
