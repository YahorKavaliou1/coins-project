from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.country import Country
from app.schemas.country import CountryCreate, CountryRead

router = APIRouter(prefix="/countries", tags=["countries"])


@router.get("", response_model=list[CountryRead])
async def list_countries(db: AsyncSession = Depends(get_db)) -> list[Country]:
    result = await db.execute(select(Country).order_by(Country.name))
    return list(result.scalars().all())


@router.post("", response_model=CountryRead, status_code=201)
async def create_country(data: CountryCreate, db: AsyncSession = Depends(get_db)) -> Country:
    # TODO: ограничить доступ ролью admin/moderator, когда появится система ролей
    country = Country(**data.model_dump())
    db.add(country)
    await db.commit()
    await db.refresh(country)
    return country


@router.get("/{country_id}", response_model=CountryRead)
async def get_country(country_id: int, db: AsyncSession = Depends(get_db)) -> Country:
    country = await db.get(Country, country_id)
    if country is None:
        raise HTTPException(status_code=404, detail="Country not found")
    return country
