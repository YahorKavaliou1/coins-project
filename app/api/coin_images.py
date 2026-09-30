from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_seller
from app.db.session import get_db
from app.models.coin import Coin
from app.models.coin_image import CoinImage
from app.models.user import User
from app.schemas.coin_image import CoinImageRead
from app.services.image_storage import (
    delete_image_file,
    process_image,
    save_image_file,
    validate_content_type,
    validate_size,
)

router = APIRouter(prefix="/coins", tags=["coin-images"])


@router.post("/{coin_id}/images", response_model=CoinImageRead, status_code=201)
async def upload_coin_image(
    coin_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> CoinImage:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if coin.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You do not own this coin")

    validate_content_type(file.content_type)
    data = await file.read()
    validate_size(data)

    processed, ext = process_image(data)
    url = save_image_file(coin_id, processed, ext)

    position_result = await db.execute(
        select(func.count()).select_from(CoinImage).where(CoinImage.coin_id == coin_id)
    )
    position = position_result.scalar_one()

    image = CoinImage(coin_id=coin_id, url=url, position=position)
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return image


@router.delete("/{coin_id}/images/{image_id}", status_code=204)
async def delete_coin_image(
    coin_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
) -> None:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if coin.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You do not own this coin")

    image = await db.get(CoinImage, image_id)
    if image is None or image.coin_id != coin_id:
        raise HTTPException(status_code=404, detail="Image not found")

    delete_image_file(image.url)
    await db.delete(image)
    await db.commit()
