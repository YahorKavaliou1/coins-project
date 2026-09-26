from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.country import Country
from app.schemas.country import CountryRead

router = APIRouter(prefix="/countries", tags=["countries"])


@router.get("", response_model=list[CountryRead])
async def list_countries(db: AsyncSession = Depends(get_db)) -> list[Country]:
    result = await db.execute(select(Country).order_by(Country.name))
    return list(result.scalars().all())


@router.get("/{country_id}", response_model=CountryRead)
async def get_country(country_id: int, db: AsyncSession = Depends(get_db)) -> Country:
    country = await db.get(Country, country_id)
    if country is None:
        raise HTTPException(status_code=404, detail="Country not found")
    return country
