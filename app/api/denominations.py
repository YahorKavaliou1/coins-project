from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.denomination import Denomination
from app.schemas.denomination import DenominationCreate, DenominationRead

router = APIRouter(prefix="/denominations", tags=["denominations"])


@router.get("", response_model=list[DenominationRead])
async def list_denominations(db: AsyncSession = Depends(get_db)) -> list[Denomination]:
    result = await db.execute(select(Denomination).order_by(Denomination.name))
    return list(result.scalars().all())


@router.post("", response_model=DenominationRead, status_code=201)
async def create_denomination(
    data: DenominationCreate, db: AsyncSession = Depends(get_db)
) -> Denomination:
    denomination = Denomination(**data.model_dump())
    db.add(denomination)
    await db.commit()
    await db.refresh(denomination)
    return denomination


@router.get("/{denomination_id}", response_model=DenominationRead)
async def get_denomination(
    denomination_id: int, db: AsyncSession = Depends(get_db)
) -> Denomination:
    denomination = await db.get(Denomination, denomination_id)
    if denomination is None:
        raise HTTPException(status_code=404, detail="Denomination not found")
    return denomination
