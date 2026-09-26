from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.metal import Metal
from app.schemas.metal import MetalRead

router = APIRouter(prefix="/metals", tags=["metals"])


@router.get("", response_model=list[MetalRead])
async def list_metals(db: AsyncSession = Depends(get_db)) -> list[Metal]:
    result = await db.execute(select(Metal).order_by(Metal.name))
    return list(result.scalars().all())


@router.get("/{metal_id}", response_model=MetalRead)
async def get_metal(metal_id: int, db: AsyncSession = Depends(get_db)) -> Metal:
    metal = await db.get(Metal, metal_id)
    if metal is None:
        raise HTTPException(status_code=404, detail="Metal not found")
    return metal
