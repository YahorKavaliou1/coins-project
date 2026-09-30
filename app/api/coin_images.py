import asyncio

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_seller
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.coin import Coin
from app.models.coin_image import CoinImage
from app.models.user import User
from app.schemas.coin_image import CoinImageRead
from app.services.image_storage import (
    MAX_FILE_SIZE_BYTES,
    MAX_IMAGES_PER_COIN,
    ImageStorage,
    get_image_storage,
)

router = APIRouter(prefix="/coins", tags=["coin-images"])


@router.post("/{coin_id}/images", response_model=CoinImageRead, status_code=201)
@limiter.limit("30/minute")
async def upload_coin_image(
    request: Request,
    coin_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_seller),
    storage: ImageStorage = Depends(get_image_storage),
) -> CoinImage:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if coin.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You do not own this coin")

    position_result = await db.execute(
        select(func.count()).select_from(CoinImage).where(CoinImage.coin_id == coin_id)
    )
    position = position_result.scalar_one()
    if position >= MAX_IMAGES_PER_COIN:
        raise HTTPException(
            status_code=400, detail=f"A coin can have at most {MAX_IMAGES_PER_COIN} photos."
        )

    storage.validate_content_type(file.content_type)
    # One byte over the limit is enough to reject the file without reading all of it.
    data = await file.read(MAX_FILE_SIZE_BYTES + 1)
    storage.validate_size(data)

    # Decoding (CPU) and disk or network I/O: run in threads so they don't block the event loop.
    processed, ext = await asyncio.to_thread(storage.process_image, data)
    url = await asyncio.to_thread(storage.save_image_file, coin_id, processed, ext)

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
    storage: ImageStorage = Depends(get_image_storage),
) -> None:
    coin = await db.get(Coin, coin_id)
    if coin is None:
        raise HTTPException(status_code=404, detail="Coin not found")
    if coin.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You do not own this coin")

    image = await db.get(CoinImage, image_id)
    if image is None or image.coin_id != coin_id:
        raise HTTPException(status_code=404, detail="Image not found")

    await asyncio.to_thread(storage.delete_image_file, image.url)
    await db.delete(image)
    await db.commit()
