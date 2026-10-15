"""Create the card thumbnails of photos uploaded before thumbnails existed.

Usage:
    python -m app.scripts.make_thumbnails

Run it with the same DATABASE_URL and IMAGE_STORAGE/S3_* settings as the site, e.g. against
production from your machine with those variables set. Safe to run again: only photos
without a thumbnail are processed, one at a time.
"""

import asyncio
import io
import sys

from PIL import Image, ImageOps
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.coin_image import CoinImage
from app.services.image_storage import THUMBNAIL_EXT, get_image_storage, make_thumbnail


async def make_thumbnails() -> int:
    engine = create_async_engine(settings.database_url)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    storage = get_image_storage()
    created = failed = 0

    async with session_maker() as db:
        images = (
            (await db.execute(select(CoinImage).where(CoinImage.thumbnail_url.is_(None))))
            .scalars()
            .all()
        )
        print(f"Photos without a thumbnail: {len(images)}")
        for image in images:
            try:
                data = await asyncio.to_thread(storage.read_image_file, image.url)
                # Stored photos were already validated and made upright on upload.
                picture = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
                thumbnail = await asyncio.to_thread(make_thumbnail, picture)
                image.thumbnail_url = await asyncio.to_thread(
                    storage.save_image_file, image.coin_id, thumbnail, THUMBNAIL_EXT
                )
                await db.commit()
                created += 1
            except Exception as e:
                failed += 1
                print(f"  {image.url}: {e}")

    await engine.dispose()
    print(f"Created {created} thumbnails, {failed} failed.")
    return 1 if failed else 0


def main() -> None:
    sys.exit(asyncio.run(make_thumbnails()))


if __name__ == "__main__":
    main()
