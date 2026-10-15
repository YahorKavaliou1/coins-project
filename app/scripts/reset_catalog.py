"""Delete every lot to start the catalog over: coins, their photos (database rows and stored
files), orders, cart items and favourites. Accounts, countries and metals are kept.

Usage:
    python -m app.scripts.reset_catalog          # dry run: only shows what would be deleted
    python -m app.scripts.reset_catalog --yes    # deletes; cannot be undone

Run it with the same DATABASE_URL and IMAGE_STORAGE/S3_* settings as the site. Plain SQL,
so it works whichever migration the database is at.
"""

import argparse
import asyncio
import shutil
import sys
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.services.image_storage import AWSImageStorage, LocalImageStorage, get_image_storage

# Children first, so no foreign key is violated.
TABLES = ["order_items", "orders", "cart_items", "favourites", "coin_images", "coins"]


def _stored_photos() -> tuple[str, list[str]]:
    """Where the photos are, and every stored photo file (also those of failed uploads)."""
    storage = get_image_storage()
    if isinstance(storage, AWSImageStorage):
        prefix = f"{storage.prefix}/" if storage.prefix else ""
        keys: list[str] = []
        paginator = storage.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=storage.bucket, Prefix=prefix):
            keys.extend(obj["Key"] for obj in page.get("Contents", []))
        return f"bucket {storage.bucket}/{prefix}", keys
    root = LocalImageStorage.UPLOAD_ROOT
    files = [str(p) for p in root.glob("*/*") if p.is_file()]
    return str(root), files


def _delete_photos(paths: list[str]) -> None:
    storage = get_image_storage()
    if isinstance(storage, AWSImageStorage):
        for i, key in enumerate(paths, start=1):
            storage.client.delete_object(Bucket=storage.bucket, Key=key)
            if i % 100 == 0:
                print(f"  {i}/{len(paths)} files deleted")
        return
    for coin_dir in LocalImageStorage.UPLOAD_ROOT.iterdir():
        if coin_dir.is_dir():
            shutil.rmtree(coin_dir)


async def reset_catalog(confirmed: bool) -> int:
    engine = create_async_engine(settings.database_url)
    print(
        f"Database: {make_url(settings.database_url).host}/{make_url(settings.database_url).database}"
    )

    async with engine.connect() as conn:
        counts: dict[str, Any] = {
            table: (await conn.execute(text(f"SELECT count(*) FROM {table}"))).scalar_one()
            for table in TABLES
        }
    location, photos = await asyncio.to_thread(_stored_photos)
    for table in TABLES:
        print(f"  {table}: {counts[table]} rows")
    print(f"Photo files in {location}: {len(photos)}")

    if not confirmed:
        print("Dry run: nothing deleted. Run again with --yes to delete all of the above.")
        await engine.dispose()
        return 0

    # One transaction: either every row is gone or none is.
    async with engine.begin() as conn:
        for table in TABLES:
            await conn.execute(text(f"DELETE FROM {table}"))
    print("Database rows deleted.")
    await engine.dispose()

    # After the commit: if this fails, only unreferenced files remain; run again to finish.
    await asyncio.to_thread(_delete_photos, photos)
    print(f"Photo files deleted: {len(photos)}.")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--yes", action="store_true", help="really delete (default: dry run)")
    args = parser.parse_args()
    sys.exit(asyncio.run(reset_catalog(args.yes)))


if __name__ == "__main__":
    main()
